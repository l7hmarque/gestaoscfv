// @ts-nocheck
// Edge Function: gera Google Sheet "Lista de Chamada" para uma turma/mês,
// aplicando o modelo institucional revisado (cabeçalho MAIÚSCULO, rótulos em
// negrito, marcadores (BA)/(D)/(T)/(N) em negrito, autoresize de colunas, etc.).
// Filtros: exclui desligados pré-mês; marca (N) entrantes do mês.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SHEETS_GW = "https://connector-gateway.lovable.dev/google_sheets/v4";
const DRIVE_GW = "https://connector-gateway.lovable.dev/google_drive/drive/v3";

const MESES = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
];
const MESES_UPPER = MESES.map(m => m.toUpperCase());
const DIAS_MAP: Record<string, number> = { dom: 0, seg: 1, ter: 2, qua: 3, qui: 4, sex: 5, sab: 6 };
const PERIODO_LABEL: Record<string, string> = { manha: "Manhã", tarde: "Tarde", integral: "Integral" };
const FAIXA_LABEL: Record<string, string> = { "6-8": "6-8 anos", "9-11": "9-11 anos", "12-17": "12-17 anos", idosos: "Idosos" };

function safeName(s: string): string {
  return (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\w\s\-]/g, "").trim().slice(0, 80);
}
function pad2(n: number): string { return String(n).padStart(2, "0"); }

async function gw(url: string, init: RequestInit, sheetsKey: string, lovableKey: string, useDriveKey?: string) {
  const headers = {
    Authorization: `Bearer ${lovableKey}`,
    "X-Connection-Api-Key": useDriveKey || sheetsKey,
    "Content-Type": "application/json",
    ...(init.headers || {}),
  };
  const res = await fetch(url, { ...init, headers });
  const text = await res.text();
  let body: any = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!res.ok) throw new Error(`[${res.status}] ${url}: ${typeof body === "string" ? body : JSON.stringify(body)}`);
  return body;
}

/** Garante a pasta SYSCFV/{MES} - {ANO}/{sub} no Drive. */
async function ensureMonthSubfolder(yyyy: number, mm: number, sub: string, driveKey: string, lovableKey: string): Promise<string | null> {
  try {
    const headers = { Authorization: `Bearer ${lovableKey}`, "X-Connection-Api-Key": driveKey, "Content-Type": "application/json" };
    const find = async (name: string, parent?: string) => {
      const pq = parent ? ` and '${parent}' in parents` : "";
      const q = `mimeType='application/vnd.google-apps.folder' and name='${name.replace(/'/g, "\\'")}' and trashed=false${pq}`;
      const url = `${DRIVE_GW}/files?q=${encodeURIComponent(q)}&fields=files(id)&pageSize=1&supportsAllDrives=true`;
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
    const root = await ensure("SYSCFV"); if (!root) return null;
    const month = await ensure(`${MESES_UPPER[mm - 1]} - ${yyyy}`, root); if (!month) return null;
    return await ensure(sub, month);
  } catch (e) { console.warn("[ensureMonthSubfolder]", e); return null; }
}

async function moveFileToFolder(fileId: string, parentId: string, driveKey: string, lovableKey: string) {
  const headers = { Authorization: `Bearer ${lovableKey}`, "X-Connection-Api-Key": driveKey, "Content-Type": "application/json" };
  const meta = await fetch(`${DRIVE_GW}/files/${fileId}?fields=parents&supportsAllDrives=true`, { headers });
  if (!meta.ok) return;
  const cur = await meta.json();
  const removeParents = (cur.parents || []).join(",");
  const url = `${DRIVE_GW}/files/${fileId}?addParents=${parentId}${removeParents ? `&removeParents=${removeParents}` : ""}&supportsAllDrives=true&fields=id`;
  await fetch(url, { method: "PATCH", headers });
}

// Build a cell with optional rich-text bold runs.
// runs: array of { text, bold? } that will be concatenated.
function richCell(runs: Array<{ text: string; bold?: boolean }>, opts: any = {}) {
  const fullText = runs.map(r => r.text).join("");
  const textFormatRuns: any[] = [];
  let idx = 0;
  for (const r of runs) {
    textFormatRuns.push({ startIndex: idx, format: { bold: !!r.bold } });
    idx += r.text.length;
  }
  return {
    userEnteredValue: { stringValue: fullText },
    userEnteredFormat: opts,
    textFormatRuns,
  };
}
function plainCell(value: string | number | null, opts: any = {}) {
  const c: any = { userEnteredFormat: opts };
  if (value === null || value === undefined) c.userEnteredValue = { stringValue: "" };
  else if (typeof value === "number") c.userEnteredValue = { numberValue: value };
  else c.userEnteredValue = { stringValue: String(value) };
  return c;
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
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supaUrl = Deno.env.get("SUPABASE_URL")!;
    const supaAnon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supaSvc = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const userClient = createClient(supaUrl, supaAnon, { global: { headers: { Authorization: auth } } });
    const { data: claims, error: claimsErr } = await userClient.auth.getClaims(auth.replace("Bearer ", ""));
    if (claimsErr || !claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const turma_id = body.turma_id || body.turmaId;
    const { mes, ano } = body;
    if (!turma_id || !mes || !ano) {
      return new Response(JSON.stringify({ error: "turma_id, mes, ano obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const mesNum = Number(mes);
    const anoNum = Number(ano);
    const dataIniMes = `${anoNum}-${pad2(mesNum)}-01`;
    const proxMes = mesNum === 12 ? `${anoNum + 1}-01-01` : `${anoNum}-${pad2(mesNum + 1)}-01`;

    const svc = createClient(supaUrl, supaSvc);

    // 1. Carregar turma + membros
    const { data: turma, error: tErr } = await svc
      .from("turmas")
      .select("id, nome, periodo, faixa_etaria, dias_semana, profiles(nome), bairros(nome)")
      .eq("id", turma_id)
      .maybeSingle();
    if (tErr || !turma) throw new Error(tErr?.message || "Turma não encontrada");

    const { data: tps } = await svc
      .from("turma_participantes")
      .select("data_saida, motivo_saida, participantes(nome_completo, status, data_desligamento, iniciou_em)")
      .eq("turma_id", turma_id);

    const members = (tps || []).map((r: any) => {
      const p = r.participantes || {};
      const desligado = p.status === "desligado";
      const transferido = !!r.data_saida && !desligado;
      const novo = !!p.iniciou_em && p.iniciou_em >= dataIniMes && p.iniciou_em < proxMes;
      return {
        nome: p.nome_completo || "—",
        desligado,
        data_desligamento: p.data_desligamento || null,
        transferido,
        data_transferencia: r.data_saida || null,
        busca_ativa: p.status === "busca_ativa",
        novo,
        iniciou_em: p.iniciou_em || null,
      };
    }).filter((m: any) => {
      // Exclui quem desligou ANTES do início do mês
      if (m.desligado && m.data_desligamento && m.data_desligamento < dataIniMes) return false;
      return true;
    });

    // 2. Datas do mês conforme dias da semana
    const diasSemana: string[] = (turma as any).dias_semana || [];
    const diasNum = diasSemana.map(d => DIAS_MAP[d.toLowerCase()]).filter(n => n !== undefined);
    const datas: string[] = [];
    const d = new Date(anoNum, mesNum - 1, 1);
    while (d.getMonth() === mesNum - 1) {
      if (diasNum.includes(d.getDay())) datas.push(`${pad2(d.getDate())}/${pad2(mesNum)}`);
      d.setDate(d.getDate() + 1);
    }
    if (datas.length === 0) {
      return new Response(JSON.stringify({ error: "Nenhuma data de atividade neste mês para a turma" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const totalCols = 2 + datas.length;
    const periodoStr = turma.periodo ? (PERIODO_LABEL[turma.periodo] || turma.periodo) : "";
    const faixaStr = turma.faixa_etaria ? (FAIXA_LABEL[turma.faixa_etaria] || turma.faixa_etaria) : "";
    const educadorStr = (turma as any).profiles?.nome || "—";
    const bairroStr = (turma as any).bairros?.nome || "—";

    // 3. Estilos base
    const black = { red: 0, green: 0, blue: 0 };
    const white = { red: 1, green: 1, blue: 1 };
    const border = { style: "SOLID", color: black };
    const allBorders = { top: border, bottom: border, left: border, right: border };
    const baseFmt = {
      borders: allBorders,
      verticalAlignment: "MIDDLE",
      horizontalAlignment: "CENTER",
      wrapStrategy: "WRAP",
      textFormat: { fontFamily: "Calibri", fontSize: 10 },
    };
    const headerInstFmt = {
      ...baseFmt,
      backgroundColor: black,
      textFormat: { fontFamily: "Calibri", fontSize: 11, bold: true, foregroundColor: white },
    };
    const subHeaderInstFmt = {
      ...baseFmt,
      backgroundColor: black,
      textFormat: { fontFamily: "Calibri", fontSize: 9, bold: true, foregroundColor: white },
    };
    const titleFmt = {
      ...baseFmt,
      backgroundColor: black,
      textFormat: { fontFamily: "Calibri", fontSize: 13, bold: true, foregroundColor: white },
    };
    const turmaNameFmt = {
      ...baseFmt,
      textFormat: { fontFamily: "Calibri", fontSize: 12, bold: true },
    };
    const infoFmt = { ...baseFmt };
    const tableHeaderFmt = {
      ...baseFmt,
      backgroundColor: black,
      textFormat: { fontFamily: "Calibri", fontSize: 9, bold: true, foregroundColor: white },
    };
    const cellNameFmt = { ...baseFmt, horizontalAlignment: "LEFT" };
    const cellNumFmt = { ...baseFmt };
    const cellDateFmt = { ...baseFmt };
    const signFmt = {
      ...baseFmt,
      horizontalAlignment: "LEFT",
      textFormat: { fontFamily: "Calibri", fontSize: 10, bold: true, italic: true },
    };
    const legendFmt = { ...baseFmt, horizontalAlignment: "LEFT" };

    // 4. Construir rowData
    const rows: any[] = [];

    const fillRow = (firstCell: any, rest: number, fmt: any) => {
      const arr = [firstCell];
      for (let i = 0; i < rest; i++) arr.push(plainCell("", fmt));
      return { values: arr };
    };

    rows.push(fillRow(plainCell("SOCIEDADE CIVIL NOSSA SENHORA APARECIDA", headerInstFmt), totalCols - 1, headerInstFmt));
    rows.push(fillRow(plainCell("CENTRO DE ATENÇÃO INTEGRAL AO ADOLESCENTE", subHeaderInstFmt), totalCols - 1, subHeaderInstFmt));
    rows.push(fillRow(plainCell("SCFV CAIA - TERMO DE COLABORAÇÃO 001/2022", subHeaderInstFmt), totalCols - 1, subHeaderInstFmt));
    rows.push(fillRow(plainCell("", baseFmt), totalCols - 1, baseFmt));
    rows.push(fillRow(plainCell(`LISTA DE CHAMADA — ${MESES[mesNum - 1].toUpperCase()} / ${anoNum}`, titleFmt), totalCols - 1, titleFmt));
    rows.push(fillRow(plainCell(turma.nome, turmaNameFmt), totalCols - 1, turmaNameFmt));

    // Linha de info com rótulos em negrito (rich text)
    const infoRuns = [
      { text: "Período: ", bold: true }, { text: periodoStr },
      { text: "  ·  " },
      { text: "Faixa Etária: ", bold: true }, { text: faixaStr },
      { text: "  ·  " },
      { text: "Educador(a): ", bold: true }, { text: educadorStr },
      { text: "  ·  " },
      { text: "Bairro: ", bold: true }, { text: bairroStr },
    ];
    rows.push(fillRow(richCell(infoRuns, infoFmt), totalCols - 1, infoFmt));
    rows.push(fillRow(plainCell("", baseFmt), totalCols - 1, baseFmt));

    // Cabeçalho da tabela
    {
      const arr = [plainCell("Nº", tableHeaderFmt), plainCell("Nome do Participante", tableHeaderFmt)];
      for (const dt of datas) arr.push(plainCell(dt, tableHeaderFmt));
      rows.push({ values: arr });
    }

    // Ordenar membros: ativos -> transferidos -> desligados, alfabetico dentro
    const sortedAll = [...members].sort((a, b) => a.nome.localeCompare(b.nome));
    const ativos = sortedAll.filter(m => !m.desligado && !m.transferido);
    const transferidos = sortedAll.filter(m => m.transferido && !m.desligado);
    const desligados = sortedAll.filter(m => m.desligado);
    const ordered = [...ativos, ...transferidos, ...desligados];

    ordered.forEach((m, i) => {
      const isInactive = m.desligado || m.transferido;
      const cellFmt = {
        ...cellNameFmt,
        textFormat: {
          ...(cellNameFmt.textFormat || {}),
          strikethrough: isInactive,
          foregroundColor: isInactive ? { red: 0.5, green: 0.5, blue: 0.5 } : black,
        },
      };
      const numFmt = {
        ...cellNumFmt,
        textFormat: {
          ...(cellNumFmt.textFormat || {}),
          strikethrough: isInactive,
          foregroundColor: isInactive ? { red: 0.5, green: 0.5, blue: 0.5 } : black,
        },
      };
      const dateFmt = {
        ...cellDateFmt,
        textFormat: {
          ...(cellDateFmt.textFormat || {}),
          strikethrough: isInactive,
          foregroundColor: isInactive ? { red: 0.5, green: 0.5, blue: 0.5 } : black,
        },
      };

      // Nome com marcador em negrito
      let runs: Array<{ text: string; bold?: boolean }>;
      if (m.desligado) {
        const data = m.data_desligamento ? ` ${m.data_desligamento}` : "";
        runs = [{ text: m.nome + " " }, { text: `(D${data})`, bold: true }];
      } else if (m.transferido) {
        const data = m.data_transferencia ? ` ${m.data_transferencia}` : "";
        runs = [{ text: m.nome + " " }, { text: `(T${data})`, bold: true }];
      } else if (m.novo) {
        const data = m.iniciou_em ? ` ${m.iniciou_em}` : "";
        runs = [{ text: m.nome + " " }, { text: `(N${data})`, bold: true }];
      } else {
        runs = [{ text: m.nome }];
      }

      const arr: any[] = [plainCell(i + 1, numFmt), richCell(runs, cellFmt)];
      for (let j = 0; j < datas.length; j++) {
        arr.push(plainCell(isInactive ? "—" : "", dateFmt));
      }
      rows.push({ values: arr });
    });

    // Linha em branco + assinatura
    rows.push(fillRow(plainCell("", baseFmt), totalCols - 1, baseFmt));
    {
      const arr: any[] = [
        plainCell("", signFmt),
        plainCell(`Assinatura do(a) Educador(a): ${"_".repeat(80)}`, signFmt),
      ];
      for (let j = 2; j < totalCols; j++) arr.push(plainCell("", signFmt));
      rows.push({ values: arr });
    }
    rows.push(fillRow(plainCell("", baseFmt), totalCols - 1, baseFmt));
    // Legenda com (BA)/(D)/(T) em negrito
    {
      const legendRuns = [
        { text: "Legenda: " },
        { text: "(D)", bold: true }, { text: " = Desligado  ·  " },
        { text: "(T)", bold: true }, { text: " = Transferido  ·  " },
        { text: "(N)", bold: true }, { text: " = Novo no mês" },
      ];
      const arr: any[] = [plainCell("", legendFmt), richCell(legendRuns, legendFmt)];
      for (let j = 2; j < totalCols; j++) arr.push(plainCell("", legendFmt));
      rows.push({ values: arr });
    }

    const totalRows = rows.length;
    const sheetTitle = `${turma.nome} - ${MESES[mesNum - 1]}`.slice(0, 95);
    const SHEET_ID = 0;

    // 5. Criar a spreadsheet com dados embutidos
    const ts = new Date();
    const timestamp = `${ts.getFullYear()}-${pad2(ts.getMonth() + 1)}-${pad2(ts.getDate())}_${pad2(ts.getHours())}${pad2(ts.getMinutes())}${pad2(ts.getSeconds())}`;
    const spreadsheetTitle = `SysCFV_ListaChamada_${safeName(turma.nome)}_${anoNum}-${pad2(mesNum)}_${timestamp}`;

    const created = await gw(
      `${SHEETS_GW}/spreadsheets`,
      {
        method: "POST",
        body: JSON.stringify({
          properties: { title: spreadsheetTitle, locale: "pt_BR" },
          sheets: [{
            properties: {
              sheetId: SHEET_ID,
              title: sheetTitle,
              gridProperties: { rowCount: Math.max(totalRows + 5, 30), columnCount: totalCols },
            },
            data: [{ startRow: 0, startColumn: 0, rowData: rows }],
          }],
        }),
      },
      GOOGLE_SHEETS_API_KEY,
      LOVABLE_API_KEY,
    );

    const fileId = created.spreadsheetId;
    const sheetUrl = created.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${fileId}/edit`;

    // 6. batchUpdate: merges, autoresize de colunas (B+) e largura mínima da col A
    const requests: any[] = [];
    // Merges das 7 linhas de cabeçalho institucional (rows 0..6 e 7 vazia)
    for (const r of [0, 1, 2, 3, 4, 5, 6, 7]) {
      requests.push({
        mergeCells: {
          range: { sheetId: SHEET_ID, startRowIndex: r, endRowIndex: r + 1, startColumnIndex: 0, endColumnIndex: totalCols },
          mergeType: "MERGE_ALL",
        },
      });
    }
    // Merge da assinatura (linha após blank): índice = 9 + ordered.length + 1
    const headerStartRow = 8;
    const dataRowsCount = ordered.length;
    const blankAfterData = headerStartRow + 1 + dataRowsCount; // index of blank
    const signRowIdx = blankAfterData + 1;
    const blankAfterSign = signRowIdx + 1;
    const legendRowIdx = blankAfterSign + 1;
    requests.push({
      mergeCells: {
        range: { sheetId: SHEET_ID, startRowIndex: signRowIdx, endRowIndex: signRowIdx + 1, startColumnIndex: 1, endColumnIndex: totalCols },
        mergeType: "MERGE_ALL",
      },
    });
    requests.push({
      mergeCells: {
        range: { sheetId: SHEET_ID, startRowIndex: legendRowIdx, endRowIndex: legendRowIdx + 1, startColumnIndex: 1, endColumnIndex: totalCols },
        mergeType: "MERGE_ALL",
      },
    });

    // Largura fixa para coluna A (Nº)
    requests.push({
      updateDimensionProperties: {
        range: { sheetId: SHEET_ID, dimension: "COLUMNS", startIndex: 0, endIndex: 1 },
        properties: { pixelSize: 40 },
        fields: "pixelSize",
      },
    });
    // Auto-resize colunas B até a última
    requests.push({
      autoResizeDimensions: {
        dimensions: { sheetId: SHEET_ID, dimension: "COLUMNS", startIndex: 1, endIndex: totalCols },
      },
    });
    // Frozen header (8 linhas + cabeçalho da tabela)
    requests.push({
      updateSheetProperties: {
        properties: { sheetId: SHEET_ID, gridProperties: { frozenRowCount: headerStartRow + 1 } },
        fields: "gridProperties.frozenRowCount",
      },
    });

    await gw(
      `${SHEETS_GW}/spreadsheets/${fileId}:batchUpdate`,
      { method: "POST", body: JSON.stringify({ requests }) },
      GOOGLE_SHEETS_API_KEY,
      LOVABLE_API_KEY,
    );

    // 7. Permissão pública (anyone with link can view)
    try {
      await gw(
        `${DRIVE_GW}/files/${fileId}/permissions?supportsAllDrives=true`,
        { method: "POST", body: JSON.stringify({ role: "reader", type: "anyone" }) },
        GOOGLE_SHEETS_API_KEY,
        LOVABLE_API_KEY,
        GOOGLE_DRIVE_API_KEY,
      );
    } catch (permErr) {
      console.warn("[lista-chamada-gsheet] permissão pública falhou:", permErr);
    }

    // 8. Mover para pasta SYSCFV/{MES} - {ANO}/04_Listas_Presenca
    try {
      const folderId = await ensureMonthSubfolder(anoNum, mesNum, "04_Listas_Chamada_Em_Branco", GOOGLE_DRIVE_API_KEY, LOVABLE_API_KEY);
      if (folderId) await moveFileToFolder(fileId, folderId, GOOGLE_DRIVE_API_KEY, LOVABLE_API_KEY);
    } catch (mvErr) {
      console.warn("[lista-chamada-gsheet] move pasta mensal:", mvErr);
    }

    return new Response(
      JSON.stringify({ url: sheetUrl, fileId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[generate-lista-chamada-gsheet] erro:", err);
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});