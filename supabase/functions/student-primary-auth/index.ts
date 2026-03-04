import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { matricule } = await req.json();
    if (!matricule) {
      return new Response(JSON.stringify({ error: "Matricule requis" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find student by matricule with class/niveau/cycle info
    const { data: eleve, error: eleveErr } = await supabaseAdmin
      .from("eleves")
      .select("id, nom, prenom, matricule, sexe, date_naissance, photo_url, statut, solde_cantine, option_cantine, classe_id, classes(id, nom, niveau_id, niveaux:niveau_id(id, nom, cycle_id, cycles:cycle_id(id, nom)))")
      .eq("matricule", matricule.trim().toUpperCase())
      .is("deleted_at", null)
      .maybeSingle();

    if (eleveErr) throw eleveErr;

    if (!eleve) {
      return new Response(JSON.stringify({ error: "Matricule introuvable. Vérifie bien ton matricule !" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check cycle is Primaire
    const cycleName = eleve.classes?.niveaux?.cycles?.nom;
    if (cycleName !== "Primaire") {
      return new Response(JSON.stringify({ 
        error: "Oups ! Cet espace est réservé aux grands du Primaire. Demande à ton maître/maîtresse. 🎒",
        not_primary: true
      }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check suspension
    if (eleve.statut === "suspendu") {
      return new Response(JSON.stringify({ 
        error: "Ton compte est suspendu. Demande à ton maître/maîtresse.",
        suspended: true
      }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate simple token
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

    // Log connection
    try {
      await supabaseAdmin.from("active_connections").insert({
        type: "eleve",
        ref_id: eleve.id,
        display_name: `${eleve.prenom} ${eleve.nom}`,
        classe_nom: eleve.classes?.nom || "",
        niveau_nom: eleve.classes?.niveaux?.nom || "",
        cycle_nom: cycleName || "",
        extra_info: { matricule: eleve.matricule, sexe: eleve.sexe, photo_url: eleve.photo_url, portal: "primaire" },
      });
    } catch (e) {
      console.error("Log error:", e);
    }

    return new Response(
      JSON.stringify({
        eleve: {
          id: eleve.id,
          nom: eleve.nom,
          prenom: eleve.prenom,
          matricule: eleve.matricule,
          sexe: eleve.sexe,
          date_naissance: eleve.date_naissance,
          photo_url: eleve.photo_url,
          statut: eleve.statut,
          solde_cantine: eleve.solde_cantine,
          option_cantine: eleve.option_cantine,
          classe_id: eleve.classe_id,
          classes: eleve.classes,
        },
        token,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("student-primary-auth error:", e);
    return new Response(
      JSON.stringify({ error: "Erreur serveur" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
