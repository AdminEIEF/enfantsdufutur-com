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
    const { token, action } = await req.json();

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
    const niveauId = (eleve as any).classes?.niveau_id;
    const cycleId = (eleve as any).classes?.niveaux?.cycle_id;

    if (action === "cours") {
      // Get courses for this student's class (only visible ones)
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
      // Get assignments for this student's class
      const { data: devoirs } = await supabaseAdmin
        .from("devoirs")
        .select("*, matieres:matiere_id(nom, pole)")
        .eq("classe_id", classeId)
        .order("date_limite", { ascending: true });

      // Get student's submissions
      const { data: soumissions } = await supabaseAdmin
        .from("soumissions_devoirs")
        .select("*")
        .eq("eleve_id", eleveId);

      return new Response(JSON.stringify({ 
        devoirs: devoirs || [], 
        soumissions: soumissions || [] 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "resultats") {
      // Get notes for this student
      const { data: notes } = await supabaseAdmin
        .from("notes")
        .select("*, matieres:matiere_id(nom, pole, coefficient), periodes:periode_id(nom, ordre)")
        .eq("eleve_id", eleveId)
        .order("created_at", { ascending: false });

      // Get bulletin publications for this class
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

      // Get submission notes
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

    if (action === "dashboard") {
      // Summary data
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

      // Count visible bulletins
      let bulletinCount = 0;
      if (classeId) {
        const { count } = await supabaseAdmin
          .from("bulletin_publications")
          .select("id", { count: "exact", head: true })
          .eq("classe_id", classeId)
          .eq("visible_parent", true);
        bulletinCount = count || 0;
      }

      return new Response(JSON.stringify({
        prochains_devoirs: devoirs || [],
        derniers_cours: cours || [],
        nb_soumissions: (soumissions || []).length,
        nb_bulletins: bulletinCount,
        solde_cantine: eleve.solde_cantine || 0,
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
      JSON.stringify({ error: e instanceof Error ? e.message : "Erreur serveur" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
