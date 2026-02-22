import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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
      return new Response(JSON.stringify({ error: "Matricule introuvable" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check password
    if (!eleve.mot_de_passe_eleve || eleve.mot_de_passe_eleve !== password.trim()) {
      return new Response(JSON.stringify({ error: "Mot de passe incorrect" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    return new Response(
      JSON.stringify({ eleve: eleveData, token }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("student-auth error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erreur serveur" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
