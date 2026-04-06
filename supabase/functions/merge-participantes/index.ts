import { createClient } from "npm:@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function respond(body: object, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Validate JWT - only coordenacao can merge
    const authHeader = req.headers.get("authorization");
    if (!authHeader) return respond({ error: "Não autorizado" }, 401);

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: userErr } = await supabaseUser.auth.getUser();
    if (userErr || !user) return respond({ error: "Não autorizado" }, 401);

    // Check role
    const { data: hasRole } = await supabaseAdmin.rpc("has_role", {
      _user_id: user.id,
      _role: "coordenacao",
    });
    if (!hasRole) return respond({ error: "Apenas coordenação pode mesclar participantes" }, 403);

    const { keep_id, remove_id } = await req.json();
    if (!keep_id || !remove_id || keep_id === remove_id) {
      return respond({ error: "IDs inválidos" }, 400);
    }

    // Verify both exist
    const { data: keepPart } = await supabaseAdmin.from("participantes").select("id, nome_completo").eq("id", keep_id).single();
    const { data: removePart } = await supabaseAdmin.from("participantes").select("id, nome_completo").eq("id", remove_id).single();
    if (!keepPart || !removePart) return respond({ error: "Participante não encontrado" }, 404);

    // Transfer all relations from remove_id to keep_id
    // turma_participantes - avoid duplicates
    const { data: existingTurmas } = await supabaseAdmin
      .from("turma_participantes").select("turma_id").eq("participante_id", keep_id);
    const existingTurmaIds = new Set((existingTurmas || []).map(t => t.turma_id));

    const { data: removeTurmas } = await supabaseAdmin
      .from("turma_participantes").select("id, turma_id").eq("participante_id", remove_id);
    for (const t of (removeTurmas || [])) {
      if (!existingTurmaIds.has(t.turma_id)) {
        await supabaseAdmin.from("turma_participantes").update({ participante_id: keep_id }).eq("id", t.id);
      }
    }
    await supabaseAdmin.from("turma_participantes").delete().eq("participante_id", remove_id);

    // presenca
    await supabaseAdmin.from("presenca").update({ participante_id: keep_id }).eq("participante_id", remove_id);

    // participante_documentos
    await supabaseAdmin.from("participante_documentos").update({ participante_id: keep_id }).eq("participante_id", remove_id);

    // atendimentos
    await supabaseAdmin.from("atendimentos").update({ participante_id: keep_id }).eq("participante_id", remove_id);

    // relatorio_presenca
    await supabaseAdmin.from("relatorio_presenca").update({ participante_id: keep_id }).eq("participante_id", remove_id);

    // recados
    await supabaseAdmin.from("recados").update({ participante_id: keep_id }).eq("participante_id", remove_id);

    // participante_transferencias
    await supabaseAdmin.from("participante_transferencias").update({ participante_id: keep_id }).eq("participante_id", remove_id);

    // Delete the duplicate
    await supabaseAdmin.from("participantes").delete().eq("id", remove_id);

    return respond({
      success: true,
      message: `"${removePart.nome_completo}" mesclado em "${keepPart.nome_completo}"`,
    });
  } catch (err) {
    return respond({ error: err.message || "Erro interno" }, 500);
  }
});
