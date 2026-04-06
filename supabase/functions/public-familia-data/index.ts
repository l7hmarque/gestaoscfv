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
    const body = await req.json();
    const { participante_id, tipo } = body;

    if (!participante_id || !tipo) {
      return respond({ error: "participante_id e tipo são obrigatórios" }, 400);
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    switch (tipo) {
      case "turmas": {
        const { data } = await supabaseAdmin
          .from("turma_participantes")
          .select("turma_id, turmas:turma_id(id, nome, periodo, dias_semana, oficina, educador_id, profiles:educador_id(nome))")
          .eq("participante_id", participante_id);
        return respond({ turmas: (data || []).map((tp: any) => tp.turmas).filter(Boolean) });
      }

      case "atividades": {
        const { data } = await supabaseAdmin
          .from("relatorio_presenca")
          .select("presente, relatorio_id, relatorios_atividade:relatorio_id(id, data, nome_atividade, tipo_atividade, dia_semana)")
          .eq("participante_id", participante_id)
          .eq("presente", true)
          .order("created_at", { ascending: false })
          .limit(10);
        return respond({
          atividades: (data || [])
            .map((rp: any) => rp.relatorios_atividade)
            .filter(Boolean),
        });
      }

      case "presenca": {
        const now = new Date();
        const mesAtual = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
        const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const mesAnterior = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, "0")}`;

        const { data: presencas } = await supabaseAdmin
          .from("presenca")
          .select("data, presente")
          .eq("participante_id", participante_id)
          .gte("data", `${mesAnterior}-01`);

        const stats = { mesAtual: { total: 0, presentes: 0 }, mesAnterior: { total: 0, presentes: 0 } };
        for (const p of presencas || []) {
          const mes = p.data.substring(0, 7);
          if (mes === mesAtual) {
            stats.mesAtual.total++;
            if (p.presente) stats.mesAtual.presentes++;
          } else if (mes === mesAnterior) {
            stats.mesAnterior.total++;
            if (p.presente) stats.mesAnterior.presentes++;
          }
        }
        return respond({ presenca: stats });
      }

      case "recados": {
        const { data } = await supabaseAdmin
          .from("recados")
          .select("id, conteudo, created_at, remetente_id, profiles:remetente_id(nome)")
          .eq("participante_id", participante_id)
          .order("created_at", { ascending: false })
          .limit(20);
        return respond({
          recados: (data || []).map((r: any) => ({
            id: r.id,
            conteudo: r.conteudo,
            created_at: r.created_at,
            remetente_nome: r.profiles?.nome || "Equipe",
          })),
        });
      }

      case "formularios": {
        const { data: formularios } = await supabaseAdmin
          .from("formularios_familia")
          .select("id, titulo, descricao, tipo, campos, created_at")
          .eq("ativo", true);

        const { data: respostas } = await supabaseAdmin
          .from("formulario_respostas")
          .select("id, formulario_id, respostas, created_at")
          .eq("participante_id", participante_id);

        const respondidosIds = new Set((respostas || []).map((r: any) => r.formulario_id));

        return respond({
          formularios: (formularios || []).map((f: any) => ({
            ...f,
            respondido: respondidosIds.has(f.id),
            resposta: (respostas || []).find((r: any) => r.formulario_id === f.id) || null,
          })),
        });
      }

      default:
        return respond({ error: "Tipo inválido" }, 400);
    }
  } catch (err) {
    return respond({ error: err.message }, 500);
  }
});
