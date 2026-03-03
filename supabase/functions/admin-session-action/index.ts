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
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify caller is admin
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin role
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin");

    if (!roles || roles.length === 0) {
      return new Response(JSON.stringify({ error: "Accès réservé aux administrateurs" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, type, ref_id, connection_id, new_password } = await req.json();

    // === FORCE DISCONNECT ===
    if (action === "disconnect") {
      if (!connection_id) {
        return new Response(JSON.stringify({ error: "connection_id requis" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error: delErr } = await supabaseAdmin
        .from("active_connections")
        .delete()
        .eq("id", connection_id);

      if (delErr) throw delErr;

      return new Response(JSON.stringify({ success: true, message: "Utilisateur déconnecté" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === CHANGE PASSWORD ===
    if (action === "change_password") {
      if (!type || !ref_id || !new_password) {
        return new Response(JSON.stringify({ error: "type, ref_id et new_password requis" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (new_password.length < 4) {
        return new Response(JSON.stringify({ error: "Le mot de passe doit contenir au moins 4 caractères" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (type === "eleve") {
        // Update student password (trigger will hash it)
        const { error: updErr } = await supabaseAdmin
          .from("eleves")
          .update({ mot_de_passe_eleve: new_password })
          .eq("id", ref_id);
        if (updErr) throw updErr;
      } else if (type === "employe") {
        // Update employee password (trigger will hash it)
        const { error: updErr } = await supabaseAdmin
          .from("employes")
          .update({ mot_de_passe: new_password })
          .eq("id", ref_id);
        if (updErr) throw updErr;
      } else if (type === "parent") {
        const { error: updErr } = await supabaseAdmin
          .from("familles")
          .update({ code_acces: new_password })
          .eq("id", ref_id);
        if (updErr) throw updErr;
      } else if (type === "admin_user") {
        // Reset Supabase auth user password
        const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(ref_id, {
          password: new_password,
        });
        if (updErr) throw updErr;
        // Set must_change_password flag
        await supabaseAdmin
          .from("profiles")
          .update({ must_change_password: true })
          .eq("user_id", ref_id);
      } else {
        return new Response(JSON.stringify({ error: "Type non supporté pour le changement de mot de passe" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true, message: "Mot de passe modifié avec succès" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Action non reconnue" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("admin-session-action error:", e);
    return new Response(JSON.stringify({ error: "Erreur serveur" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
