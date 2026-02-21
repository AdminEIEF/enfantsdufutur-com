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
    const { action, code, eleve_id, montant, type_service, description, ordre_id } = await req.json();

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ─── CREATE ORDER (from parent space) ───
    if (action === "create_ordre") {
      if (!code || !montant || montant <= 0 || !type_service) {
        return new Response(JSON.stringify({ error: "Paramètres manquants" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const allowedTypes = ["wallet", "librairie", "boutique", "cantine"];
      if (!allowedTypes.includes(type_service)) {
        return new Response(JSON.stringify({ error: "Type de service non autorisé" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Validate parent code
      const { data: famille } = await supabaseAdmin
        .from("familles")
        .select("id, nom_famille")
        .eq("code_acces", code?.trim()?.toUpperCase())
        .maybeSingle();

      if (!famille) {
        return new Response(JSON.stringify({ error: "Session expirée" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // If eleve_id provided, verify belongs to family
      if (eleve_id) {
        const { data: eleve } = await supabaseAdmin
          .from("eleves")
          .select("id")
          .eq("id", eleve_id)
          .eq("famille_id", famille.id)
          .is("deleted_at", null)
          .maybeSingle();
        if (!eleve) {
          return new Response(JSON.stringify({ error: "Élève non trouvé" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      const codeTransaction = "ORD-" + Math.random().toString(36).substring(2, 10).toUpperCase();

      const { data: ordre, error } = await supabaseAdmin
        .from("ordres_paiement")
        .insert({
          famille_id: famille.id,
          eleve_id: eleve_id || null,
          type_service,
          montant,
          description: description || null,
          code_transaction: codeTransaction,
          statut: "en_attente",
          canal: "ordre_parent",
        })
        .select()
        .single();

      if (error) throw error;

      return new Response(
        JSON.stringify({ ordre, message: "Ordre créé avec succès" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── GET ORDERS (for parent) ───
    if (action === "get_ordres") {
      if (!code) {
        return new Response(JSON.stringify({ error: "Code manquant" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: famille } = await supabaseAdmin
        .from("familles")
        .select("id")
        .eq("code_acces", code?.trim()?.toUpperCase())
        .maybeSingle();

      if (!famille) {
        return new Response(JSON.stringify({ error: "Session expirée" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: ordres } = await supabaseAdmin
        .from("ordres_paiement")
        .select("*, eleves:eleve_id(prenom, nom)")
        .eq("famille_id", famille.id)
        .order("created_at", { ascending: false })
        .limit(30);

      return new Response(
        JSON.stringify({ ordres: ordres || [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── VALIDATE ORDER (from comptabilité) ───
    if (action === "validate_ordre") {
      if (!ordre_id) {
        return new Response(JSON.stringify({ error: "ID ordre manquant" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: ordre, error: ordreErr } = await supabaseAdmin
        .from("ordres_paiement")
        .select("*, eleves:eleve_id(prenom, nom), familles:famille_id(nom_famille)")
        .eq("id", ordre_id)
        .eq("statut", "en_attente")
        .maybeSingle();

      if (ordreErr) throw ordreErr;
      if (!ordre) {
        return new Response(JSON.stringify({ error: "Ordre non trouvé ou déjà traité" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Update order status
      await supabaseAdmin
        .from("ordres_paiement")
        .update({ statut: "valide", validated_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", ordre_id);

      // Handle based on type_service
      const typeService = ordre.type_service;

      if (typeService === "wallet") {
        // Credit family wallet: create a wallet payment (triggers credit_famille_wallet)
        // Need any eleve_id from the family
        let eleveId = ordre.eleve_id;
        if (!eleveId) {
          const { data: firstChild } = await supabaseAdmin
            .from("eleves")
            .select("id")
            .eq("famille_id", ordre.famille_id)
            .is("deleted_at", null)
            .limit(1)
            .maybeSingle();
          eleveId = firstChild?.id;
        }
        if (eleveId) {
          await supabaseAdmin.from("paiements").insert({
            eleve_id: eleveId,
            montant: ordre.montant,
            type_paiement: "wallet",
            canal: "especes",
            mois_concerne: "Recharge portefeuille",
          });
        }
      } else if (typeService === "cantine") {
        // Same as cantine-ordre validation
        if (ordre.eleve_id) {
          await supabaseAdmin.from("paiements").insert({
            eleve_id: ordre.eleve_id,
            montant: ordre.montant,
            type_paiement: "cantine",
            canal: "especes",
            mois_concerne: "Recharge ordonnée",
          });
        }
      } else {
        // librairie / boutique → credit wallet then debit for the service
        let eleveId = ordre.eleve_id;
        if (!eleveId) {
          const { data: firstChild } = await supabaseAdmin
            .from("eleves")
            .select("id")
            .eq("famille_id", ordre.famille_id)
            .is("deleted_at", null)
            .limit(1)
            .maybeSingle();
          eleveId = firstChild?.id;
        }
        if (eleveId) {
          // Record as direct payment for this service
          await supabaseAdmin.from("paiements").insert({
            eleve_id: eleveId,
            montant: ordre.montant,
            type_paiement: typeService,
            canal: "especes",
            mois_concerne: ordre.description || `Ordre ${typeService}`,
          });
        }
      }

      // Notify parent
      const typeLabels: Record<string, string> = {
        wallet: "Recharge Portefeuille", librairie: "Librairie", boutique: "Boutique", cantine: "Cantine",
      };
      await supabaseAdmin.from("parent_notifications").insert({
        famille_id: ordre.famille_id,
        titre: `✅ Ordre ${typeLabels[typeService] || typeService} validé`,
        message: `Votre ordre de ${Number(ordre.montant).toLocaleString()} GNF (${typeLabels[typeService] || typeService})${ordre.eleves ? ` pour ${(ordre as any).eleves.prenom} ${(ordre as any).eleves.nom}` : ''} a été validé.`,
        type: "paiement",
      });

      return new Response(
        JSON.stringify({ success: true, message: "Ordre validé" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── CANCEL ORDER ───
    if (action === "cancel_ordre") {
      if (!ordre_id) {
        return new Response(JSON.stringify({ error: "ID ordre manquant" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await supabaseAdmin
        .from("ordres_paiement")
        .update({ statut: "annule", updated_at: new Date().toISOString() })
        .eq("id", ordre_id)
        .eq("statut", "en_attente");

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ error: "Action inconnue" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("service-ordre error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erreur serveur" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
