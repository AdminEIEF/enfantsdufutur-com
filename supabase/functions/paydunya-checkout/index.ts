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
    const { code, eleve_id, type_paiement, montant, mois_concerne, description } = await req.json();

    if (!code || !eleve_id || !type_paiement || !montant || montant <= 0) {
      return new Response(JSON.stringify({ error: "Paramètres invalides" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Validate parent code
    const { data: famille, error: famErr } = await supabaseAdmin
      .from("familles")
      .select("id, nom_famille")
      .eq("code_acces", code.trim().toUpperCase())
      .maybeSingle();

    if (famErr) throw famErr;
    if (!famille) {
      return new Response(JSON.stringify({ error: "Session expirée" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify child belongs to family
    const { data: eleve } = await supabaseAdmin
      .from("eleves")
      .select("id, nom, prenom, famille_id")
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

    // PayDunya API setup
    const PAYDUNYA_BASE = "https://app.paydunya.com/api/v1";
    const masterKey = Deno.env.get("PAYDUNYA_MASTER_KEY")!;
    const privateKey = Deno.env.get("PAYDUNYA_PRIVATE_KEY")!;
    const token = Deno.env.get("PAYDUNYA_TOKEN")!;

    const paydunyaHeaders = {
      "Content-Type": "application/json",
      "PAYDUNYA-MASTER-KEY": masterKey,
      "PAYDUNYA-PRIVATE-KEY": privateKey,
      "PAYDUNYA-TOKEN": token,
    };

    const projectUrl = Deno.env.get("SUPABASE_URL")!;
    const typeLabels: Record<string, string> = {
      scolarite: 'Scolarité', cantine: 'Recharge Cantine', transport: 'Transport',
      inscription: 'Inscription', librairie: 'Librairie', boutique: 'Boutique', autre: 'Paiement',
    };
    const desc = description || `${typeLabels[type_paiement] || 'Paiement'} — ${eleve.prenom} ${eleve.nom}${mois_concerne ? ` (${mois_concerne})` : ''}`;

    // Create PayDunya invoice
    const invoicePayload = {
      invoice: {
        total_amount: Math.round(montant),
        description: desc,
      },
      store: {
        name: "E.I Enfant du Futur",
      },
      custom_data: {
        eleve_id,
        famille_id: famille.id,
        type_paiement,
        mois_concerne: mois_concerne || null,
        montant: Math.round(montant),
      },
      actions: {
        callback_url: `${projectUrl}/functions/v1/paydunya-webhook`,
        return_url: `${projectUrl.replace('supabase.co', 'lovable.app').replace('https://xlrlelzqasgqaiylldcj.supabase.co', 'https://eienfantdufutur.lovable.app')}/parent/dashboard?payment=success`,
        cancel_url: `${projectUrl.replace('supabase.co', 'lovable.app').replace('https://xlrlelzqasgqaiylldcj.supabase.co', 'https://eienfantdufutur.lovable.app')}/parent/dashboard?payment=cancelled`,
      },
    };

    const payResp = await fetch(`${PAYDUNYA_BASE}/checkout-invoice/create`, {
      method: "POST",
      headers: paydunyaHeaders,
      body: JSON.stringify(invoicePayload),
    });

    const payData = await payResp.json();

    if (payData.response_code !== "00") {
      console.error("PayDunya error:", payData);
      return new Response(
        JSON.stringify({ error: payData.response_text || "Erreur PayDunya", details: payData }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        token: payData.token,
        url: payData.response_text, // redirect URL for payment
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("paydunya-checkout error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erreur serveur" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
