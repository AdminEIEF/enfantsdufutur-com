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
    const { code, action, eleve_id } = await req.json();

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Validate code
    const { data: famille, error: famErr } = await supabaseAdmin
      .from("familles")
      .select("id")
      .eq("code_acces", code?.trim()?.toUpperCase())
      .maybeSingle();

    if (famErr) throw famErr;
    if (!famille) {
      return new Response(JSON.stringify({ error: "Session expirée" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const familleId = famille.id;

    // Get all children IDs for this family
    const { data: enfantsIds } = await supabaseAdmin
      .from("eleves")
      .select("id")
      .eq("famille_id", familleId)
      .is("deleted_at", null);

    const childIds = (enfantsIds || []).map((e: any) => e.id);

    if (action === "dashboard") {
      // Fetch all payments for the family's children
      const { data: paiements } = await supabaseAdmin
        .from("paiements")
        .select("*")
        .in("eleve_id", childIds)
        .order("date_paiement", { ascending: false });

      // Fetch niveaux for fee calculation
      const { data: eleves } = await supabaseAdmin
        .from("eleves")
        .select("id, nom, prenom, matricule, solde_cantine, classe_id, option_cantine, option_fournitures, uniforme_scolaire, uniforme_sport, uniforme_polo_lacoste, uniforme_karate, zone_transport_id, classes(nom, niveaux:niveau_id(nom, frais_scolarite, frais_inscription, frais_reinscription, frais_dossier, frais_assurance, cycles:cycle_id(nom))), zones_transport:zone_transport_id(nom, prix_mensuel)")
        .eq("famille_id", familleId)
        .is("deleted_at", null);

      // Fetch all tarifs (uniforms, assurance, etc.)
      const { data: tarifs } = await supabaseAdmin
        .from("tarifs")
        .select("*");

      return new Response(
        JSON.stringify({ paiements: paiements || [], eleves: eleves || [], tarifs: tarifs || [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "enfant" && eleve_id) {
      // Verify this child belongs to the family
      if (!childIds.includes(eleve_id)) {
        return new Response(JSON.stringify({ error: "Accès non autorisé" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Fetch child payments
      const { data: paiements } = await supabaseAdmin
        .from("paiements")
        .select("*")
        .eq("eleve_id", eleve_id)
        .order("date_paiement", { ascending: false });

      // Fetch cantine meals (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const { data: repas } = await supabaseAdmin
        .from("repas_cantine")
        .select("*")
        .eq("eleve_id", eleve_id)
        .gte("date_repas", thirtyDaysAgo.toISOString())
        .order("date_repas", { ascending: false });

      // Fetch librairie purchases
      const { data: ventesArticles } = await supabaseAdmin
        .from("ventes_articles")
        .select("*, articles:article_id(nom, categorie)")
        .eq("eleve_id", eleve_id)
        .order("created_at", { ascending: false });

      // Fetch boutique purchases
      const { data: boutiqueVentes } = await supabaseAdmin
        .from("boutique_ventes")
        .select("*, boutique_vente_items(*, boutique_articles:article_id(nom, categorie, taille))")
        .eq("eleve_id", eleve_id)
        .order("created_at", { ascending: false });

      // Fetch available articles for the child's level
      const { data: eleveData } = await supabaseAdmin
        .from("eleves")
        .select("classe_id, classes(niveau_id)")
        .eq("id", eleve_id)
        .maybeSingle();

      const niveauId = (eleveData as any)?.classes?.niveau_id;
      const classeId = eleveData?.classe_id;
      let articlesNiveau: any[] = [];
      if (niveauId) {
        const { data: arts } = await supabaseAdmin
          .from("articles")
          .select("id, nom, categorie")
          .eq("niveau_id", niveauId);
        articlesNiveau = arts || [];
      }

      // Fetch bulletin publications visible to parents for this child's class
      let bulletinPublications: any[] = [];
      if (classeId) {
        const { data: pubs } = await supabaseAdmin
          .from("bulletin_publications")
          .select("*, periodes:periode_id(nom, ordre)")
          .eq("classe_id", classeId)
          .eq("visible_parent", true)
          .order("created_at", { ascending: false });
        bulletinPublications = pubs || [];
      }

      return new Response(
        JSON.stringify({
          paiements: paiements || [],
          repas: repas || [],
          ventesArticles: ventesArticles || [],
          boutiqueVentes: boutiqueVentes || [],
          articlesNiveau,
          bulletinPublications,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ error: "Action inconnue" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("parent-data error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erreur serveur" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
