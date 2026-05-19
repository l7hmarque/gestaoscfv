// @ts-nocheck
// Edge Function: gera 1 Google Sheet com 1 aba por turma — Listas de Chamada em branco do mês.
// Reutiliza o layout institucional da função generate-lista-chamada-gsheet (uma turma por aba).
// Salvo em SYSCFV/{MES} - {ANO}/04_Listas_Chamada_Em_Branco/.
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
const DIAS_MAP: Record<string, number> = { dom: 0, seg: 1, ter: 2, qua: 3, qui: 4, sex: 5, sab: 6 };
const PERIODO_LABEL: Record<string, string> = { manha: "Manhã", tarde: "Tarde", integral: "Integral" };
const FAIXA_LABEL: Record<string, string> = { "6-8": "6-8 anos", "9-11": "9-11 anos", "12-17": "12-17 anos", idosos: "Idosos" };

function pad2(n: number): string { return String(n).padStart(2, "0"); }
function safeName(s: string): string { return (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\w\s\-]/g, "").trim().slice(0, 80); }
function safeTab(s: string): string {
  // Google Sheets: máx 100 chars, sem [ ] * ? / \ :
  return (s || "Turma").replace(/[\[\]\*\?\/\\:]/g, " ").slice(0, 95);
}

async function gw(url: string, init: RequestInit, sheetsKey: string, lovableKey: string, useDriveKey?: string) {
  const headers = {
    Authorization: `Bearer ${lovableKey}`,
    "X-Connection-Api-Key": useDriveKey || sheetsKey,
    "Content-Type": "application/json",
    ...(init.headers || {}),
  };
  const res = await fetch(url, { ...init, headers });
  const text = await res.text();
  let body: any = null; try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!res.ok) throw new Error(`[${res.status}] ${url}: ${typeof body === "string" ? body : JSON.stringify(body)}`);
  return body;
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

function richCell(runs: Array<{ text: string; bold?: boolean }>, opts: any = {}) {
  const fullText = runs.map(r => r.text).join("");
  const textFormatRuns: any[] = [];
  let idx = 0;
  for (const r of runs) { textFormatRuns.push({ startIndex: idx, format: { bold: !!r.bold } }); idx += r.text.length; }
  return { userEnteredValue: { stringValue: fullText }, userEnteredFormat: opts, textFormatRuns };
}
function plainCell(value: string | number | null, opts: any = {}) {
  const c: any = { userEnteredFormat: opts };
  if (value === null || value === undefined) c.userEnteredValue = { stringValue: "" };
  else if (typeof value === "number") c.userEnteredValue = { numberValue: value };
  else c.userEnteredValue = { stringValue: String(value) };
  return c;
}

/** Builds the rowData + meta for one turma sheet. */
function buildTurmaSheet(turma: any, members: any[], anoNum: number, mesNum: number) {
  const diasSemana: string[] = turma.dias_semana || [];
  const diasNum = diasSemana.map((d: string) => DIAS_MAP[d.toLowerCase()]).filter((n: number) => n !== undefined);
  const datas: string[] = [];
  const d = new Date(anoNum, mesNum - 1, 1);
  while (d.getMonth() === mesNum - 1) {
    if (diasNum.includes(d.getDay())) datas.push(`${pad2(d.getDate())}/${pad2(mesNum)}`);
    d.setDate(d.getDate() + 1);
  }
  if (datas.length === 0) return null;

  const totalCols = 2 + datas.length;
  const periodoStr = turma.periodo ? (PERIODO_LABEL[turma.periodo] || turma.periodo) : "";
  const faixaStr = turma.faixa_etaria ? (FAIXA_LABEL[turma.faixa_etaria] || turma.faixa_etaria) : "";
  const educadorStr = turma.profiles?.nome || "—";
  const bairroStr = turma.bairros?.nome || "—";

  const black = { red: 0, green: 0, blue: 0 };
  const white = { red: 1, green: 1, blue: 1 };
  const border = { style: "SOLID", color: black };
  const allBorders = { top: border, bottom: border, left: border, right: border };
  const baseFmt = { borders: allBorders, verticalAlignment: "MIDDLE", horizontalAlignment: "CENTER", wrapStrategy: "WRAP", textFormat: { fontFamily: "Calibri", fontSize: 10 } };
  const headerInstFmt = { ...baseFmt, backgroundColor: black, textFormat: { fontFamily: "Calibri", fontSize: 11, bold: true, foregroundColor: white } };
  const subHeaderInstFmt = { ...baseFmt, backgroundColor: black, textFormat: { fontFamily: "Calibri", fontSize: 9, bold: true, foregroundColor: white } };
  const titleFmt = { ...baseFmt, backgroundColor: black, textFormat: { fontFamily: "Calibri", fontSize: 13, bold: true, foregroundColor: white } };
  const turmaNameFmt = { ...baseFmt, textFormat: { fontFamily: "Calibri", fontSize: 12, bold: true } };
  const tableHeaderFmt = { ...baseFmt, backgroundColor: black, textFormat: { fontFamily: "Calibri", fontSize: 9, bold: true, foregroundColor: white } };
  const cellNameFmt = { ...baseFmt, horizontalAlignment: "LEFT" };
  const signFmt = { ...baseFmt, horizontalAlignment: "LEFT", textFormat: { fontFamily: "Calibri", fontSize: 10, bold: true, italic: true } };
  const legendFmt = { ...baseFmt, horizontalAlignment: "LEFT" };

  const fillRow = (firstCell: any, rest: number, fmt: any) => {
    const arr = [firstCell]; for (let i = 0; i < rest; i++) arr.push(plainCell("", fmt)); return { values: arr };
  };

  const rows: any[] = [];
  rows.push(fillRow(plainCell("SOCIEDADE CIVIL NOSSA SENHORA APARECIDA", headerInstFmt), totalCols - 1, headerInstFmt));
  rows.push(fillRow(plainCell("CENTRO DE ATENÇÃO INTEGRAL AO ADOLESCENTE", subHeaderInstFmt), totalCols - 1, subHeaderInstFmt));
  rows.push(fillRow(plainCell("SCFV CAIA - TERMO DE COLABORAÇÃO 001/2022", subHeaderInstFmt), totalCols - 1, subHeaderInstFmt));
  rows.push(fillRow(plainCell("", baseFmt), totalCols - 1, baseFmt));
  rows.push(fillRow(plainCell(`LISTA DE CHAMADA — ${MESES[mesNum - 1].toUpperCase()} / ${anoNum}`, titleFmt), totalCols - 1, titleFmt));
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

  const sortedAll = [...members].sort((a, b) => a.nome.localeCompare(b.nome));
  const ordered = [
    ...sortedAll.filter(m => !m.bloqueado_chamada),
    ...sortedAll.filter(m => m.bloqueado_chamada),
  ];

  ordered.forEach((m, i) => {
    const isInactive = !!m.bloqueado_chamada;
    const grayFg = isInactive ? { red: 0.5, green: 0.5, blue: 0.5 } : black;
    const cellFmt = { ...cellNameFmt, textFormat: { ...(cellNameFmt.textFormat || {}), strikethrough: isInactive, foregroundColor: grayFg } };
    const numFmt = { ...baseFmt, textFormat: { ...(baseFmt.textFormat || {}), strikethrough: isInactive, foregroundColor: grayFg } };
    const dateFmt = { ...baseFmt, textFormat: { ...(baseFmt.textFormat || {}), strikethrough: isInactive, foregroundColor: grayFg } };

    const runs: Array<{ text: string; bold?: boolean }> = m.marcador
      ? [{ text: m.nome + " " }, { text: m.marcador, bold: true }]
      : [{ text: m.nome }];

    const arr: any[] = [plainCell(i + 1, numFmt), richCell(runs, cellFmt)];
    for (let j = 0; j < datas.length; j++) arr.push(plainCell(isInactive ? "—" : "", dateFmt));
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
      { text: "(BA)", bold: true }, { text: " = Busca Ativa  ·  " },
      { text: "(Desligado)", bold: true }, { text: " = Desligado (≤30d)  ·  " },
      { text: '(Transferido DD/MM para "Turma")', bold: true }, { text: " = Transferido (≤30d)  ·  " },
      { text: "—", bold: true }, { text: " = Sem aula/desligado" },
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
    const { data: claims, error: claimsErr } = await userClient.auth.getClaims(auth.replace("Bearer ", ""));
    if (claimsErr || !claims?.claims) {
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
    const proxMes = mesNum === 12 ? `${anoNum + 1}-01-01` : `${anoNum}-${pad2(mesNum + 1)}-01`;

    const svc = createClient(supaUrl, supaSvc);

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
    // Fonte única: RPC get_participantes_turma. ref_date = 1º dia do mês.
    const membersByTurma: Record<string, any[]> = {};
    await Promise.all(turmaIds.map(async (tid: string) => {
      const { data: rows, error: rpcErr } = await svc.rpc("get_participantes_turma", {
        _turma_id: tid,
        _ref_date: dataIniMes,
      });
      if (rpcErr) { console.warn("[get_participantes_turma]", tid, rpcErr); return; }
      membersByTurma[tid] = (rows || []).map((r: any) => ({
        nome: r.nome,
        marcador: r.marcador || "",
        bloqueado_chamada: !!r.bloqueado_chamada,
        status: r.status,
        desligado: r.status === "desligado",
        transferido: !!r.data_transferencia && r.status !== "desligado",
      }));
    }));

    // Construir sheets
    const sheets: any[] = [];
    const sheetMeta: Array<{ sheetId: number; totalCols: number; dataRowsCount: number; headerStartRow: number }> = [];
    let sheetIdSeq = 0;
    const usedTitles = new Set<string>();
    let skipped = 0;

    for (const t of turmas as any[]) {
      const built = buildTurmaSheet(t, membersByTurma[t.id] || [], anoNum, mesNum);
      if (!built) { skipped++; continue; }
      let title = safeTab(t.nome);
      let suffix = 2;
      while (usedTitles.has(title)) { title = safeTab(`${t.nome} (${suffix++})`); }
      usedTitles.add(title);
      const sheetId = sheetIdSeq++;
      sheets.push({
        properties: {
          sheetId, title,
          gridProperties: { rowCount: Math.max(built.rows.length + 5, 30), columnCount: built.totalCols },
        },
        data: [{ startRow: 0, startColumn: 0, rowData: built.rows }],
      });
      sheetMeta.push({ sheetId, totalCols: built.totalCols, dataRowsCount: built.dataRowsCount, headerStartRow: built.headerStartRow });
    }

    if (!sheets.length) {
      return new Response(JSON.stringify({ error: "Nenhuma turma com dias_semana cadastrados para este mês" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const ts = new Date();
    const timestamp = `${ts.getFullYear()}-${pad2(ts.getMonth() + 1)}-${pad2(ts.getDate())}_${pad2(ts.getHours())}${pad2(ts.getMinutes())}${pad2(ts.getSeconds())}`;
    const spreadsheetTitle = `SysCFV_ListasChamada_Mes_${anoNum}-${pad2(mesNum)}_${timestamp}`;

    const created = await gw(
      `${SHEETS_GW}/spreadsheets`,
      { method: "POST", body: JSON.stringify({ properties: { title: spreadsheetTitle, locale: "pt_BR" }, sheets }) },
      GOOGLE_SHEETS_API_KEY, LOVABLE_API_KEY,
    );
    const fileId = created.spreadsheetId;
    const sheetUrl = created.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${fileId}/edit`;

    // batchUpdate por aba
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
      requests.push({ updateSheetProperties: { properties: { sheetId: m.sheetId, gridProperties: { frozenRowCount: m.headerStartRow + 1 } }, fields: "gridProperties.frozenRowCount" } });
    }
    await gw(`${SHEETS_GW}/spreadsheets/${fileId}:batchUpdate`, { method: "POST", body: JSON.stringify({ requests }) }, GOOGLE_SHEETS_API_KEY, LOVABLE_API_KEY);

    try {
      await gw(`${DRIVE_GW}/files/${fileId}/permissions?supportsAllDrives=true`, { method: "POST", body: JSON.stringify({ role: "reader", type: "anyone" }) }, GOOGLE_SHEETS_API_KEY, LOVABLE_API_KEY, GOOGLE_DRIVE_API_KEY);
    } catch (e) { console.warn("[listas-chamada-mes] permissão pública:", e); }

    try {
      const folderId = await ensureMonthSubfolder(anoNum, mesNum, "04_Listas_Chamada_Em_Branco", GOOGLE_DRIVE_API_KEY, LOVABLE_API_KEY);
      if (folderId) await moveFileToFolder(fileId, folderId, GOOGLE_DRIVE_API_KEY, LOVABLE_API_KEY);
    } catch (e) { console.warn("[listas-chamada-mes] mover pasta:", e); }

    return new Response(JSON.stringify({ url: sheetUrl, fileId, turmas: sheetMeta.length, skipped }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("[generate-listas-chamada-mes-gsheet] erro:", err);
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});