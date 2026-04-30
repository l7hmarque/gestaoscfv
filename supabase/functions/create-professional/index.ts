import { createClient } from "npm:@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Verify caller is coordenacao
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const callerClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user: caller } } = await callerClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!caller) return new Response(JSON.stringify({ error: "Não autenticado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: hasRole } = await supabaseAdmin.rpc("has_role", { _user_id: caller.id, _role: "coordenacao" });
    if (!hasRole) return new Response(JSON.stringify({ error: "Apenas coordenação pode cadastrar profissionais" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { email, password, nome, cargo, role, cpf, rg, rg_data_expedicao, rg_orgao_expedidor, registro_profissional, endereco, telefone, data_inicio } = await req.json();

    if (!email || !password || !nome || !role) {
      return new Response(JSON.stringify({ error: "Email, senha, nome e permissão são obrigatórios" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Create user with admin API (auto-confirms email)
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: nome },
    });

    if (createError) {
      return new Response(JSON.stringify({ error: createError.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Update profile with additional data
    const { data: profile } = await supabaseAdmin.from("profiles").select("id").eq("user_id", newUser.user.id).single();
    if (profile) {
      await supabaseAdmin.from("profiles").update({
        nome, cargo: cargo || null, cpf: cpf || null, rg: rg || null,
        rg_data_expedicao: rg_data_expedicao || null, rg_orgao_expedidor: rg_orgao_expedidor || null,
        registro_profissional: registro_profissional || null, endereco: endereco || null,
        telefone: telefone || null, data_inicio: data_inicio || null, email,
      }).eq("id", profile.id);
    }

    // Assign role
    await supabaseAdmin.from("user_roles").insert({ user_id: newUser.user.id, role });

    return new Response(JSON.stringify({ success: true, user_id: newUser.user.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
