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
    const { code, action, eleve_id, montant, type_paiement, description, type_service, items, total } = await req.json();

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Validate code
    const { data: famille, error: famErr } = await supabaseAdmin
      .from("familles")
      .select("id, solde_famille")
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

    // ─── DEBIT WALLET ACTION ───
    if (action === "debit_wallet") {
      if (!eleve_id || !montant || !type_paiement) {
        return new Response(JSON.stringify({ error: "Paramètres manquants (eleve_id, montant, type_paiement)" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!childIds.includes(eleve_id)) {
        return new Response(JSON.stringify({ error: "Accès non autorisé à cet élève" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const numMontant = Number(montant);
      if (isNaN(numMontant) || numMontant <= 0 || numMontant > 100000000) {
        return new Response(JSON.stringify({ error: "Montant invalide" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const allowedTypes = ["scolarite", "transport", "cantine", "boutique", "librairie", "fournitures", "inscription", "reinscription", "autre"];
      if (!allowedTypes.includes(type_paiement)) {
        return new Response(JSON.stringify({ error: "Type de paiement non autorisé" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: result, error: rpcErr } = await supabaseAdmin.rpc("debit_famille_wallet", {
        _famille_id: familleId,
        _montant: numMontant,
        _eleve_id: eleve_id,
        _type_paiement: type_paiement,
        _description: description || null,
      });

      if (rpcErr) throw rpcErr;

      const rpcResult = result as any;
      if (!rpcResult?.success) {
        return new Response(JSON.stringify({ error: rpcResult?.error || "Échec du débit" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(
        JSON.stringify({ success: true, paiement_id: rpcResult.paiement_id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── CATALOGUE (fetch articles for parent ordering) ───
    if (action === "catalogue") {
      let articles: any[] = [];

      if (type_service === "librairie") {
        // Fetch articles for the child's level
        if (!eleve_id || !childIds.includes(eleve_id)) {
          return new Response(JSON.stringify({ articles: [] }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const { data: eleveData } = await supabaseAdmin
          .from("eleves")
          .select("classes(niveau_id)")
          .eq("id", eleve_id)
          .maybeSingle();
        const niveauId = (eleveData as any)?.classes?.niveau_id;
        if (niveauId) {
          const { data: arts } = await supabaseAdmin
            .from("articles")
            .select("id, nom, categorie, prix, stock, niveau_id")
            .eq("niveau_id", niveauId)
            .gt("stock", 0);
          articles = arts || [];
        }
      } else if (type_service === "boutique") {
        const { data: arts } = await supabaseAdmin
          .from("boutique_articles")
          .select("id, nom, categorie, prix, stock, taille")
          .gt("stock", 0)
          .order("categorie")
          .order("nom");
        articles = arts || [];
      }

      return new Response(
        JSON.stringify({ articles }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── COMMANDER ARTICLES (parent places order, debits wallet) ───
    if (action === "commander_articles") {
      if (!eleve_id || !items || !Array.isArray(items) || items.length === 0 || !type_service || !total) {
        return new Response(JSON.stringify({ error: "Paramètres manquants" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!childIds.includes(eleve_id)) {
        return new Response(JSON.stringify({ error: "Accès non autorisé" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const numTotal = Number(total);
      if (isNaN(numTotal) || numTotal <= 0) {
        return new Response(JSON.stringify({ error: "Total invalide" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Verify server-side total
      let serverTotal = 0;
      for (const item of items) {
        serverTotal += Number(item.prix_unitaire) * Number(item.quantite);
      }
      if (Math.abs(serverTotal - numTotal) > 1) {
        return new Response(JSON.stringify({ error: "Incohérence du montant total" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check wallet balance
      const { data: freshFamille } = await supabaseAdmin
        .from("familles")
        .select("solde_famille")
        .eq("id", familleId)
        .single();
      
      if (!freshFamille || Number(freshFamille.solde_famille) < numTotal) {
        return new Response(JSON.stringify({ error: `Solde insuffisant. Solde actuel: ${Number(freshFamille?.solde_famille || 0).toLocaleString()} GNF` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Debit wallet
      const { data: debitResult, error: debitErr } = await supabaseAdmin.rpc("debit_famille_wallet", {
        _famille_id: familleId,
        _montant: numTotal,
        _eleve_id: eleve_id,
        _type_paiement: type_service === "boutique" ? "boutique" : "librairie",
        _description: `Commande ${type_service} (${items.length} article${items.length > 1 ? 's' : ''})`,
      });

      if (debitErr) throw debitErr;
      const debitRes = debitResult as any;
      if (!debitRes?.success) {
        return new Response(JSON.stringify({ error: debitRes?.error || "Échec du débit" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Create commandes_articles entries (status: paye - stock NOT deducted yet)
      const commandeRows = items.map((item: any) => ({
        eleve_id,
        article_nom: item.article_nom,
        article_taille: item.article_taille || null,
        article_type: type_service,
        quantite: Number(item.quantite),
        prix_unitaire: Number(item.prix_unitaire),
        source: "commande_parent",
        statut: "paye",
      }));

      const { error: insertErr } = await supabaseAdmin
        .from("commandes_articles")
        .insert(commandeRows);

      if (insertErr) throw insertErr;

      // Notify parent
      await supabaseAdmin.from("parent_notifications").insert({
        famille_id: familleId,
        titre: `🛒 Commande ${type_service} validée`,
        message: `Votre commande de ${numTotal.toLocaleString()} GNF (${items.length} article${items.length > 1 ? 's' : ''}) a été payée. Présentez-vous à l'école pour récupérer les articles.`,
        type: "commande",
      });

      return new Response(
        JSON.stringify({ success: true, message: "Commande validée" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── DASHBOARD ───
    if (action === "dashboard") {
      const { data: paiements } = await supabaseAdmin
        .from("paiements")
        .select("*")
        .in("eleve_id", childIds)
        .order("date_paiement", { ascending: false });

      const { data: eleves } = await supabaseAdmin
        .from("eleves")
        .select("id, nom, prenom, matricule, solde_cantine, classe_id, option_cantine, option_fournitures, uniforme_scolaire, uniforme_sport, uniforme_polo_lacoste, uniforme_karate, zone_transport_id, classes(nom, niveaux:niveau_id(nom, frais_scolarite, frais_inscription, frais_reinscription, frais_dossier, frais_assurance, cycles:cycle_id(nom))), zones_transport:zone_transport_id(nom, prix_mensuel)")
        .eq("famille_id", familleId)
        .is("deleted_at", null);

      const { data: tarifs } = await supabaseAdmin
        .from("tarifs")
        .select("*");

      const { data: familleData } = await supabaseAdmin
        .from("familles")
        .select("solde_famille")
        .eq("id", familleId)
        .maybeSingle();

      return new Response(
        JSON.stringify({
          paiements: paiements || [],
          eleves: eleves || [],
          tarifs: tarifs || [],
          solde_famille: Number(familleData?.solde_famille || 0),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── ENFANT DETAIL ───
    if (action === "enfant" && eleve_id) {
      if (!childIds.includes(eleve_id)) {
        return new Response(JSON.stringify({ error: "Accès non autorisé" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: paiements } = await supabaseAdmin
        .from("paiements")
        .select("*")
        .eq("eleve_id", eleve_id)
        .order("date_paiement", { ascending: false });

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const { data: repas } = await supabaseAdmin
        .from("repas_cantine")
        .select("*")
        .eq("eleve_id", eleve_id)
        .gte("date_repas", thirtyDaysAgo.toISOString())
        .order("date_repas", { ascending: false });

      const { data: ventesArticles } = await supabaseAdmin
        .from("ventes_articles")
        .select("*, articles:article_id(nom, categorie)")
        .eq("eleve_id", eleve_id)
        .order("created_at", { ascending: false });

      const { data: boutiqueVentes } = await supabaseAdmin
        .from("boutique_ventes")
        .select("*, boutique_vente_items(*, boutique_articles:article_id(nom, categorie, taille))")
        .eq("eleve_id", eleve_id)
        .order("created_at", { ascending: false });

      const { data: commandesArticles } = await supabaseAdmin
        .from("commandes_articles")
        .select("*")
        .eq("eleve_id", eleve_id)
        .order("created_at", { ascending: false });

      const { data: eleveData } = await supabaseAdmin
        .from("eleves")
        .select("classe_id, solde_cantine, classes(niveau_id)")
        .eq("id", eleve_id)
        .maybeSingle();

      const solde_cantine = (eleveData as any)?.solde_cantine || 0;

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
          solde_cantine,
          paiements: paiements || [],
          repas: repas || [],
          ventesArticles: ventesArticles || [],
          boutiqueVentes: boutiqueVentes || [],
          commandesArticles: commandesArticles || [],
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
