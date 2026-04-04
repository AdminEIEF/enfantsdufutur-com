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
    const { token, action, notification_id, composition_id, reponses: studentReponses, reponse_texte } = await req.json();

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
        .select("*, matieres:matiere_id(id, nom, pole, coefficient)")
        .eq("classe_id", classeId)
        .eq("visible", true)
        .order("created_at", { ascending: false });

      // Get class matières for secondary students
      const { data: classeMatieres } = await supabaseAdmin
        .from("classe_matieres")
        .select("id, matiere_id, matieres:matiere_id(id, nom, pole, coefficient)")
        .eq("classe_id", classeId);

      // Determine if secondary
      const cycleName = ((eleve as any).classes?.niveaux?.cycles?.nom || '').toLowerCase();
      const isSecondaire = ['secondaire', 'collège', 'lycée', 'college', 'lycee'].some(s => cycleName.includes(s));

      return new Response(JSON.stringify({ 
        cours: cours || [], 
        classe_matieres: classeMatieres || [],
        is_secondaire: isSecondaire,
      }), {
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

    if (action === "compositions") {
      const now = new Date().toISOString();
      const { data: comps } = await supabaseAdmin
        .from("compositions")
        .select("id, titre, description, matiere_id, duree_minutes, date_debut, date_fin, bareme, type_composition, sujet_url, sujet_nom, matieres:matiere_id(nom)")
        .eq("classe_id", classeId)
        .eq("publie", true)
        .order("date_debut", { ascending: false });

      const { data: reps } = await supabaseAdmin
        .from("composition_reponses")
        .select("id, composition_id, score, soumis_at, debut_at")
        .eq("eleve_id", eleveId);

      return new Response(JSON.stringify({ compositions: comps || [], reponses: reps || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "start_composition") {
      // Verify composition exists and is published for this class
      const { data: comp } = await supabaseAdmin
        .from("compositions")
        .select("id, duree_minutes, date_debut, date_fin, classe_id, publie, type_composition, sujet_url, sujet_nom")
        .eq("id", composition_id)
        .eq("publie", true)
        .maybeSingle();

      if (!comp || comp.classe_id !== classeId) {
        return new Response(JSON.stringify({ error: "Composition non disponible" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const now = new Date();
      if (now < new Date(comp.date_debut) || now > new Date(comp.date_fin)) {
        return new Response(JSON.stringify({ error: "Cette composition n'est pas dans la période autorisée" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check existing attempt
      const { data: existing } = await supabaseAdmin
        .from("composition_reponses")
        .select("id, soumis_at, debut_at")
        .eq("composition_id", composition_id)
        .eq("eleve_id", eleveId)
        .maybeSingle();

      if (existing?.soumis_at) {
        return new Response(JSON.stringify({ error: "Vous avez déjà soumis cette composition" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let debutAt: string;
      if (existing) {
        debutAt = existing.debut_at;
      } else {
        const { data: newRep } = await supabaseAdmin
          .from("composition_reponses")
          .insert({ composition_id, eleve_id: eleveId, reponses: {} })
          .select("debut_at")
          .single();
        debutAt = newRep!.debut_at;
      }

      // For document type, return sujet info instead of questions
      if (comp.type_composition === 'document') {
        // Generate signed URL if sujet_url contains storage path
        let sujetUrl = comp.sujet_url || '';
        if (sujetUrl.includes('/storage/v1/object/public/cours/')) {
          const storagePath = sujetUrl.split('/storage/v1/object/public/cours/')[1];
          if (storagePath) {
            const { data: signedData } = await supabaseAdmin.storage.from('cours').createSignedUrl(storagePath, 3600);
            if (signedData?.signedUrl) sujetUrl = signedData.signedUrl;
          }
        }
        return new Response(JSON.stringify({ 
          type_composition: 'document',
          sujet_url: sujetUrl,
          sujet_nom: comp.sujet_nom,
          debut_at: debutAt 
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // For texte type, return questions without options
      if (comp.type_composition === 'texte') {
        const { data: questions } = await supabaseAdmin
          .from("composition_questions")
          .select("id, type_question, enonce, points, ordre")
          .eq("composition_id", composition_id)
          .order("ordre");

        return new Response(JSON.stringify({ type_composition: 'texte', questions: questions || [], debut_at: debutAt }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get questions (strip correct answers) for QCM type
      const { data: questions } = await supabaseAdmin
        .from("composition_questions")
        .select("id, type_question, enonce, options, points, ordre")
        .eq("composition_id", composition_id)
        .order("ordre");

      const cleanQuestions = (questions || []).map((q: any) => ({
        ...q,
        options: (q.options as any[]).map((o: any) => ({ label: o.label })),
      }));

      return new Response(JSON.stringify({ type_composition: 'qcm', questions: cleanQuestions, debut_at: debutAt }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "submit_composition") {
      const { data: comp } = await supabaseAdmin
        .from("compositions")
        .select("id, titre, duree_minutes, bareme, classe_id, type_composition, matieres:matiere_id(nom)")
        .eq("id", composition_id)
        .maybeSingle();

      const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
      const studentAnswers = comp?.type_composition === 'texte'
        ? (Array.isArray(studentReponses) ? studentReponses : [])
        : (isObject(studentReponses) ? studentReponses : {});

      if (!comp || comp.classe_id !== classeId) {
        return new Response(JSON.stringify({ error: "Composition non trouvée" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: existing } = await supabaseAdmin
        .from("composition_reponses")
        .select("id, soumis_at, debut_at")
        .eq("composition_id", composition_id)
        .eq("eleve_id", eleveId)
        .maybeSingle();

      if (!existing) {
        return new Response(JSON.stringify({ error: "Session non trouvée" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (existing.soumis_at) {
        return new Response(JSON.stringify({ error: "Déjà soumis" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check time (allow 30s grace)
      const elapsed = Date.now() - new Date(existing.debut_at).getTime();
      if (elapsed > (comp.duree_minutes * 60 + 30) * 1000) {
        return new Response(JSON.stringify({ error: "Temps écoulé" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Document type: save text response, no auto-scoring
      if (comp.type_composition === 'document') {
        await supabaseAdmin
          .from("composition_reponses")
          .update({ reponse_texte: reponse_texte || '', soumis_at: new Date().toISOString() })
          .eq("id", existing.id);

        await supabaseAdmin.from("student_notifications").insert({
          eleve_id: eleveId,
          titre: '📝 Composition soumise',
          message: `Votre composition "${comp.titre}" en ${comp.matieres?.nom || 'matière'} a été soumise. En attente de correction.`,
          type: 'info',
        });

        return new Response(JSON.stringify({ submitted: true, message: "Réponse soumise. Le superviseur notera votre copie.", bareme: comp.bareme }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Texte type: save response then auto-grade with AI
      if (comp.type_composition === 'texte') {
        const { data: texteQuestions } = await supabaseAdmin
          .from("composition_questions")
          .select("id, enonce, reponse_correcte, points")
          .eq("composition_id", composition_id)
          .order("ordre");

        if (!texteQuestions || texteQuestions.length === 0) {
          return new Response(JSON.stringify({ error: "Aucune question enregistrée pour cette composition" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const normalizedAnswers = studentAnswers.map((entry: any) => ({
          question_id: typeof entry?.question_id === 'string' ? entry.question_id : '',
          question: typeof entry?.question === 'string' ? entry.question.slice(0, 2000) : '',
          answer: typeof entry?.answer === 'string' ? entry.answer.slice(0, 12000) : '',
          ordre: typeof entry?.ordre === 'number' ? entry.ordre : null,
          points: typeof entry?.points === 'number' ? entry.points : null,
        })).filter((entry: any) => entry.question_id || entry.answer || entry.question);

        const normalizedTextResponse = typeof reponse_texte === 'string' ? reponse_texte.slice(0, 200000) : '';

        await supabaseAdmin
          .from("composition_reponses")
          .update({ reponse_texte: normalizedTextResponse, reponses: normalizedAnswers, soumis_at: new Date().toISOString() })
          .eq("id", existing.id);

        // Try AI grading if reference answers exist
        const hasRefs = (texteQuestions || []).some(q => q.reponse_correcte && q.reponse_correcte !== '_texte_');
        if (hasRefs && normalizedTextResponse) {
          try {
            const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
            if (LOVABLE_API_KEY) {
              const totalPossiblePts = (texteQuestions || []).reduce((s, q) => s + q.points, 0);
              const gradingPrompt = (texteQuestions || []).map((q, i) => 
                `Question ${i+1} (${q.points} pts): ${q.enonce}\nRéponse attendue: ${q.reponse_correcte}`
              ).join('\n\n');

              const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
                method: "POST",
                headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
                body: JSON.stringify({
                  model: "google/gemini-3-flash-preview",
                  messages: [
                    { role: "system", content: `Tu es un correcteur d'examen scolaire. Compare les réponses de l'élève avec les réponses attendues. Évalue la pertinence des idées, pas la formulation exacte. Sois juste mais bienveillant. Le total possible est ${totalPossiblePts} points.` },
                    { role: "user", content: `Voici les questions et réponses attendues:\n\n${gradingPrompt}\n\nVoici la copie de l'élève:\n${normalizedTextResponse}\n\nAttribue un score total sur ${totalPossiblePts} points. Réponds UNIQUEMENT avec un JSON: {"score": <nombre>, "commentaire": "<bref commentaire>"}` }
                  ],
                  tools: [{
                    type: "function",
                    function: {
                      name: "grade_composition",
                      description: "Return the grade for a student composition",
                      parameters: {
                        type: "object",
                        properties: {
                          score: { type: "number", description: "Total score" },
                          commentaire: { type: "string", description: "Brief feedback" }
                        },
                        required: ["score", "commentaire"],
                        additionalProperties: false
                      }
                    }
                  }],
                  tool_choice: { type: "function", function: { name: "grade_composition" } }
                }),
              });

              if (aiRes.ok) {
                const aiData = await aiRes.json();
                const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
                if (toolCall) {
                  const gradeResult = JSON.parse(toolCall.function.arguments);
                  const rawScore = Math.max(0, Math.min(gradeResult.score, totalPossiblePts));
                  const scaledScore = totalPossiblePts > 0 ? Math.round((rawScore / totalPossiblePts) * comp.bareme * 100) / 100 : 0;
                  
                  await supabaseAdmin
                    .from("composition_reponses")
                    .update({ score: scaledScore })
                    .eq("id", existing.id);

                  await supabaseAdmin.from("student_notifications").insert({
                    eleve_id: eleveId,
                    titre: '📝 Composition corrigée',
                    message: `Votre composition "${comp.titre}" en ${comp.matieres?.nom || 'matière'} a été notée : ${scaledScore}/${comp.bareme}. ${gradeResult.commentaire}`,
                    type: 'info',
                  });

                  return new Response(JSON.stringify({ submitted: true, score: scaledScore, bareme: comp.bareme, message: `Composition notée par IA : ${scaledScore}/${comp.bareme}. ${gradeResult.commentaire}` }), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                  });
                }
              }
            }
          } catch (aiErr) {
            console.error("AI grading error:", aiErr);
          }
        }

        await supabaseAdmin.from("student_notifications").insert({
          eleve_id: eleveId,
          titre: '📝 Composition soumise',
          message: `Votre composition "${comp.titre}" en ${comp.matieres?.nom || 'matière'} a été soumise. En attente de correction.`,
          type: 'info',
        });

        return new Response(JSON.stringify({ submitted: true, message: "Réponse soumise. Le superviseur notera votre copie.", bareme: comp.bareme }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // QCM type: Calculate score
      const { data: questions } = await supabaseAdmin
        .from("composition_questions")
        .select("id, reponse_correcte, points")
        .eq("composition_id", composition_id);

      let totalPoints = 0;
      const totalPossible = (questions || []).reduce((s: number, q: any) => s + q.points, 0);

      for (const q of (questions || [])) {
        if (studentAnswers[q.id] === q.reponse_correcte) {
          totalPoints += q.points;
        }
      }

      // Scale to bareme
      const score = totalPossible > 0 ? Math.round((totalPoints / totalPossible) * comp.bareme * 100) / 100 : 0;

      await supabaseAdmin
        .from("composition_reponses")
        .update({ reponses: studentAnswers, score, soumis_at: new Date().toISOString() })
        .eq("id", existing.id);

      await supabaseAdmin.from("student_notifications").insert({
        eleve_id: eleveId,
        titre: '📝 Composition corrigée',
        message: `Votre composition "${comp.titre}" en ${comp.matieres?.nom || 'matière'} a été corrigée : ${score}/${comp.bareme}.`,
        type: 'info',
      });

      return new Response(JSON.stringify({ score, bareme: comp.bareme }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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

      const { data: soumissions } = await supabaseAdmin
        .from("soumissions_devoirs")
        .select("devoir_id")
        .eq("eleve_id", eleveId);

      let bulletinCount = 0;
      let coursCount = 0;
      if (classeId) {
        const { count } = await supabaseAdmin
          .from("bulletin_publications")
          .select("id", { count: "exact", head: true })
          .eq("classe_id", classeId)
          .eq("visible_parent", true);
        bulletinCount = count || 0;

        const { count: cCount } = await supabaseAdmin
          .from("cours")
          .select("id", { count: "exact", head: true })
          .eq("classe_id", classeId)
          .eq("visible", true);
        coursCount = cCount || 0;
      }

      // Full weekly timetable
      const { data: edtSemaine } = await supabaseAdmin
        .from("emploi_du_temps")
        .select("*, matieres:matiere_id(nom), employes:enseignant_id(nom, prenom)")
        .eq("classe_id", classeId)
        .order("jour_semaine")
        .order("heure_debut");

      // Calendar events (upcoming, for the class or global)
      const today = new Date().toISOString().split('T')[0];
      
      // Get events linked to this class via evenement_classes
      const { data: ecLinks } = await supabaseAdmin
        .from("evenement_classes")
        .select("evenement_id")
        .eq("classe_id", classeId);
      const linkedEventIds = (ecLinks || []).map((l: any) => l.evenement_id);

      const { data: evenements } = await supabaseAdmin
        .from("evenements_calendrier")
        .select("id, titre, description, type, couleur, date_debut, date_fin, heure_debut, heure_fin, matieres:matiere_id(nom)")
        .or(`classe_id.eq.${classeId},classe_id.is.null${linkedEventIds.length > 0 ? `,id.in.(${linkedEventIds.join(',')})` : ''}`)
        .gte("date_debut", today)
        .order("date_debut", { ascending: true })
        .limit(10);

      // Enrich with evenement_classes for multi-class events
      if (evenements && evenements.length > 0) {
        const evIds = evenements.map((e: any) => e.id);
        const { data: allEcLinks } = await supabaseAdmin
          .from("evenement_classes")
          .select("evenement_id, classe_id, matiere_id, heure_debut, heure_fin, date_epreuve, classes:classe_id(nom), matieres:matiere_id(nom)")
          .in("evenement_id", evIds);
        
        evenements.forEach((ev: any) => {
          ev.evenement_classes = (allEcLinks || []).filter((l: any) => l.evenement_id === ev.id);
        });
      }

      // Class rank per period
      let rangParPeriode: any[] = [];
      if (classeId) {
        const { data: periodes } = await supabaseAdmin
          .from("periodes")
          .select("id, nom, ordre")
          .order("ordre");

        const { data: classeEleves } = await supabaseAdmin
          .from("eleves")
          .select("id")
          .eq("classe_id", classeId)
          .is("deleted_at", null)
          .eq("statut", "inscrit");

        const classeEleveIds = (classeEleves || []).map((e: any) => e.id);

        if (classeEleveIds.length > 0 && (periodes || []).length > 0) {
          const { data: allNotes } = await supabaseAdmin
            .from("notes")
            .select("eleve_id, note, matieres:matiere_id(coefficient), periode_id")
            .in("eleve_id", classeEleveIds);

          for (const periode of (periodes || [])) {
            const periodeNotes = (allNotes || []).filter((n: any) => n.periode_id === periode.id);
            if (periodeNotes.length === 0) continue;

            const moyennes: { eleve_id: string; moyenne: number }[] = [];
            for (const eid of classeEleveIds) {
              const studentNotes = periodeNotes.filter((n: any) => n.eleve_id === eid);
              if (studentNotes.length === 0) continue;
              let totalPondere = 0;
              let totalCoeff = 0;
              for (const n of studentNotes) {
                const coeff = n.matieres?.coefficient || 1;
                totalPondere += (n.note || 0) * coeff;
                totalCoeff += coeff;
              }
              if (totalCoeff > 0) {
                moyennes.push({ eleve_id: eid, moyenne: totalPondere / totalCoeff });
              }
            }

            moyennes.sort((a, b) => b.moyenne - a.moyenne);
            const myIndex = moyennes.findIndex(m => m.eleve_id === eleveId);
            if (myIndex !== -1) {
              rangParPeriode.push({
                periode_id: periode.id,
                periode_nom: periode.nom,
                rang: myIndex + 1,
                total_eleves: moyennes.length,
                moyenne: Math.round(moyennes[myIndex].moyenne * 100) / 100,
              });
            }
          }
        }
      }

      return new Response(JSON.stringify({
        prochains_devoirs: devoirs || [],
        nb_soumissions: (soumissions || []).length,
        nb_bulletins: bulletinCount,
        nb_cours: coursCount,
        solde_cantine: eleve.solde_cantine || 0,
        emploi_du_temps_semaine: edtSemaine || [],
        rang_par_periode: rangParPeriode,
        evenements_calendrier: evenements || [],
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── LIBRAIRIE (digital library - books only) ───
    if (action === "librairie") {
      const niveauId = (eleve as any).classes?.niveau_id;
      const LIBRAIRIE_CATEGORIES = ['roman', 'romans', 'livre', 'livres', 'manuel', 'manuels', 'lecture', 'dictionnaire', 'dictionnaires'];

      // Get all articles
      const { data: allArticles } = await supabaseAdmin
        .from("articles")
        .select("id, nom, categorie, prix, stock, fichier_url, fichier_nom, niveau_id")
        .order("categorie")
        .order("nom");

      // Get student's purchases
      const { data: purchases } = await supabaseAdmin
        .from("ventes_articles")
        .select("article_id")
        .eq("eleve_id", eleveId);

      const purchasedIds = new Set((purchases || []).map((p: any) => p.article_id));

      // Filter: only book categories + student's niveau or purchased
      const articles = (allArticles || [])
        .filter((a: any) => {
          const isBook = LIBRAIRIE_CATEGORIES.some(cat => a.categorie.toLowerCase().includes(cat));
          if (!isBook) return false;
          return a.niveau_id === niveauId || purchasedIds.has(a.id);
        })
        .map((a: any) => ({
          id: a.id,
          nom: a.nom,
          categorie: a.categorie,
          prix: a.prix,
          stock: a.stock,
          fichier_url: purchasedIds.has(a.id) ? a.fichier_url : null,
          fichier_nom: purchasedIds.has(a.id) ? a.fichier_nom : null,
          purchased: purchasedIds.has(a.id),
        }));

      return new Response(JSON.stringify({ articles }), {
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
