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
    const { code } = await req.json();
    if (!code || typeof code !== "string" || code.trim().length < 4) {
      return new Response(JSON.stringify({ error: "Code d'accès invalide" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Look up family by plain-text code match
    const codeUpper = code.trim().toUpperCase();
    const { data: familles, error: famErr } = await supabaseAdmin
      .from("familles")
      .select("*")
      .eq("code_acces", codeUpper)
      .limit(1);

    if (famErr) throw famErr;
    
    const famille = familles && familles.length > 0 ? familles[0] : null;
    
    if (!famille) {
      return new Response(JSON.stringify({ error: "Code d'accès incorrect" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    return new Response(
      JSON.stringify({ famille, eleves: eleves || [], token }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("parent-auth error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erreur serveur" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
