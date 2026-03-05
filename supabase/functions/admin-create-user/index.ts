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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Use admin client to validate JWT (bypasses session check)
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller }, error: userError } = await adminClient.auth.getUser(token);
    if (userError || !caller) {
      console.error("Auth error:", userError?.message);
      return new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callerId = caller.id;
    const callerEmail = caller.email || "";

    // Check superviseur/admin role
    const { data: rolesData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId);
    const roleList = (rolesData || []).map((r: any) => r.role);
    if (!roleList.includes("superviseur") && !roleList.includes("admin")) {
      return new Response(JSON.stringify({ error: "Accès réservé au superviseur ou administrateur" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { email, password, nom, prenom, role } = await req.json();
    if (!email || !password || !nom || !prenom || !role) {
      return new Response(JSON.stringify({ error: "Tous les champs sont requis" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create user with admin API
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nom, prenom },
    });

    if (createError) {
      return new Response(JSON.stringify({ error: createError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = newUser.user.id;

    // Update profile
    await adminClient.from("profiles").update({
      nom,
      prenom,
      display_name: `${prenom} ${nom}`,
      must_change_password: true,
    }).eq("user_id", userId);

    // Assign role
    await adminClient.from("user_roles").insert({
      user_id: userId,
      role,
    });

    // Audit log
    await adminClient.from("audit_log").insert({
      user_id: callerId,
      user_email: callerEmail,
      action: "CREATE_USER",
      table_name: "auth.users",
      record_id: userId,
      details: { email, nom, prenom, role, created_by: callerEmail },
    });

    return new Response(
      JSON.stringify({ success: true, user_id: userId, email }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
