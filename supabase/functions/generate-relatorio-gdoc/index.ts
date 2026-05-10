// @ts-nocheck
// Edge Function: gera Google Doc do Relatório de Atividade copiando o template
// institucional (com timbre/cabeçalho/rodapé) e preenchendo o corpo via batchUpdate.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DOCS_GW = "https://connector-gateway.lovable.dev/google_docs/v1";
const DRIVE_GW = "https://connector-gateway.lovable.dev/google_drive/drive/v3";
const TEMPLATE_ID =
  Deno.env.get("GDOCS_RELATORIOS_TEMPLATE_ID") ||
  "1in9wpXN6kScnZ048pnxvboaWiqKEWzxaB_m8hr-eG2I";

const tipoLabels: Record<string, string> = {
  conteudo_pedagogico: "Conteúdo Pedagógico",
  conteudo_complementar: "Conteúdo Complementar",
  evento_atividade: "Evento / Atividade",
  reuniao_familia: "Reunião com Família",
  visita_externa: "Visita Externa",
  formacao: "Formação",
  outro: "Outro",
};

const ENGAJAMENTO_OPCOES = [
  "Participação ativa e engajada",
  "Participação parcial",
  "Pouca participação",
  "Resistência / dispersão",
];

function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  try {
    const dt = new Date(d.length === 10 ? d + "T12:00:00" : d);
    return dt.toLocaleDateString("pt-BR");
  } catch {
    return String(d);
  }
}

function diaSemana(d: string | null | undefined): string {
  if (!d) return "—";
  try {
    const dt = new Date(d.length === 10 ? d + "T12:00:00" : d);
    return dt.toLocaleDateString("pt-BR", { weekday: "long" });
  } catch {
    return "—";
  }
}

function safeFilename(s: string): string {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "_")
    .slice(0, 60);
}

async function gw(
  url: string,
  init: RequestInit,
  driveKey: string,
  lovableKey: string,
  useDocsKey?: string,
) {
  const headers = {
    Authorization: `Bearer ${lovableKey}`,
    "X-Connection-Api-Key": useDocsKey || driveKey,
    "Content-Type": "application/json",
    ...(init.headers || {}),
  };
  const res = await fetch(url, { ...init, headers });
  const text = await res.text();
  let body: any = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!res.ok) {
    throw new Error(`[${res.status}] ${url}: ${typeof body === "string" ? body : JSON.stringify(body)}`);
  }
  return body;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const GOOGLE_DOCS_API_KEY = Deno.env.get("GOOGLE_DOCS_API_KEY");
    const GOOGLE_DRIVE_API_KEY = Deno.env.get("GOOGLE_DRIVE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY ausente");
    if (!GOOGLE_DOCS_API_KEY) throw new Error("GOOGLE_DOCS_API_KEY ausente — conecte Google Docs");
    if (!GOOGLE_DRIVE_API_KEY) throw new Error("GOOGLE_DRIVE_API_KEY ausente — conecte Google Drive");

    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supaUrl = Deno.env.get("SUPABASE_URL")!;
    const supaAnon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supaSvc = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const userClient = createClient(supaUrl, supaAnon, {
      global: { headers: { Authorization: auth } },
    });
    const { data: claims, error: claimsErr } = await userClient.auth.getClaims(
      auth.replace("Bearer ", ""),
    );
    if (claimsErr || !claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { relatorioId, force } = await req.json();
    if (!relatorioId || typeof relatorioId !== "string") {
      return new Response(JSON.stringify({ error: "relatorioId obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const svc = createClient(supaUrl, supaSvc);

    // 1. Carregar dados do relatório
    const { data: rel, error: relErr } = await svc
      .from("relatorios_atividade")
      .select("*, profiles!relatorios_atividade_educador_id_fkey(nome)")
      .eq("id", relatorioId)
      .maybeSingle();
    if (relErr || !rel) throw new Error(relErr?.message || "Relatório não encontrado");

    // Idempotência: se já existe gdoc, devolver
    if (rel.gdoc_url && !force) {
      return new Response(
        JSON.stringify({ url: rel.gdoc_url, fileId: rel.gdoc_id, cached: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: tt } = await svc
      .from("relatorio_turmas")
      .select("turmas(nome)")
      .eq("relatorio_id", relatorioId);
    const turmaNames = (tt || []).map((r: any) => r?.turmas?.nome).filter(Boolean);

    const { data: pres } = await svc
      .from("relatorio_presenca")
      .select("presente, justificativa, participantes(nome_completo)")
      .eq("relatorio_id", relatorioId);

    const presentes = (pres || []).filter((p: any) => p.presente);
    const ausentes = (pres || []).filter((p: any) => !p.presente);
    const total = (pres || []).length;
    const adesao = total ? Math.round((presentes.length / total) * 100) : 0;

    const educadorNome = (rel as any).profiles?.nome || "—";
    const dataStr = fmtDate(rel.data_atividade);
    const dia = diaSemana(rel.data_atividade);
    const tipoStr = tipoLabels[rel.tipo_atividade] || rel.tipo_atividade || "—";
    const turmasStr = turmaNames.length ? turmaNames.join(", ") : "—";
    const engajList = Array.isArray(rel.engajamento) ? rel.engajamento : [];
    const compMap: Record<string, number> = (rel.competencias as any) || {};
    const score = rel.score_elo != null ? Number(rel.score_elo).toFixed(2) : "—";

    const tituloSafe = safeFilename(rel.nome_atividade || "Relatorio");
    const dateNum = (rel.data_atividade || "").replace(/-/g, "");
    const fileName = `SysCFV_Relatorio_${dateNum}_${tituloSafe}`;

    // 2. Copiar template (Drive)
    const copy = await gw(
      `${DRIVE_GW}/files/${TEMPLATE_ID}/copy?supportsAllDrives=true&fields=id,webViewLink`,
      { method: "POST", body: JSON.stringify({ name: fileName }) },
      GOOGLE_DRIVE_API_KEY,
      LOVABLE_API_KEY,
    );
    const fileId: string = copy.id;
    const webViewLink: string = copy.webViewLink || `https://docs.google.com/document/d/${fileId}/edit`;

    // 3. Buscar doc para descobrir endIndex do body (Docs API)
    const doc = await gw(
      `${DOCS_GW}/documents/${fileId}`,
      { method: "GET" },
      GOOGLE_DRIVE_API_KEY,
      LOVABLE_API_KEY,
      GOOGLE_DOCS_API_KEY,
    );
    const bodyContent: any[] = doc?.body?.content || [];
    const lastEnd = bodyContent.length
      ? bodyContent[bodyContent.length - 1].endIndex
      : 1;
    // O último \n do body não pode ser apagado — limpamos do índice 1 até lastEnd-1.

    // 4. Construir texto do corpo
    const lines: { text: string; bold?: boolean; heading?: boolean; banner?: "red" | "gray" }[] = [];

    lines.push({ text: "RELATÓRIO DE ATIVIDADE", banner: "red" });
    lines.push({ text: "" });
    lines.push({ text: "DADOS DA ATIVIDADE", bold: true });
    lines.push({ text: `Data: ${dataStr}` });
    lines.push({ text: `Dia da Semana: ${dia}` });
    lines.push({ text: `Educador(a): ${educadorNome}` });
    lines.push({ text: `Turma(s): ${turmasStr}` });
    lines.push({ text: `Tipo: ${tipoStr}` });
    lines.push({ text: `Nome da Atividade: ${rel.nome_atividade || "—"}` });
    lines.push({ text: "" });

    lines.push({ text: "ENGAJAMENTO", bold: true });
    const engLine = ENGAJAMENTO_OPCOES.map(
      (op) => `${engajList.includes(op) ? "■" : "☐"} ${op}`,
    ).join("    ");
    lines.push({ text: engLine });
    lines.push({ text: "" });

    lines.push({ text: "COMPETÊNCIAS TRABALHADAS", bold: true });
    const compEntries = Object.entries(compMap);
    if (compEntries.length) {
      for (const [k, v] of compEntries) {
        const nivel =
          v >= 5 ? "Avançado" : v >= 4 ? "Bom" : v >= 3 ? "Moderado" : v >= 2 ? "Inicial" : "Não trabalhado";
        lines.push({ text: `• ${k}: ${v} — ${nivel}` });
      }
    } else {
      lines.push({ text: "não há" });
    }
    lines.push({ text: `Score ELO: ${score}`, bold: true });
    lines.push({ text: "" });

    lines.push({ text: "RESUMO DE FREQUÊNCIA", bold: true });
    lines.push({ text: `Presentes: ${presentes.length}    Ausentes: ${ausentes.length}    Adesão: ${adesao}%` });
    lines.push({ text: "" });

    lines.push({ text: "OBJETIVO", bold: true });
    lines.push({ text: rel.objetivo_alcancado ? "Alcançado" : "Parcialmente alcançado / Não alcançado" });
    lines.push({ text: "" });

    lines.push({ text: "ATIVIDADES REALIZADAS", bold: true });
    lines.push({ text: rel.atividades_realizadas || "não há" });
    lines.push({ text: "" });

    lines.push({ text: "OBSERVAÇÕES", bold: true });
    lines.push({ text: rel.observacoes || "não há" });
    lines.push({ text: "" });

    // ANEXO I
    lines.push({ text: "ANEXO I — LISTA DE FREQUÊNCIA", banner: "gray" });
    lines.push({ text: `Atividade: ${rel.nome_atividade || "—"}    Data: ${dataStr}    Turma(s): ${turmasStr}` });
    lines.push({ text: `Educador(a): ${educadorNome}` });
    lines.push({ text: "" });
    (pres || []).forEach((p: any, i: number) => {
      const marca = p.presente ? "■" : "☐";
      const nome = p?.participantes?.nome_completo || "—";
      const just = !p.presente && p.justificativa ? `  (${p.justificativa})` : "";
      lines.push({ text: `${String(i + 1).padStart(2, "0")}. ${marca} ${nome}${just}` });
    });
    if (!(pres || []).length) lines.push({ text: "Nenhum participante registrado." });
    lines.push({ text: "" });
    lines.push({ text: "_______________________________________" });
    lines.push({ text: `Assinatura: ${educadorNome}` });

    // 5. Construir batchUpdate requests
    // Estratégia: 1) limpar body, 2) inserir tudo como um único insertText na posição 1
    // (depois aplicar styles por intervalo).
    const requests: any[] = [];
    if (lastEnd > 2) {
      requests.push({
        deleteContentRange: {
          range: { startIndex: 1, endIndex: lastEnd - 1 },
        },
      });
    }

    // Construir texto consolidado e mapa de estilos
    let cursor = 1;
    const styleOps: any[] = [];
    const insertChunks: { text: string; index: number }[] = [];

    for (const ln of lines) {
      const text = (ln.text || "") + "\n";
      const start = cursor;
      const end = cursor + text.length - 1; // exclui o \n no range visual
      insertChunks.push({ text, index: cursor });
      cursor += text.length;

      if (ln.text) {
        if (ln.banner === "red") {
          styleOps.push({
            updateTextStyle: {
              range: { startIndex: start, endIndex: end },
              textStyle: {
                bold: true,
                fontSize: { magnitude: 14, unit: "PT" },
                foregroundColor: { color: { rgbColor: { red: 1, green: 1, blue: 1 } } },
              },
              fields: "bold,fontSize,foregroundColor",
            },
          });
          styleOps.push({
            updateParagraphStyle: {
              range: { startIndex: start, endIndex: end },
              paragraphStyle: {
                alignment: "CENTER",
                shading: { backgroundColor: { color: { rgbColor: { red: 0.7, green: 0.1, blue: 0.1 } } } },
              },
              fields: "alignment,shading",
            },
          });
        } else if (ln.banner === "gray") {
          styleOps.push({
            updateTextStyle: {
              range: { startIndex: start, endIndex: end },
              textStyle: { bold: true, fontSize: { magnitude: 12, unit: "PT" } },
              fields: "bold,fontSize",
            },
          });
          styleOps.push({
            updateParagraphStyle: {
              range: { startIndex: start, endIndex: end },
              paragraphStyle: {
                alignment: "CENTER",
                shading: { backgroundColor: { color: { rgbColor: { red: 0.85, green: 0.85, blue: 0.85 } } } },
              },
              fields: "alignment,shading",
            },
          });
        } else if (ln.bold) {
          styleOps.push({
            updateTextStyle: {
              range: { startIndex: start, endIndex: end },
              textStyle: { bold: true },
              fields: "bold",
            },
          });
        }
      }
    }

    // Inserir em ordem reversa para que os índices não desloquem
    const reversed = [...insertChunks].reverse();
    for (const c of reversed) {
      requests.push({ insertText: { location: { index: 1 }, text: c.text } });
    }
    // Os styleOps usam índices baseados em texto inserido a partir de 1, na ordem original.
    // Como inserimos tudo a partir de index=1 sequencialmente, os índices finais batem.
    requests.push(...styleOps);

    // 6. Aplicar batchUpdate
    await gw(
      `${DOCS_GW}/documents/${fileId}:batchUpdate`,
      { method: "POST", body: JSON.stringify({ requests }) },
      GOOGLE_DRIVE_API_KEY,
      LOVABLE_API_KEY,
      GOOGLE_DOCS_API_KEY,
    );

    // 7. Compartilhar como "qualquer pessoa com o link pode visualizar"
    try {
      await gw(
        `${DRIVE_GW}/files/${fileId}/permissions?supportsAllDrives=true`,
        {
          method: "POST",
          body: JSON.stringify({ role: "reader", type: "anyone" }),
        },
        GOOGLE_DRIVE_API_KEY,
        LOVABLE_API_KEY,
      );
    } catch (permErr) {
      console.warn("[gdoc] permissão pública falhou:", permErr);
    }

    // 8. Persistir no relatório
    await svc
      .from("relatorios_atividade")
      .update({ gdoc_id: fileId, gdoc_url: webViewLink })
      .eq("id", relatorioId);

    return new Response(
      JSON.stringify({ url: webViewLink, fileId, cached: false }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[generate-relatorio-gdoc] erro:", err);
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});