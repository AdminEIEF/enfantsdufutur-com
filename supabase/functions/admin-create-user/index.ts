import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
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
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify caller JWT via getClaims (doesn't require active session)
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await callerClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callerId = claimsData.claims.sub as string;
    const callerEmail = claimsData.claims.email as string;

    // Check superviseur/admin role using service role client (bypasses RLS)
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
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
