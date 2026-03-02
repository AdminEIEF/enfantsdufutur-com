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
    record.lockUntil = now + 15 * 60 * 1000; // 15 min lockout
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
    const { code } = await req.json();
    if (!code || typeof code !== "string" || code.trim().length < 6) {
      return new Response(JSON.stringify({ error: "Code d'accès invalide (6 caractères minimum)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Rate limiting by IP + code
    const clientIP = req.headers.get("x-forwarded-for") || "unknown";
    const rateLimitKey = `parent:${clientIP}`;
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

    // Look up all families with a code and verify with bcrypt
    const codeUpper = code.trim().toUpperCase();
    const { data: familles, error: famErr } = await supabaseAdmin
      .from("familles")
      .select("*")
      .not("code_acces", "is", null);

    if (famErr) throw famErr;
    
    let famille = null;
    for (const f of familles || []) {
      const { data: match } = await supabaseAdmin.rpc('verify_password', {
        _hash: f.code_acces,
        _password: codeUpper
      });
      if (match) {
        famille = f;
        break;
      }
    }
    
    if (!famille) {
      recordFailedAttempt(rateLimitKey);
      return new Response(JSON.stringify({ error: "Code d'accès incorrect" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    clearAttempts(rateLimitKey);

    // Fetch children with class info
    const { data: eleves, error: elevesErr } = await supabaseAdmin
      .from("eleves")
      .select("id, nom, prenom, matricule, sexe, date_naissance, photo_url, statut, solde_cantine, option_cantine, option_fournitures, classe_id, classes(nom, niveaux:niveau_id(id, nom, frais_scolarite, cycles:cycle_id(nom))), zone_transport_id, zones_transport:zone_transport_id(nom, prix_mensuel, chauffeur_bus, telephone_chauffeur)")
      .eq("famille_id", famille.id)
      .is("deleted_at", null)
      .order("prenom");

    if (elevesErr) throw elevesErr;

    // Generate a session token
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const tokenData = `${famille.id}:${Date.now()}`;
    const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(tokenData));
    const token = btoa(tokenData + ":" + Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join(''));

    // Log connection for monitoring
    try {
      const enfantsNoms = (eleves || []).map((e: any) => `${e.prenom} ${e.nom}`).join(', ');
      await supabaseAdmin.from('active_connections').insert({
        type: 'parent',
        ref_id: famille.id,
        display_name: famille.nom_famille,
        email: famille.email_parent,
        extra_info: { telephone_pere: famille.telephone_pere, telephone_mere: famille.telephone_mere, enfants: enfantsNoms, nb_enfants: (eleves || []).length },
      });
    } catch (logErr) {
      console.error("Connection log error:", logErr);
    }

    return new Response(
      JSON.stringify({ famille, eleves: eleves || [], token }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("parent-auth error:", e);
    return new Response(
      JSON.stringify({ error: "Erreur serveur" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
