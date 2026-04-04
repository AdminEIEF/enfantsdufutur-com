import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const now = new Date();
  const day = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

  // Only send reminders when 5 days or less remain in the month
  if (daysInMonth - day > 5) {
    return new Response(JSON.stringify({ message: "Pas encore fin de mois" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const monthEnd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${daysInMonth}`;

  // Get all cantine students
  const { data: eleves } = await supabase
    .from("eleves")
    .select("id, prenom, nom, famille_id")
    .eq("option_cantine", true)
    .eq("statut", "inscrit")
    .is("deleted_at", null)
    .not("famille_id", "is", null);

  if (!eleves || eleves.length === 0) {
    return new Response(JSON.stringify({ message: "Aucun élève cantine" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // Get cantine payments this month
  const { data: paiements } = await supabase
    .from("paiements")
    .select("eleve_id")
    .eq("type_paiement", "cantine")
    .gte("date_paiement", monthStart)
    .lte("date_paiement", monthEnd);

  const paidEleveIds = new Set((paiements || []).map((p: any) => p.eleve_id));
  const unpaid = eleves.filter((e: any) => !paidEleveIds.has(e.id));

  // Group by famille
  const byFamille = new Map<string, any[]>();
  for (const e of unpaid) {
    if (!byFamille.has(e.famille_id)) byFamille.set(e.famille_id, []);
    byFamille.get(e.famille_id)!.push(e);
  }

  let sent = 0;
  for (const [familleId, enfants] of byFamille) {
    // Check if already notified this month
    const { data: existing } = await supabase
      .from("parent_notifications")
      .select("id")
      .eq("famille_id", familleId)
      .eq("type", "alerte")
      .like("titre", "%Rappel cantine%")
      .gte("created_at", monthStart)
      .limit(1);

    if (existing && existing.length > 0) continue;

    const noms = enfants.map((e: any) => e.prenom).join(", ");
    await supabase.from("parent_notifications").insert({
      famille_id: familleId,
      titre: "🍽️ Rappel cantine — Fin de mois",
      message: `La cantine de ${noms} n'a pas encore été rechargée ce mois. Pensez à recharger avant la fin du mois pour éviter toute interruption du service.`,
      type: "alerte",
      action_url: "/parent/dashboard",
    });
    sent++;
  }

  return new Response(JSON.stringify({ sent, total_unpaid: unpaid.length }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
