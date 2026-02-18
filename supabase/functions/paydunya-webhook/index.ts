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
    const body = await req.json();
    console.log("PayDunya webhook received:", JSON.stringify(body));

    const { data } = body;
    if (!data) {
      return new Response(JSON.stringify({ error: "No data" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate with PayDunya - confirm the transaction
    const masterKey = Deno.env.get("PAYDUNYA_MASTER_KEY")!;
    const privateKey = Deno.env.get("PAYDUNYA_PRIVATE_KEY")!;
    const token = Deno.env.get("PAYDUNYA_TOKEN")!;

    const paydunyaHeaders = {
      "Content-Type": "application/json",
      "PAYDUNYA-MASTER-KEY": masterKey,
      "PAYDUNYA-PRIVATE-KEY": privateKey,
      "PAYDUNYA-TOKEN": token,
    };

    // Verify the invoice with PayDunya
    const invoiceToken = data.invoice?.token || body.invoice?.token || data.token;
    if (!invoiceToken) {
      console.error("No invoice token in webhook");
      return new Response(JSON.stringify({ error: "Missing token" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const verifyResp = await fetch(
      `https://app.paydunya.com/api/v1/checkout-invoice/confirm/${invoiceToken}`,
      { headers: paydunyaHeaders }
    );
    const verifyData = await verifyResp.json();

    if (verifyData.status !== "completed") {
      console.log("Payment not completed:", verifyData.status);
      return new Response(JSON.stringify({ status: "pending" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Extract custom data
    const customData = verifyData.custom_data || {};
    const eleveId = customData.eleve_id;
    const familleId = customData.famille_id;
    const typePaiement = customData.type_paiement;
    const moisConcerne = customData.mois_concerne;
    const montant = Number(customData.montant || verifyData.invoice?.total_amount || 0);

    if (!eleveId || !typePaiement || montant <= 0) {
      console.error("Invalid custom data:", customData);
      return new Response(JSON.stringify({ error: "Données invalides" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Check if payment already recorded (idempotency)
    const { data: existingPayment } = await supabaseAdmin
      .from("paiements")
      .select("id")
      .eq("reference", `PDNYA-${invoiceToken}`)
      .maybeSingle();

    if (existingPayment) {
      console.log("Payment already recorded:", invoiceToken);
      return new Response(JSON.stringify({ status: "already_processed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Record the payment
    const { error: insertErr } = await supabaseAdmin
      .from("paiements")
      .insert({
        eleve_id: eleveId,
        type_paiement: typePaiement,
        montant,
        canal: "mobile_money",
        reference: `PDNYA-${invoiceToken}`,
        mois_concerne: moisConcerne,
        date_paiement: new Date().toISOString(),
      });

    if (insertErr) {
      console.error("Insert payment error:", insertErr);
      throw insertErr;
    }

    // Note: cantine credit is handled by the existing trigger `credit_cantine_on_payment`

    // Create a notification for the parent
    if (familleId) {
      await supabaseAdmin.from("parent_notifications").insert({
        famille_id: familleId,
        titre: "Paiement confirmé ✅",
        message: `Votre paiement de ${montant.toLocaleString()} GNF (${typePaiement}${moisConcerne ? ` — ${moisConcerne}` : ''}) a été confirmé.`,
        type: "paiement",
      });
    }

    console.log("Payment processed successfully:", invoiceToken, montant, typePaiement);

    return new Response(
      JSON.stringify({ status: "success", montant, type: typePaiement }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("paydunya-webhook error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erreur serveur" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
