import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import XLSX from "npm:xlsx-js-style";

const DIAS_MAP: Record<string, number> = { dom: 0, seg: 1, ter: 2, qua: 3, qui: 4, sex: 5, sab: 6 };
const MESES_NOMES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const BAIRROS_SCFV = ["JARDIM IRENE", "PARQUE INDEPENDENCIA", "ALVORADA"];
const METAS_BAIRRO: Record<string, { criancasManha: number; criancasTarde: number; idosos: number | null }> = {
  "JARDIM IRENE": { criancasManha: 100, criancasTarde: 100, idosos: 30 },
  "PARQUE INDEPENDENCIA": { criancasManha: 60, criancasTarde: 60, idosos: 30 },
  "ALVORADA": { criancasManha: 60, criancasTarde: 60, idosos: null },
};
const TIPO_ATENDIMENTO_LABELS: Record<string, string> = {
  atendimento_individual: "Atendimento Individual", visita_domiciliar: "Visita Domiciliar",
  encaminhamento: "Encaminhamento", busca_ativa: "Busca Ativa", acolhida: "Acolhida", desligamento: "Desligamento",
};

// ===== Drive helpers (upload XLSX e converte em Google Sheets na pasta mensal) =====
const DRIVE_GW = "https://connector-gateway.lovable.dev/google_drive/drive/v3";
const DRIVE_UPLOAD_GW = "https://connector-gateway.lovable.dev/google_drive/upload/drive/v3";
const MESES_UPPER = ["JANEIRO","FEVEREIRO","MARÇO","ABRIL","MAIO","JUNHO","JULHO","AGOSTO","SETEMBRO","OUTUBRO","NOVEMBRO","DEZEMBRO"];

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
  } catch (e) { console.warn("ensureMonthSubfolder", e); return null; }
}

async function uploadXlsxAsGsheet(buf: Uint8Array, name: string, parentId: string | null, driveKey: string, lovableKey: string): Promise<{ id: string; url: string } | null> {
  try {
    const metadata: any = {
      name,
      mimeType: "application/vnd.google-apps.spreadsheet", // converte para Sheets
    };
    if (parentId) metadata.parents = [parentId];
    const boundary = "----syscfv" + Math.random().toString(36).slice(2);
    const enc = new TextEncoder();
    const head = enc.encode(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\nContent-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\r\n\r\n`
    );
    const tail = enc.encode(`\r\n--${boundary}--`);
    const body = new Uint8Array(head.length + buf.length + tail.length);
    body.set(head, 0); body.set(buf, head.length); body.set(tail, head.length + buf.length);
    const r = await fetch(`${DRIVE_UPLOAD_GW}/files?uploadType=multipart&supportsAllDrives=true&fields=id,webViewLink`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": driveKey,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    });
    if (!r.ok) { console.warn("upload drive falhou", r.status, await r.text()); return null; }
    const j = await r.json();
    // share anyone with link
    await fetch(`${DRIVE_GW}/files/${j.id}/permissions?supportsAllDrives=true`, {
      method: "POST",
      headers: { Authorization: `Bearer ${lovableKey}`, "X-Connection-Api-Key": driveKey, "Content-Type": "application/json" },
      body: JSON.stringify({ role: "reader", type: "anyone" }),
    }).catch(() => {});
    return { id: j.id, url: j.webViewLink || `https://docs.google.com/spreadsheets/d/${j.id}/edit` };
  } catch (e) { console.warn("uploadXlsxAsGsheet", e); return null; }
}

async function maybePushToDrive(buf: Uint8Array, name: string, mes: number, ano: number): Promise<{ url: string; id: string } | null> {
  const driveKey = Deno.env.get("GOOGLE_DRIVE_API_KEY");
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  if (!driveKey || !lovableKey) return null;
  const folderId = await ensureMonthSubfolder(ano, mes, "01_Relatorios_Mensais", driveKey, lovableKey);
  return await uploadXlsxAsGsheet(buf, name, folderId, driveKey, lovableKey);
}

// ===== Estilos institucionais (atualizados conforme comentários da planilha) =====
const BORDER_THIN = { style: "thin", color: { rgb: "000000" } };
const BORDER_OBJ = { top: BORDER_THIN, bottom: BORDER_THIN, left: BORDER_THIN, right: BORDER_THIN };
const FONT_NAME = "Arial";

const TITULO_INSTITUCIONAL = "RELATÓRIO MENSAL CONSOLIDADO | SOCIEDADE CIVIL NOSSA SENHORA APARECIDA";
const SUBTITULO_INSTITUCIONAL =
  "Centro de Atenção Integral ao Adolescente | Serviço de Convivência e Fortalecimento de Vínculos";

const STYLE_TITULO = {
  font: { name: FONT_NAME, sz: 12, bold: true, color: { rgb: "FFFFFF" } },
  fill: { fgColor: { rgb: "000000" } },
  alignment: { horizontal: "center", vertical: "center", wrapText: true },
  border: BORDER_OBJ,
};
const STYLE_SUBTITULO = {
  font: { name: FONT_NAME, sz: 10, italic: true, color: { rgb: "000000" } },
  alignment: { horizontal: "center", vertical: "center", wrapText: true },
};
const STYLE_BOLD = { font: { name: FONT_NAME, sz: 10, bold: true } };
const STYLE_NORMAL = { font: { name: FONT_NAME, sz: 10 } };

function periodoLabel(p?: string | null): string {
  if (!p) return "—";
  const v = String(p).toLowerCase();
  if (v === "manha" || v === "manhã") return "MANHA";
  if (v === "tarde") return "TARDE";
  if (v === "integral") return "INTEGRAL";
  return String(p).toUpperCase();
}

function styleCell(ws: any, addr: string, style: any, value?: any) {
  if (!ws[addr]) ws[addr] = { v: value ?? "", t: "s" };
  if (value !== undefined) ws[addr].v = value;
  ws[addr].s = { ...(ws[addr].s || {}), ...style };
}

/** Aplica cabeçalho institucional (título preto + subtítulo) nas linhas 0-1 e
 *  faz merge ao longo de `colCount` colunas. Eleva a altura das linhas. */
function applyInstitutionalHeader(ws: any, colCount: number) {
  // Título (linha 0)
  for (let c = 0; c < colCount; c++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c });
    styleCell(ws, addr, STYLE_TITULO, c === 0 ? TITULO_INSTITUCIONAL : "");
  }
  // Subtítulo (linha 1)
  for (let c = 0; c < colCount; c++) {
    const addr = XLSX.utils.encode_cell({ r: 1, c });
    styleCell(ws, addr, STYLE_SUBTITULO, c === 0 ? SUBTITULO_INSTITUCIONAL : "");
  }
  ws["!merges"] = ws["!merges"] || [];
  if (colCount > 1) {
    ws["!merges"].push({ s: { r: 0, c: 0 }, e: { r: 0, c: colCount - 1 } });
    ws["!merges"].push({ s: { r: 1, c: 0 }, e: { r: 1, c: colCount - 1 } });
  }
  ws["!rows"] = ws["!rows"] || [];
  ws["!rows"][0] = { hpt: 22 };
  ws["!rows"][1] = { hpt: 16 };
}

/** Insere bordas finas pretas em todas as linhas com conteúdo até `lastDataCol`. */
function applyBordersToRange(ws: any, startRow: number, endRow: number, colCount: number) {
  for (let r = startRow; r <= endRow; r++) {
    for (let c = 0; c < colCount; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      if (!ws[addr]) ws[addr] = { v: "", t: "s" };
      ws[addr].s = { ...(ws[addr].s || {}), border: BORDER_OBJ };
    }
  }
}

function getDatasAtividade(ano: number, mes: number, diasSemana: string[]): string[] {
  const diasNum = diasSemana.map(d => DIAS_MAP[d.toLowerCase()]).filter(n => n !== undefined);
  if (!diasNum.length) return [];
  const datas: string[] = [];
  const dt = new Date(ano, mes - 1, 1);
  while (dt.getMonth() === mes - 1) {
    if (diasNum.includes(dt.getDay())) datas.push(dt.toISOString().slice(0, 10));
    dt.setDate(dt.getDate() + 1);
  }
  return datas;
}

function calcAge(dob: string): number {
  const b = new Date(dob); const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  if (now.getMonth() < b.getMonth() || (now.getMonth() === b.getMonth() && now.getDate() < b.getDate())) age--;
  return age;
}

function calcFaixaFromDate(dob: string): string | null {
  const age = calcAge(dob);
  if (age >= 60) return "idosos";
  if (age >= 12) return "12-17";
  if (age >= 9) return "9-11";
  if (age >= 6) return "6-8";
  return null;
}

function applyBorders(ws: any) {
  const range = XLSX.utils.decode_range(ws["!ref"] || "A1");
  const border = { style: "thin", color: { rgb: "000000" } };
  for (let r = range.s.r; r <= range.e.r; r++) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      if (!ws[addr]) ws[addr] = { v: "", t: "s" };
      ws[addr].s = { ...(ws[addr].s || {}), border: { top: border, bottom: border, left: border, right: border } };
    }
  }
}

function autoFitCols(ws: any) {
  const range = XLSX.utils.decode_range(ws["!ref"] || "A1");
  const existing = ws["!cols"] || [];
  const widths: number[] = [];
  for (let c = range.s.c; c <= range.e.c; c++) {
    let best = existing[c]?.wch ?? 4;
    for (let r = range.s.r; r <= range.e.r; r++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = ws[addr];
      if (!cell || cell.v == null) continue;
      const len = String(cell.v).split("\n").reduce((mx: number, l: string) => Math.max(mx, l.length), 0);
      if (len + 2 > best) best = len + 2;
    }
    widths.push(Math.min(best, 60));
  }
  ws["!cols"] = widths.map((w: number) => ({ wch: w }));
}

function applyHeaderStyle(ws: any, row: number, colCount: number) {
  const border = { style: "thin", color: { rgb: "000000" } };
  for (let c = 0; c < colCount; c++) {
    const addr = XLSX.utils.encode_cell({ r: row, c });
    if (!ws[addr]) ws[addr] = { v: "", t: "s" };
    ws[addr].s = {
      font: { bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "000000" } },
      border: { top: border, bottom: border, left: border, right: border },
      alignment: { wrapText: true, vertical: "center" },
    };
  }
}

async function fetchAll(supabase: any, table: string) {
  const all: any[] = [];
  let from = 0;
  const size = 1000;
  while (true) {
    const { data, error } = await supabase.from(table).select("*").range(from, from + size - 1);
    if (error) throw error;
    all.push(...(data || []));
    if (!data || data.length < size) break;
    from += size;
  }
  return all;
}

function generateMonthSheets(
  wb: any, mesNum: number, anoNum: number, suffix: string,
  presencas_raw: any[], participantes: any[], turmas: any[], bairros: any[],
  relatorios: any[], planejamentos: any[], turmaParticipantes: any[],
  relatorioTurmas: any[], atendimentos_raw: any[], profilesData: any[],
  relatorioPresencas: any[], usedSheetNames: Set<string>,
  buscaAtivaRegistros: any[] = []
) {
  const mesStr = String(mesNum).padStart(2, "0");
  const startDate = `${anoNum}-${mesStr}-01`;
  const endDate = mesNum === 12 ? `${anoNum + 1}-01-01` : `${anoNum}-${String(mesNum + 1).padStart(2, "0")}-01`;

  const presencas = presencas_raw.filter((p: any) => p.data >= startDate && p.data < endDate);
  const filteredRelatorios = relatorios.filter((r: any) => r.data >= startDate && r.data < endDate);
  const filteredAtendimentos = atendimentos_raw.filter((a: any) => a.data_atendimento >= startDate && a.data_atendimento < endDate);

  // Enrich presencas with relatorio_presenca fallback
  const presencaKeys = new Set(presencas.map((p: any) => `${p.participante_id}_${p.data}_${p.turma_id}`));
  filteredRelatorios.forEach((r: any) => {
    const rTurmas = relatorioTurmas.filter((rt: any) => rt.relatorio_id === r.id);
    const rPres = relatorioPresencas.filter((rp: any) => rp.relatorio_id === r.id);
    rTurmas.forEach((rt: any) => {
      rPres.forEach((rp: any) => {
        const key = `${rp.participante_id}_${r.data}_${rt.turma_id}`;
        if (!presencaKeys.has(key)) {
          presencas.push({ participante_id: rp.participante_id, data: r.data, turma_id: rt.turma_id, presente: rp.presente, id: rp.id });
          presencaKeys.add(key);
        }
      });
    });
  });

  const partMap = new Map(participantes.map((p: any) => [p.id, p]));
  const bairroMap = new Map(bairros.map((b: any) => [b.id, b.nome]));
  const profileMap = new Map(profilesData.map((p: any) => [p.id, p]));
  const turmaMap = new Map(turmas.map((t: any) => [t.id, t]));
  const planMap = new Map(planejamentos.map((p: any) => [p.id, p]));

  // Filter out presencas from desligados after their data_desligamento
  const activePresencas = presencas.filter((p: any) => {
    const part = partMap.get(p.participante_id);
    if (!part) return true;
    if (part.status === "desligado" && part.data_desligamento && p.data > part.data_desligamento) return false;
    return true;
  });

  const atendidosIds = new Set(activePresencas.filter((p: any) => p.presente).map((p: any) => p.participante_id));
  const atendidos = [...atendidosIds].map(id => partMap.get(id)).filter(Boolean);

  // Exclude participants desligados before start of month
  const atendidosFiltered = atendidos.filter((p: any) => {
    if (p.status === "desligado" && p.data_desligamento && p.data_desligamento < startDate) return false;
    return true;
  });

  const byBairro: Record<string, number> = {};
  atendidosFiltered.forEach((p: any) => { const b = p.bairro_id ? (bairroMap.get(p.bairro_id) || "N/I") : "N/I"; byBairro[b] = (byBairro[b] || 0) + 1; });

  const byFaixa: Record<string, number> = {};
  atendidosFiltered.forEach((p: any) => { if (p.data_nascimento) { const f = calcFaixaFromDate(p.data_nascimento); if (f) byFaixa[f] = (byFaixa[f] || 0) + 1; } });

  const byPeriodo: Record<string, number> = {};
  atendidosFiltered.forEach((p: any) => { const per = p.periodo || "N/I"; byPeriodo[per] = (byPeriodo[per] || 0) + 1; });

  const novasInsercoes = participantes.filter((p: any) => p.iniciou_em && p.iniciou_em >= startDate && p.iniciou_em < endDate);

  const atendByTipo: Record<string, number> = {};
  filteredAtendimentos.forEach((a: any) => { const t = a.tipo || "atendimento_individual"; atendByTipo[t] = (atendByTipo[t] || 0) + 1; });

  // ===== Indicadores institucionais (padrão D3) =====
  // Ativos = status IN ('ativo','cadastro_incompleto') no fim do período.
  const ativosNoFim = participantes.filter(
    (p: any) => p.status === "ativo" || p.status === "cadastro_incompleto"
  );
  // Em Busca Ativa = status='busca_ativa' AND busca_ativa_desde <= fim_periodo.
  const fimPeriodo = endDate; // exclusivo; comparações `<` funcionam
  const baNoFim = participantes.filter(
    (p: any) => p.status === "busca_ativa" &&
      (!p.busca_ativa_desde || p.busca_ativa_desde < fimPeriodo)
  );

  // Sheet: Resumo
  const periodoLabelMap = (k: string) => k === "manha" ? "Manha" : k === "tarde" ? "Tarde" : k === "integral" ? "Integral" : k;
  const totalGeral = atendidosFiltered.length;
  const resumoData: any[][] = [
    [TITULO_INSTITUCIONAL], // linha 1 (sobrescrita pelo applyInstitutionalHeader)
    [SUBTITULO_INSTITUCIONAL], // linha 2
    [`MÊS: ${MESES_NOMES[mesNum - 1].toUpperCase()} / ${anoNum}`],
    [`Data de geração: ${new Date().toLocaleString("pt-BR")}`],
    [],
    ["ATENDIDOS NO MÊS", atendidosFiltered.length],
    ["ATIVOS (fim do período)", ativosNoFim.length],
    ["EM BUSCA ATIVA (fim do período)", baNoFim.length],
    [], ["POR BAIRRO", "Quant."],
    ...Object.entries(byBairro).sort((a, b) => b[1] - a[1]).map(([b, c]) => [b, c]),
    [], ["POR FAIXA ETÁRIA", "Quant."],
    ...Object.entries(byFaixa).map(([f, c]) => [f, c]),
    [], ["POR PERÍODO", "Quant."],
    ...Object.entries(byPeriodo).map(([p, c]) => [periodoLabelMap(p), c]),
    [], ["NOVAS INSERÇÕES NO MÊS", novasInsercoes.length],
    ...novasInsercoes.map((p: any) => [p.nome_completo, p.iniciou_em]),
    [], ["ATENDIMENTOS TÉCNICOS NO MÊS", filteredAtendimentos.length],
    ...Object.entries(atendByTipo).map(([t, c]) => [TIPO_ATENDIMENTO_LABELS[t] || t, c]),
    [], ["TOTAL GERAL", totalGeral],
  ];
  const sn1 = truncSheet(`Resumo${suffix}`, usedSheetNames);
  const wsResumo = XLSX.utils.aoa_to_sheet(resumoData);
  wsResumo["!cols"] = [{ wch: 40 }, { wch: 15 }];
  autoFitCols(wsResumo);
  applyInstitutionalHeader(wsResumo, 2);
  // Negritos institucionais
  const RESUMO_BOLD_LABELS = new Set([
    "ATENDIDOS NO MÊS", "ATIVOS (fim do período)", "EM BUSCA ATIVA (fim do período)",
    "POR BAIRRO", "POR FAIXA ETÁRIA", "POR PERÍODO",
    "NOVAS INSERÇÕES NO MÊS", "ATENDIMENTOS TÉCNICOS NO MÊS", "TOTAL GERAL",
    ...BAIRROS_SCFV,
  ]);
  for (let r = 2; r < resumoData.length; r++) {
    const v = resumoData[r][0];
    if (typeof v === "string") {
      if (v.startsWith("MÊS:")) styleCell(wsResumo, XLSX.utils.encode_cell({ r, c: 0 }), { ...STYLE_BOLD, alignment: { horizontal: "left" } });
      else if (RESUMO_BOLD_LABELS.has(v)) {
        styleCell(wsResumo, XLSX.utils.encode_cell({ r, c: 0 }), STYLE_BOLD);
        styleCell(wsResumo, XLSX.utils.encode_cell({ r, c: 1 }), STYLE_BOLD);
      }
    }
  }
  XLSX.utils.book_append_sheet(wb, wsResumo, sn1);

  // ===== Aba "Em Busca Ativa" =====
  // Coluna: Nome, CPF, Idade, Bairro, Turma, Em BA desde, Último registro, Resultado, Responsável
  const baByPart = new Map<string, any[]>();
  (buscaAtivaRegistros || []).forEach((r: any) => {
    if (!baByPart.has(r.participante_id)) baByPart.set(r.participante_id, []);
    baByPart.get(r.participante_id)!.push(r);
  });
  const calcIdade = (dn: string | null): string => {
    if (!dn) return "—";
    const d = new Date(dn + "T12:00:00");
    const ref = new Date(endDate + "T12:00:00");
    let age = ref.getFullYear() - d.getFullYear();
    const m = ref.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && ref.getDate() < d.getDate())) age--;
    return String(age);
  };
  const turmaByPart = new Map<string, string>();
  turmaParticipantes.forEach((tp: any) => {
    if (tp.data_saida) return;
    const t = turmaMap.get(tp.turma_id);
    if (t) turmaByPart.set(tp.participante_id, t.nome);
  });
  const baSorted = [...baNoFim].sort((a: any, b: any) =>
    (a.busca_ativa_desde || "").localeCompare(b.busca_ativa_desde || "")
  );
  const baRows: any[][] = [
    [TITULO_INSTITUCIONAL],
    [SUBTITULO_INSTITUCIONAL],
    [`EM BUSCA ATIVA — ${MESES_NOMES[mesNum - 1].toUpperCase()} / ${anoNum}`],
    [`Data de geração: ${new Date().toLocaleString("pt-BR")}`],
    [],
    ["Nome", "CPF", "Idade", "Bairro", "Turma", "Em BA desde", "Último registro", "Resultado", "Responsável"],
  ];
  baSorted.forEach((p: any) => {
    const regs = (baByPart.get(p.id) || []).slice().sort((a: any, b: any) =>
      (b.data_registro || "").localeCompare(a.data_registro || "")
    );
    const last = regs[0];
    const respId = last?.profissional_id;
    const resp = respId ? (profileMap.get(respId)?.nome || "—") : "—";
    baRows.push([
      p.nome_completo,
      p.cpf || "—",
      calcIdade(p.data_nascimento),
      p.bairro_id ? (bairroMap.get(p.bairro_id) || "—") : "—",
      turmaByPart.get(p.id) || "—",
      p.busca_ativa_desde ? `${p.busca_ativa_desde.slice(8,10)}/${p.busca_ativa_desde.slice(5,7)}/${p.busca_ativa_desde.slice(0,4)}` : "—",
      last?.data_registro ? `${last.data_registro.slice(8,10)}/${last.data_registro.slice(5,7)}` : "—",
      last?.resultado || "—",
      resp,
    ]);
  });
  if (baSorted.length === 0) baRows.push(["(nenhum participante em busca ativa no período)"]);
  const wsBA = XLSX.utils.aoa_to_sheet(baRows);
  wsBA["!cols"] = [{ wch: 30 }, { wch: 14 }, { wch: 6 }, { wch: 22 }, { wch: 24 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 22 }];
  autoFitCols(wsBA);
  applyInstitutionalHeader(wsBA, 9);
  applyHeaderStyle(wsBA, 5, 9);
  XLSX.utils.book_append_sheet(wb, wsBA, truncSheet(`BuscaAtiva${suffix}`, usedSheetNames));

  // Sheet: Atividades — Propostas = TODOS planejamentos do mês; Desenvolvidas = relatórios + descrição (até 250)
  const atividadesRows: any[][] = [];
  const usedPlanIds = new Set<string>();
  const filteredPlanejamentos = planejamentos.filter(
    (p: any) => p.data_aplicacao && p.data_aplicacao >= startDate && p.data_aplicacao < endDate,
  );
  const truncStr = (s: string, n: number) => (s || "").length > n ? (s || "").slice(0, n - 1) + "…" : (s || "");
  filteredRelatorios.forEach((r: any) => {
    const plan = r.planejamento_id ? planMap.get(r.planejamento_id) : null;
    if (plan) usedPlanIds.add(plan.id);
    const proposta = plan ? (plan.titulo + (plan.tema ? ` — ${plan.tema}` : "")) : "Não planejada";
    const desc = truncStr(r.observacoes || r.intervencoes || r.nome_atividade || "", 250);
    const desenvolvida = r.nome_atividade ? `${r.nome_atividade}\n${desc}` : desc;
    atividadesRows.push([proposta, desenvolvida, r.analise_ia || "", ""]);
  });
  filteredPlanejamentos.forEach((plan: any) => {
    if (usedPlanIds.has(plan.id)) return;
    const proposta = plan.titulo + (plan.tema ? ` — ${plan.tema}` : "");
    atividadesRows.push([proposta, "— Não executada —", "", ""]);
  });
  if (atividadesRows.length === 0) atividadesRows.push(["Nenhuma atividade registrada no período", "", "", ""]);
  const atividadesData = [
    [TITULO_INSTITUCIONAL],
    [SUBTITULO_INSTITUCIONAL],
    ["ATIVIDADES PROPOSTAS x DESENVOLVIDAS"],
    [`MÊS: ${MESES_NOMES[mesNum - 1].toUpperCase()} / ${anoNum}`],
    [],
    ["Atividades Propostas", "Atividades Desenvolvidas", "Resultados Alcançados", "Justificativas"],
    ...atividadesRows,
  ];
  const sn2 = truncSheet(`Ativ${suffix}`, usedSheetNames);
  const wsAtiv = XLSX.utils.aoa_to_sheet(atividadesData);
  wsAtiv["!cols"] = [{ wch: 35 }, { wch: 35 }, { wch: 40 }, { wch: 30 }];
  autoFitCols(wsAtiv);
  applyInstitutionalHeader(wsAtiv, 4);
  styleCell(wsAtiv, "A3", STYLE_BOLD, "ATIVIDADES PROPOSTAS x DESENVOLVIDAS");
  styleCell(wsAtiv, "A4", { ...STYLE_BOLD, alignment: { horizontal: "left" } });
  applyHeaderStyle(wsAtiv, 5, 4);
  // Bordas e wrap em todas as linhas com conteúdo (incluindo coluna Resultados)
  const lastRowAtiv = 5 + atividadesRows.length;
  applyBordersToRange(wsAtiv, 5, lastRowAtiv, 4);
  for (let r = 6; r <= lastRowAtiv; r++) {
    for (let c = 0; c < 4; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      styleCell(wsAtiv, addr, { font: { name: FONT_NAME, sz: 9 }, alignment: { wrapText: true, vertical: "top", horizontal: c === 2 ? "left" : "left" }, border: BORDER_OBJ });
    }
  }
  XLSX.utils.book_append_sheet(wb, wsAtiv, sn2);

  // Sheet: Metas
  // Conta cada participante UMA VEZ, no bairro de residência cadastrado e no seu período.
  // Evita duplicação por turmas em bairros distintos e elimina o efeito do período "integral".
  const bairroStats: Record<string, { criancasManha: Set<string>; criancasTarde: Set<string>; idosos: Set<string> }> = {};
  BAIRROS_SCFV.forEach(bn => { bairroStats[bn] = { criancasManha: new Set(), criancasTarde: new Set(), idosos: new Set() }; });
  const relIdToAnalise = new Map(filteredRelatorios.map((r: any) => [r.id, r.analise_ia || ""]));
  const bairroRelResultados: Record<string, Set<string>> = {};
  BAIRROS_SCFV.forEach(bn => { bairroRelResultados[bn] = new Set(); });
  relatorioTurmas.forEach((rt: any) => {
    const turma = turmaMap.get(rt.turma_id);
    if (!turma) return;
    const bairroNome = bairroMap.get(turma.bairro_id) || "";
    if (BAIRROS_SCFV.includes(bairroNome)) { const analise = relIdToAnalise.get(rt.relatorio_id); if (analise) bairroRelResultados[bairroNome].add(analise); }
  });
  // atendidosFiltered já é o conjunto único do Resumo (mesmo critério). Usa o bairro/periodo do PARTICIPANTE.
  atendidosFiltered.forEach((part: any) => {
    const bairroNome = part.bairro_id ? (bairroMap.get(part.bairro_id) || "") : "";
    if (!BAIRROS_SCFV.includes(bairroNome)) return;
    const age = part.data_nascimento ? calcAge(part.data_nascimento) : 0;
    const isIdoso = age >= 60;
    // Período: legado "integral" tratado como "manha" (não trabalhamos mais com integral).
    const periodo = part.periodo === "tarde" ? "tarde" : "manha";
    if (isIdoso) bairroStats[bairroNome].idosos.add(part.id);
    else if (periodo === "tarde") bairroStats[bairroNome].criancasTarde.add(part.id);
    else bairroStats[bairroNome].criancasManha.add(part.id);
  });
  const metasRows: any[][] = [];
  let totalCriancas = 0, totalMeta = 0, totalIdosos = 0, totalMetaIdosos = 0;
  BAIRROS_SCFV.forEach(bn => {
    const meta = METAS_BAIRRO[bn]; if (!meta) return;
    const stats = bairroStats[bn];
    const cm = stats.criancasManha.size, ct = stats.criancasTarde.size;
    const totalBairro = cm + ct, metaBairro = meta.criancasManha + meta.criancasTarde;
    const pct = metaBairro > 0 ? Math.round((totalBairro / metaBairro) * 100) : 0;
    const resultados = [...bairroRelResultados[bn]].filter(Boolean).join("; ").slice(0, 500);
    metasRows.push([bn, "", "", ""], [`  Crianças/adolescentes — Manhã (meta: ${meta.criancasManha})`, `${cm} atendidos`, resultados, ""], [`  Crianças/adolescentes — Tarde (meta: ${meta.criancasTarde})`, `${ct} atendidos`, "", ""], [`  Total crianças: ${pct}% da meta (${totalBairro}/${metaBairro})`, `${pct}% de atendidos em relação à meta`, "", ""]);
    if (meta.idosos !== null) { const idCount = stats.idosos.size; const pctId = meta.idosos > 0 ? Math.round((idCount / meta.idosos) * 100) : 0; metasRows.push([`  Idosos (meta: ${meta.idosos})`, `${idCount} atendidos — ${pctId}% da meta`, "", ""]); totalIdosos += idCount; totalMetaIdosos += meta.idosos; }
    metasRows.push([]); totalCriancas += totalBairro; totalMeta += metaBairro;
  });
  const pctGeral = totalMeta > 0 ? Math.round((totalCriancas / totalMeta) * 100) : 0;
  const pctIdosos2 = totalMetaIdosos > 0 ? Math.round((totalIdosos / totalMetaIdosos) * 100) : 0;
  metasRows.push(["TOTAL GERAL", "", "", ""], [`  Crianças/adolescentes: ${totalCriancas} (${pctGeral}% da meta de ${totalMeta})`, `${totalCriancas}`, "", ""], [`  Idosos: ${totalIdosos} (${pctIdosos2}% da meta de ${totalMetaIdosos})`, `${totalIdosos}`, "", ""]);
  const metasData = [
    [TITULO_INSTITUCIONAL],
    [SUBTITULO_INSTITUCIONAL],
    ["METAS PROPOSTAS — ACOMPANHAMENTO MENSAL"],
    [`MÊS: ${MESES_NOMES[mesNum - 1].toUpperCase()} / ${anoNum}`],
    [],
    ["Metas Propostas", "Quant.", "Resultados Alcançados", "Justificativa"],
    ...metasRows,
  ];
  const sn3 = truncSheet(`Metas${suffix}`, usedSheetNames);
  const wsMetas = XLSX.utils.aoa_to_sheet(metasData);
  wsMetas["!cols"] = [{ wch: 55 }, { wch: 35 }, { wch: 50 }, { wch: 25 }];
  autoFitCols(wsMetas);
  applyInstitutionalHeader(wsMetas, 4);
  styleCell(wsMetas, "A3", STYLE_BOLD, "METAS PROPOSTAS — ACOMPANHAMENTO MENSAL");
  styleCell(wsMetas, "A4", { ...STYLE_BOLD, alignment: { horizontal: "left" } });
  applyHeaderStyle(wsMetas, 5, 4);
  const lastRowMetas = 5 + metasRows.length;
  applyBordersToRange(wsMetas, 5, lastRowMetas, 4);
  // Negrito em "TOTAL GERAL" e nomes de bairro
  for (let r = 6; r <= lastRowMetas; r++) {
    const v = metasData[r]?.[0];
    if (typeof v === "string") {
      const trimmed = v.trim();
      if (trimmed === "TOTAL GERAL" || BAIRROS_SCFV.includes(trimmed)) {
        for (let c = 0; c < 4; c++) {
          const addr = XLSX.utils.encode_cell({ r, c });
          styleCell(wsMetas, addr, { ...STYLE_BOLD, border: BORDER_OBJ });
        }
      } else {
        for (let c = 0; c < 4; c++) {
          const addr = XLSX.utils.encode_cell({ r, c });
          styleCell(wsMetas, addr, { font: { name: FONT_NAME, sz: 9 }, alignment: { wrapText: true, vertical: "top" }, border: BORDER_OBJ });
        }
      }
    }
  }
  XLSX.utils.book_append_sheet(wb, wsMetas, sn3);

  // Sheet: Monitoramento (use activePresencas to exclude post-desligamento)
  const totalPresencasRegistros = activePresencas.length;
  const totalPresentes = activePresencas.filter((p: any) => p.presente).length;
  const pctPresencaGeral = totalPresencasRegistros > 0 ? Math.round((totalPresentes / totalPresencasRegistros) * 100) : 0;
  const partFreq: Record<string, { total: number; presentes: number }> = {};
  activePresencas.forEach((p: any) => { if (!partFreq[p.participante_id]) partFreq[p.participante_id] = { total: 0, presentes: 0 }; partFreq[p.participante_id].total++; if (p.presente) partFreq[p.participante_id].presentes++; });
  const partComFreq = Object.values(partFreq);
  const partBomFreq = partComFreq.filter(pf => pf.total > 0 && (pf.presentes / pf.total) >= 0.75).length;
  const pctBomFreq = partComFreq.length > 0 ? Math.round((partBomFreq / partComFreq.length) * 100) : 0;
  const monitorRows = [
    ["Assegurar espaços de referência para o convívio grupal, comunitário e social e o desenvolvimento de relações de afetividade, solidariedade e respeito mútuo", "Participação nas atividades sócio educacionais", "100%", `${pctPresencaGeral}%`],
    ["Possibilitar o reconhecimento do trabalho e a ampliação do universo informacional, artístico e cultural, bem como o desenvolvimento de potencialidades, habilidades, talentos e propiciar sua formação cidadã", "Participação nas atividades culturais, esportivas e sócio educacionais", "100%", `${pctPresencaGeral}%`],
    ["Contribuir para a inserção, reinserção e permanência no sistema educacional", "Matrícula, rendimento e frequência escolar", "100%", `${pctBomFreq}%`],
    ["Promover o acesso aos benefícios e serviços socioassistenciais, fortalecendo a função protetiva das famílias", "Quantidade de beneficiários encaminhados para a proteção social básica", "100%", "100%"],
  ];
  const monitorData = [
    [TITULO_INSTITUCIONAL],
    [SUBTITULO_INSTITUCIONAL],
    ["MONITORAMENTO E AVALIAÇÃO"],
    [`MÊS: ${MESES_NOMES[mesNum - 1].toUpperCase()} / ${anoNum}`],
    [],
    ["Objetivo", "Indicador", "Meta Prevista", "Meta Atingida"],
    ...monitorRows,
  ];
  const sn4 = truncSheet(`Monitor${suffix}`, usedSheetNames);
  const wsMonitor = XLSX.utils.aoa_to_sheet(monitorData);
  wsMonitor["!cols"] = [{ wch: 60 }, { wch: 45 }, { wch: 15 }, { wch: 15 }];
  autoFitCols(wsMonitor);
  applyInstitutionalHeader(wsMonitor, 4);
  styleCell(wsMonitor, "A3", STYLE_BOLD, "MONITORAMENTO E AVALIAÇÃO");
  styleCell(wsMonitor, "A4", { ...STYLE_BOLD, alignment: { horizontal: "left" } });
  applyHeaderStyle(wsMonitor, 5, 4);
  applyBordersToRange(wsMonitor, 5, 5 + monitorRows.length, 4);
  for (let r = 6; r <= 5 + monitorRows.length; r++) {
    for (let c = 0; c < 4; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      styleCell(wsMonitor, addr, { font: { name: FONT_NAME, sz: 9 }, alignment: { wrapText: true, vertical: "top" }, border: BORDER_OBJ });
    }
  }
  XLSX.utils.book_append_sheet(wb, wsMonitor, sn4);

  // Sheet: Atendimentos
  if (filteredAtendimentos.length > 0) {
    const atendRows = filteredAtendimentos.map((a: any) => {
      const part = partMap.get(a.participante_id);
      const prof = profileMap.get(a.profissional_id);
      return [a.data_atendimento, TIPO_ATENDIMENTO_LABELS[a.tipo] || a.tipo, part?.nome_completo || "—", prof?.nome || "—", (a.descricao || "").slice(0, 200), a.encaminhamento || ""];
    });
    // Formatar datas como DD/MM/AA
    const atendRowsFmt = atendRows.map((row: any[]) => {
      const d = row[0];
      if (typeof d === "string" && /^\d{4}-\d{2}-\d{2}/.test(d)) {
        row = [...row];
        row[0] = `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(2, 4)}`;
      }
      return row;
    });
    const atendData = [
      [TITULO_INSTITUCIONAL],
      [SUBTITULO_INSTITUCIONAL],
      ["ATENDIMENTOS TÉCNICOS"],
      [`MÊS: ${MESES_NOMES[mesNum - 1].toUpperCase()} / ${anoNum}`],
      [],
      ["Data", "Tipo", "Participante", "Profissional", "Descrição", "Encaminhamento"],
      ...atendRowsFmt,
    ];
    const sn5 = truncSheet(`Atend${suffix}`, usedSheetNames);
    const wsAtend = XLSX.utils.aoa_to_sheet(atendData);
    wsAtend["!cols"] = [{ wch: 12 }, { wch: 22 }, { wch: 30 }, { wch: 20 }, { wch: 50 }, { wch: 30 }];
    autoFitCols(wsAtend);
    applyInstitutionalHeader(wsAtend, 6);
    styleCell(wsAtend, "A3", STYLE_BOLD, "ATENDIMENTOS TÉCNICOS");
    styleCell(wsAtend, "A4", { ...STYLE_BOLD, alignment: { horizontal: "left" } });
    applyHeaderStyle(wsAtend, 5, 6);
    applyBordersToRange(wsAtend, 5, 5 + atendRowsFmt.length, 6);
    XLSX.utils.book_append_sheet(wb, wsAtend, sn5);
  }

  // Sheets: Matrizes de frequência por turma
  // Removido: as listas de presença/frequência agora são geradas em arquivo separado
  // (`generate-listas-frequencia-mes-gsheet`) com layout institucional P/A/J,
  // salvas em SYSCFV/{MÊS} - {ANO}/05_Listas_Frequencia_Preenchidas/.
  // O consolidado mensal foca em indicadores, atividades e atendimentos.
  const turmasAtivas: any[] = [];
  const border = { style: "thin", color: { rgb: "000000" } };
  const borderObj = { top: border, bottom: border, left: border, right: border };

  for (const t of turmasAtivas) {
    const tpRecords = turmaParticipantes.filter(
      (tp: any) =>
        tp.turma_id === t.id &&
        (!tp.data_saida || !tp.data_entrada || tp.data_saida >= tp.data_entrada),
    );
    // Janela efetiva por participante: combina turma_participantes com participantes.iniciou_em e data_desligamento
    const addDay = (iso: string): string => {
      const d = new Date(iso + "T12:00:00");
      d.setDate(d.getDate() + 1);
      return d.toISOString().slice(0, 10);
    };
    const windowByPart = new Map<string, { entrada: string | null; saida: string | null }>();
    tpRecords.forEach((tp: any) => {
      const part = partMap.get(tp.participante_id);
      const iniciou = part?.iniciou_em || null;
      const tpEntrada = tp.data_entrada || null;
      const effEntrada = iniciou && tpEntrada ? (iniciou > tpEntrada ? iniciou : tpEntrada) : (iniciou || tpEntrada);
      const tpSaida = tp.data_saida || null;
      const dataDeslig = (part?.status === "desligado" && part?.data_desligamento) ? part.data_desligamento : null;
      const deligSaida = dataDeslig ? addDay(dataDeslig) : null; // saida exclusiva
      const effSaida = tpSaida && deligSaida ? (tpSaida < deligSaida ? tpSaida : deligSaida) : (tpSaida || deligSaida);
      windowByPart.set(tp.participante_id, { entrada: effEntrada, saida: effSaida });
    });
    const tParts = tpRecords.map((tp: any) => partMap.get(tp.participante_id)).filter(Boolean) as any[];
    const tPresencas = presencas.filter((p: any) => p.turma_id === t.id);

    const relIdsForTurma = relatorioTurmas.filter((rt: any) => rt.turma_id === t.id).map((rt: any) => rt.relatorio_id);
    const relsForTurma = filteredRelatorios.filter((r: any) => relIdsForTurma.includes(r.id));
    const relPresFallback: { participante_id: string; data: string; presente: boolean }[] = [];
    relsForTurma.forEach((r: any) => {
      const rps = relatorioPresencas.filter((rp: any) => rp.relatorio_id === r.id);
      rps.forEach((rp: any) => {
        relPresFallback.push({ participante_id: rp.participante_id, data: r.data, presente: rp.presente });
      });
    });

    const diasSemana = t.dias_semana || [];
    const datasAtividade = getDatasAtividade(anoNum, mesNum, diasSemana);
    const fallbackDates = [...new Set(relPresFallback.map(f => f.data))];
    const allDatesSet = new Set([...datasAtividade, ...tPresencas.map((p: any) => p.data), ...fallbackDates]);
    const datas = [...allDatesSet].sort();
    if (!datas.length && !tParts.length) continue;

    const bairroNome = bairroMap.get(t.bairro_id) || "N/I";
    const sheetName = truncSheet(`${(t.nome || "Turma").slice(0, 22)}${suffix}`, usedSheetNames);

    // Cabeçalhos: 0/1 institucional · 2 título · 3 turma · 4 mês · 5 legenda · 6 vazio · 7 col headers
    const header1 = [TITULO_INSTITUCIONAL];
    const header2 = [SUBTITULO_INSTITUCIONAL];
    const header3 = [`SCFV — CAIA Medianeira — Matriz de Frequência`];
    const header4 = [
      `Turma: ${t.nome} | Bairro: ${bairroNome} | Faixa Etária: ${t.faixa_etaria || "N/I"} | Período: ${periodoLabel(t.periodo)}`,
    ];
    const header5 = [`MÊS: ${MESES_NOMES[mesNum - 1].toUpperCase()} / ${anoNum} | Exportado em: ${new Date().toLocaleString("pt-BR")}`];
    const header6 = [`Legenda: ■ presente · vazio = ausente · cinza = fora do vínculo (não matriculado, já saiu ou desligado) · "(D dd/mm)" no nome = desligado · "(BA)" = busca ativa`];
    // Datas formatadas DD/MM/AA
    const colHeaders = [
      "Nº",
      "Nome do Participante",
      ...datas.map((d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(2, 4)}`),
    ];
    const rows = tParts.map((p: any, idx: number) => {
      const isDesligado = p.status === "desligado";
      const isBA = p.status === "busca_ativa";
      const dataDeslig = p.data_desligamento || null;
      let nameSuffix = "";
      if (isDesligado && dataDeslig) nameSuffix = ` (D ${dataDeslig.slice(8,10)}/${dataDeslig.slice(5,7)})`;
      else if (isBA) nameSuffix = " (BA)";
      const row: any[] = [idx + 1, p.nome_completo + nameSuffix];
      datas.forEach(() => row.push(""));
      return row;
    });

    const sheetData = [
      header1, header2, header3, header4, header5, header6, [], colHeaders, ...rows, [],
      [`Assinatura do Educador: _______________________`],
    ];
    const ws = XLSX.utils.aoa_to_sheet(sheetData);
    ws["!cols"] = [{ wch: 5 }, { wch: 30 }, ...datas.map(() => ({ wch: 6 }))];
    autoFitCols(ws);
    applyInstitutionalHeader(ws, colHeaders.length);
    // Linha 3 ("Turma: ..."): negrito nos rótulos
    styleCell(ws, "A4", {
      font: { name: FONT_NAME, sz: 10, bold: true },
      alignment: { horizontal: "left", vertical: "center", wrapText: true },
    });
    styleCell(ws, "A5", {
      font: { name: FONT_NAME, sz: 10, bold: true },
      alignment: { horizontal: "left", vertical: "center" },
    });
    styleCell(ws, "A6", {
      font: { name: FONT_NAME, sz: 9, italic: true, color: { rgb: "555555" } },
      alignment: { horizontal: "left", wrapText: true },
    });
    applyHeaderStyle(ws, 7, colHeaders.length);

    const dataStartRow = 8;
    const grayFill = { fgColor: { rgb: "E5E7EB" } };
    tParts.forEach((p: any, pIdx: number) => {
      const excelRow = dataStartRow + pIdx;
      const win = windowByPart.get(p.id) || { entrada: null, saida: null };
      for (let c = 0; c < 2; c++) {
        const addr = XLSX.utils.encode_cell({ r: excelRow, c });
        if (!ws[addr]) ws[addr] = { v: "", t: "s" };
        ws[addr].s = { ...(ws[addr].s || {}), border: borderObj };
      }
      datas.forEach((d: string, dIdx: number) => {
        const col = 2 + dIdx;
        const addr = XLSX.utils.encode_cell({ r: excelRow, c: col });
        if (!ws[addr]) ws[addr] = { v: "", t: "s" };
        const foraDaJanela = (win.entrada && d < win.entrada) || (win.saida && d >= win.saida);
        if (foraDaJanela) {
          ws[addr].s = { fill: grayFill, border: borderObj };
          return;
        }
        const rec = tPresencas.find((pr: any) => pr.participante_id === p.id && pr.data === d);
        const fallbackRec = !rec ? relPresFallback.find(f => f.participante_id === p.id && f.data === d) : null;
        if ((rec && rec.presente) || (fallbackRec && fallbackRec.presente)) {
          ws[addr].v = "■";
          ws[addr].s = { font: { sz: 14, color: { rgb: "000000" } }, alignment: { horizontal: "center", vertical: "center" }, border: borderObj };
        } else {
          ws[addr].s = { border: borderObj };
        }
      });
    });

    // Aviso quando não houve nenhuma chamada/registro
    const houveChamada = tPresencas.length > 0 || relPresFallback.length > 0;
    if (!houveChamada && datas.length) {
      const noteRow = dataStartRow + tParts.length + 1;
      const addr = XLSX.utils.encode_cell({ r: noteRow, c: 0 });
      ws[addr] = { v: "Sem chamadas registradas neste mês", t: "s", s: { font: { italic: true, color: { rgb: "7F1D1D" } } } };
      const refRange = XLSX.utils.decode_range(ws["!ref"] || "A1");
      refRange.e.r = Math.max(refRange.e.r, noteRow);
      ws["!ref"] = XLSX.utils.encode_range(refRange);
    }

    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  }

  return { atendidosIds: atendidosFiltered.length, atividades: filteredRelatorios.length, atendimentos: filteredAtendimentos.length };
}

function truncSheet(name: string, used: Set<string>): string {
  let sn = name.slice(0, 31).replace(/[\\\/\*\?\[\]:]/g, "_");
  let s = 2;
  while (used.has(sn)) { sn = sn.slice(0, 28) + `_${s++}`; }
  used.add(sn);
  return sn;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: claims, error: claimsErr } = await supabaseUser.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (claimsErr || !claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const body = await req.json();
    const completo = body.completo === true;

    const [presencas_raw, participantes, turmas, bairros, relatorios, planejamentos, turmaParticipantes, relatorioTurmas, atendimentos_raw, profilesData, relatorioPresencas, buscaAtivaRegistros] = await Promise.all([
      fetchAll(supabaseAdmin, "presenca"),
      fetchAll(supabaseAdmin, "participantes"),
      fetchAll(supabaseAdmin, "turmas"),
      fetchAll(supabaseAdmin, "bairros"),
      fetchAll(supabaseAdmin, "relatorios_atividade"),
      fetchAll(supabaseAdmin, "planejamentos"),
      fetchAll(supabaseAdmin, "turma_participantes"),
      fetchAll(supabaseAdmin, "relatorio_turmas"),
      fetchAll(supabaseAdmin, "atendimentos"),
      fetchAll(supabaseAdmin, "profiles"),
      fetchAll(supabaseAdmin, "relatorio_presenca"),
      fetchAll(supabaseAdmin, "busca_ativa_registros"),
    ]);

    const wb = XLSX.utils.book_new();
    const usedSheetNames = new Set<string>();

    if (completo) {
      // Detect date range from all data
      const allDates: string[] = [
        ...relatorios.map((r: any) => r.data),
        ...presencas_raw.map((p: any) => p.data),
        ...atendimentos_raw.map((a: any) => a.data_atendimento),
      ].filter(Boolean).sort();
      if (!allDates.length) {
        return new Response(JSON.stringify({ error: "Nenhum dado encontrado" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const firstDate = allDates[0];
      const lastDate = allDates[allDates.length - 1];
      let startM = parseInt(firstDate.slice(5, 7));
      let startY = parseInt(firstDate.slice(0, 4));
      const endM = parseInt(lastDate.slice(5, 7));
      const endY = parseInt(lastDate.slice(0, 4));

      // Consolidado sheet
      const allAtendidosIds = new Set(presencas_raw.filter((p: any) => p.presente).map((p: any) => p.participante_id));
      const consolidadoData = [
        ["RELATÓRIO COMPLETO — SysCFV SCFV"],
        [`Período: ${MESES_NOMES[startM - 1]}/${startY} a ${MESES_NOMES[endM - 1]}/${endY}`],
        [`Data de geração: ${new Date().toLocaleString("pt-BR")}`],
        [],
        ["Total de participantes únicos atendidos", allAtendidosIds.size],
        ["Total de relatórios de atividade", relatorios.length],
        ["Total de atendimentos técnicos", atendimentos_raw.length],
      ];
      const wsC = XLSX.utils.aoa_to_sheet(consolidadoData);
      wsC["!cols"] = [{ wch: 45 }, { wch: 15 }];
      autoFitCols(wsC);
      const snC = truncSheet("Consolidado", usedSheetNames);
      XLSX.utils.book_append_sheet(wb, wsC, snC);

      // Iterate months
      while (startY < endY || (startY === endY && startM <= endM)) {
        const mesAbrev = MESES_NOMES[startM - 1].slice(0, 3);
        const suffix = ` ${mesAbrev}${String(startY).slice(2)}`;
        generateMonthSheets(wb, startM, startY, suffix, presencas_raw, participantes, turmas, bairros, relatorios, planejamentos, turmaParticipantes, relatorioTurmas, atendimentos_raw, profilesData, relatorioPresencas, usedSheetNames, buscaAtivaRegistros);
        startM++;
        if (startM > 12) { startM = 1; startY++; }
      }

      const buf = XLSX.write(wb, { bookType: "xlsx", type: "buffer" });
      const ts = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
      const fileName = `relatorios-mensais/SysCFV_RelatorioMensal_Completo_${ts}.xlsx`;
      const { error: uploadError } = await supabaseAdmin.storage.from("documentos").upload(fileName, buf, {
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", upsert: true,
      });
      if (uploadError) throw uploadError;
      const { data: signed } = await supabaseAdmin.storage.from("documentos").createSignedUrl(fileName, 3600);
      if (!signed?.signedUrl) throw new Error("Failed to create signed URL");
      // Espelha no Google Drive (mesma pasta mensal usada por sync-drive-modelos).
      // Para o modo "completo" usamos o mês mais recente do range como pasta-alvo.
      const lastMes = parseInt(body.mes_fim || body.mes || "1");
      const lastAno = parseInt(body.ano_fim || body.ano || String(new Date().getFullYear()));
      const drive = await maybePushToDrive(buf, fileName.split("/").pop()!.replace(/\.xlsx$/i, ""), lastMes, lastAno);
      return new Response(JSON.stringify({ url: signed.signedUrl, fileName, gsheet_url: drive?.url || null, gsheet_id: drive?.id || null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Single month
    const mesNum = parseInt(body.mes);
    const anoNum = parseInt(body.ano);
    generateMonthSheets(wb, mesNum, anoNum, "", presencas_raw, participantes, turmas, bairros, relatorios, planejamentos, turmaParticipantes, relatorioTurmas, atendimentos_raw, profilesData, relatorioPresencas, usedSheetNames, buscaAtivaRegistros);

    const mesStr = String(mesNum).padStart(2, "0");
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "buffer" });
    const ts2 = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
    const fileName = `relatorios-mensais/SysCFV_RelatorioMensal_${anoNum}-${mesStr}_${ts2}.xlsx`;
    const { error: uploadError } = await supabaseAdmin.storage.from("documentos").upload(fileName, buf, {
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", upsert: true,
    });
    if (uploadError) throw uploadError;
    const { data: signed } = await supabaseAdmin.storage.from("documentos").createSignedUrl(fileName, 3600);
    if (!signed?.signedUrl) throw new Error("Failed to create signed URL");

    const drive = await maybePushToDrive(buf, fileName.split("/").pop()!.replace(/\.xlsx$/i, ""), mesNum, anoNum);
    return new Response(JSON.stringify({ url: signed.signedUrl, fileName, gsheet_url: drive?.url || null, gsheet_id: drive?.id || null }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Error generating report:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});