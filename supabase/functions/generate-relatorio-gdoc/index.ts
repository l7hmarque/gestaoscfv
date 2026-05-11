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
  "1BSf2GzuXu0QYGsVg-d-plbjrqEemRXxEFX3ut86UJUg";

const MESES_UPPER = [
  "JANEIRO","FEVEREIRO","MARÇO","ABRIL","MAIO","JUNHO",
  "JULHO","AGOSTO","SETEMBRO","OUTUBRO","NOVEMBRO","DEZEMBRO",
];

/** Resolve (cria se necessário) a pasta SYSCFV/{MES} - {ANO}/{sub} e retorna seu fileId. */
async function ensureMonthSubfolder(
  yyyy: number,
  mm: number,
  sub: string,
  driveKey: string,
  lovableKey: string,
): Promise<string | null> {
  try {
    const headers = {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": driveKey,
      "Content-Type": "application/json",
    };
    const find = async (name: string, parent?: string) => {
      const pq = parent ? ` and '${parent}' in parents` : "";
      const q = `mimeType='application/vnd.google-apps.folder' and name='${name.replace(/'/g, "\\'")}' and trashed=false${pq}`;
      const url = `${DRIVE_GW}/files?q=${encodeURIComponent(q)}&fields=files(id,name)&pageSize=1&supportsAllDrives=true`;
      const r = await fetch(url, { headers });
      if (!r.ok) return null;
      const j = await r.json();
      return j.files?.[0]?.id || null;
    };
    const create = async (name: string, parent?: string) => {
      const body: any = { name, mimeType: "application/vnd.google-apps.folder" };
      if (parent) body.parents = [parent];
      const r = await fetch(`${DRIVE_GW}/files?fields=id&supportsAllDrives=true`, { method: "POST", headers, body: JSON.stringify(body) });
      if (!r.ok) return null;
      return (await r.json()).id;
    };
    const ensure = async (name: string, parent?: string) => (await find(name, parent)) || (await create(name, parent));
    const root = await ensure("SYSCFV");
    if (!root) return null;
    const monthName = `${MESES_UPPER[mm - 1]} - ${yyyy}`;
    const month = await ensure(monthName, root);
    if (!month) return null;
    return await ensure(sub, month);
  } catch (e) {
    console.warn("[ensureMonthSubfolder] falhou:", e);
    return null;
  }
}

async function moveFileToFolder(fileId: string, parentId: string, driveKey: string, lovableKey: string) {
  const headers = {
    Authorization: `Bearer ${lovableKey}`,
    "X-Connection-Api-Key": driveKey,
    "Content-Type": "application/json",
  };
  const meta = await fetch(`${DRIVE_GW}/files/${fileId}?fields=parents&supportsAllDrives=true`, { headers });
  if (!meta.ok) return;
  const cur = await meta.json();
  const removeParents = (cur.parents || []).join(",");
  const url = `${DRIVE_GW}/files/${fileId}?addParents=${parentId}${removeParents ? `&removeParents=${removeParents}` : ""}&supportsAllDrives=true&fields=id,parents`;
  await fetch(url, { method: "PATCH", headers });
}

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
  "Grupo participativo",
  "Grupo disperso",
  "Boa interação entre participantes",
  "Necessitou intervenção do educador",
];

const SITUACOES_OPCOES = [
  "Nenhuma ocorrência",
  "Conflito entre participantes",
  "Situação de vulnerabilidade identificada",
  "Encaminhamento necessário",
  "Comunicação com família/responsável",
];

const OBJETIVO_LABEL: Record<string, string> = {
  alcancado: "Alcançado",
  parcial: "Parcialmente alcançado",
  nao_alcancado: "Não alcançado",
};

const LIKERT_LABEL: Record<number, string> = {
  1: "Muito Baixo", 2: "Baixo", 3: "Moderado", 4: "Alto", 5: "Excepcional",
};

const COMPETENCIAS_DEF: { campo: string; label: string }[] = [
  { campo: "iniciativa", label: "Iniciativa" },
  { campo: "autonomia", label: "Autonomia" },
  { campo: "colaboracao", label: "Colaboração" },
  { campo: "comunicacao", label: "Comunicação" },
  { campo: "respeito_mutuo", label: "Respeito mútuo" },
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

    // Idempotência: se já existe gdoc, devolver (a menos que force=true)
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
      .select("presente, justificativa, participantes(nome_completo, status)")
      .eq("relatorio_id", relatorioId)
      .order("participantes(nome_completo)", { ascending: true });

    const educadorNome = (rel as any).profiles?.nome || "—";
    const dataField = rel.data || rel.data_atividade;
    const dataStr = fmtDate(dataField);
    const dia = rel.dia_semana || diaSemana(dataField);
    const tipoArr: string[] = Array.isArray(rel.tipo_atividade)
      ? rel.tipo_atividade
      : (rel.tipo_atividade ? [rel.tipo_atividade] : []);
    const tipoStr = tipoArr.length
      ? tipoArr.map((t: string) => tipoLabels[t] || t).join(", ") + (rel.tipo_atividade_detalhe ? ` (${rel.tipo_atividade_detalhe})` : "")
      : "—";
    const turmasStr = turmaNames.length ? turmaNames.join(", ") : "—";
    const engajList = Array.isArray(rel.engajamento) ? rel.engajamento : [];
    const sitList = Array.isArray(rel.situacoes_relevantes) ? rel.situacoes_relevantes : [];
    const score = rel.score_elo != null ? Number(rel.score_elo).toFixed(2) : "—";
    const totalPres = (pres || []).length;
    const numPres = (pres || []).filter((p: any) => p.presente).length;
    const numAus = totalPres - numPres;
    const adesaoStr = rel.pct_adesao != null
      ? `${Number(rel.pct_adesao).toFixed(0)}%`
      : (totalPres ? `${Math.round((numPres / totalPres) * 100)}%` : "—");

    const tituloSafe = safeFilename(rel.nome_atividade || "Relatorio");
    const dateNum = (dataField || "").toString().replace(/-/g, "");
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

    // 4. Construir texto do corpo (modelo institucional)
    type Line = { text: string; bold?: boolean; section?: boolean; banner?: "black" | "white" };
    const lines: Line[] = [];

    // Banner principal
    lines.push({ text: "RELATÓRIO DE ATIVIDADE", banner: "black" });
    lines.push({ text: "" });

    // 1. DADOS DA ATIVIDADE
    lines.push({ text: "DADOS DA ATIVIDADE", section: true });
    lines.push({ text: `Data: ${dataStr}` });
    lines.push({ text: `Dia da Semana: ${dia}` });
    lines.push({ text: `Educador(a): ${educadorNome}` });
    lines.push({ text: `Turma(s): ${turmasStr}` });
    lines.push({ text: `Tipo: ${tipoStr}` });
    lines.push({ text: `Nome da Atividade: ${rel.nome_atividade || "—"}` });
    lines.push({ text: "" });

    // 2. ENGAJAMENTO
    lines.push({ text: "ENGAJAMENTO", section: true });
    ENGAJAMENTO_OPCOES.forEach((op) => {
      lines.push({ text: `${engajList.includes(op) ? "■" : "☐"} ${op}` });
    });
    lines.push({ text: "" });

    // 3. COMPETÊNCIAS TRABALHADAS
    lines.push({ text: "COMPETÊNCIAS TRABALHADAS", section: true });
    let temCompetencia = false;
    for (const c of COMPETENCIAS_DEF) {
      const v = (rel as any)[c.campo];
      if (v == null) continue;
      const n = Number(v);
      const label = LIKERT_LABEL[n] || "—";
      lines.push({ text: `• ${c.label}: ${n} — ${label}` });
      temCompetencia = true;
    }
    if (!temCompetencia) lines.push({ text: "não há" });
    lines.push({ text: `Score ELO: ${score}`, bold: true });
    lines.push({ text: "" });

    // 4. RESUMO DE FREQUÊNCIA
    lines.push({ text: "RESUMO DE FREQUÊNCIA", section: true });
    lines.push({ text: `Presentes: ${numPres}    Ausentes: ${numAus}    Total: ${totalPres}    Adesão: ${adesaoStr}` });
    lines.push({ text: "" });

    // 5. OBJETIVO
    lines.push({ text: "OBJETIVO", section: true });
    lines.push({ text: rel.objetivo_alcancado ? (OBJETIVO_LABEL[rel.objetivo_alcancado] || rel.objetivo_alcancado) : "—" });
    lines.push({ text: "" });

    // 6. ATIVIDADES REALIZADAS
    lines.push({ text: "ATIVIDADES REALIZADAS", section: true });
    lines.push({ text: rel.atividades_realizadas || rel.intervencoes || "não há" });
    lines.push({ text: "" });

    // 7. OBSERVAÇÕES
    lines.push({ text: "OBSERVAÇÕES", section: true });
    lines.push({ text: rel.observacoes || "não há" });
    lines.push({ text: "" });

    // 8. INTERVENÇÕES (se distinta)
    if (rel.intervencoes && rel.intervencoes !== rel.atividades_realizadas) {
      lines.push({ text: "INTERVENÇÕES", section: true });
      lines.push({ text: rel.intervencoes });
      lines.push({ text: "" });
    }

    // 9. SITUAÇÕES RELEVANTES
    lines.push({ text: "SITUAÇÕES RELEVANTES", section: true });
    SITUACOES_OPCOES.forEach((op) => {
      lines.push({ text: `${sitList.includes(op) ? "■" : "☐"} ${op}` });
    });
    lines.push({ text: "" });

    // 10. RESULTADOS ALCANÇADOS (Análise IA)
    if (rel.analise_ia) {
      lines.push({ text: "RESULTADOS ALCANÇADOS", section: true });
      lines.push({ text: rel.analise_ia });
      lines.push({ text: "" });
    }

    // ANEXO I — LISTA DE FREQUÊNCIA
    lines.push({ text: "ANEXO I — LISTA DE FREQUÊNCIA", banner: "white" });
    lines.push({ text: "" });
    lines.push({ text: `Atividade: ${rel.nome_atividade || "—"}    Data: ${dataStr}    Turma(s): ${turmasStr}` });
    lines.push({ text: `Educador(a): ${educadorNome}` });
    lines.push({ text: "" });
    (pres || []).forEach((p: any, i: number) => {
      const marca = p.presente ? "■" : "☐";
      const nomeBase = p?.participantes?.nome_completo || "—";
      const baSuffix = p?.participantes?.status === "busca_ativa" ? " (BA)" : "";
      const just = !p.presente && p.justificativa ? `  — ${p.justificativa}` : "";
      lines.push({ text: `${String(i + 1).padStart(2, "0")}. ${marca} ${nomeBase}${baSuffix}${just}` });
    });
    if (!(pres || []).length) lines.push({ text: "Nenhum participante registrado." });
    lines.push({ text: "" });
    lines.push({ text: "" });
    lines.push({ text: "_______________________________________" });
    lines.push({ text: `Assinatura: ${educadorNome}` });

    // 5. Construir batchUpdate requests
    const requests: any[] = [];
    if (lastEnd > 2) {
      requests.push({
        deleteContentRange: {
          range: { startIndex: 1, endIndex: lastEnd - 1 },
        },
      });
    }

    let cursor = 1;
    const styleOps: any[] = [];
    const insertChunks: { text: string; index: number }[] = [];

    for (const ln of lines) {
      const text = (ln.text || "") + "\n";
      const start = cursor;
      const end = cursor + text.length - 1; // exclui o \n no range
      insertChunks.push({ text, index: cursor });
      cursor += text.length;

      if (ln.text) {
        if (ln.banner === "black") {
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
                shading: { backgroundColor: { color: { rgbColor: { red: 0, green: 0, blue: 0 } } } },
              },
              fields: "alignment,shading",
            },
          });
        } else if (ln.banner === "white") {
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
              paragraphStyle: { alignment: "CENTER" },
              fields: "alignment",
            },
          });
        } else if (ln.section) {
          styleOps.push({
            updateTextStyle: {
              range: { startIndex: start, endIndex: end },
              textStyle: { bold: true, fontSize: { magnitude: 12, unit: "PT" } },
              fields: "bold,fontSize",
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
