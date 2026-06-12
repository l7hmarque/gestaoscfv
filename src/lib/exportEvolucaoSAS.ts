import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { saveAs } from "file-saver";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/fetchAllRows";
import { sysCfvFileName } from "@/lib/fileNaming";
import { tryUploadToDrive } from "@/lib/driveUpload";

const PDF_MIME = "application/pdf";
const MESES_NOMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

// Acento institucional SysCFV (vermelho frio)
const ACCENT: [number, number, number] = [185, 28, 28];
const INK: [number, number, number] = [30, 30, 30];
const SOFT: [number, number, number] = [120, 120, 120];
const SOFT_BG: [number, number, number] = [245, 245, 245];

export interface EvolucaoSASParams {
  mesInicio: string; // "2026-03"
  mesFim: string;    // "2026-05"
  autorNome?: string;
  onProgress?: (label: string) => void;
}

interface MesKpi {
  key: string;        // "2026-03"
  label: string;      // "Março/2026"
  baseline: boolean;  // antes de 01/04/2026
  ativosFimMes: number;
  novosIngressos: number;
  freqMediaPct: number;       // presença % no mês
  atendimentos: number;
  atividades: number;
  tempoVinculoMedioDias: number;
  taxaAdesaoPct: number;      // presentes/matriculados em sessões registradas
  buscaAtiva: number;
  retencaoPctParaProx: number | null; // % dos ativos que seguem ativos no mês seguinte
}

interface AtividadeDestaque {
  id: string;
  data: string;          // ISO
  nome: string;
  resumo: string;        // observacoes/intervencoes truncado
  presentes: number;
  matriculados: number;
  fotos: string[];       // URLs
}

function mesesEntre(ini: string, fim: string): string[] {
  const [yi, mi] = ini.split("-").map(Number);
  const [yf, mf] = fim.split("-").map(Number);
  const out: string[] = [];
  let y = yi, m = mi;
  while (y < yf || (y === yf && m <= mf)) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return out;
}

function rangeDoMes(mes: string): { ini: string; fim: string; iniDate: Date; fimDate: Date } {
  const [y, m] = mes.split("-").map(Number);
  const iniDate = new Date(y, m - 1, 1);
  const fimDate = new Date(y, m, 0); // último dia
  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { ini: fmt(iniDate), fim: fmt(fimDate), iniDate, fimDate };
}

function diasEntre(a: Date, b: Date): number {
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 86400000));
}

/**
 * Tenta baixar uma imagem como dataURL para embed em jsPDF.
 * Retorna null em caso de falha (CORS, 404 etc.) — caller deve seguir sem foto.
 */
async function fetchAsDataURL(url: string): Promise<string | null> {
  try {
    const r = await fetch(url, { mode: "cors" });
    if (!r.ok) return null;
    const blob = await r.blob();
    return await new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result));
      fr.onerror = reject;
      fr.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

// ============================================================
// Coleta de dados e cálculo de KPIs
// ============================================================

async function carregarDados(mesInicio: string, mesFim: string) {
  const { ini } = rangeDoMes(mesInicio);
  const { fim: fimUltimoDia } = rangeDoMes(mesFim);

  const [participantes, presenca, atendimentos, relatorios, fotos, busca] = await Promise.all([
    fetchAllRows("participantes", {
      select: "id, status, iniciou_em, data_desligamento, created_at",
    }),
    fetchAllRows("presenca", {
      select: "participante_id, data, presente, justificativa",
      filters: [
        { col: "data", op: "gte", val: ini },
        { col: "data", op: "lte", val: fimUltimoDia },
      ],
    }),
    fetchAllRows("atendimentos", {
      select: "id, data_atendimento",
      filters: [
        { col: "data_atendimento", op: "gte", val: ini },
        { col: "data_atendimento", op: "lte", val: fimUltimoDia },
      ],
    }),
    fetchAllRows("relatorios_atividade", {
      select: "id, data, nome_atividade, observacoes, intervencoes, num_participantes, num_matriculados",
      filters: [
        { col: "data", op: "gte", val: ini },
        { col: "data", op: "lte", val: fimUltimoDia },
      ],
    }),
    fetchAllRows("relatorio_fotos", { select: "relatorio_id, foto_url, ordem" }),
    fetchAllRows("busca_ativa_registros", {
      select: "id, data_registro",
      filters: [
        { col: "data_registro", op: "gte", val: ini },
        { col: "data_registro", op: "lte", val: fimUltimoDia },
      ],
    }),
  ]);

  return {
    participantes: participantes as any[],
    presenca: presenca as any[],
    atendimentos: atendimentos as any[],
    relatorios: relatorios as any[],
    fotos: fotos as any[],
    busca: busca as any[],
  };
}

function calcularKpis(meses: string[], dados: Awaited<ReturnType<typeof carregarDados>>): MesKpi[] {
  const ativosNoFinalDoMes = (mes: string): { ids: Set<string>; tempos: number[] } => {
    const { fimDate } = rangeDoMes(mes);
    const fimStr = fimDate.toISOString().slice(0, 10);
    const ids = new Set<string>();
    const tempos: number[] = [];
    for (const p of dados.participantes) {
      const iniciou = p.iniciou_em || (p.created_at ? p.created_at.slice(0, 10) : null);
      if (!iniciou || iniciou > fimStr) continue;
      if (p.data_desligamento && p.data_desligamento <= fimStr) continue;
      ids.add(p.id);
      tempos.push(diasEntre(new Date(iniciou), fimDate));
    }
    return { ids, tempos };
  };

  const ativosPorMes = meses.map((m) => ({ mes: m, ...ativosNoFinalDoMes(m) }));

  return meses.map((mes, i) => {
    const { ini, fim } = rangeDoMes(mes);
    const dentro = (d?: string | null) => !!d && d >= ini && d <= fim;
    const a = ativosPorMes[i];

    const presNoMes = dados.presenca.filter((p) => dentro(p.data));
    const totalPres = presNoMes.length;
    const presentes = presNoMes.filter((p) => p.presente).length;
    const freqMediaPct = totalPres > 0 ? (presentes / totalPres) * 100 : 0;

    const atendNoMes = dados.atendimentos.filter((r) => dentro(r.data_atendimento)).length;
    const relsNoMes = dados.relatorios.filter((r) => dentro(r.data));
    const ativNoMes = relsNoMes.length;

    const buscaNoMes = dados.busca.filter((r) => dentro(r.data_registro)).length;

    const novos = dados.participantes.filter((p) => dentro(p.iniciou_em)).length;

    // Taxa de adesão = soma(num_participantes) / soma(num_matriculados) das sessões registradas
    const somaPart = relsNoMes.reduce((s, r) => s + (r.num_participantes || 0), 0);
    const somaMat = relsNoMes.reduce((s, r) => s + (r.num_matriculados || 0), 0);
    const taxaAdesaoPct = somaMat > 0 ? (somaPart / somaMat) * 100 : 0;

    const tempoMedio = a.tempos.length > 0 ? a.tempos.reduce((s, n) => s + n, 0) / a.tempos.length : 0;

    // Retenção para o próximo mês
    let retencaoPctParaProx: number | null = null;
    if (i < meses.length - 1) {
      const prox = ativosPorMes[i + 1].ids;
      if (a.ids.size > 0) {
        let cont = 0;
        a.ids.forEach((id) => { if (prox.has(id)) cont++; });
        retencaoPctParaProx = (cont / a.ids.size) * 100;
      }
    }

    const [yy, mm] = mes.split("-").map(Number);
    const marcoOperacional = "2026-04-01";
    const baseline = `${yy}-${String(mm).padStart(2, "0")}-01` < marcoOperacional;

    return {
      key: mes,
      label: `${MESES_NOMES[mm - 1]}/${yy}`,
      baseline,
      ativosFimMes: a.ids.size,
      novosIngressos: novos,
      freqMediaPct,
      atendimentos: atendNoMes,
      atividades: ativNoMes,
      tempoVinculoMedioDias: tempoMedio,
      taxaAdesaoPct,
      buscaAtiva: buscaNoMes,
      retencaoPctParaProx,
    };
  });
}

function topAtividadesPorMes(meses: string[], dados: Awaited<ReturnType<typeof carregarDados>>): Record<string, AtividadeDestaque[]> {
  const fotosPorRel = new Map<string, string[]>();
  for (const f of dados.fotos) {
    if (!fotosPorRel.has(f.relatorio_id)) fotosPorRel.set(f.relatorio_id, []);
    fotosPorRel.get(f.relatorio_id)!.push(f.foto_url);
  }
  const out: Record<string, AtividadeDestaque[]> = {};
  for (const mes of meses) {
    const { ini, fim } = rangeDoMes(mes);
    const rels = dados.relatorios
      .filter((r) => r.data >= ini && r.data <= fim)
      .sort((a, b) => (b.num_participantes || 0) - (a.num_participantes || 0))
      .slice(0, 3);
    out[mes] = rels.map((r) => ({
      id: r.id,
      data: r.data,
      nome: r.nome_atividade || "Atividade sem nome",
      resumo: [(r.observacoes || "").trim(), (r.intervencoes || "").trim()].filter(Boolean).join(" — ").slice(0, 260),
      presentes: r.num_participantes || 0,
      matriculados: r.num_matriculados || 0,
      fotos: (fotosPorRel.get(r.id) || []).slice(0, 2),
    }));
  }
  return out;
}

// ============================================================
// Renderização do PDF
// ============================================================

function rgb(doc: jsPDF, c: [number, number, number]) { doc.setTextColor(c[0], c[1], c[2]); }
function fill(doc: jsPDF, c: [number, number, number]) { doc.setFillColor(c[0], c[1], c[2]); }
function stroke(doc: jsPDF, c: [number, number, number]) { doc.setDrawColor(c[0], c[1], c[2]); }

function ensureSpace(doc: jsPDF, y: number, need: number, marginBottom = 20): number {
  const h = doc.internal.pageSize.getHeight();
  if (y + need > h - marginBottom) { doc.addPage(); return 22; }
  return y;
}

function drawSectionTitle(doc: jsPDF, y: number, label: string): number {
  const w = doc.internal.pageSize.getWidth();
  fill(doc, ACCENT); doc.rect(10, y, 3, 7, "F");
  rgb(doc, INK); doc.setFont("helvetica", "bold"); doc.setFontSize(12);
  doc.text(label, 16, y + 5.5);
  stroke(doc, [220, 220, 220]); doc.setLineWidth(0.2);
  doc.line(16, y + 8, w - 10, y + 8);
  return y + 14;
}

function drawBarChart(doc: jsPDF, x: number, y: number, w: number, h: number, labels: string[], values: number[], opts: { suffix?: string; baselineFlags?: boolean[] } = {}) {
  const max = Math.max(1, ...values);
  const padL = 18, padB = 12, padT = 6, padR = 4;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;
  // eixo
  stroke(doc, [180, 180, 180]); doc.setLineWidth(0.2);
  doc.line(x + padL, y + padT, x + padL, y + padT + innerH);
  doc.line(x + padL, y + padT + innerH, x + padL + innerW, y + padT + innerH);
  // ticks
  doc.setFontSize(7); rgb(doc, SOFT);
  for (let i = 0; i <= 2; i++) {
    const v = (max * i) / 2;
    const yy = y + padT + innerH - (innerH * i) / 2;
    doc.text(String(Math.round(v)), x + padL - 1, yy + 1.5, { align: "right" });
    if (i > 0) { stroke(doc, [235, 235, 235]); doc.line(x + padL, yy, x + padL + innerW, yy); }
  }
  // barras
  const n = values.length;
  const slot = innerW / n;
  const bw = slot * 0.55;
  values.forEach((v, i) => {
    const bh = (v / max) * innerH;
    const bx = x + padL + slot * i + (slot - bw) / 2;
    const by = y + padT + innerH - bh;
    const isBase = opts.baselineFlags?.[i];
    fill(doc, isBase ? [150, 150, 150] : ACCENT);
    doc.rect(bx, by, bw, bh, "F");
    doc.setFontSize(7); rgb(doc, INK);
    const lbl = `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}${opts.suffix || ""}`;
    doc.text(lbl, bx + bw / 2, by - 1, { align: "center" });
    rgb(doc, SOFT);
    doc.text(labels[i], bx + bw / 2, y + padT + innerH + 4, { align: "center" });
  });
}

function drawLineChart(doc: jsPDF, x: number, y: number, w: number, h: number, labels: string[], values: number[], opts: { suffix?: string } = {}) {
  const max = Math.max(1, ...values);
  const min = 0;
  const padL = 18, padB = 12, padT = 6, padR = 4;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;
  stroke(doc, [180, 180, 180]); doc.setLineWidth(0.2);
  doc.line(x + padL, y + padT, x + padL, y + padT + innerH);
  doc.line(x + padL, y + padT + innerH, x + padL + innerW, y + padT + innerH);
  doc.setFontSize(7); rgb(doc, SOFT);
  for (let i = 0; i <= 2; i++) {
    const v = min + ((max - min) * i) / 2;
    const yy = y + padT + innerH - (innerH * i) / 2;
    doc.text(String(Math.round(v)), x + padL - 1, yy + 1.5, { align: "right" });
    if (i > 0) { stroke(doc, [235, 235, 235]); doc.line(x + padL, yy, x + padL + innerW, yy); }
  }
  const n = values.length;
  const stepX = n > 1 ? innerW / (n - 1) : 0;
  const pts = values.map((v, i) => {
    const px = x + padL + stepX * i + (n === 1 ? innerW / 2 : 0);
    const py = y + padT + innerH - ((v - min) / Math.max(0.001, max - min)) * innerH;
    return { x: px, y: py };
  });
  stroke(doc, ACCENT); doc.setLineWidth(0.6);
  for (let i = 1; i < pts.length; i++) doc.line(pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y);
  pts.forEach((p, i) => {
    fill(doc, ACCENT); doc.circle(p.x, p.y, 1.2, "F");
    doc.setFontSize(7); rgb(doc, INK);
    const lbl = `${values[i].toLocaleString("pt-BR", { maximumFractionDigits: 1 })}${opts.suffix || ""}`;
    doc.text(lbl, p.x, p.y - 2, { align: "center" });
    rgb(doc, SOFT);
    doc.text(labels[i], p.x, y + padT + innerH + 4, { align: "center" });
  });
}

function variacaoTxt(a: number, b: number, suffix = ""): string {
  if (a === 0 && b === 0) return "—";
  if (a === 0) return `+${b.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}${suffix}`;
  const delta = b - a;
  const sign = delta > 0 ? "↑" : delta < 0 ? "↓" : "→";
  const pct = a !== 0 ? (delta / a) * 100 : 0;
  return `${sign} ${Math.abs(pct).toFixed(1)}%`;
}

function drawCapa(doc: jsPDF, kpis: MesKpi[], autorNome?: string) {
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  fill(doc, ACCENT); doc.rect(0, 0, w, 60, "F");
  doc.setTextColor(255); doc.setFont("helvetica", "bold"); doc.setFontSize(22);
  doc.text("RELATÓRIO DE EVOLUÇÃO", w / 2, 28, { align: "center" });
  doc.setFontSize(14); doc.setFont("helvetica", "normal");
  doc.text("Serviço de Convivência e Fortalecimento de Vínculos", w / 2, 38, { align: "center" });
  doc.setFontSize(11); doc.setFont("helvetica", "italic");
  doc.text("Sociedade Civil Nossa Senhora Aparecida — CAIA", w / 2, 46, { align: "center" });

  rgb(doc, INK); doc.setFont("helvetica", "bold"); doc.setFontSize(13);
  doc.text("Apresentação à Secretaria de Assistência Social", w / 2, 80, { align: "center" });
  doc.setFont("helvetica", "normal"); doc.setFontSize(11);
  doc.text(`Período: ${kpis[0].label} a ${kpis[kpis.length - 1].label}`, w / 2, 90, { align: "center" });

  // Caixa metadados
  fill(doc, SOFT_BG); doc.rect(20, 110, w - 40, 38, "F");
  rgb(doc, INK); doc.setFont("helvetica", "bold"); doc.setFontSize(10);
  doc.text("Territórios atendidos:", 26, 120);
  doc.setFont("helvetica", "normal");
  doc.text("Jardim Irene · Parque Independência · Alvorada", 26, 126);
  doc.setFont("helvetica", "bold");
  doc.text("Emitido em:", 26, 134);
  doc.setFont("helvetica", "normal");
  doc.text(new Date().toLocaleString("pt-BR"), 26, 140);
  if (autorNome) {
    doc.setFont("helvetica", "bold"); doc.text("Responsável:", 110, 134);
    doc.setFont("helvetica", "normal"); doc.text(autorNome, 110, 140);
  }

  rgb(doc, SOFT); doc.setFontSize(9);
  const aviso = "Observação metodológica: indicadores anteriores a 01/04/2026 (marco operacional) são apresentados como linha de base e identificados em cinza nos gráficos. Meses operacionais cheios aparecem em destaque (vermelho).";
  doc.text(doc.splitTextToSize(aviso, w - 40), 20, 160);

  rgb(doc, SOFT); doc.setFontSize(8);
  doc.text(`SysCFV — Sistema de Gestão CAIA`, w / 2, h - 12, { align: "center" });
}

function drawSumarioExecutivo(doc: jsPDF, kpis: MesKpi[]) {
  doc.addPage();
  let y = 22;
  y = drawSectionTitle(doc, y, "Sumário Executivo");
  const w = doc.internal.pageSize.getWidth();
  const first = kpis[0], last = kpis[kpis.length - 1];
  const cards = [
    { label: "Participantes ativos", a: first.ativosFimMes, b: last.ativosFimMes, suffix: "" },
    { label: "Frequência média", a: first.freqMediaPct, b: last.freqMediaPct, suffix: "%" },
    { label: "Atividades realizadas", a: first.atividades, b: last.atividades, suffix: "" },
    { label: "Atendimentos técnicos", a: first.atendimentos, b: last.atendimentos, suffix: "" },
  ];
  const cardW = (w - 20 - 12) / 2;
  const cardH = 32;
  cards.forEach((c, i) => {
    const cx = 10 + (i % 2) * (cardW + 12);
    const cy = y + Math.floor(i / 2) * (cardH + 8);
    fill(doc, SOFT_BG); doc.rect(cx, cy, cardW, cardH, "F");
    fill(doc, ACCENT); doc.rect(cx, cy, 2, cardH, "F");
    rgb(doc, SOFT); doc.setFont("helvetica", "normal"); doc.setFontSize(9);
    doc.text(c.label.toUpperCase(), cx + 5, cy + 6);
    rgb(doc, INK); doc.setFont("helvetica", "bold"); doc.setFontSize(18);
    doc.text(`${c.b.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}${c.suffix}`, cx + 5, cy + 18);
    rgb(doc, SOFT); doc.setFont("helvetica", "normal"); doc.setFontSize(8);
    doc.text(`Em ${first.label.split("/")[0]}: ${c.a.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}${c.suffix}  ·  Variação: ${variacaoTxt(c.a, c.b)}`, cx + 5, cy + 26);
  });
  y += Math.ceil(cards.length / 2) * (cardH + 8) + 4;

  y = ensureSpace(doc, y, 60);
  y = drawSectionTitle(doc, y, "Leitura Interpretativa (texto-modelo)");
  rgb(doc, INK); doc.setFont("helvetica", "normal"); doc.setFontSize(10);
  const linhas = [
    `• A frequência média passou de ${first.freqMediaPct.toFixed(1)}% (${first.label}) para ${last.freqMediaPct.toFixed(1)}% (${last.label}), variação de ${(last.freqMediaPct - first.freqMediaPct).toFixed(1)} pontos percentuais.`,
    `• O tempo médio de vínculo dos participantes ativos evoluiu de ${Math.round(first.tempoVinculoMedioDias)} dias para ${Math.round(last.tempoVinculoMedioDias)} dias, indicando ${last.tempoVinculoMedioDias > first.tempoVinculoMedioDias ? "consolidação" : "rotatividade"} da permanência.`,
    `• A taxa de adesão (presentes/convocados nas sessões registradas) atingiu ${last.taxaAdesaoPct.toFixed(1)}% em ${last.label}.`,
    `• Foram realizados ${kpis.reduce((s, k) => s + k.atendimentos, 0)} atendimentos técnicos e ${kpis.reduce((s, k) => s + k.atividades, 0)} atividades pedagógicas no trimestre.`,
    `• Volume de busca ativa: ${kpis.reduce((s, k) => s + k.buscaAtiva, 0)} contatos no período — instrumento de prevenção à evasão.`,
  ];
  for (const t of linhas) {
    const wrapped = doc.splitTextToSize(t, doc.internal.pageSize.getWidth() - 24);
    doc.text(wrapped, 12, y);
    y += wrapped.length * 5 + 1;
  }

  y += 4;
  rgb(doc, ACCENT); doc.setFont("helvetica", "bold"); doc.setFontSize(10);
  doc.text("Análise da Coordenação:", 12, y);
  rgb(doc, [200, 200, 200]); doc.setLineWidth(0.2);
  for (let i = 0; i < 4; i++) { y += 7; doc.line(12, y, doc.internal.pageSize.getWidth() - 12, y); }
}

function drawSecaoKpis(doc: jsPDF, kpis: MesKpi[]) {
  doc.addPage();
  let y = 22;
  y = drawSectionTitle(doc, y, "Evolução dos Indicadores Essenciais");

  const w = doc.internal.pageSize.getWidth();
  const labels = kpis.map((k) => k.label.split("/")[0].slice(0, 3));
  const baseline = kpis.map((k) => k.baseline);

  const blocos: { titulo: string; valores: number[]; tipo: "bar" | "line"; suffix?: string; interpretacao: string }[] = [
    {
      titulo: "Participantes ativos no fim do mês",
      tipo: "line",
      valores: kpis.map((k) => k.ativosFimMes),
      interpretacao: `Variação total: ${variacaoTxt(kpis[0].ativosFimMes, kpis[kpis.length - 1].ativosFimMes)}.`,
    },
    {
      titulo: "Novos ingressos no mês",
      tipo: "bar",
      valores: kpis.map((k) => k.novosIngressos),
      interpretacao: `Total de ${kpis.reduce((s, k) => s + k.novosIngressos, 0)} novas matrículas no trimestre.`,
    },
    {
      titulo: "Frequência média (%)",
      tipo: "line",
      suffix: "%",
      valores: kpis.map((k) => Number(k.freqMediaPct.toFixed(1))),
      interpretacao: `${variacaoTxt(kpis[0].freqMediaPct, kpis[kpis.length - 1].freqMediaPct)} entre primeiro e último mês.`,
    },
    {
      titulo: "Atendimentos técnicos",
      tipo: "bar",
      valores: kpis.map((k) => k.atendimentos),
      interpretacao: `${kpis.reduce((s, k) => s + k.atendimentos, 0)} atendimentos no trimestre.`,
    },
    {
      titulo: "Atividades pedagógicas realizadas",
      tipo: "bar",
      valores: kpis.map((k) => k.atividades),
      interpretacao: `${kpis.reduce((s, k) => s + k.atividades, 0)} sessões registradas no trimestre.`,
    },
  ];

  const bw = (w - 20 - 8) / 2;
  const bh = 56;
  blocos.forEach((b, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    if (col === 0 && row > 0) y += bh + 14;
    y = ensureSpace(doc, y, bh + 14);
    const x = 10 + col * (bw + 8);
    rgb(doc, INK); doc.setFont("helvetica", "bold"); doc.setFontSize(10);
    doc.text(b.titulo, x, y);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); rgb(doc, SOFT);
    const wrap = doc.splitTextToSize(b.interpretacao, bw);
    doc.text(wrap, x, y + 4);
    if (b.tipo === "bar") {
      drawBarChart(doc, x, y + 8, bw, bh, labels, b.valores, { suffix: b.suffix, baselineFlags: baseline });
    } else {
      drawLineChart(doc, x, y + 8, bw, bh, labels, b.valores, { suffix: b.suffix });
    }
  });
  y += bh + 14;
}

function drawVinculoAdesao(doc: jsPDF, kpis: MesKpi[]) {
  doc.addPage();
  let y = 22;
  y = drawSectionTitle(doc, y, "Vínculo, Adesão e Permanência");

  rgb(doc, INK); doc.setFont("helvetica", "normal"); doc.setFontSize(10);
  const intro = "Esta seção complementa os indicadores de volume com métricas que demonstram a qualidade do vínculo construído entre o SCFV e os participantes.";
  const wrapIntro = doc.splitTextToSize(intro, doc.internal.pageSize.getWidth() - 24);
  doc.text(wrapIntro, 12, y);
  y += wrapIntro.length * 5 + 4;

  // Tabela consolidada
  autoTable(doc, {
    startY: y,
    head: [["Mês", "Ativos (fim)", "Tempo médio de vínculo", "Taxa de adesão", "Retenção p/ próx mês", "Busca ativa"]],
    body: kpis.map((k) => [
      k.label,
      String(k.ativosFimMes),
      `${Math.round(k.tempoVinculoMedioDias)} dias`,
      `${k.taxaAdesaoPct.toFixed(1)}%`,
      k.retencaoPctParaProx == null ? "—" : `${k.retencaoPctParaProx.toFixed(1)}%`,
      String(k.buscaAtiva),
    ]),
    styles: { font: "helvetica", fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [60, 60, 60], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: SOFT_BG },
    margin: { left: 10, right: 10 },
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  const w = doc.internal.pageSize.getWidth();
  const labels = kpis.map((k) => k.label.split("/")[0].slice(0, 3));
  const bw = (w - 20 - 8) / 2;
  const bh = 56;

  y = ensureSpace(doc, y, bh + 18);
  rgb(doc, INK); doc.setFont("helvetica", "bold"); doc.setFontSize(10);
  doc.text("Tempo médio de vínculo (dias)", 10, y);
  doc.text("Taxa de adesão (%)", 10 + bw + 8, y);
  drawBarChart(doc, 10, y + 4, bw, bh, labels, kpis.map((k) => Math.round(k.tempoVinculoMedioDias)), { baselineFlags: kpis.map((k) => k.baseline) });
  drawLineChart(doc, 10 + bw + 8, y + 4, bw, bh, labels, kpis.map((k) => Number(k.taxaAdesaoPct.toFixed(1))), { suffix: "%" });
  y += bh + 12;

  y = ensureSpace(doc, y, bh + 18);
  rgb(doc, INK); doc.setFont("helvetica", "bold"); doc.setFontSize(10);
  doc.text("Busca ativa realizada", 10, y);
  doc.text("Retenção mês a mês (%)", 10 + bw + 8, y);
  drawBarChart(doc, 10, y + 4, bw, bh, labels, kpis.map((k) => k.buscaAtiva), { baselineFlags: kpis.map((k) => k.baseline) });
  const ret = kpis.map((k) => Number((k.retencaoPctParaProx ?? 0).toFixed(1)));
  drawLineChart(doc, 10 + bw + 8, y + 4, bw, bh, labels, ret, { suffix: "%" });
  y += bh + 12;

  y = ensureSpace(doc, y, 40);
  rgb(doc, ACCENT); doc.setFont("helvetica", "bold"); doc.setFontSize(10);
  doc.text("Análise da Coordenação:", 12, y);
  rgb(doc, [200, 200, 200]); doc.setLineWidth(0.2);
  for (let i = 0; i < 4; i++) { y += 7; doc.line(12, y, doc.internal.pageSize.getWidth() - 12, y); }
}

async function drawAtividadesDestaque(doc: jsPDF, kpis: MesKpi[], destaques: Record<string, AtividadeDestaque[]>, onProgress?: (s: string) => void) {
  doc.addPage();
  let y = 22;
  y = drawSectionTitle(doc, y, "Atividades em Destaque (Top 3 por mês)");
  rgb(doc, INK); doc.setFont("helvetica", "normal"); doc.setFontSize(10);
  doc.text("Seleção das três atividades com maior número de presentes em cada mês do período.", 12, y);
  y += 6;

  const w = doc.internal.pageSize.getWidth();

  for (const kpi of kpis) {
    const lista = destaques[kpi.key] || [];
    y = ensureSpace(doc, y, 16);
    fill(doc, ACCENT); doc.rect(10, y, w - 20, 7, "F");
    doc.setTextColor(255); doc.setFont("helvetica", "bold"); doc.setFontSize(11);
    doc.text(kpi.label.toUpperCase(), 13, y + 5);
    y += 11;

    if (lista.length === 0) {
      rgb(doc, SOFT); doc.setFont("helvetica", "italic"); doc.setFontSize(9);
      doc.text("Nenhuma atividade registrada neste mês.", 12, y);
      y += 8;
      continue;
    }

    for (const a of lista) {
      onProgress?.(`Baixando fotos: ${a.nome.slice(0, 30)}…`);
      y = ensureSpace(doc, y, 42);
      fill(doc, SOFT_BG); doc.rect(10, y, w - 20, 38, "F");
      rgb(doc, INK); doc.setFont("helvetica", "bold"); doc.setFontSize(10);
      doc.text(a.nome.slice(0, 90), 13, y + 6);
      rgb(doc, SOFT); doc.setFont("helvetica", "normal"); doc.setFontSize(8);
      const dataStr = new Date(a.data + "T00:00:00").toLocaleDateString("pt-BR");
      const meta = `${dataStr}  ·  ${a.presentes} presentes${a.matriculados > 0 ? ` de ${a.matriculados} matriculados` : ""}`;
      doc.text(meta, 13, y + 11);
      rgb(doc, INK); doc.setFontSize(8.5);
      const resumo = doc.splitTextToSize(a.resumo || "Sem descrição registrada.", w - 76);
      doc.text(resumo.slice(0, 4), 13, y + 17);

      // Fotos
      const fotoBoxX = w - 60;
      const fotoW = 22, fotoH = 22;
      const dataURLs = await Promise.all(a.fotos.slice(0, 2).map(fetchAsDataURL));
      dataURLs.forEach((du, i) => {
        if (!du) return;
        try {
          const fmt = du.startsWith("data:image/png") ? "PNG" : "JPEG";
          doc.addImage(du, fmt, fotoBoxX + i * (fotoW + 3), y + 8, fotoW, fotoH, undefined, "FAST");
        } catch {}
      });
      y += 42;
    }
    y += 2;
  }
}

function drawRodape(doc: jsPDF) {
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    const w = doc.internal.pageSize.getWidth();
    const h = doc.internal.pageSize.getHeight();
    if (i === 1) continue; // capa sem rodapé numerado
    rgb(doc, SOFT); doc.setFont("helvetica", "normal"); doc.setFontSize(8);
    doc.text("SysCFV — Relatório de Evolução SAS", 10, h - 8);
    doc.text(`Página ${i} de ${total}`, w - 10, h - 8, { align: "right" });
    stroke(doc, [220, 220, 220]); doc.setLineWidth(0.2);
    doc.line(10, h - 12, w - 10, h - 12);
  }
}

// ============================================================
// Orquestração
// ============================================================

export async function gerarRelatorioEvolucaoSAS(params: EvolucaoSASParams): Promise<{ filename: string; driveUrl: string | null }> {
  const { mesInicio, mesFim, autorNome, onProgress } = params;
  const meses = mesesEntre(mesInicio, mesFim);

  onProgress?.("Coletando dados...");
  const dados = await carregarDados(mesInicio, mesFim);
  onProgress?.("Calculando indicadores...");
  const kpis = calcularKpis(meses, dados);
  const destaques = topAtividadesPorMes(meses, dados);

  onProgress?.("Montando PDF...");
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  drawCapa(doc, kpis, autorNome);
  drawSumarioExecutivo(doc, kpis);
  drawSecaoKpis(doc, kpis);
  drawVinculoAdesao(doc, kpis);
  await drawAtividadesDestaque(doc, kpis, destaques, onProgress);
  drawRodape(doc);

  const filename = sysCfvFileName("EvolucaoSAS", "pdf", `${mesInicio}-a-${mesFim}`);
  const blob = doc.output("blob");
  saveAs(blob, filename);

  onProgress?.("Registrando auditoria...");
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("audit_log").insert({
        user_id: user.id,
        user_nome: autorNome || null,
        acao: "gerou_relatorio_evolucao_sas",
        tabela: "relatorios_atividade",
        detalhes: JSON.stringify({ mesInicio, mesFim, meses: meses.length, totalAtividades: dados.relatorios.length }),
      });
    }
  } catch (e) {
    console.warn("audit_log evolucao_sas", e);
  }

  onProgress?.("Enviando ao Drive (se conectado)...");
  let driveUrl: string | null = null;
  try {
    const r = await tryUploadToDrive({ blob, filename, mimeType: PDF_MIME, categoria: "EvolucaoSAS" });
    driveUrl = r.url;
  } catch {}

  return { filename, driveUrl };
}