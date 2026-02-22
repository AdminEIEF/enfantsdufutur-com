import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function validateToken(token: string, serviceRoleKey: string): Promise<string> {
  const decoded = atob(token);
  const parts = decoded.split(":");
  if (parts.length < 4 || parts[0] !== "emp") throw new Error("Invalid token");
  const employeId = parts[1];
  const tokenTimestamp = parseInt(parts[2]);
  const tokenSignature = parts.slice(3).join(":");

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(serviceRoleKey),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const tokenData = `emp:${employeId}:${tokenTimestamp}`;
  const expectedSig = await crypto.subtle.sign("HMAC", key, encoder.encode(tokenData));
  const expectedHex = Array.from(new Uint8Array(expectedSig)).map(b => b.toString(16).padStart(2, "0")).join("");

  if (tokenSignature !== expectedHex) throw new Error("Bad signature");
  if (Date.now() - tokenTimestamp > 24 * 60 * 60 * 1000) throw new Error("Token expired");

  return employeId;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { token, action, notification_id, conge, avance, courrier } = await req.json();
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    let employeId: string;
    try {
      employeId = await validateToken(token, serviceRoleKey);
    } catch {
      return new Response(JSON.stringify({ error: "Session expirée" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      serviceRoleKey
    );

    // ─── DASHBOARD ───
    if (action === "dashboard") {
      const { data: employe } = await supabaseAdmin
        .from("employes")
        .select("id, nom, prenom, matricule, categorie, poste, statut, salaire_base, photo_url")
        .eq("id", employeId)
        .maybeSingle();

      if (!employe || employe.statut !== "actif") {
        return new Response(JSON.stringify({ error: "Compte désactivé" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const now = new Date();
      const startMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
      const { data: pointages } = await supabaseAdmin
        .from("pointages_employes")
        .select("*")
        .eq("employe_id", employeId)
        .gte("date_pointage", startMonth)
        .order("date_pointage", { ascending: false });

      const { data: conges } = await supabaseAdmin
        .from("conges")
        .select("*")
        .eq("employe_id", employeId)
        .order("created_at", { ascending: false })
        .limit(10);

      const { data: avances } = await supabaseAdmin
        .from("avances_salaire")
        .select("*")
        .eq("employe_id", employeId)
        .order("created_at", { ascending: false })
        .limit(10);

      const { data: bulletins } = await supabaseAdmin
        .from("bulletins_paie")
        .select("*")
        .eq("employe_id", employeId)
        .order("annee", { ascending: false })
        .order("mois", { ascending: false })
        .limit(12);

      // Evaluations
      const { data: evaluations } = await supabaseAdmin
        .from("evaluations_employes")
        .select("*")
        .eq("employe_id", employeId)
        .order("created_at", { ascending: false })
        .limit(5);

      // Courriers
      const { data: courriers } = await supabaseAdmin
        .from("courriers_employes")
        .select("*")
        .eq("employe_id", employeId)
        .order("created_at", { ascending: false })
        .limit(20);

      let classes: any[] = [];
      let cours_enseignant: any[] = [];
      let devoirs_enseignant: any[] = [];
      if (employe.categorie === 'enseignant') {
        const { data: ec } = await supabaseAdmin
          .from("enseignant_classes")
          .select("id, classe_id, matiere_id, classes(id, nom), matieres:matiere_id(id, nom)")
          .eq("employe_id", employeId);
        classes = ec || [];

        const classeIds = classes.map(c => c.classe_id);
        if (classeIds.length > 0) {
          const { data: coursData } = await supabaseAdmin
            .from("cours")
            .select("id, titre, type_contenu, classe_id, matiere_id, classes(nom), matieres:matiere_id(nom)")
            .in("classe_id", classeIds)
            .eq("visible", true)
            .order("created_at", { ascending: false })
            .limit(10);
          cours_enseignant = coursData || [];

          const { data: devoirsData } = await supabaseAdmin
            .from("devoirs")
            .select("id, titre, date_limite, classe_id, matiere_id, classes(nom), matieres:matiere_id(nom)")
            .in("classe_id", classeIds)
            .gte("date_limite", new Date().toISOString())
            .order("date_limite", { ascending: true })
            .limit(10);
          devoirs_enseignant = devoirsData || [];
        }
      }

      // All month pointages for recap
      const startOfYear = `${now.getFullYear()}-01-01`;
      const { data: allPointages } = await supabaseAdmin
        .from("pointages_employes")
        .select("*")
        .eq("employe_id", employeId)
        .gte("date_pointage", startOfYear)
        .order("date_pointage", { ascending: false });

      return new Response(JSON.stringify({
        employe,
        pointages: pointages || [],
        allPointages: allPointages || [],
        conges: conges || [],
        avances: avances || [],
        bulletins: bulletins || [],
        evaluations: evaluations || [],
        courriers: courriers || [],
        classes,
        cours_enseignant,
        devoirs_enseignant,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── NOTIFICATIONS ───
    if (action === "notifications") {
      const { data: notifs } = await supabaseAdmin
        .from("employee_notifications")
        .select("id, titre, message, type, action_url, lu, created_at")
        .eq("employe_id", employeId)
        .order("created_at", { ascending: false })
        .limit(5);

      const { count: unreadCount } = await supabaseAdmin
        .from("employee_notifications")
        .select("id", { count: "exact", head: true })
        .eq("employe_id", employeId)
        .eq("lu", false);

      return new Response(
        JSON.stringify({ notifications: notifs || [], unread_count: unreadCount || 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "all_notifications") {
      const { data: notifs } = await supabaseAdmin
        .from("employee_notifications")
        .select("id, titre, message, type, action_url, lu, created_at")
        .eq("employe_id", employeId)
        .order("created_at", { ascending: false })
        .limit(100);

      return new Response(
        JSON.stringify({ notifications: notifs || [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "mark_notification_read") {
      if (notification_id) {
        await supabaseAdmin
          .from("employee_notifications")
          .update({ lu: true })
          .eq("id", notification_id)
          .eq("employe_id", employeId);
      }
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── DEMANDE DE CONGÉ ───
    if (action === "demander_conge") {
      if (!conge?.date_debut || !conge?.date_fin) {
        return new Response(JSON.stringify({ error: "Dates requises" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { error: insertErr } = await supabaseAdmin.from("conges").insert({
        employe_id: employeId,
        type_conge: conge.type_conge || "annuel",
        date_debut: conge.date_debut,
        date_fin: conge.date_fin,
        motif: conge.motif || null,
      });
      if (insertErr) throw insertErr;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── DEMANDE D'AVANCE ───
    if (action === "demander_avance") {
      if (!avance?.montant || avance.montant <= 0) {
        return new Response(JSON.stringify({ error: "Montant invalide" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { error: insertErr } = await supabaseAdmin.from("avances_salaire").insert({
        employe_id: employeId,
        montant: avance.montant,
        motif: avance.motif || null,
      });
      if (insertErr) throw insertErr;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── ENVOYER UN COURRIER ───
    if (action === "envoyer_courrier") {
      if (!courrier?.objet || !courrier?.contenu) {
        return new Response(JSON.stringify({ error: "Objet et contenu requis" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // If type is maladie, require a file
      if (courrier.type === "maladie" && !courrier.fichier_url) {
        return new Response(JSON.stringify({ error: "Un justificatif est obligatoire pour un congé maladie" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { error: insertErr } = await supabaseAdmin.from("courriers_employes").insert({
        employe_id: employeId,
        type: courrier.type || "demande",
        objet: courrier.objet,
        contenu: courrier.contenu,
        fichier_url: courrier.fichier_url || null,
        fichier_nom: courrier.fichier_nom || null,
      });
      if (insertErr) throw insertErr;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── UPLOAD COURRIER FILE (returns signed upload URL) ───
    if (action === "upload_courrier_file") {
      const fileName = `${employeId}/${Date.now()}_${courrier?.fichier_nom || 'file'}`;
      // We'll handle this client-side via direct fetch with the service role
      // Just return a path for the client to use
      return new Response(JSON.stringify({ path: fileName, bucket: 'courriers-employes' }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Action inconnue" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("employee-data error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erreur serveur" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
