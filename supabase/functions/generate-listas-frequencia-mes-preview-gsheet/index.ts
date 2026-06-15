// @ts-nocheck
// PREVIEW: Lista de Frequência Mensal "limpa" — sem alterar a geração oficial.
// Regra:
//   - referência = ÚLTIMO dia do mês
//   - entra somente quem está vinculado no fim do mês:
//       turma_participantes: data_entrada <= v_last AND (data_saida IS NULL OR data_saida > v_last)
//   - somente status 'ativo' ou 'cadastro_incompleto'
//   - exclui busca_ativa, desligado, transferido
//   - cabeçalho/legenda sem marcadores (BA)/(D)/(T)
//   - abas extras: RESUMO, REMOVIDOS, INCONSISTENCIAS
// Salvo em SYSCFV/{MES} - {ANO}/ZZ_Preview_Limpa/.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SHEETS_GW = "https://connector-gateway.lovable.dev/google_sheets/v4";
const DRIVE_GW = "https://connector-gateway.lovable.dev/google_drive/drive/v3";

const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const MESES_UPPER = MESES.map(m => m.toUpperCase());
const PERIODO_LABEL: Record<string, string> = { manha: "Manhã", tarde: "Tarde", integral: "Integral" };
const FAIXA_LABEL: Record<string, string> = { "6-8": "6-8 anos", "9-11": "9-11 anos", "12-17": "12-17 anos", idosos: "Idosos" };
const DIA_SEMANA_MAP: Record<string, number> = { dom: 0, seg: 1, ter: 2, qua: 3, qui: 4, sex: 5, sab: 6 };

function pad2(n: number): string { return String(n).padStart(2, "0"); }
function safeTab(s: string): string { return (s || "Turma").replace(/[\[\]\*\?\/\\:]/g, " ").slice(0, 95); }

function diasDoMesPorSemana(ano: number, mes: number, diasSemana: string[]): string[] {
  const targets = new Set((diasSemana || []).map(d => DIA_SEMANA_MAP[String(d).toLowerCase()]).filter(n => n !== undefined));
  if (!targets.size) return [];
  const out: string[] = [];
  const last = new Date(ano, mes, 0).getDate();
  for (let d = 1; d <= last; d++) {
    if (targets.has(new Date(ano, mes - 1, d).getDay())) out.push(`${ano}-${pad2(mes)}-${pad2(d)}`);
  }
  return out;
}

async function gw(url: string, init: RequestInit, sheetsKey: string, lovableKey: string, useDriveKey?: string) {
  const headers = {
    Authorization: `Bearer ${lovableKey}`,
    "X-Connection-Api-Key": useDriveKey || sheetsKey,
    "Content-Type": "application/json",
    ...(init.headers || {}),
  };
  const RETRIABLE = new Set([429, 500, 502, 503, 504]);
  const MAX_ATTEMPTS = 4;
  let lastErr: any = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url, { ...init, headers });
      const text = await res.text();
      let body: any = null;
      try { body = text ? JSON.parse(text) : null; } catch { body = text; }
      if (res.ok) return body;
      if (RETRIABLE.has(res.status) && attempt < MAX_ATTEMPTS) {
        await new Promise(r => setTimeout(r, 600 * Math.pow(2, attempt - 1)));
        continue;
      }
      throw new Error(`[${res.status}] ${url}: ${typeof body === "string" ? body : JSON.stringify(body)}`);
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      const isNet = !/^\[\d{3}\]/.test(msg);
      if (isNet && attempt < MAX_ATTEMPTS) {
        await new Promise(r => setTimeout(r, 600 * Math.pow(2, attempt - 1)));
        continue;
      }
      throw err;
    }
  }
  throw lastErr || new Error(`gw failed: ${url}`);
}

async function ensureMonthSubfolder(yyyy: number, mm: number, sub: string, driveKey: string, lovableKey: string): Promise<string | null> {
  try {
    const headers = { Authorization: `Bearer ${lovableKey}`, "X-Connection-Api-Key": driveKey, "Content-Type": "application/json" };
    const find = async (name: string, parent?: string) => {
      const pq = parent ? ` and '${parent}' in parents` : "";
      const q = `mimeType='application/vnd.google-apps.folder' and name='${name.replace(/'/g, "\\'")}' and trashed=false${pq}`;
      const r = await fetch(`${DRIVE_GW}/files?q=${encodeURIComponent(q)}&fields=files(id)&pageSize=1&supportsAllDrives=true`, { headers });
      if (!r.ok) return null;
      return (await r.json()).files?.[0]?.id || null;
    };
    const create = async (name: string, parent?: string) => {
      const body: any = { name, mimeType: "application/vnd.google-apps.folder" };
      if (parent) body.parents = [parent];
      const r = await fetch(`${DRIVE_GW}/files?fields=id&supportsAllDrives=true`, { method: "POST", headers, body: JSON.stringify(body) });
      if (!r.ok) return null;
      return (await r.json()).id;
    };
    const ensure = async (n: string, p?: string) => (await find(n, p)) || (await create(n, p));
    const root = await ensure("SYSCFV"); if (!root) return null;
    const month = await ensure(`${MESES_UPPER[mm - 1]} - ${yyyy}`, root); if (!month) return null;
    return await ensure(sub, month);
  } catch (e) { console.warn(e); return null; }
}

async function moveFileToFolder(fileId: string, parentId: string, driveKey: string, lovableKey: string) {
  const headers = { Authorization: `Bearer ${lovableKey}`, "X-Connection-Api-Key": driveKey, "Content-Type": "application/json" };
  const meta = await fetch(`${DRIVE_GW}/files/${fileId}?fields=parents&supportsAllDrives=true`, { headers });
  if (!meta.ok) return;
  const cur = await meta.json();
  const removeParents = (cur.parents || []).join(",");
  await fetch(`${DRIVE_GW}/files/${fileId}?addParents=${parentId}${removeParents ? `&removeParents=${removeParents}` : ""}&supportsAllDrives=true&fields=id`, { method: "PATCH", headers });
}

function plainCell(value: string | number | null, opts: any = {}, note?: string) {
  const c: any = { userEnteredFormat: opts };
  if (value === null || value === undefined) c.userEnteredValue = { stringValue: "" };
  else if (typeof value === "number") c.userEnteredValue = { numberValue: value };
  else c.userEnteredValue = { stringValue: String(value) };
  if (note) c.note = note;
  return c;
}
function richCell(runs: Array<{ text: string; bold?: boolean }>, opts: any = {}) {
  const fullText = runs.map(r => r.text).join("");
  const textFormatRuns: any[] = [];
  let idx = 0;
  for (const r of runs) { textFormatRuns.push({ startIndex: idx, format: { bold: !!r.bold } }); idx += r.text.length; }
  return { userEnteredValue: { stringValue: fullText }, userEnteredFormat: opts, textFormatRuns };
}

function buildTurmaSheet(turma: any, members: any[], presencasMap: any, relatorioDates: Set<string>, anoNum: number, mesNum: number) {
  const diasSemana: string[] = turma.dias_semana || [];
  const datesISO = diasDoMesPorSemana(anoNum, mesNum, diasSemana);
  if (!datesISO.length) return null;
  const datas = datesISO.map(d => `${d.slice(8,10)}/${d.slice(5,7)}`);

  const totalCols = 2 + datas.length;
  const periodoStr = turma.periodo ? (PERIODO_LABEL[turma.periodo] || turma.periodo) : "";
  const faixaStr = turma.faixa_etaria ? (FAIXA_LABEL[turma.faixa_etaria] || turma.faixa_etaria) : "";
  const educadorStr = turma.profiles?.nome || "—";
  const bairroStr = turma.bairros?.nome || "—";

  const black = { red: 0, green: 0, blue: 0 };
  const white = { red: 1, green: 1, blue: 1 };
  const border = { style: "SOLID", color: black };
  const allBorders = { top: border, bottom: border, left: border, right: border };
  const baseFmt = { borders: allBorders, verticalAlignment: "MIDDLE", horizontalAlignment: "CENTER", wrapStrategy: "WRAP", textFormat: { fontFamily: "Calibri", fontSize: 11 } };
  const headerInstFmt = { ...baseFmt, backgroundColor: black, textFormat: { fontFamily: "Calibri", fontSize: 12, bold: true, foregroundColor: white } };
  const subHeaderInstFmt = { ...baseFmt, textFormat: { fontFamily: "Calibri", fontSize: 11, bold: true } };
  const subHeaderItalicFmt = { ...baseFmt, textFormat: { fontFamily: "Calibri", fontSize: 11, bold: true, italic: true } };
  const titleFmt = { ...baseFmt, backgroundColor: black, textFormat: { fontFamily: "Calibri", fontSize: 13, bold: true, foregroundColor: white } };
  const turmaNameFmt = { ...baseFmt, textFormat: { fontFamily: "Calibri", fontSize: 12, bold: true } };
  const tableHeaderFmt = { ...baseFmt, backgroundColor: black, textFormat: { fontFamily: "Calibri", fontSize: 11, bold: true, foregroundColor: white } };
  const cellNameFmt = { ...baseFmt, horizontalAlignment: "LEFT" };
  const signFmt = { ...baseFmt, horizontalAlignment: "LEFT", textFormat: { fontFamily: "Calibri", fontSize: 10, bold: true, italic: true } };
  const legendFmt = { ...baseFmt, horizontalAlignment: "LEFT", textFormat: { fontFamily: "Calibri", fontSize: 9 } };
  const semRelFmt = { ...baseFmt, backgroundColor: { red: 0.95, green: 0.95, blue: 0.95 } };

  const fillRow = (firstCell: any, rest: number, fmt: any) => {
    const arr = [firstCell]; for (let i = 0; i < rest; i++) arr.push(plainCell("", fmt)); return { values: arr };
  };

  const rows: any[] = [];
  rows.push(fillRow(plainCell("SOCIEDADE CIVIL NOSSA SENHORA APARECIDA", headerInstFmt), totalCols - 1, headerInstFmt));
  rows.push(fillRow(plainCell("Centro de Atenção Integral ao Adolescente | Serviço de Convivência e Fortalecimento de Vínculos", subHeaderInstFmt), totalCols - 1, subHeaderInstFmt));
  rows.push(fillRow(plainCell("Termo de Colaboração 001/2022", subHeaderItalicFmt), totalCols - 1, subHeaderItalicFmt));
  rows.push(fillRow(plainCell("", baseFmt), totalCols - 1, baseFmt));
  rows.push(fillRow(plainCell(`LISTA DE PRESENÇA — ${MESES[mesNum - 1].toUpperCase()} / ${anoNum}  ·  PREVIEW (REGRA LIMPA)`, titleFmt), totalCols - 1, titleFmt));
  rows.push(fillRow(plainCell(turma.nome, turmaNameFmt), totalCols - 1, turmaNameFmt));
  const infoRuns = [
    { text: "Período: ", bold: true }, { text: periodoStr },
    { text: "  ·  " }, { text: "Faixa Etária: ", bold: true }, { text: faixaStr },
    { text: "  ·  " }, { text: "Educador(a): ", bold: true }, { text: educadorStr },
    { text: "  ·  " }, { text: "Bairro: ", bold: true }, { text: bairroStr },
  ];
  rows.push(fillRow(richCell(infoRuns, baseFmt), totalCols - 1, baseFmt));
  rows.push(fillRow(plainCell("", baseFmt), totalCols - 1, baseFmt));

  {
    const arr = [plainCell("Nº", tableHeaderFmt), plainCell("Nome do Participante", tableHeaderFmt)];
    for (const dt of datas) arr.push(plainCell(dt, tableHeaderFmt));
    rows.push({ values: arr });
  }

  const ordered = [...members].sort((a, b) => a.nome.localeCompare(b.nome));

  ordered.forEach((m, i) => {
    const arr: any[] = [plainCell(i + 1, baseFmt), plainCell(m.nome, cellNameFmt)];
    for (const dtIso of datesISO) {
      const rec = (presencasMap[m.id] || {})[dtIso];
      if (!rec) {
        if (relatorioDates.has(dtIso)) arr.push(plainCell("", baseFmt));
        else arr.push(plainCell("", semRelFmt));
        continue;
      }
      if (rec.presente) arr.push(plainCell("P", { ...baseFmt, textFormat: { ...baseFmt.textFormat, bold: true } }));
      else if (rec.justificativa) arr.push(plainCell("J", baseFmt, rec.justificativa));
      else arr.push(plainCell("A", baseFmt));
    }
    rows.push({ values: arr });
  });

  rows.push(fillRow(plainCell("", baseFmt), totalCols - 1, baseFmt));
  {
    const arr: any[] = [plainCell("", signFmt), plainCell(`Assinatura do(a) Educador(a): ${"_".repeat(80)}`, signFmt)];
    for (let j = 2; j < totalCols; j++) arr.push(plainCell("", signFmt));
    rows.push({ values: arr });
  }
  rows.push(fillRow(plainCell("", baseFmt), totalCols - 1, baseFmt));
  {
    const legendRuns = [
      { text: "Legenda: " },
      { text: "P", bold: true }, { text: " = Presente  ·  " },
      { text: "A", bold: true }, { text: " = Ausente  ·  " },
      { text: "J", bold: true }, { text: " = Justificada (comentário na célula)  ·  " },
      { text: "(vazio)", bold: true }, { text: " = Sem relatório no dia" },
    ];
    const arr: any[] = [plainCell("", legendFmt), richCell(legendRuns, legendFmt)];
    for (let j = 2; j < totalCols; j++) arr.push(plainCell("", legendFmt));
    rows.push({ values: arr });
  }

  return { rows, totalCols, dataRowsCount: ordered.length, headerStartRow: 8 };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const GOOGLE_SHEETS_API_KEY = Deno.env.get("GOOGLE_SHEETS_API_KEY");
    const GOOGLE_DRIVE_API_KEY = Deno.env.get("GOOGLE_DRIVE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY ausente");
    if (!GOOGLE_SHEETS_API_KEY) throw new Error("GOOGLE_SHEETS_API_KEY ausente — conecte Google Sheets");
    if (!GOOGLE_DRIVE_API_KEY) throw new Error("GOOGLE_DRIVE_API_KEY ausente — conecte Google Drive");

    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const supaUrl = Deno.env.get("SUPABASE_URL")!;
    const supaAnon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supaSvc = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const userClient = createClient(supaUrl, supaAnon, { global: { headers: { Authorization: auth } } });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json();
    const { mes, ano } = body;
    if (!mes || !ano) {
      return new Response(JSON.stringify({ error: "mes, ano obrigatórios" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const mesNum = Number(mes);
    const anoNum = Number(ano);
    const dataIniMes = `${anoNum}-${pad2(mesNum)}-01`;
    const lastDay = new Date(anoNum, mesNum, 0).getDate();
    const dataFimMes = `${anoNum}-${pad2(mesNum)}-${pad2(lastDay)}`;
    const proxMes = mesNum === 12 ? `${anoNum + 1}-01-01` : `${anoNum}-${pad2(mesNum + 1)}-01`;

    const svc = createClient(supaUrl, supaSvc);

    // Turmas ativas
    const { data: turmas, error: turmasErr } = await svc
      .from("turmas")
      .select("id, nome, periodo, faixa_etaria, dias_semana, ativa, profiles(nome), bairros(nome)")
      .eq("ativa", true)
      .order("nome");
    if (turmasErr) throw turmasErr;
    if (!turmas?.length) {
      return new Response(JSON.stringify({ error: "Nenhuma turma ativa encontrada" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const turmaIds = turmas.map((t: any) => t.id);

    // Vínculos da turma (TODOS — para diff atual vs limpo)
    const { data: tps } = await svc
      .from("turma_participantes")
      .select("turma_id, participante_id, data_entrada, data_saida, participantes(id, nome_completo, status, data_desligamento, busca_ativa_desde, is_teste, created_at)")
      .in("turma_id", turmaIds);

    // Transferências (para identificar "transferido")
    const { data: transfs } = await svc
      .from("participante_transferencias")
      .select("participante_id, turma_origem_id, data_transferencia, turma_destino_id, turmas:turma_destino_id(nome)")
      .in("turma_origem_id", turmaIds);
    const transfByKey: Record<string, any> = {};
    (transfs || []).forEach((tr: any) => {
      const k = `${tr.turma_origem_id}|${tr.participante_id}`;
      const cur = transfByKey[k];
      if (!cur || (tr.data_transferencia || "") > (cur.data_transferencia || "")) transfByKey[k] = tr;
    });

    // Classificar vínculo por turma
    const cleanByTurma: Record<string, any[]> = {};
    const removidosFlat: Array<{ turma_id: string; turma: string; participante_id: string; nome: string; motivo: string; detalhe: string }> = [];
    const allVinculadosByTurma: Record<string, Set<string>> = {};
    const turmaById: Record<string, any> = {};
    (turmas as any[]).forEach((t) => { turmaById[t.id] = t; cleanByTurma[t.id] = []; allVinculadosByTurma[t.id] = new Set(); });

    (tps || []).forEach((row: any) => {
      const p = row.participantes;
      if (!p) return;
      if (p.is_teste) return;
      if ((p.created_at || "").slice(0, 10) > dataFimMes) return;
      if (row.data_entrada && row.data_entrada > dataFimMes) return;

      const k = `${row.turma_id}|${p.id}`;
      const transf = transfByKey[k];
      const turma = turmaById[row.turma_id];
      if (!turma) return;
      allVinculadosByTurma[row.turma_id].add(p.id);

      // Razões de remoção (em ordem)
      let motivo: string | null = null;
      let detalhe = "";
      if (row.data_saida && row.data_saida <= dataFimMes) { motivo = "sem vínculo no fim do mês"; detalhe = `data_saida=${row.data_saida}`; }
      else if (p.status === "desligado") { motivo = "desligado"; detalhe = `data_desligamento=${p.data_desligamento || "-"}`; }
      else if (transf && transf.data_transferencia && transf.data_transferencia <= dataFimMes) {
        motivo = "transferido"; detalhe = `em ${transf.data_transferencia} → ${transf.turmas?.nome || "—"}`;
      }
      else if (p.status === "busca_ativa") { motivo = "busca ativa"; detalhe = `desde=${(p.busca_ativa_desde || "").slice(0,10) || "-"}`; }
      else if (p.status !== "ativo" && p.status !== "cadastro_incompleto") { motivo = `status=${p.status}`; detalhe = ""; }

      if (motivo) {
        removidosFlat.push({ turma_id: row.turma_id, turma: turma.nome, participante_id: p.id, nome: p.nome_completo || "—", motivo, detalhe });
      } else {
        cleanByTurma[row.turma_id].push({ id: p.id, nome: p.nome_completo || "—" });
      }
    });

    // Presenças/relatórios do mês (uma vez só)
    const { data: relatorios } = await svc
      .from("relatorios_atividade")
      .select("id, data, relatorio_turmas!inner(turma_id)")
      .in("relatorio_turmas.turma_id", turmaIds)
      .gte("data", dataIniMes)
      .lt("data", proxMes);
    const relMeta: Record<string, { data: string; turmas: string[] }> = {};
    (relatorios || []).forEach((r: any) => {
      const ts = (r.relatorio_turmas || []).map((rt: any) => rt.turma_id);
      relMeta[r.id] = { data: r.data, turmas: ts };
    });
    const relIds = Object.keys(relMeta);
    const presencas: any[] = [];
    if (relIds.length) {
      const CHUNK = 200;
      for (let i = 0; i < relIds.length; i += CHUNK) {
        const slice = relIds.slice(i, i + CHUNK);
        let from = 0;
        const PAGE = 1000;
        while (true) {
          const { data: pageRows, error: pErr } = await svc
            .from("relatorio_presenca")
            .select("relatorio_id, participante_id, presente, justificativa")
            .in("relatorio_id", slice)
            .range(from, from + PAGE - 1);
          if (pErr) throw pErr;
          const rows = pageRows || [];
          presencas.push(...rows);
          if (rows.length < PAGE) break;
          from += PAGE;
        }
      }
    }

    const presencasByTurma: Record<string, Record<string, Record<string, { presente: boolean; justificativa: string | null }>>> = {};
    presencas.forEach((p: any) => {
      const meta = relMeta[p.relatorio_id]; if (!meta) return;
      meta.turmas.forEach((tid) => {
        if (!presencasByTurma[tid]) presencasByTurma[tid] = {};
        if (!presencasByTurma[tid][p.participante_id]) presencasByTurma[tid][p.participante_id] = {};
        presencasByTurma[tid][p.participante_id][meta.data] = { presente: !!p.presente, justificativa: p.justificativa || null };
      });
    });
    const relatorioDatesByTurma: Record<string, Set<string>> = {};
    Object.values(relMeta).forEach((meta) => {
      meta.turmas.forEach((tid) => {
        if (!relatorioDatesByTurma[tid]) relatorioDatesByTurma[tid] = new Set<string>();
        relatorioDatesByTurma[tid].add(meta.data);
      });
    });

    // INCONSISTENCIAS: removidos que tiveram presença marcada em maio
    const removidoSet = new Set(removidosFlat.map(r => `${r.turma_id}|${r.participante_id}`));
    const inconsistencias: Array<{ turma: string; nome: string; motivo: string; marcacoes: number; P: number; A: number; J: number }> = [];
    const inconsMap: Record<string, { turma: string; nome: string; motivo: string; P: number; A: number; J: number }> = {};
    Object.entries(presencasByTurma).forEach(([tid, byPart]) => {
      Object.entries(byPart).forEach(([pid, byDate]) => {
        const k = `${tid}|${pid}`;
        if (!removidoSet.has(k)) return;
        const r = removidosFlat.find(x => x.turma_id === tid && x.participante_id === pid)!;
        let P = 0, A = 0, J = 0;
        Object.values(byDate).forEach((rec: any) => { if (rec.presente) P++; else if (rec.justificativa) J++; else A++; });
        inconsMap[k] = { turma: r.turma, nome: r.nome, motivo: r.motivo, P, A, J };
      });
    });
    Object.values(inconsMap).forEach(v => inconsistencias.push({ ...v, marcacoes: v.P + v.A + v.J }));

    // === Construir abas das turmas ===
    const sheets: any[] = [];
    const sheetMeta: Array<{ sheetId: number; totalCols: number; dataRowsCount: number; headerStartRow: number }> = [];
    let sheetIdSeq = 0;
    const usedTitles = new Set<string>();
    let skipped = 0;
    const resumoRows: Array<{ turma: string; atual: number; limpo: number; removidos: number }> = [];

    for (const t of turmas as any[]) {
      const members = cleanByTurma[t.id] || [];
      const atual = allVinculadosByTurma[t.id].size;
      const limpo = members.length;
      resumoRows.push({ turma: t.nome, atual, limpo, removidos: atual - limpo });

      const built = buildTurmaSheet(t, members, presencasByTurma[t.id] || {}, relatorioDatesByTurma[t.id] || new Set<string>(), anoNum, mesNum);
      if (!built) { skipped++; continue; }
      let title = safeTab(t.nome); let sfx = 2;
      while (usedTitles.has(title)) title = safeTab(`${t.nome} (${sfx++})`);
      usedTitles.add(title);
      const sheetId = sheetIdSeq++;
      sheets.push({
        properties: { sheetId, title, gridProperties: { rowCount: Math.max(built.rows.length + 5, 30), columnCount: built.totalCols } },
        data: [{ startRow: 0, startColumn: 0, rowData: built.rows }],
      });
      sheetMeta.push({ sheetId, totalCols: built.totalCols, dataRowsCount: built.dataRowsCount, headerStartRow: built.headerStartRow });
    }

    // === Aba RESUMO ===
    const black2 = { red: 0, green: 0, blue: 0 };
    const white2 = { red: 1, green: 1, blue: 1 };
    const border2 = { style: "SOLID", color: black2 };
    const allBorders2 = { top: border2, bottom: border2, left: border2, right: border2 };
    const baseFmt2 = { borders: allBorders2, verticalAlignment: "MIDDLE", horizontalAlignment: "LEFT", wrapStrategy: "WRAP", textFormat: { fontFamily: "Calibri", fontSize: 11 } };
    const headerFmt2 = { ...baseFmt2, backgroundColor: black2, horizontalAlignment: "CENTER", textFormat: { fontFamily: "Calibri", fontSize: 11, bold: true, foregroundColor: white2 } };
    const numFmt2 = { ...baseFmt2, horizontalAlignment: "RIGHT" };
    const boldFmt2 = { ...baseFmt2, textFormat: { ...baseFmt2.textFormat, bold: true } };
    const boldNumFmt2 = { ...numFmt2, textFormat: { ...numFmt2.textFormat, bold: true } };

    const resumoSheetRows: any[] = [];
    resumoSheetRows.push({ values: [plainCell("PREVIEW — Lista de Frequência Limpa", boldFmt2), plainCell("", baseFmt2), plainCell("", baseFmt2), plainCell("", baseFmt2)] });
    resumoSheetRows.push({ values: [plainCell(`Mês / Ano: ${MESES[mesNum-1]} / ${anoNum}  ·  Referência: ${dataFimMes} (último dia do mês)`, baseFmt2), plainCell("", baseFmt2), plainCell("", baseFmt2), plainCell("", baseFmt2)] });
    resumoSheetRows.push({ values: [plainCell("", baseFmt2), plainCell("", baseFmt2), plainCell("", baseFmt2), plainCell("", baseFmt2)] });
    resumoSheetRows.push({ values: [plainCell("Turma", headerFmt2), plainCell("Atual (lista oficial)", headerFmt2), plainCell("Limpo (proposto)", headerFmt2), plainCell("Removidos", headerFmt2)] });
    let totA=0, totL=0;
    resumoRows.sort((a,b) => (b.removidos - a.removidos) || a.turma.localeCompare(b.turma)).forEach((r) => {
      totA += r.atual; totL += r.limpo;
      resumoSheetRows.push({ values: [plainCell(r.turma, baseFmt2), plainCell(r.atual, numFmt2), plainCell(r.limpo, numFmt2), plainCell(r.removidos, { ...numFmt2, textFormat: { ...numFmt2.textFormat, bold: r.removidos > 0 } })] });
    });
    resumoSheetRows.push({ values: [plainCell("TOTAL", boldFmt2), plainCell(totA, boldNumFmt2), plainCell(totL, boldNumFmt2), plainCell(totA - totL, boldNumFmt2)] });
    const resumoSheetId = sheetIdSeq++;
    sheets.unshift({
      properties: { sheetId: resumoSheetId, title: "RESUMO", gridProperties: { rowCount: Math.max(resumoSheetRows.length + 5, 30), columnCount: 4 } },
      data: [{ startRow: 0, startColumn: 0, rowData: resumoSheetRows }],
    });

    // === Aba REMOVIDOS ===
    const removidosRows: any[] = [];
    removidosRows.push({ values: [plainCell("Turma", headerFmt2), plainCell("Participante", headerFmt2), plainCell("Motivo", headerFmt2), plainCell("Detalhe", headerFmt2)] });
    removidosFlat
      .sort((a, b) => a.motivo.localeCompare(b.motivo) || a.turma.localeCompare(b.turma) || a.nome.localeCompare(b.nome))
      .forEach((r) => {
        removidosRows.push({ values: [plainCell(r.turma, baseFmt2), plainCell(r.nome, baseFmt2), plainCell(r.motivo, baseFmt2), plainCell(r.detalhe, baseFmt2)] });
      });
    const removidosSheetId = sheetIdSeq++;
    sheets.push({
      properties: { sheetId: removidosSheetId, title: "REMOVIDOS", gridProperties: { rowCount: Math.max(removidosRows.length + 5, 30), columnCount: 4 } },
      data: [{ startRow: 0, startColumn: 0, rowData: removidosRows }],
    });

    // === Aba INCONSISTENCIAS ===
    const inconsRows: any[] = [];
    inconsRows.push({ values: [plainCell("Turma", headerFmt2), plainCell("Participante", headerFmt2), plainCell("Motivo da remoção", headerFmt2), plainCell("Marcações no mês", headerFmt2), plainCell("P", headerFmt2), plainCell("A", headerFmt2), plainCell("J", headerFmt2)] });
    inconsistencias
      .sort((a, b) => b.marcacoes - a.marcacoes || a.turma.localeCompare(b.turma) || a.nome.localeCompare(b.nome))
      .forEach((r) => {
        inconsRows.push({ values: [plainCell(r.turma, baseFmt2), plainCell(r.nome, baseFmt2), plainCell(r.motivo, baseFmt2), plainCell(r.marcacoes, numFmt2), plainCell(r.P, numFmt2), plainCell(r.A, numFmt2), plainCell(r.J, numFmt2)] });
      });
    const inconsSheetId = sheetIdSeq++;
    sheets.push({
      properties: { sheetId: inconsSheetId, title: "INCONSISTENCIAS", gridProperties: { rowCount: Math.max(inconsRows.length + 5, 30), columnCount: 7 } },
      data: [{ startRow: 0, startColumn: 0, rowData: inconsRows }],
    });

    if (!sheets.length) {
      return new Response(JSON.stringify({ error: "Nada para exportar" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const ts = new Date();
    const timestamp = `${ts.getFullYear()}-${pad2(ts.getMonth() + 1)}-${pad2(ts.getDate())}_${pad2(ts.getHours())}${pad2(ts.getMinutes())}${pad2(ts.getSeconds())}`;
    const spreadsheetTitle = `SysCFV_ListasFrequencia_Mes_PREVIEW_LIMPA_${anoNum}-${pad2(mesNum)}_${timestamp}`;

    const created = await gw(
      `${SHEETS_GW}/spreadsheets`,
      { method: "POST", body: JSON.stringify({ properties: { title: spreadsheetTitle, locale: "pt_BR" }, sheets }) },
      GOOGLE_SHEETS_API_KEY, LOVABLE_API_KEY,
    );
    const fileId = created.spreadsheetId;
    const sheetUrl = created.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${fileId}/edit`;

    const requests: any[] = [];
    for (const m of sheetMeta) {
      for (const r of [0, 1, 2, 3, 4, 5, 6, 7]) {
        requests.push({ mergeCells: { range: { sheetId: m.sheetId, startRowIndex: r, endRowIndex: r + 1, startColumnIndex: 0, endColumnIndex: m.totalCols }, mergeType: "MERGE_ALL" } });
      }
      const blankAfterData = m.headerStartRow + 1 + m.dataRowsCount;
      const signRowIdx = blankAfterData + 1;
      const legendRowIdx = signRowIdx + 2;
      requests.push({ mergeCells: { range: { sheetId: m.sheetId, startRowIndex: signRowIdx, endRowIndex: signRowIdx + 1, startColumnIndex: 1, endColumnIndex: m.totalCols }, mergeType: "MERGE_ALL" } });
      requests.push({ mergeCells: { range: { sheetId: m.sheetId, startRowIndex: legendRowIdx, endRowIndex: legendRowIdx + 1, startColumnIndex: 1, endColumnIndex: m.totalCols }, mergeType: "MERGE_ALL" } });
      requests.push({ updateDimensionProperties: { range: { sheetId: m.sheetId, dimension: "COLUMNS", startIndex: 0, endIndex: 1 }, properties: { pixelSize: 40 }, fields: "pixelSize" } });
      requests.push({ autoResizeDimensions: { dimensions: { sheetId: m.sheetId, dimension: "COLUMNS", startIndex: 1, endIndex: m.totalCols } } });
    }
    if (requests.length) {
      await gw(`${SHEETS_GW}/spreadsheets/${fileId}:batchUpdate`, { method: "POST", body: JSON.stringify({ requests }) }, GOOGLE_SHEETS_API_KEY, LOVABLE_API_KEY);
    }

    try {
      await gw(`${DRIVE_GW}/files/${fileId}/permissions?supportsAllDrives=true`, { method: "POST", body: JSON.stringify({ role: "reader", type: "anyone" }) }, GOOGLE_SHEETS_API_KEY, LOVABLE_API_KEY, GOOGLE_DRIVE_API_KEY);
    } catch (e) { console.warn("[preview-limpa] permissão pública:", e); }

    try {
      const folderId = await ensureMonthSubfolder(anoNum, mesNum, "ZZ_Preview_Limpa", GOOGLE_DRIVE_API_KEY, LOVABLE_API_KEY);
      if (folderId) await moveFileToFolder(fileId, folderId, GOOGLE_DRIVE_API_KEY, LOVABLE_API_KEY);
    } catch (e) { console.warn("[preview-limpa] mover pasta:", e); }

    return new Response(JSON.stringify({
      url: sheetUrl, fileId,
      turmas: sheetMeta.length, skipped,
      totalAtual: totA, totalLimpo: totL, totalRemovidos: totA - totL,
      removidos: removidosFlat.length, inconsistencias: inconsistencias.length,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("[preview-limpa] erro:", err);
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});