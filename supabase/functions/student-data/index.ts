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
    const { token, action, notification_id } = await req.json();

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
      return new Response(JSON.stringify({ error: "Session expirée" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch student data
    const { data: eleve, error: eleveErr } = await supabaseAdmin
      .from("eleves")
      .select("id, nom, prenom, matricule, statut, classe_id, solde_cantine, classes(id, nom, niveau_id, niveaux:niveau_id(id, nom, cycle_id, cycles:cycle_id(id, nom, bareme)))")
      .eq("id", eleveIdFromToken)
      .is("deleted_at", null)
      .maybeSingle();

    if (eleveErr) throw eleveErr;
    if (!eleve) {
      return new Response(JSON.stringify({ error: "Session expirée" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (eleve.statut === 'suspendu') {
      return new Response(JSON.stringify({ 
        error: "Veuillez régulariser votre situation à la comptabilité.",
        suspended: true
      }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const eleveId = eleve.id;
    const classeId = eleve.classe_id;

    if (action === "cours") {
      const { data: cours } = await supabaseAdmin
        .from("cours")
        .select("*, matieres:matiere_id(nom, pole, coefficient)")
        .eq("classe_id", classeId)
        .eq("visible", true)
        .order("created_at", { ascending: false });

      return new Response(JSON.stringify({ cours: cours || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "devoirs") {
      // Get assignments with type_devoir
      const { data: devoirs } = await supabaseAdmin
        .from("devoirs")
        .select("*, matieres:matiere_id(nom, pole)")
        .eq("classe_id", classeId)
        .order("date_limite", { ascending: true });

      // Get student's file submissions
      const { data: soumissions } = await supabaseAdmin
        .from("soumissions_devoirs")
        .select("*")
        .eq("eleve_id", eleveId);

      // Get quiz questions for quiz-type devoirs
      const quizDevoirIds = (devoirs || []).filter((d: any) => d.type_devoir === 'quiz').map((d: any) => d.id);
      let allQuestions: any[] = [];
      if (quizDevoirIds.length > 0) {
        const { data: questions } = await supabaseAdmin
          .from("quiz_questions")
          .select("*")
          .in("devoir_id", quizDevoirIds)
          .order("ordre");
        allQuestions = questions || [];
      }

      // Get student's quiz responses
      const { data: quizReponses } = await supabaseAdmin
        .from("quiz_reponses")
        .select("*")
        .eq("eleve_id", eleveId);

      // Attach questions to devoirs (strip correct answers for non-submitted quizzes)
      const devoirsWithQuestions = (devoirs || []).map((d: any) => {
        if (d.type_devoir === 'quiz') {
          const hasResponded = (quizReponses || []).find((r: any) => r.devoir_id === d.id);
          const questions = allQuestions.filter((q: any) => q.devoir_id === d.id).map(q => ({
            ...q,
            // Only show correct answers if already submitted
            options: hasResponded
              ? q.options
              : (q.options as any[]).map((o: any) => ({ label: o.label })),
          }));
          return { ...d, questions };
        }
        return d;
      });

      return new Response(JSON.stringify({ 
        devoirs: devoirsWithQuestions, 
        soumissions: soumissions || [],
        quiz_reponses: quizReponses || [],
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "resultats") {
      const { data: notes } = await supabaseAdmin
        .from("notes")
        .select("*, matieres:matiere_id(nom, pole, coefficient), periodes:periode_id(nom, ordre)")
        .eq("eleve_id", eleveId)
        .order("created_at", { ascending: false });

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

      const { data: soumissions } = await supabaseAdmin
        .from("soumissions_devoirs")
        .select("*, devoirs:devoir_id(titre, note_max, matieres:matiere_id(nom))")
        .eq("eleve_id", eleveId)
        .not("note", "is", null)
        .order("corrige_at", { ascending: false });

      return new Response(JSON.stringify({ 
        notes: notes || [], 
        bulletinPublications,
        soumissionsNotees: soumissions || []
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "notifications") {
      const { data: notifs } = await supabaseAdmin
        .from("student_notifications")
        .select("id, titre, message, type, action_url, lu, created_at")
        .eq("eleve_id", eleveId)
        .order("created_at", { ascending: false })
        .limit(5);

      const { count: unreadCount } = await supabaseAdmin
        .from("student_notifications")
        .select("id", { count: "exact", head: true })
        .eq("eleve_id", eleveId)
        .eq("lu", false);

      return new Response(
        JSON.stringify({ notifications: notifs || [], unread_count: unreadCount || 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "all_notifications") {
      const { data: notifs } = await supabaseAdmin
        .from("student_notifications")
        .select("id, titre, message, type, action_url, lu, created_at")
        .eq("eleve_id", eleveId)
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
          .from("student_notifications")
          .update({ lu: true })
          .eq("id", notification_id)
          .eq("eleve_id", eleveId);
      }
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "emploi_du_temps") {
      const { data: edt } = await supabaseAdmin
        .from("emploi_du_temps")
        .select("*, matieres:matiere_id(nom), employes:enseignant_id(nom, prenom)")
        .eq("classe_id", classeId)
        .order("jour_semaine")
        .order("heure_debut");

      return new Response(JSON.stringify({ emploi_du_temps: edt || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "evaluations_enseignants") {
      // Get teachers assigned to student's class
      const { data: affectations } = await supabaseAdmin
        .from("enseignant_classes")
        .select("id, employe_id, matiere_id, employes:employe_id(nom, prenom), matieres:matiere_id(nom)")
        .eq("classe_id", classeId);

      const enseignants = (affectations || []).map((a: any) => ({
        id: a.id,
        employe_id: a.employe_id,
        nom: a.employes?.nom,
        prenom: a.employes?.prenom,
        matiere_nom: a.matieres?.nom || null,
      }));

      // Current period
      const year = new Date().getFullYear();
      const semester = new Date().getMonth() < 6 ? 'S1' : 'S2';
      const periode = `${year}-${semester}`;

      // Get existing evaluations by this student for this period
      const { data: evals } = await supabaseAdmin
        .from("eval_enseignants_eleves")
        .select("id, enseignant_id, pedagogie, ponctualite, competences, relations, commentaire")
        .eq("eleve_id", eleveId)
        .eq("periode", periode);

      return new Response(JSON.stringify({ enseignants, evaluations: evals || [], periode }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "dashboard") {
      const { data: devoirs } = await supabaseAdmin
        .from("devoirs")
        .select("id, titre, date_limite, matieres:matiere_id(nom)")
        .eq("classe_id", classeId)
        .gte("date_limite", new Date().toISOString())
        .order("date_limite", { ascending: true })
        .limit(5);

      const { data: cours } = await supabaseAdmin
        .from("cours")
        .select("id, titre, type_contenu, created_at, matieres:matiere_id(nom)")
        .eq("classe_id", classeId)
        .order("created_at", { ascending: false })
        .limit(5);

      const { data: soumissions } = await supabaseAdmin
        .from("soumissions_devoirs")
        .select("devoir_id")
        .eq("eleve_id", eleveId);

      let bulletinCount = 0;
      if (classeId) {
        const { count } = await supabaseAdmin
          .from("bulletin_publications")
          .select("id", { count: "exact", head: true })
          .eq("classe_id", classeId)
          .eq("visible_parent", true);
        bulletinCount = count || 0;
      }

      const todayJS = new Date().getDay();
      const jourSemaine = todayJS === 0 ? 7 : todayJS;
      const { data: edtToday } = await supabaseAdmin
        .from("emploi_du_temps")
        .select("*, matieres:matiere_id(nom), employes:enseignant_id(nom, prenom)")
        .eq("classe_id", classeId)
        .eq("jour_semaine", jourSemaine)
        .order("heure_debut");

      return new Response(JSON.stringify({
        prochains_devoirs: devoirs || [],
        derniers_cours: cours || [],
        nb_soumissions: (soumissions || []).length,
        nb_bulletins: bulletinCount,
        solde_cantine: eleve.solde_cantine || 0,
        emploi_du_temps_aujourdhui: edtToday || [],
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Action inconnue" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("student-data error:", e);
    return new Response(
      JSON.stringify({ error: "Erreur serveur" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
