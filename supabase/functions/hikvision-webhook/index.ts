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
    // Validate webhook secret if configured
    const webhookSecret = Deno.env.get("HIKVISION_WEBHOOK_SECRET");
    if (webhookSecret) {
      const authHeader = req.headers.get("x-webhook-secret") || req.headers.get("authorization");
      if (authHeader !== webhookSecret && authHeader !== `Bearer ${webhookSecret}`) {
        console.error("Invalid webhook secret");
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const body = await req.json();
    console.log("Hikvision webhook received:", JSON.stringify(body).substring(0, 500));

    // Hikvision MinMoe sends events via ISAPI
    // Format: { eventType, dateTime, employeeNoString, ... }
    // Or nested: { AccessControllerEvent: { employeeNoString, ... } }
    const event = body.AccessControllerEvent || body;
    const employeeNo = event.employeeNoString || event.employeeNo || body.employeeNo;
    const eventTime = event.dateTime || event.time || body.dateTime || new Date().toISOString();
    const deviceName = event.deviceName || body.deviceName || "Hikvision MinMoe";
    const direction = (event.direction || event.doorName || body.direction || "").toLowerCase();

    if (!employeeNo) {
      console.error("No employeeNo in event:", JSON.stringify(body).substring(0, 300));
      return new Response(JSON.stringify({ error: "Missing employeeNo" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Map employeeNo → matricule in eleves table
    const { data: eleve, error: eleveErr } = await supabaseAdmin
      .from("eleves")
      .select("id, matricule, nom, prenom, classe_id, famille_id, classes:classe_id(nom)")
      .or(`matricule.eq.${employeeNo},qr_code.eq.${employeeNo}`)
      .eq("statut", "inscrit")
      .is("deleted_at", null)
      .maybeSingle();

    if (eleveErr || !eleve) {
      console.error("Élève non trouvé pour employeeNo:", employeeNo, eleveErr);
      return new Response(JSON.stringify({ error: "Élève non trouvé", employeeNo }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = new Date(eventTime);
    const today = now.toISOString().split("T")[0];
    const heureStr = now.toTimeString().substring(0, 5); // HH:mm
    const HEURE_LIMITE = "08:10";

    // Check existing pointage for today
    const { data: existing } = await supabaseAdmin
      .from("pointages_eleves")
      .select("id, heure_arrivee, heure_depart")
      .eq("eleve_id", eleve.id)
      .eq("date_pointage", today)
      .maybeSingle();

    let action = "";
    const isEntree = direction.includes("in") || direction.includes("entree") || direction.includes("entrée");
    const isSortie = direction.includes("out") || direction.includes("sortie");

    if (!existing) {
      // First scan today → arrivée
      const enRetard = heureStr > HEURE_LIMITE;
      const { error: insertErr } = await supabaseAdmin
        .from("pointages_eleves")
        .insert({
          eleve_id: eleve.id,
          date_pointage: today,
          heure_arrivee: now.toISOString(),
          en_retard: enRetard,
        });
      if (insertErr) throw insertErr;
      action = "arrivee";

      // Notify parent
      if (eleve.famille_id) {
        await supabaseAdmin.from("parent_notifications").insert({
          famille_id: eleve.famille_id,
          titre: enRetard ? "⚠️ Arrivée en retard" : "🏫 Arrivée à l'école",
          message: `${eleve.prenom} ${eleve.nom} est arrivé(e) à ${heureStr} via ${deviceName}.${enRetard ? " (En retard)" : ""}`,
          type: enRetard ? "alerte" : "info",
        });
      }
      console.log(`✅ Arrivée: ${eleve.prenom} ${eleve.nom} à ${heureStr}${enRetard ? " (RETARD)" : ""}`);
    } else if (!existing.heure_depart && (isSortie || !isEntree)) {
      // Has arrivée, no depart → départ
      const { error: updateErr } = await supabaseAdmin
        .from("pointages_eleves")
        .update({ heure_depart: now.toISOString() })
        .eq("id", existing.id);
      if (updateErr) throw updateErr;
      action = "depart";

      if (eleve.famille_id) {
        await supabaseAdmin.from("parent_notifications").insert({
          famille_id: eleve.famille_id,
          titre: "🚪 Départ de l'école",
          message: `${eleve.prenom} ${eleve.nom} a quitté l'école à ${heureStr} via ${deviceName}.`,
          type: "info",
        });
      }
      console.log(`✅ Départ: ${eleve.prenom} ${eleve.nom} à ${heureStr}`);
    } else {
      action = "deja_complet";
      console.log(`ℹ️ Pointage déjà complet pour ${eleve.prenom} ${eleve.nom}`);
    }

    return new Response(
      JSON.stringify({
        status: "ok",
        action,
        eleve: { id: eleve.id, nom: eleve.nom, prenom: eleve.prenom },
        heure: heureStr,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("hikvision-webhook error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erreur serveur" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
