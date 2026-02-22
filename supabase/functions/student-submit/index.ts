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
    const { token, devoir_id, fichier_url, fichier_nom } = await req.json();

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Validate HMAC token
    let eleveIdFromToken: string;
    try {
      const decoded = atob(token);
      const parts = decoded.split(":");
      if (parts.length < 3) throw new Error("Invalid token");
      eleveIdFromToken = parts[0];
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
      const tokenData = `${eleveIdFromToken}:${tokenTimestamp}`;
      const expectedSig = await crypto.subtle.sign("HMAC", key, encoder.encode(tokenData));
      const expectedHex = Array.from(new Uint8Array(expectedSig)).map(b => b.toString(16).padStart(2, '0')).join('');

      if (tokenSignature !== expectedHex) throw new Error("Bad signature");
      if (Date.now() - tokenTimestamp > 24 * 60 * 60 * 1000) throw new Error("Token expired");
    } catch {
      return new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch student
    const { data: eleve, error } = await supabaseAdmin
      .from("eleves")
      .select("id, statut")
      .eq("id", eleveIdFromToken)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) throw error;
    if (!eleve) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (eleve.statut === 'suspendu') {
      return new Response(JSON.stringify({ error: "Compte suspendu" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Upsert submission
    const { error: insertErr } = await supabaseAdmin
      .from("soumissions_devoirs")
      .upsert({
        devoir_id,
        eleve_id: eleve.id,
        fichier_url,
        fichier_nom,
        soumis_at: new Date().toISOString(),
      }, { onConflict: "devoir_id,eleve_id" });

    if (insertErr) throw insertErr;

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("student-submit error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erreur serveur" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
