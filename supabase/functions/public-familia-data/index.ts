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

function fromB64url(s: string): Uint8Array {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const b64 = (s + pad).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}
async function verifyFamiliaToken(token: string, participanteId: string): Promise<boolean> {
  try {
    const [payloadStr, sig] = token.split(".");
    if (!payloadStr || !sig) return false;
    const secret = Deno.env.get("FAMILIA_TOKEN_SECRET")
      ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );
    const ok = await crypto.subtle.verify(
      "HMAC",
      key,
      fromB64url(sig),
      new TextEncoder().encode(payloadStr),
    );
    if (!ok) return false;
    const payload = JSON.parse(new TextDecoder().decode(fromB64url(payloadStr)));
    if (typeof payload.exp !== "number" || payload.exp < Math.floor(Date.now() / 1000)) return false;
    if (!Array.isArray(payload.ids) || !payload.ids.includes(participanteId)) return false;
    return true;
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { participante_id, tipo, token, acesso_id } = body;

    if (!participante_id || !tipo) {
      return respond({ error: "participante_id e tipo são obrigatórios" }, 400);
    }

    if (!token || !(await verifyFamiliaToken(token, participante_id))) {
      return respond({ error: "Token inválido ou expirado" }, 401);
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Heartbeat / log de ação (best-effort, não bloqueia)
    if (acesso_id) {
      (async () => {
        try {
          const agora = new Date();
          const { data: ac } = await supabaseAdmin
            .from("familia_acessos")
            .select("iniciado_em, acoes, total_acoes")
            .eq("id", acesso_id)
            .maybeSingle();
          if (ac) {
            const inicio = new Date(ac.iniciado_em).getTime();
            const dur = Math.max(0, Math.floor((agora.getTime() - inicio) / 1000));
            const novasAcoes = Array.isArray(ac.acoes) ? [...ac.acoes] : [];
            // mantém só últimas 50 ações
            novasAcoes.push({ tipo, em: agora.toISOString() });
            const limitadas = novasAcoes.slice(-50);
            await supabaseAdmin
              .from("familia_acessos")
              .update({
                ultimo_ping_em: agora.toISOString(),
                duracao_segundos: dur,
                total_acoes: (ac.total_acoes || 0) + 1,
                acoes: limitadas,
              })
              .eq("id", acesso_id);
          }
        } catch { /* ignore */ }
      })();
    }

    switch (tipo) {
      case "heartbeat": {
        return respond({ ok: true });
      }

      case "turmas": {
        const { data } = await supabaseAdmin
          .from("turma_participantes")
          .select("turma_id, turmas:turma_id(id, nome, nome_grupo, periodo, dias_semana, oficina, educador_id, profiles:educador_id(nome))")
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

        const stats: any = { mesAtual: { total: 0, presentes: 0 }, mesAnterior: { total: 0, presentes: 0 }, ultima_presenca: null };
        for (const p of presencas || []) {
          const mes = p.data.substring(0, 7);
          if (mes === mesAtual) {
            stats.mesAtual.total++;
            if (p.presente) stats.mesAtual.presentes++;
          } else if (mes === mesAnterior) {
            stats.mesAnterior.total++;
            if (p.presente) stats.mesAnterior.presentes++;
          }
          if (p.presente && (!stats.ultima_presenca || p.data > stats.ultima_presenca)) {
            stats.ultima_presenca = p.data;
          }
        }

        // Also check for the absolute last presence if not in the 2-month window
        if (!stats.ultima_presenca) {
          const { data: lastP } = await supabaseAdmin
            .from("presenca")
            .select("data")
            .eq("participante_id", participante_id)
            .eq("presente", true)
            .order("data", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (lastP) stats.ultima_presenca = lastP.data;
        }

        return respond({ presenca: stats });
      }

      case "recados": {
        const { data } = await supabaseAdmin
          .from("recados_familia")
          .select("id, conteudo, created_at, remetente_id, profiles:remetente_id(nome)")
          .eq("participante_id", participante_id)
          .order("created_at", { ascending: false })
          .limit(20);

        // marca como lido (best-effort, não bloqueia resposta)
        const ids = (data || []).map((r: any) => r.id);
        if (ids.length) {
          await supabaseAdmin
            .from("recados_familia")
            .update({ lido_em: new Date().toISOString() })
            .in("id", ids)
            .is("lido_em", null);
        }

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

      case "responder_formulario": {
        const { formulario_id, responsavel_nome, respostas } = body;
        if (!formulario_id) return respond({ error: "formulario_id obrigatório" }, 400);

        const { error } = await supabaseAdmin
          .from("formulario_respostas")
          .insert({
            formulario_id,
            participante_id,
            responsavel_nome: responsavel_nome || null,
            respostas: respostas || {},
          });

        if (error) return respond({ error: error.message }, 500);
        return respond({ success: true });
      }

      case "checkins": {
        // Últimos 14 dias para cálculo de streak + status do dia atual e próximos
        const hoje = new Date();
        const inicio = new Date(hoje);
        inicio.setDate(inicio.getDate() - 14);
        const inicioISO = inicio.toISOString().slice(0, 10);
        const fimISO = new Date(hoje.getTime() + 8 * 86400000).toISOString().slice(0, 10);

        const { data } = await supabaseAdmin
          .from("participante_checkins")
          .select("data, periodo, confirmado, confirmado_em, confirmado_por, observacao")
          .eq("participante_id", participante_id)
          .gte("data", inicioISO)
          .lte("data", fimISO)
          .order("data", { ascending: false });

        return respond({ checkins: data || [] });
      }

      case "registrar_checkin": {
        const { data: dataAlvo, periodo, confirmado, confirmado_por, observacao } = body;

        if (!dataAlvo || !periodo) {
          return respond({ error: "data e periodo são obrigatórios" }, 400);
        }
        if (!["manha", "tarde"].includes(periodo)) {
          return respond({ error: "periodo inválido" }, 400);
        }

        // Validação de janela (autoridade) — America/Sao_Paulo
        const TZ = "America/Sao_Paulo";
        const nowSPStr = new Date().toLocaleString("en-US", { timeZone: TZ });
        const agoraSP = new Date(nowSPStr);
        const hojeSP = new Intl.DateTimeFormat("en-CA", {
          timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
        }).format(new Date());

        const [yh, mh, dh] = hojeSP.split("-").map(Number);
        const [ya, ma, da] = String(dataAlvo).split("-").map(Number);
        const hojeDt = new Date(yh, mh - 1, dh);
        const alvoDt = new Date(ya, ma - 1, da);
        const diffDias = Math.round((alvoDt.getTime() - hojeDt.getTime()) / 86400000);

        if (diffDias < 0) {
          return respond({ error: "Não é possível confirmar para datas passadas" }, 422);
        }
        if (diffDias > 7) {
          return respond({ error: "Confirmação disponível apenas para os próximos 7 dias" }, 422);
        }
        if (diffDias === 0 && agoraSP.getHours() >= 6) {
          return respond({
            error: "Janela de confirmação encerrada às 06:00 — fale com a coordenação",
          }, 422);
        }

        // Upsert idempotente
        const { data, error } = await supabaseAdmin
          .from("participante_checkins")
          .upsert({
            participante_id,
            data: dataAlvo,
            periodo,
            confirmado: confirmado === false ? false : true,
            confirmado_em: new Date().toISOString(),
            confirmado_por: confirmado_por || null,
            observacao: observacao || null,
          }, { onConflict: "participante_id,data,periodo" })
          .select()
          .single();

        if (error) return respond({ error: error.message }, 500);
        return respond({ success: true, checkin: data });
      }

      default:
        return respond({ error: "Tipo inválido" }, 400);
    }
  } catch (err) {
    return respond({ error: err.message }, 500);
  }
});
