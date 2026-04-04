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
    const contentType = req.headers.get("content-type") || "";
    
    // Handle multipart form data for photo upload
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const code = formData.get("code") as string;
      const actionField = formData.get("action") as string;
      const photo = formData.get("photo") as File;

      if (!code || !photo) {
        return new Response(JSON.stringify({ error: "Paramètres manquants" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const supabaseAdmin = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      // Validate token
      let familleId: string;
      try {
        const decoded = atob(code);
        const parts = decoded.split(":");
        if (parts.length < 3) throw new Error("Invalid token");
        const tokenFamilleId = parts[0];
        const tokenTimestamp = parseInt(parts[1]);
        const tokenSignature = parts.slice(2).join(":");
        const encoder = new TextEncoder();
        const key = await crypto.subtle.importKey("raw", encoder.encode(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
        const tokenData = `${tokenFamilleId}:${tokenTimestamp}`;
        const expectedSig = await crypto.subtle.sign("HMAC", key, encoder.encode(tokenData));
        const expectedHex = Array.from(new Uint8Array(expectedSig)).map(b => b.toString(16).padStart(2, '0')).join('');
        if (tokenSignature !== expectedHex) throw new Error("Bad signature");
        if (Date.now() - tokenTimestamp > 24 * 60 * 60 * 1000) throw new Error("Token expired");
        familleId = tokenFamilleId;
      } catch {
        return new Response(JSON.stringify({ error: "Session expirée" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ─── PARENT PHOTO UPLOAD ───
      if (actionField === "upload_parent_photo") {
        const ext = photo.name?.split(".").pop() || "jpg";
        const path = `familles/${familleId}/parent_photo_${Date.now()}.${ext}`;
        const buffer = await photo.arrayBuffer();

        const { error: uploadErr } = await supabaseAdmin.storage
          .from("photos")
          .upload(path, new Uint8Array(buffer), { contentType: photo.type || "image/jpeg", upsert: true });

        if (uploadErr) throw uploadErr;

        const { data: signedData } = await supabaseAdmin.storage
          .from("photos")
          .createSignedUrl(path, 31536000);

        if (signedData?.signedUrl) {
          await supabaseAdmin
            .from("familles")
            .update({ photo_url: signedData.signedUrl, updated_at: new Date().toISOString() })
            .eq("id", familleId);

          return new Response(
            JSON.stringify({ success: true, photo_url: signedData.signedUrl }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        throw new Error("Échec de l'upload");
      }

      // ─── CHILD PHOTO UPLOAD (legacy) ───
      const eleve_id = formData.get("eleve_id") as string;
      if (!eleve_id) {
        return new Response(JSON.stringify({ error: "eleve_id manquant" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Verify child belongs to family
      const { data: enfant } = await supabaseAdmin
        .from("eleves")
        .select("id, famille_id")
        .eq("id", eleve_id)
        .eq("famille_id", familleId)
        .is("deleted_at", null)
        .maybeSingle();

      if (!enfant) {
        return new Response(JSON.stringify({ error: "Accès non autorisé" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Upload photo
      const ext2 = photo.name?.split(".").pop() || "jpg";
      const path2 = `eleves/${eleve_id}/photo_parent_${Date.now()}.${ext2}`;
      const buffer2 = await photo.arrayBuffer();

      const { error: uploadErr2 } = await supabaseAdmin.storage
        .from("photos")
        .upload(path2, new Uint8Array(buffer2), { contentType: photo.type || "image/jpeg", upsert: true });

      if (uploadErr2) throw uploadErr2;

      const { data: signedData2 } = await supabaseAdmin.storage
        .from("photos")
        .createSignedUrl(path2, 31536000);

      if (signedData2?.signedUrl) {
        await supabaseAdmin
          .from("eleves")
          .update({ photo_url: signedData2.signedUrl, updated_at: new Date().toISOString() })
          .eq("id", eleve_id);

        return new Response(
          JSON.stringify({ success: true, photo_url: signedData2.signedUrl }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      throw new Error("Échec de l'upload");
    }

    const { code, action, eleve_id, montant, type_paiement, description, type_service, items, total, notification_id } = await req.json();

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Validate HMAC token
    let familleId: string;
    try {
      const decoded = atob(code);
      const parts = decoded.split(":");
      if (parts.length < 3) throw new Error("Invalid token");
      const tokenFamilleId = parts[0];
      const tokenTimestamp = parseInt(parts[1]);
      const tokenSignature = parts.slice(2).join(":");

      // Verify HMAC
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        "raw",
        encoder.encode(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
      );
      const tokenData = `${tokenFamilleId}:${tokenTimestamp}`;
      const expectedSig = await crypto.subtle.sign("HMAC", key, encoder.encode(tokenData));
      const expectedHex = Array.from(new Uint8Array(expectedSig)).map(b => b.toString(16).padStart(2, '0')).join('');

      if (tokenSignature !== expectedHex) throw new Error("Bad signature");

      // Check token age (24h max)
      if (Date.now() - tokenTimestamp > 24 * 60 * 60 * 1000) throw new Error("Token expired");

      familleId = tokenFamilleId;
    } catch {
      return new Response(JSON.stringify({ error: "Session expirée" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify family exists
    const { data: famille } = await supabaseAdmin
      .from("familles")
      .select("id, solde_famille")
      .eq("id", familleId)
      .maybeSingle();

    if (!famille) {
      return new Response(JSON.stringify({ error: "Session expirée" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // familleId already set from token

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
        // Fetch ALL librairie articles (no level filter)
        const { data: arts } = await supabaseAdmin
          .from("articles")
          .select("id, nom, categorie, prix, stock, niveau_id")
          .gt("stock", 0)
          .order("categorie")
          .order("nom");
        articles = arts || [];
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

    // ─── NOTIFICATIONS (last 5) ───
    if (action === "notifications") {
      const { data: notifs, error: nErr } = await supabaseAdmin
        .from("parent_notifications")
        .select("id, titre, message, type, action_url, lu, created_at")
        .eq("famille_id", familleId)
        .order("created_at", { ascending: false })
        .limit(5);
      if (nErr) throw nErr;

      const { count: unreadCount } = await supabaseAdmin
        .from("parent_notifications")
        .select("id", { count: "exact", head: true })
        .eq("famille_id", familleId)
        .eq("lu", false);

      return new Response(
        JSON.stringify({ notifications: notifs || [], unread_count: unreadCount || 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── ALL NOTIFICATIONS (archive) ───
    if (action === "all_notifications") {
      const { data: notifs } = await supabaseAdmin
        .from("parent_notifications")
        .select("id, titre, message, type, action_url, lu, created_at")
        .eq("famille_id", familleId)
        .order("created_at", { ascending: false })
        .limit(100);

      return new Response(
        JSON.stringify({ notifications: notifs || [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── MARK NOTIFICATION READ ───
    if (action === "mark_notification_read") {
      // notification_id already parsed from body
      if (notification_id) {
        await supabaseAdmin
          .from("parent_notifications")
          .update({ lu: true })
          .eq("id", notification_id)
          .eq("famille_id", familleId);
      }
      return new Response(
        JSON.stringify({ success: true }),
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
        .select("id, nom, prenom, matricule, photo_url, photo_thumbnail_url, sexe, date_naissance, solde_cantine, classe_id, option_cantine, option_fournitures, uniforme_scolaire, uniforme_sport, uniforme_polo_lacoste, uniforme_karate, zone_transport_id, classes(nom, niveaux:niveau_id(nom, frais_scolarite, frais_inscription, frais_reinscription, frais_dossier, frais_assurance, cycles:cycle_id(nom, bareme))), zones_transport:zone_transport_id(nom, prix_mensuel)")
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

      // Fetch devoirs for this child's class
      let devoirs: any[] = [];
      let soumissions: any[] = [];
      if (classeId) {
        const { data: devoirsData } = await supabaseAdmin
          .from("devoirs")
          .select("id, titre, description, date_limite, type_devoir, note_max, sujet_url, sujet_nom, matieres:matiere_id(nom)")
          .eq("classe_id", classeId)
          .order("date_limite", { ascending: false })
          .limit(30);
        devoirs = devoirsData || [];

        if (devoirs.length > 0) {
          const devoirIds = devoirs.map((d: any) => d.id);
          const { data: soumsData } = await supabaseAdmin
            .from("soumissions_devoirs")
            .select("id, devoir_id, note, soumis_at, commentaire, fichier_nom")
            .eq("eleve_id", eleve_id)
            .in("devoir_id", devoirIds);
          soumissions = soumsData || [];

          // Also fetch quiz responses for quiz-type devoirs
          const quizDevoirIds = devoirs.filter((d: any) => d.type_devoir === 'quiz').map((d: any) => d.id);
          if (quizDevoirIds.length > 0) {
            const { data: quizData } = await supabaseAdmin
              .from("quiz_reponses")
              .select("id, devoir_id, score, score_max, soumis_at")
              .eq("eleve_id", eleve_id)
              .in("devoir_id", quizDevoirIds);
            // Merge quiz responses into soumissions format
            for (const qr of (quizData || [])) {
              soumissions.push({
                id: qr.id,
                devoir_id: qr.devoir_id,
                note: qr.score,
                soumis_at: qr.soumis_at,
                commentaire: null,
                fichier_nom: null,
                is_quiz: true,
                score_max: qr.score_max,
              });
            }
          }
        }
      }

      // Fetch emploi du temps for this child's class
      let emploiDuTemps: any[] = [];
      if (classeId) {
        const { data: edtData } = await supabaseAdmin
          .from("emploi_du_temps")
          .select("id, jour_semaine, heure_debut, heure_fin, salle, matieres:matiere_id(nom), employes:enseignant_id(prenom, nom)")
          .eq("classe_id", classeId)
          .order("jour_semaine")
          .order("heure_debut");
        emploiDuTemps = edtData || [];
      }

      // Fetch pointages (last 30 days)
      const thirtyDaysAgoDate = new Date();
      thirtyDaysAgoDate.setDate(thirtyDaysAgoDate.getDate() - 30);
      const { data: pointagesData } = await supabaseAdmin
        .from("pointages_eleves")
        .select("id, date_pointage, heure_arrivee, heure_depart, en_retard")
        .eq("eleve_id", eleve_id)
        .gte("date_pointage", thirtyDaysAgoDate.toISOString().split('T')[0])
        .order("date_pointage", { ascending: false });

      // Fetch notes for radar profile
      const { data: notesData } = await supabaseAdmin
        .from("notes")
        .select("*, matieres(nom, pole, coefficient), periodes(nom, ordre, est_rattrapage)")
        .eq("eleve_id", eleve_id)
        .order("created_at");

      // Fetch periodes
      const { data: periodesData } = await supabaseAdmin
        .from("periodes")
        .select("*")
        .order("ordre");

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
          devoirs,
          soumissions,
          emploiDuTemps,
          pointages: pointagesData || [],
          notes: notesData || [],
          periodes: periodesData || [],
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
