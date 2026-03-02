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
    const { token, action = 'submit_file', devoir_id, fichier_url, fichier_nom, reponses } = body;

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

    // ─── FILE SUBMISSION ───
    if (action === 'submit_file') {
      if (!devoir_id || !fichier_url || !fichier_nom) {
        return new Response(JSON.stringify({ error: "Données manquantes" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

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
    }

    // ─── QUIZ SUBMISSION ───
    if (action === 'submit_quiz') {
      if (!devoir_id || !reponses || !Array.isArray(reponses)) {
        return new Response(JSON.stringify({ error: "Données manquantes" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check if already submitted
      const { data: existing } = await supabaseAdmin
        .from("quiz_reponses")
        .select("id")
        .eq("devoir_id", devoir_id)
        .eq("eleve_id", eleve.id)
        .maybeSingle();

      if (existing) {
        return new Response(JSON.stringify({ error: "Quiz déjà soumis" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Fetch quiz questions to calculate score
      const { data: questions } = await supabaseAdmin
        .from("quiz_questions")
        .select("*")
        .eq("devoir_id", devoir_id)
        .order("ordre");

      if (!questions || questions.length === 0) {
        return new Response(JSON.stringify({ error: "Quiz introuvable" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Calculate score
      let score = 0;
      let scoreMax = 0;
      for (const q of questions) {
        scoreMax += q.points;
        const studentAnswer = reponses.find((r: any) => r.question_id === q.id);
        if (studentAnswer && studentAnswer.answer_index >= 0) {
          const options = q.options as any[];
          if (options[studentAnswer.answer_index]?.correct) {
            score += q.points;
          }
        }
      }

      // Insert quiz response
      const { error: insertErr } = await supabaseAdmin
        .from("quiz_reponses")
        .insert({
          devoir_id,
          eleve_id: eleve.id,
          reponses,
          score,
          score_max: scoreMax,
          soumis_at: new Date().toISOString(),
        });

      if (insertErr) throw insertErr;

      return new Response(JSON.stringify({ success: true, score, score_max: scoreMax }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── TEACHER EVALUATION ───
    if (action === 'eval_enseignant') {
      const { enseignant_id, periode, pedagogie, ponctualite, competences, relations, commentaire } = body;
      if (!enseignant_id || !periode) {
        return new Response(JSON.stringify({ error: "Données manquantes" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Validate scores
      for (const score of [pedagogie, ponctualite, competences, relations]) {
        if (typeof score !== 'number' || score < 1 || score > 10) {
          return new Response(JSON.stringify({ error: "Notes invalides (1-10)" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      // Server-side profanity filter
      const bannedWords = ['idiot','imbecile','stupide','con','connard','merde','putain','salaud',
        'enculé','bâtard','débile','crétin','abruti','foutre','chier','pute','bordel',
        'connasse','enfoiré','salopard','salope'];
      if (commentaire) {
        const lower = commentaire.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        for (const word of bannedWords) {
          const normalized = word.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
          if (lower.includes(normalized)) {
            return new Response(JSON.stringify({ error: "Commentaire inapproprié détecté" }), {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        }
      }

      // Check duplicate
      const { data: existing } = await supabaseAdmin
        .from("eval_enseignants_eleves")
        .select("id")
        .eq("eleve_id", eleve.id)
        .eq("enseignant_id", enseignant_id)
        .eq("periode", periode)
        .maybeSingle();

      if (existing) {
        return new Response(JSON.stringify({ error: "Vous avez déjà évalué ce professeur pour cette période" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error: insertErr } = await supabaseAdmin
        .from("eval_enseignants_eleves")
        .insert({
          eleve_id: eleve.id,
          enseignant_id,
          periode,
          pedagogie,
          ponctualite,
          competences,
          relations,
          commentaire: commentaire || null,
        });

      if (insertErr) throw insertErr;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Action inconnue" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("student-submit error:", e);
    return new Response(
      JSON.stringify({ error: "Erreur serveur" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
