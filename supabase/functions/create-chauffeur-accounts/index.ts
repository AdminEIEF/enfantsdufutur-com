import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const chauffeurs = [
      { email: "balde.chauffeur@enfantsdufutur.com", nom: "BALDE", prenom: "BALDE", password: "Bus2025!" },
      { email: "conde.chauffeur@enfantsdufutur.com", nom: "CONDE", prenom: "MORY", password: "Bus2025!" },
      { email: "sylla.chauffeur@enfantsdufutur.com", nom: "SYLLA", prenom: "ABDOUL KARIM", password: "Bus2025!" },
      { email: "soumah.chauffeur@enfantsdufutur.com", nom: "SOUMAH", prenom: "IBRAHIMA SORY", password: "Bus2025!" },
    ];

    const results = [];

    for (const c of chauffeurs) {
      // Check if user already exists
      const { data: existingUsers } = await adminClient.auth.admin.listUsers();
      const existing = existingUsers?.users?.find((u: any) => u.email === c.email);
      
      if (existing) {
        // Ensure role exists
        await adminClient.from("user_roles").upsert(
          { user_id: existing.id, role: "chauffeur" },
          { onConflict: "user_id,role" }
        );
        results.push({ email: c.email, status: "already_exists", user_id: existing.id });
        continue;
      }

      const { data, error } = await adminClient.auth.admin.createUser({
        email: c.email,
        password: c.password,
        email_confirm: true,
        user_metadata: { nom: c.nom, prenom: c.prenom },
      });

      if (error) {
        results.push({ email: c.email, status: "error", message: error.message });
        continue;
      }

      const userId = data.user.id;

      // Assign chauffeur role
      await adminClient.from("user_roles").insert({ user_id: userId, role: "chauffeur" });

      // Update profile
      await adminClient.from("profiles").update({
        nom: c.nom,
        prenom: c.prenom,
        display_name: `${c.prenom} ${c.nom}`,
        must_change_password: true,
      }).eq("user_id", userId);

      results.push({ email: c.email, status: "created", user_id: userId });
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
