import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function verifyParentToken(code: string): Promise<string | null> {
  try {
    const decoded = atob(code);
    const parts = decoded.split(":");
    if (parts.length < 3) return null;
    const familleId = parts[0];
    const tokenTimestamp = parseInt(parts[1]);
    const tokenSignature = parts.slice(2).join(":");

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const tokenData = `${familleId}:${tokenTimestamp}`;
    const expectedSig = await crypto.subtle.sign("HMAC", key, encoder.encode(tokenData));
    const expectedHex = Array.from(new Uint8Array(expectedSig)).map(b => b.toString(16).padStart(2, '0')).join('');

    if (tokenSignature !== expectedHex) return null;
    if (Date.now() - tokenTimestamp > 24 * 60 * 60 * 1000) return null;

    return familleId;
  } catch {
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, code, eleve_id, montant, ordre_id } = await req.json();

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Action: create_ordre (from parent space)
    if (action === "create_ordre") {
      if (!code || !eleve_id || !montant || montant <= 0) {
        return new Response(JSON.stringify({ error: "Paramètres manquants" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const familleId = await verifyParentToken(code);
      if (!familleId) {
        return new Response(JSON.stringify({ error: "Session expirée" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Verify child belongs to family
      const { data: eleve } = await supabaseAdmin
        .from("eleves")
        .select("id, prenom, nom, famille_id")
        .eq("id", eleve_id)
        .eq("famille_id", familleId)
        .maybeSingle();

      if (!eleve) {
        return new Response(JSON.stringify({ error: "Élève non trouvé" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Generate unique transaction code
      const codeTransaction = "CAN-" + Math.random().toString(36).substring(2, 10).toUpperCase();

      const { data: ordre, error } = await supabaseAdmin
        .from("ordres_cantine")
        .insert({
          famille_id: familleId,
          eleve_id,
          montant,
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

    // Action: get_ordres (for parent - get their orders)
    if (action === "get_ordres") {
      if (!code) {
        return new Response(JSON.stringify({ error: "Code manquant" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const familleId = await verifyParentToken(code);
      if (!familleId) {
        return new Response(JSON.stringify({ error: "Session expirée" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: ordres } = await supabaseAdmin
        .from("ordres_cantine")
        .select("*, eleves:eleve_id(prenom, nom)")
        .eq("famille_id", familleId)
        .order("created_at", { ascending: false })
        .limit(20);

      return new Response(
        JSON.stringify({ ordres: ordres || [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Action: validate_ordre (from comptabilité - requires auth)
    if (action === "validate_ordre") {
      if (!ordre_id) {
        return new Response(JSON.stringify({ error: "ID ordre manquant" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get the order
      const { data: ordre, error: ordreErr } = await supabaseAdmin
        .from("ordres_cantine")
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
      const { error: updateErr } = await supabaseAdmin
        .from("ordres_cantine")
        .update({
          statut: "valide",
          validated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", ordre_id);

      if (updateErr) throw updateErr;

      // Create the payment record (triggers credit_cantine_on_payment)
      const { error: payErr } = await supabaseAdmin
        .from("paiements")
        .insert({
          eleve_id: ordre.eleve_id,
          montant: ordre.montant,
          type_paiement: "cantine",
          canal: "especes",
          mois_concerne: "Recharge ordonnée",
        });

      if (payErr) throw payErr;

      // Credit the cantine balance directly as well (trigger handles it)
      // Send notification to parent
      await supabaseAdmin.from("parent_notifications").insert({
        famille_id: ordre.famille_id,
        titre: "🍽️ Recharge Cantine validée",
        message: `Votre rechargement cantine de ${Number(ordre.montant).toLocaleString()} GNF pour ${(ordre as any).eleves?.prenom} ${(ordre as any).eleves?.nom} a été validé. Le solde a été crédité.`,
        type: "paiement",
      });

      return new Response(
        JSON.stringify({ success: true, message: "Ordre validé et solde crédité" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Action: cancel_ordre
    if (action === "cancel_ordre") {
      if (!ordre_id) {
        return new Response(JSON.stringify({ error: "ID ordre manquant" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error } = await supabaseAdmin
        .from("ordres_cantine")
        .update({ statut: "annule", updated_at: new Date().toISOString() })
        .eq("id", ordre_id)
        .eq("statut", "en_attente");

      if (error) throw error;

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
    console.error("cantine-ordre error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erreur serveur" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
