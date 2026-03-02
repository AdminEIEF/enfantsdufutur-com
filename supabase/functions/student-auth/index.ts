import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// In-memory rate limiting
const attempts = new Map<string, { count: number; lockUntil: number }>();

function checkRateLimit(key: string): { blocked: boolean; retryAfter?: number } {
  const now = Date.now();
  const record = attempts.get(key);
  if (!record) return { blocked: false };
  if (record.lockUntil > now) {
    return { blocked: true, retryAfter: Math.ceil((record.lockUntil - now) / 1000) };
  }
  if (record.lockUntil <= now && record.count >= 5) {
    attempts.delete(key);
  }
  return { blocked: false };
}

function recordFailedAttempt(key: string) {
  const now = Date.now();
  const record = attempts.get(key) || { count: 0, lockUntil: 0 };
  record.count++;
  if (record.count >= 5) {
    record.lockUntil = now + 15 * 60 * 1000;
  }
  attempts.set(key, record);
}

function clearAttempts(key: string) {
  attempts.delete(key);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { matricule, password } = await req.json();
    if (!matricule || !password) {
      return new Response(JSON.stringify({ error: "Matricule et mot de passe requis" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Rate limiting
    const clientIP = req.headers.get("x-forwarded-for") || "unknown";
    const rateLimitKey = `student:${clientIP}:${matricule.trim().toUpperCase()}`;
    const rateCheck = checkRateLimit(rateLimitKey);
    if (rateCheck.blocked) {
      return new Response(
        JSON.stringify({ error: `Trop de tentatives. Réessayez dans ${Math.ceil((rateCheck.retryAfter || 900) / 60)} minutes.` }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find student by matricule
    const { data: eleve, error: eleveErr } = await supabaseAdmin
      .from("eleves")
      .select("id, nom, prenom, matricule, sexe, date_naissance, photo_url, statut, solde_cantine, option_cantine, option_fournitures, mot_de_passe_eleve, classe_id, classes(id, nom, niveau_id, niveaux:niveau_id(id, nom, cycle_id, cycles:cycle_id(id, nom, bareme)))")
      .eq("matricule", matricule.trim().toUpperCase())
      .is("deleted_at", null)
      .maybeSingle();

    if (eleveErr) throw eleveErr;
    if (!eleve) {
      recordFailedAttempt(rateLimitKey);
      return new Response(JSON.stringify({ error: "Matricule introuvable" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check password using bcrypt verification
    if (!eleve.mot_de_passe_eleve) {
      return new Response(JSON.stringify({ error: "Mot de passe non configuré" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    const { data: pwCheck } = await supabaseAdmin.rpc('verify_password', {
      _hash: eleve.mot_de_passe_eleve,
      _password: password.trim()
    });
    
    if (!pwCheck) {
      recordFailedAttempt(rateLimitKey);
      return new Response(JSON.stringify({ error: "Mot de passe incorrect" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    clearAttempts(rateLimitKey);

    // Check suspension
    if (eleve.statut === 'suspendu') {
      return new Response(JSON.stringify({ 
        error: "Veuillez régulariser votre situation à la comptabilité.",
        suspended: true
      }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate a session token (HMAC of eleve_id + timestamp)
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const tokenData = `${eleve.id}:${Date.now()}`;
    const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(tokenData));
    const token = btoa(tokenData + ":" + Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join(''));

    // Remove password from response
    const { mot_de_passe_eleve, ...eleveData } = eleve;

    // Log connection for monitoring
    try {
      const classeNom = eleve.classes?.nom || '';
      const niveauNom = eleve.classes?.niveaux?.nom || '';
      const cycleNom = eleve.classes?.niveaux?.cycles?.nom || '';
      await supabaseAdmin.from('active_connections').insert({
        type: 'eleve',
        ref_id: eleve.id,
        display_name: `${eleve.prenom} ${eleve.nom}`,
        classe_nom: classeNom,
        niveau_nom: niveauNom,
        cycle_nom: cycleNom,
        extra_info: { matricule: eleve.matricule, sexe: eleve.sexe, photo_url: eleve.photo_url },
      });
    } catch (logErr) {
      console.error("Connection log error:", logErr);
    }

    return new Response(
      JSON.stringify({ eleve: eleveData, token }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("student-auth error:", e);
    return new Response(
      JSON.stringify({ error: "Erreur serveur" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
