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

    const { data: eleve } = await supabaseAdmin
      .from("eleves")
      .select("id, nom, prenom, photo_url, classes(nom, niveaux:niveau_id(nom, cycles:cycle_id(nom)))")
      .eq("matricule", matricule.trim().toUpperCase())
      .is("deleted_at", null)
      .maybeSingle();

    if (!eleve) {
      return new Response(JSON.stringify({ found: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate signed URL for photo if it's a private bucket path
    let photoUrl = eleve.photo_url;
    if (photoUrl && photoUrl.startsWith("photos/")) {
      const { data: signedData } = await supabaseAdmin.storage
        .from("photos")
        .createSignedUrl(photoUrl.replace("photos/", ""), 300);
      if (signedData?.signedUrl) photoUrl = signedData.signedUrl;
    }

    return new Response(
      JSON.stringify({
        found: true,
        prenom: eleve.prenom,
        nom: eleve.nom,
        photo_url: photoUrl,
        classe: eleve.classes?.nom || "",
        niveau: eleve.classes?.niveaux?.nom || "",
        cycle: eleve.classes?.niveaux?.cycles?.nom || "",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("student-preview error:", e);
    return new Response(
      JSON.stringify({ error: "Erreur serveur" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
