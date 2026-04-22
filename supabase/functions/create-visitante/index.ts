import { createClient } from "npm:@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // Auth gate: only authenticated coordenacao users may create/reset the demo account
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await supabaseAuth.auth.getClaims(token);
    if (claimsErr || !claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: isCoord } = await supabaseAdmin.rpc("has_role", {
      _user_id: claims.claims.sub,
      _role: "coordenacao",
    });
    if (!isCoord) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const visitantePassword = Deno.env.get("VISITANTE_PASSWORD") ?? crypto.randomUUID();

    // Check if user already exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existing = existingUsers?.users?.find((u: any) => u.email === "visitante@syselo.demo");
    
    if (existing) {
      // Update password to current one
      await supabaseAdmin.auth.admin.updateUserById(existing.id, { password: visitantePassword });
      return new Response(JSON.stringify({ success: true, message: "Visitante atualizado", user_id: existing.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create user
    const { data: userData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: "visitante@syselo.demo",
      password: visitantePassword,
      email_confirm: true,
      user_metadata: { full_name: "Visitante Demo" },
    });

    if (createError) throw createError;

    const userId = userData.user.id;

    // Update profile
    await supabaseAdmin.from("profiles").update({ nome: "Visitante Demo", cargo: "Visitante" }).eq("user_id", userId);

    // Assign role
    await supabaseAdmin.from("user_roles").insert({ user_id: userId, role: "visitante" });

    return new Response(JSON.stringify({ success: true, user_id: userId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
