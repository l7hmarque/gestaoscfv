import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  Document, Packer, Paragraph, TextRun, Table as DocxTable, TableRow as DocxTableRow, TableCell as DocxTableCell,
  Header, Footer, AlignmentType, BorderStyle, WidthType, ShadingType,
  PageNumber, PageBreak, HeadingLevel, ImageRun,
} from "npm:docx@9.2.0";
import XLSX from "npm:xlsx-js-style";

const MESES_NOMES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const BAIRROS_SCFV = ["JARDIM IRENE", "PARQUE INDEPENDENCIA", "ALVORADA"];
const METAS_BAIRRO: Record<string, { criancasManha: number; criancasTarde: number; idosos: number | null }> = {
  "JARDIM IRENE": { criancasManha: 100, criancasTarde: 100, idosos: 30 },
  "PARQUE INDEPENDENCIA": { criancasManha: 60, criancasTarde: 60, idosos: 30 },
  "ALVORADA": { criancasManha: 60, criancasTarde: 60, idosos: null },
};
const TIPO_ATENDIMENTO_MAP: Record<string, string> = {
  atendimento_comunidade: "Atendimento/Orientação Comunidade",
  atendimento_familiar: "Atendimento/Orientação Familiares",
  atendimento_individual: "Atendimento/Orientação Crianças e Adolescentes ou Idosos",
  atendimento_educador: "Atendimento/Orientação aos Educadores",
  acao_social: "Ações sociais/Eventos",
  reuniao_rede: "Reunião de Rede/Estudo de Caso",
  visita_domiciliar: "Visitas Domiciliares",
  visita_escolar: "Visitas Escolares",
  aplicacao_grupo: "Aplicação de grupos",
  busca_ativa: "Atendimento/Orientação Comunidade",
  encaminhamento: "Atendimento/Orientação Familiares",
  acolhida: "Atendimento/Orientação Crianças e Adolescentes ou Idosos",
  desligamento: "Atendimento/Orientação Crianças e Adolescentes ou Idosos",
};

const MONITORAMENTO_ROWS = [
  {
    objetivo: "Assegurar espaços de referência para convívio grupal, comunitário e social, desenvolvendo relações de afetividade, solidariedade e respeito mútuo;",
    indicador: "Participação nas atividades sócio educacionais (Oficina de Educando e Orientações)",
    meta: "100%",
  },
  {
    objetivo: "Possibilitar o desenvolvimento de potencialidades, habilidades, talentos e sua formação cidadã, através de atividades esportivas, culturais e socioeducacionais;",
    indicador: "Participação nas atividades, culturais, esportivas e sócio educacionais condizentes com os eixos do SCFV.",
    meta: "100%",
  },
  {
    objetivo: "Contribuir para a inserção, reinserção e permanência da criança e do adolescente no sistema sócio educacional;",
    indicador: "Matrícula, rendimento e frequência no sistema sócio educacional.",
    meta: "100%",
  },
  {
    objetivo: "Promover o acesso aos benefícios e serviços encaminhados para proteção socioassistenciais ofertados pela rede de proteção social.",
    indicador: "Quantidade de beneficiários",
    meta: "100%",
  },
];

function fmt(v: number): string {
  return `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function calcAge(dob: string): number {
  const b = new Date(dob); const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  if (now.getMonth() < b.getMonth() || (now.getMonth() === b.getMonth() && now.getDate() < b.getDate())) age--;
  return age;
}

async function fetchAll(supabase: any, table: string, select = "*") {
  const allRows: any[] = [];
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabase.from(table).select(select).range(from, from + pageSize - 1);
    if (error) throw error;
    allRows.push(...(data || []));
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }
  return allRows;
}

// ── Helpers for building table cells ──

const thinBorder = { style: BorderStyle.SINGLE, size: 1, color: "000000" };
const cellBorders = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder };
const cellMargins = { top: 40, bottom: 40, left: 80, right: 80 };

function headerCell(text: string, width: number, opts?: { colSpan?: number; rowSpan?: number; shading?: string }): DocxTableCell {
  return new DocxTableCell({
    borders: cellBorders,
    margins: cellMargins,
    width: { size: width, type: WidthType.DXA },
    shading: { fill: opts?.shading || "D9E2F3", type: ShadingType.CLEAR },
    columnSpan: opts?.colSpan,
    rowSpan: opts?.rowSpan,
    verticalAlign: "center" as any,
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text, bold: true, font: "Arial", size: 18 })],
    })],
  });
}

function dataCell(text: string, width: number, opts?: { bold?: boolean; alignment?: (typeof AlignmentType)[keyof typeof AlignmentType] }): DocxTableCell {
  return new DocxTableCell({
    borders: cellBorders,
    margins: cellMargins,
    width: { size: width, type: WidthType.DXA },
    children: [new Paragraph({
      alignment: opts?.alignment || AlignmentType.LEFT,
      children: [new TextRun({ text, font: "Arial", size: 18, bold: opts?.bold })],
    })],
  });
}

function sectionTitle(text: string): Paragraph {
  return new Paragraph({
    spacing: { before: 300, after: 200 },
    children: [new TextRun({ text, bold: true, font: "Arial", size: 24 })],
  });
}

function subNote(text: string): Paragraph {
  return new Paragraph({
    spacing: { before: 60, after: 60 },
    children: [new TextRun({ text, font: "Arial", size: 16, italics: true, color: "666666" })],
  });
}

// ── Main handler ──

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { mes, ano, formato } = await req.json();
    const outputFormat = formato || "docx";
    const mesNum = parseInt(mes);
    const anoNum = parseInt(ano);
    const prefix = `${anoNum}-${String(mesNum).padStart(2, "0")}`;
    const mesNome = MESES_NOMES[mesNum - 1];

    // ── Fetch all data ──
    const [participantes, turmas, turmaParticipantes, presenca, planejamentos, relatorios,
           atendimentos, profiles, bairros, categorias, despesas, parcelas, estornos,
           relatorioTurmas, relatorioFotos, relatorioPresencas] = await Promise.all([
      fetchAll(supabase, "participantes"),
      fetchAll(supabase, "turmas"),
      fetchAll(supabase, "turma_participantes"),
      fetchAll(supabase, "presenca"),
      fetchAll(supabase, "planejamentos"),
      fetchAll(supabase, "relatorios_atividade"),
      fetchAll(supabase, "atendimentos"),
      fetchAll(supabase, "profiles"),
      fetchAll(supabase, "bairros"),
      fetchAll(supabase, "categorias_financeiras"),
      fetchAll(supabase, "despesas"),
      fetchAll(supabase, "parcelas_financeiras"),
      fetchAll(supabase, "estornos"),
      fetchAll(supabase, "relatorio_turmas"),
      fetchAll(supabase, "relatorio_fotos"),
      fetchAll(supabase, "relatorio_presenca"),
    ]);

    const bairroMap = Object.fromEntries(bairros.map((b: any) => [b.id, b.nome]));
    const ativos = participantes.filter((p: any) => p.status === "ativo");

    // ── 1.1 Atividades ──
    const plansMes = planejamentos.filter((p: any) => p.data_aplicacao?.startsWith(prefix));
    const relsMes = relatorios.filter((r: any) => r.data?.startsWith(prefix));

    // Enrich presenca with relatorio_presenca fallback
    const presencaKeys = new Set(presenca.map((p: any) => `${p.participante_id}_${p.data}_${p.turma_id}`));
    for (const r of relsMes) {
      const rTurmas = relatorioTurmas.filter((rt: any) => rt.relatorio_id === r.id);
      const rPres = relatorioPresencas.filter((rp: any) => rp.relatorio_id === r.id);
      for (const rt of rTurmas) {
        for (const rp of rPres) {
          if (!rp.presente || !rp.participante_id) continue;
          const key = `${rp.participante_id}_${r.data}_${rt.turma_id}`;
          if (!presencaKeys.has(key)) {
            presenca.push({ participante_id: rp.participante_id, data: r.data, turma_id: rt.turma_id, presente: true, id: rp.id });
            presencaKeys.add(key);
          }
        }
      }
    }

    const atividadesRows: DocxTableRow[] = [];
    // Header
    atividadesRows.push(new DocxTableRow({
      children: [
        headerCell("Atividades Propostas", 2800),
        headerCell("Atividades desenvolvidas", 2500),
        headerCell("Resultados alcançados", 2200),
        headerCell("Justificativa¹", 1860),
      ],
    }));

    // Group plans by title
    for (const plan of plansMes) {
      const matched = relsMes.filter((r: any) => r.planejamento_id === plan.id);
      const desenvolvidas = matched.length > 0
        ? matched.map((r: any) => r.nome_atividade || plan.titulo).join("; ")
        : "Não realizada";
      let resultados = "-";
      if (matched.length > 0) {
        // Use analise_ia if available, otherwise fall back to objetivo_alcancado
        const firstWithIA = matched.find((r: any) => r.analise_ia);
        if (firstWithIA?.analise_ia) {
          resultados = firstWithIA.analise_ia;
        } else {
          resultados = matched[0].objetivo_alcancado === "alcancado" ? "Alcançado" : matched[0].objetivo_alcancado === "parcial" ? "Parcialmente" : "Não alcançado";
        }
      }
      atividadesRows.push(new DocxTableRow({
        children: [
          dataCell(plan.titulo || plan.tema || "-", 2800),
          dataCell(desenvolvidas, 2500),
          dataCell(resultados, 2200),
          dataCell(matched.length === 0 ? "Atividade não realizada no mês" : "", 1860),
        ],
      }));
    }
    // Relatórios without plan
    const relsWithoutPlan = relsMes.filter((r: any) => !r.planejamento_id || !plansMes.find((p: any) => p.id === r.planejamento_id));
    for (const r of relsWithoutPlan) {
      const resultados = r.analise_ia || (r.objetivo_alcancado === "alcancado" ? "Alcançado" : r.objetivo_alcancado === "parcial" ? "Parcialmente" : r.objetivo_alcancado ? "Não alcançado" : "-");
      atividadesRows.push(new DocxTableRow({
        children: [
          dataCell(r.nome_atividade || "(Sem planejamento)", 2800),
          dataCell(r.nome_atividade || "Sim", 2500),
          dataCell(resultados, 2200),
          dataCell("", 1860),
        ],
      }));
    }

    if (atividadesRows.length === 1) {
      atividadesRows.push(new DocxTableRow({
        children: [
          dataCell("Nenhuma atividade registrada", 2800),
          dataCell("-", 2500),
          dataCell("-", 2200),
          dataCell("-", 1860),
        ],
      }));
    }

    // ── 1.2 Equipe Técnica ──
    const atendMes = atendimentos.filter((a: any) => a.data_atendimento?.startsWith(prefix));
    const countByTipo: Record<string, number> = {};
    for (const a of atendMes) {
      const tipo = a.tipo || "atendimento_individual";
      countByTipo[tipo] = (countByTipo[tipo] || 0) + 1;
    }

    const servicoLabels = [
      ["atendimento_comunidade", "Atendimento/Orientação Comunidade"],
      ["atendimento_familiar", "Atendimento/Orientação Familiares"],
      ["atendimento_individual", "Atendimento/Orientação Crianças e Adolescentes ou Idosos"],
      ["atendimento_educador", "Atendimento/Orientação aos Educadores"],
      ["acao_social", "Ações sociais/Eventos"],
      ["reuniao_rede", "Reunião de Rede/Estudo de Caso"],
      ["visita_domiciliar", "Visitas Domiciliares"],
      ["visita_escolar", "Visitas Escolares"],
      ["aplicacao_grupo", "Aplicação de grupos"],
    ];

    let totalServicos = 0;
    const equipeRows: DocxTableRow[] = [];
    equipeRows.push(new DocxTableRow({
      children: [
        headerCell(`RELATÓRIO MENSAL DE SERVIÇOS - EQUIPE TÉCNICA - ${mesNome?.toUpperCase()}/${anoNum}`, 7060, { colSpan: 2 }),
      ],
    }));
    equipeRows.push(new DocxTableRow({
      children: [
        headerCell("SERVIÇO", 5200),
        headerCell("QUANTIDADE", 1860),
      ],
    }));
    for (const [key, label] of servicoLabels) {
      const count = countByTipo[key] || 0;
      totalServicos += count;
      equipeRows.push(new DocxTableRow({
        children: [
          dataCell(label, 5200),
          dataCell(String(count), 1860, { alignment: AlignmentType.CENTER }),
        ],
      }));
    }
    equipeRows.push(new DocxTableRow({
      children: [
        dataCell("TOTAL:", 5200, { bold: true }),
        dataCell(String(totalServicos), 1860, { bold: true, alignment: AlignmentType.CENTER }),
      ],
    }));

    // ── 1.3 Metas por bairro ──
    const presencaMes = presenca.filter((p: any) => p.data?.startsWith(prefix) && p.presente);
    const turmaMap = Object.fromEntries(turmas.map((t: any) => [t.id, t]));
    const partMap = Object.fromEntries(participantes.map((p: any) => [p.id, p]));

    // Count unique participants per bairro+periodo
    function countUniqueParts(bairroNome: string, periodo: string): number {
      const bairroTurmas = turmas.filter((t: any) => {
        const bn = bairroMap[t.bairro_id] || "";
        return bn.toUpperCase().includes(bairroNome) && t.ativa && t.periodo === periodo;
      });
      const tIds = new Set(bairroTurmas.map((t: any) => t.id));
      const partIds = new Set<string>();
      for (const p of presencaMes) {
        if (tIds.has(p.turma_id)) partIds.add(p.participante_id);
      }
      return partIds.size;
    }

    const metasRows: DocxTableRow[] = [];
    metasRows.push(new DocxTableRow({
      children: [
        headerCell("Metas Propostas", 3800),
        headerCell("Quant.", 1100),
        headerCell("Resultados Alcançados", 2200),
        headerCell("Justificativa²", 2260),
      ],
    }));

    let totalGeral = 0;
    for (const bairro of BAIRROS_SCFV) {
      const meta = METAS_BAIRRO[bairro];
      const manha = countUniqueParts(bairro, "manha");
      const tarde = countUniqueParts(bairro, "tarde");
      const idosos = meta.idosos ? countUniqueParts(bairro, "integral") : 0;
      const bairroTotal = manha + tarde + idosos;
      totalGeral += bairroTotal;

      const bairroLabel = bairro === "JARDIM IRENE" ? "Jardim Irene" : bairro === "PARQUE INDEPENDENCIA" ? "Parque Independência" : "Parque Alvorada";
      const metaDesc = `${bairroLabel}:\n${meta.criancasManha} crianças - manhã e tarde.${meta.idosos ? `\n${meta.idosos} idosos.` : ""}`;
      const metaTotal = meta.criancasManha + meta.criancasTarde + (meta.idosos || 0);
      const pct = metaTotal > 0 ? Math.round((bairroTotal / metaTotal) * 100) : 0;

      metasRows.push(new DocxTableRow({
        children: [
          dataCell(metaDesc, 3800, { bold: true }),
          dataCell(String(bairroTotal), 1100, { alignment: AlignmentType.CENTER }),
          dataCell(`${pct}% da meta`, 2200, { alignment: AlignmentType.CENTER }),
          dataCell(pct < 100 ? "Meta não atingida integralmente" : "", 2260),
        ],
      }));
    }
    metasRows.push(new DocxTableRow({
      children: [
        dataCell("TOTAL GERAL:", 3800, { bold: true }),
        dataCell(String(totalGeral), 1100, { bold: true, alignment: AlignmentType.CENTER }),
        dataCell("", 2200),
        dataCell("", 2260),
      ],
    }));

    // ── 1.4 RH ──
    const activeProfiles = profiles.filter((p: any) => p.ativo !== false && p.cargo);
    const rhRows: DocxTableRow[] = [];
    rhRows.push(new DocxTableRow({
      children: [
        headerCell("Nome", 3600),
        headerCell("Função", 2600),
        headerCell("Carga horária", 1800),
      ],
    }));
    for (const p of activeProfiles) {
      rhRows.push(new DocxTableRow({
        children: [
          dataCell(p.nome || "", 3600),
          dataCell(p.cargo || "", 2600),
          dataCell(p.carga_horaria || "-", 1800, { alignment: AlignmentType.CENTER }),
        ],
      }));
    }

    // ── 1.5 Monitoramento ──
    const monitorRows: DocxTableRow[] = [];
    monitorRows.push(new DocxTableRow({
      children: [
        headerCell("Objetivo", 2800),
        headerCell("Indicador", 2400),
        headerCell("Meta Prevista", 1000),
        headerCell("Meta atingida", 1160),
      ],
    }));
    // Compute general attendance rate
    const totalPresencas = presencaMes.length;
    const totalRegistros = presenca.filter((p: any) => p.data?.startsWith(prefix)).length;
    const taxaGeral = totalRegistros > 0 ? Math.round((totalPresencas / totalRegistros) * 100) : 0;

    for (const row of MONITORAMENTO_ROWS) {
      monitorRows.push(new DocxTableRow({
        children: [
          dataCell(row.objetivo, 2800),
          dataCell(row.indicador, 2400),
          dataCell(row.meta, 1000, { alignment: AlignmentType.CENTER }),
          dataCell(`${taxaGeral}%`, 1160, { alignment: AlignmentType.CENTER }),
        ],
      }));
    }

    // ── 2.1 Parcelas ──
    const parcelasRows: DocxTableRow[] = [];
    parcelasRows.push(new DocxTableRow({
      children: [
        headerCell("Número da parcela", 2400),
        headerCell("Valor da parcela", 2800),
        headerCell("Data do recebimento", 2800),
      ],
    }));
    const sortedParcelas = [...parcelas].sort((a: any, b: any) => a.numero_parcela - b.numero_parcela);
    for (const p of sortedParcelas) {
      parcelasRows.push(new DocxTableRow({
        children: [
          dataCell(String(p.numero_parcela), 2400, { alignment: AlignmentType.CENTER }),
          dataCell(fmt(Number(p.valor)), 2800, { alignment: AlignmentType.RIGHT }),
          dataCell(p.data_recebimento ? new Date(p.data_recebimento + "T12:00:00").toLocaleDateString("pt-BR") : "-", 2800, { alignment: AlignmentType.CENTER }),
        ],
      }));
    }

    // ── 2.2 Despesas do mês ──
    const despMes = despesas.filter((d: any) => d.mes_referencia === prefix);
    const despesasRows: DocxTableRow[] = [];
    despesasRows.push(new DocxTableRow({
      children: [
        headerCell("Código", 1600),
        headerCell("Descrição", 4200),
        headerCell("Valor Gasto", 2200),
      ],
    }));
    let totalDespMes = 0;
    for (const d of despMes) {
      totalDespMes += Number(d.valor);
      despesasRows.push(new DocxTableRow({
        children: [
          dataCell(d.codigo_lancamento || "-", 1600),
          dataCell(d.descricao, 4200),
          dataCell(fmt(Number(d.valor)), 2200, { alignment: AlignmentType.RIGHT }),
        ],
      }));
    }
    if (despMes.length === 0) {
      despesasRows.push(new DocxTableRow({
        children: [
          dataCell("-", 1600), dataCell("Nenhuma despesa registrada", 4200), dataCell("-", 2200),
        ],
      }));
    }

    // ── 2.3 Resumo financeiro ──
    const totalParcelas = parcelas.reduce((s: number, p: any) => s + Number(p.valor), 0);
    const totalDespesas = despesas.reduce((s: number, d: any) => s + Number(d.valor), 0);
    const estornosMes = estornos.filter((e: any) => e.mes_referencia === prefix);
    const totalEstornos = estornosMes.reduce((s: number, e: any) => s + Number(e.valor), 0);
    const saldo = totalParcelas - totalDespesas + totalEstornos;

    const resumoRows: DocxTableRow[] = [];
    const resumoData = [
      ["Saldo Anterior", fmt(totalParcelas - totalDespMes + totalEstornos)],
      ["Valores Transferidos", fmt(totalParcelas)],
      ["Rendimentos", fmt(0)],
      ["Valores Estornados", fmt(totalEstornos)],
      ["Valor Executado", fmt(totalDespMes)],
      ["Saldo para o mês seguinte", fmt(saldo)],
    ];
    for (const [label, val] of resumoData) {
      resumoRows.push(new DocxTableRow({
        children: [
          dataCell(label, 4500, { bold: true }),
          dataCell(val, 3500, { alignment: AlignmentType.RIGHT }),
        ],
      }));
    }

    // ── 2.4 Saldo por categoria ──
    const catRows: DocxTableRow[] = [];
    catRows.push(new DocxTableRow({
      children: [
        headerCell("Código", 1600),
        headerCell("Descrição", 2200),
        headerCell("Valor Previsto", 1400),
        headerCell("Valor Gasto⁵", 1400),
        headerCell("Valor Estornado", 1200),
        headerCell("Saldo Disponível⁶", 1200),
      ],
    }));

    let catTotalPrev = 0, catTotalGasto = 0, catTotalEst = 0, catTotalSaldo = 0;
    for (const cat of categorias) {
      const gasto = despesas.filter((d: any) => d.categoria_id === cat.id).reduce((s: number, d: any) => s + Number(d.valor), 0);
      const est = estornos.filter((e: any) => e.categoria_id === cat.id).reduce((s: number, e: any) => s + Number(e.valor), 0);
      const prev = Number(cat.valor_previsto || 0);
      const saldoCat = prev - gasto + est;
      catTotalPrev += prev;
      catTotalGasto += gasto;
      catTotalEst += est;
      catTotalSaldo += saldoCat;

      catRows.push(new DocxTableRow({
        children: [
          dataCell(cat.codigo, 1600),
          dataCell(cat.descricao, 2200),
          dataCell(fmt(prev), 1400, { alignment: AlignmentType.RIGHT }),
          dataCell(fmt(gasto), 1400, { alignment: AlignmentType.RIGHT }),
          dataCell(fmt(est), 1200, { alignment: AlignmentType.RIGHT }),
          dataCell(fmt(saldoCat), 1200, { alignment: AlignmentType.RIGHT }),
        ],
      }));
    }
    catRows.push(new DocxTableRow({
      children: [
        dataCell("", 1600),
        dataCell("TOTAL", 2200, { bold: true }),
        dataCell(fmt(catTotalPrev), 1400, { bold: true, alignment: AlignmentType.RIGHT }),
        dataCell(fmt(catTotalGasto), 1400, { bold: true, alignment: AlignmentType.RIGHT }),
        dataCell(fmt(catTotalEst), 1200, { bold: true, alignment: AlignmentType.RIGHT }),
        dataCell(fmt(catTotalSaldo), 1200, { bold: true, alignment: AlignmentType.RIGHT }),
      ],
    }));

    // ── XLSX FORMAT ──
    if (outputFormat === "xlsx") {
      const wb = XLSX.utils.book_new();
      const border = { style: "thin", color: { rgb: "000000" } };
      const hdrStyle = { font: { bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "1A5276" } }, border: { top: border, bottom: border, left: border, right: border }, alignment: { wrapText: true, vertical: "center" } };
      const cellStyle = { border: { top: border, bottom: border, left: border, right: border }, alignment: { wrapText: true, vertical: "center" } };
      const instStyle = { font: { bold: true, sz: 14 }, alignment: { horizontal: "center" } };

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

      function applyStyles(ws: any, headerRow = 0) {
        const range = XLSX.utils.decode_range(ws["!ref"] || "A1");
        for (let r = range.s.r; r <= range.e.r; r++) {
          for (let c = range.s.c; c <= range.e.c; c++) {
            const addr = XLSX.utils.encode_cell({ r, c });
            if (!ws[addr]) ws[addr] = { v: "", t: "s" };
            if (r === headerRow) ws[addr].s = { ...hdrStyle };
            else if (r < headerRow) ws[addr].s = { ...instStyle };
            else ws[addr].s = { ...cellStyle };
          }
        }
        autoFitCols(ws);
      }

      function addInstHeader(rows: any[][], title: string): any[][] {
        return [
          ["Sociedade Civil Nossa Senhora Aparecida"],
          ["Centro de Atenção Integral ao Adolescente - Medianeira"],
          [title],
          [],
          ...rows,
        ];
      }

      // Aba Atividades
      const atRows = addInstHeader(
        [["Atividades Propostas", "Atividades Desenvolvidas", "Resultados", "Justificativa"]],
        "ATIVIDADES — REO"
      );
      for (const plan of plansMes) {
        const matched = relsMes.filter((r: any) => r.planejamento_id === plan.id);
        const desenvolvidas = matched.length > 0 ? matched.map((r: any) => r.nome_atividade || plan.titulo).join("; ") : "Não realizada";
        const firstWithIA = matched.find((r: any) => r.analise_ia);
        const resultados = matched.length > 0 ? (firstWithIA?.analise_ia || (matched[0].objetivo_alcancado === "alcancado" ? "Alcançado" : matched[0].objetivo_alcancado === "parcial" ? "Parcial" : "Não")) : "-";
        atRows.push([plan.titulo || plan.tema || "-", desenvolvidas, resultados, matched.length === 0 ? "Não realizada" : ""]);
      }
      for (const r of relsWithoutPlan) {
        const resultados = r.analise_ia || (r.objetivo_alcancado === "alcancado" ? "Alcançado" : r.objetivo_alcancado === "parcial" ? "Parcial" : "-");
        atRows.push([r.nome_atividade || "(Sem plan.)", r.nome_atividade || "Sim", resultados, ""]);
      }
      const wsAt = XLSX.utils.aoa_to_sheet(atRows);
      wsAt["!cols"] = [{ wch: 35 }, { wch: 25 }, { wch: 20 }, { wch: 25 }];
      applyStyles(wsAt, 4);
      XLSX.utils.book_append_sheet(wb, wsAt, "Atividades");

      // Aba Equipe Técnica
      const eqRows = addInstHeader([["Serviço", "Quantidade"]], "EQUIPE TÉCNICA — REO");
      for (const [key, label] of servicoLabels) { eqRows.push([label, String(countByTipo[key] || 0)]); }
      eqRows.push(["TOTAL", String(totalServicos)]);
      const wsEq = XLSX.utils.aoa_to_sheet(eqRows);
      wsEq["!cols"] = [{ wch: 50 }, { wch: 15 }];
      applyStyles(wsEq, 4);
      XLSX.utils.book_append_sheet(wb, wsEq, "Equipe Técnica");

      // Aba Metas
      const mtRows = addInstHeader([["Metas Propostas", "Quantidade", "Resultados", "Justificativa"]], "METAS — REO");
      for (const bairro of BAIRROS_SCFV) {
        const meta = METAS_BAIRRO[bairro];
        const manha = countUniqueParts(bairro, "manha");
        const tarde = countUniqueParts(bairro, "tarde");
        const idosos = meta.idosos ? countUniqueParts(bairro, "integral") : 0;
        const bt = manha + tarde + idosos;
        const metaT = meta.criancasManha + meta.criancasTarde + (meta.idosos || 0);
        const pct = metaT > 0 ? Math.round((bt / metaT) * 100) : 0;
        mtRows.push([bairro, String(bt), `${pct}% da meta`, pct < 100 ? "Meta não atingida" : ""]);
      }
      mtRows.push(["TOTAL", String(totalGeral), "", ""]);
      const wsMt = XLSX.utils.aoa_to_sheet(mtRows);
      wsMt["!cols"] = [{ wch: 40 }, { wch: 12 }, { wch: 20 }, { wch: 25 }];
      applyStyles(wsMt, 4);
      XLSX.utils.book_append_sheet(wb, wsMt, "Metas");

      // Aba RH
      const rhXRows = addInstHeader([["Nome", "Função", "Carga Horária"]], "RECURSOS HUMANOS — REO");
      for (const p of activeProfiles) { rhXRows.push([p.nome || "", p.cargo || "", p.carga_horaria || "-"]); }
      const wsRh = XLSX.utils.aoa_to_sheet(rhXRows);
      wsRh["!cols"] = [{ wch: 30 }, { wch: 25 }, { wch: 15 }];
      applyStyles(wsRh, 4);
      XLSX.utils.book_append_sheet(wb, wsRh, "RH");

      // Aba Monitoramento
      const moRows = addInstHeader([["Objetivo", "Indicador", "Meta Prevista", "Meta Atingida"]], "MONITORAMENTO — REO");
      for (const row of MONITORAMENTO_ROWS) { moRows.push([row.objetivo, row.indicador, row.meta, `${taxaGeral}%`]); }
      const wsMo = XLSX.utils.aoa_to_sheet(moRows);
      wsMo["!cols"] = [{ wch: 50 }, { wch: 45 }, { wch: 12 }, { wch: 12 }];
      applyStyles(wsMo, 4);
      XLSX.utils.book_append_sheet(wb, wsMo, "Monitoramento");

      // Aba Financeiro
      const finRows: any[][] = [
        ["Sociedade Civil Nossa Senhora Aparecida", "", ""],
        ["Centro de Atenção Integral ao Adolescente - Medianeira", "", ""],
        ["FINANCEIRO — REO", "", ""],
        [],
        ["PARCELAS RECEBIDAS", "", ""],
      ];
      finRows.push(["Nº Parcela", "Valor", "Data Recebimento"]);
      for (const p of sortedParcelas) { finRows.push([p.numero_parcela, Number(p.valor), p.data_recebimento ? new Date(p.data_recebimento + "T12:00:00").toLocaleDateString("pt-BR") : "-"]); }
      finRows.push([]);
      finRows.push(["DESPESAS DO MÊS", "", ""]);
      finRows.push(["Código", "Descrição", "Valor"]);
      for (const d of despMes) { finRows.push([d.codigo_lancamento || "-", d.descricao, Number(d.valor)]); }
      finRows.push(["", "TOTAL", totalDespMes]);
      finRows.push([]);
      finRows.push(["RESUMO FINANCEIRO", "", ""]);
      for (const [label, val] of resumoData) { finRows.push([label, val, ""]); }
      finRows.push([]);
      finRows.push(["SALDO POR CATEGORIA", "", "", "", "", ""]);
      finRows.push(["Código", "Descrição", "Previsto", "Gasto", "Estornado", "Saldo"]);
      for (const cat of categorias) {
        const gasto = despesas.filter((d: any) => d.categoria_id === cat.id).reduce((s: number, d: any) => s + Number(d.valor), 0);
        const est = estornos.filter((e: any) => e.categoria_id === cat.id).reduce((s: number, e: any) => s + Number(e.valor), 0);
        const prev = Number(cat.valor_previsto || 0);
        finRows.push([cat.codigo, cat.descricao, prev, gasto, est, prev - gasto + est]);
      }
      finRows.push(["", "TOTAL", catTotalPrev, catTotalGasto, catTotalEst, catTotalSaldo]);
      const wsFin = XLSX.utils.aoa_to_sheet(finRows);
      wsFin["!cols"] = [{ wch: 18 }, { wch: 35 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];
      const finRange = XLSX.utils.decode_range(wsFin["!ref"] || "A1");
      for (let r = finRange.s.r; r <= finRange.e.r; r++) {
        for (let c = finRange.s.c; c <= finRange.e.c; c++) {
          const addr = XLSX.utils.encode_cell({ r, c });
          if (!wsFin[addr]) wsFin[addr] = { v: "", t: "s" };
          wsFin[addr].s = { ...cellStyle };
        }
      }
      autoFitCols(wsFin);
      XLSX.utils.book_append_sheet(wb, wsFin, "Financeiro");

      // ── Attendance tabs per turma ──
      const DIAS_MAP_XLSX: Record<string, number> = { dom: 0, seg: 1, ter: 2, qua: 3, qui: 4, sex: 5, sab: 6 };
      const turmasAtivasXlsx = turmas.filter((t: any) => t.ativa);
      const usedSheetNames = new Set<string>(["Atividades", "Equipe Técnica", "Metas", "RH", "Monitoramento", "Financeiro"]);

      for (const turma of turmasAtivasXlsx) {
        const t = turma as any;
        const diasSemana: string[] = t.dias_semana || [];
        const diasNum = diasSemana.map((d: string) => DIAS_MAP_XLSX[d.toLowerCase()]).filter((n: number) => n !== undefined);

        const datas: string[] = [];
        const dStr = new Date(anoNum, mesNum - 1, 1);
        while (dStr.getMonth() === mesNum - 1) {
          if (diasNum.includes(dStr.getDay())) {
            datas.push(`${dStr.getFullYear()}-${String(dStr.getMonth() + 1).padStart(2, "0")}-${String(dStr.getDate()).padStart(2, "0")}`);
          }
          dStr.setDate(dStr.getDate() + 1);
        }

        const tpMembers = turmaParticipantes.filter((tp: any) => tp.turma_id === t.id);
        const memberParts = tpMembers.map((tp: any) => partMap[tp.participante_id]).filter(Boolean);
        const sorted = [...memberParts].sort((a: any, b: any) => a.nome_completo.localeCompare(b.nome_completo));
        if (sorted.length === 0 && datas.length === 0) continue;

        // Also include dates from presenca records for this turma
        const tPresencas = presencaMes.filter((p: any) => p.turma_id === t.id);
        const allPresenca = presenca.filter((p: any) => p.turma_id === t.id && p.data?.startsWith(prefix));
        const allDatesSet = new Set([...datas, ...allPresenca.map((p: any) => p.data)]);
        const allDates = [...allDatesSet].sort();
        if (allDates.length === 0) continue;

        const presencaSet = new Set(tPresencas.map((p: any) => `${p.participante_id}_${p.data}`));
        // Also check full presenca for non-present records
        const allPresencaSet = new Set(allPresenca.map((p: any) => `${p.participante_id}_${p.data}`));

        const educador = profiles.find((p: any) => p.id === t.educador_id);
        const bn = bairroMap[t.bairro_id] || "";

        let sheetName = (t.nome || "Turma").slice(0, 28).replace(/[\\\/\*\?\[\]:]/g, "_");
        let suffix = 2;
        while (usedSheetNames.has(sheetName)) { sheetName = sheetName.slice(0, 25) + `_${suffix++}`; }
        usedSheetNames.add(sheetName);

        const header1 = [`SCFV — CAIA Medianeira — Lista de Presença`];
        const header2 = [`Turma: ${t.nome} | Bairro: ${bn} | Período: ${t.periodo || "N/I"}`];
        const header3 = [`Mês: ${MESES_NOMES[mesNum - 1]} / ${anoNum} | Educador(a): ${educador?.nome || "N/I"}`];
        const colHeaders = ["Nº", "Nome do Participante", ...allDates.map((d: string) => d.slice(8,10) + "/" + d.slice(5,7))];
        const rows = sorted.map((p: any, idx: number) => {
          const isDesligado = p.status === "desligado";
          const dataDeslig = p.data_desligamento || null;
          const nameSuffix = isDesligado && dataDeslig ? ` (D ${dataDeslig.slice(8,10)}/${dataDeslig.slice(5,7)})` : "";
          const row: any[] = [idx + 1, p.nome_completo + nameSuffix];
          allDates.forEach(() => row.push(""));
          return row;
        });

        const sheetData = [header1, header2, header3, [], colHeaders, ...rows, [], [`Assinatura do Educador: _______________________`]];
        const ws = XLSX.utils.aoa_to_sheet(sheetData);
        ws["!cols"] = [{ wch: 5 }, { wch: 30 }, ...allDates.map(() => ({ wch: 6 }))];

        // Style header row
        for (let c = 0; c < colHeaders.length; c++) {
          const addr = XLSX.utils.encode_cell({ r: 4, c });
          if (!ws[addr]) ws[addr] = { v: "", t: "s" };
          ws[addr].s = { ...hdrStyle };
        }
        // Style inst header
        for (let r = 0; r < 3; r++) {
          const addr = XLSX.utils.encode_cell({ r, c: 0 });
          if (ws[addr]) ws[addr].s = { ...instStyle };
        }

        const dataStartRow = 5;
        sorted.forEach((p: any, pIdx: number) => {
          const excelRow = dataStartRow + pIdx;
          const isDesligado = p.status === "desligado";
          const dataDeslig = p.data_desligamento || null;
          for (let c = 0; c < 2; c++) {
            const addr = XLSX.utils.encode_cell({ r: excelRow, c });
            if (!ws[addr]) ws[addr] = { v: "", t: "s" };
            ws[addr].s = { ...(ws[addr].s || {}), border: { top: border, bottom: border, left: border, right: border } };
          }
          allDates.forEach((d: string, dIdx: number) => {
            const col = 2 + dIdx;
            const addr = XLSX.utils.encode_cell({ r: excelRow, c: col });
            if (!ws[addr]) ws[addr] = { v: "", t: "s" };
            if (isDesligado && dataDeslig && d > dataDeslig) {
              ws[addr].v = "D";
              ws[addr].s = { fill: { fgColor: { rgb: "CCCCCC" } }, font: { color: { rgb: "666666" } }, border: { top: border, bottom: border, left: border, right: border } };
            } else {
              const key = `${p.id}_${d}`;
              if (presencaSet.has(key)) {
                ws[addr].v = "■";
                ws[addr].s = { font: { sz: 14, color: { rgb: "000000" } }, alignment: { horizontal: "center", vertical: "center" }, border: { top: border, bottom: border, left: border, right: border } };
              } else {
                ws[addr].s = { border: { top: border, bottom: border, left: border, right: border } };
              }
            }
          });
        });

        XLSX.utils.book_append_sheet(wb, ws, sheetName);
      }

      const buf = new Uint8Array(XLSX.write(wb, { bookType: "xlsx", type: "array" }));
      const ts = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
      const fileName = `SysCFV_REO_${anoNum}-${String(mesNum).padStart(2, "0")}_${ts}.xlsx`;
      const storagePath = `reo/${fileName}`;

      const { error: uploadErr } = await supabase.storage.from("documentos").upload(storagePath, buf, { contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", upsert: true });
      if (uploadErr) throw uploadErr;
      const { data: urlData } = await supabase.storage.from("documentos").createSignedUrl(storagePath, 600);

      return new Response(JSON.stringify({ url: urlData?.signedUrl, fileName }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── ANEXO I - REGISTROS FOTOGRÁFICOS (DOCX only) ──
    const relIdsMes = new Set(relsMes.map((r: any) => r.id));
    const fotosMes = relatorioFotos.filter((f: any) => relIdsMes.has(f.relatorio_id));

    const photoChildren: (Paragraph | DocxTable)[] = [];
    if (fotosMes.length > 0) {
      photoChildren.push(new Paragraph({
        spacing: { before: 300, after: 300 },
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: "ANEXO I - REGISTROS FOTOGRÁFICOS", bold: true, font: "Arial", size: 26 })],
      }));

      // Group photos by relatorio
      const fotosByRelatorio = new Map<string, any[]>();
      for (const f of fotosMes) {
        if (!fotosByRelatorio.has(f.relatorio_id)) fotosByRelatorio.set(f.relatorio_id, []);
        fotosByRelatorio.get(f.relatorio_id)!.push(f);
      }

      let photoCount = 0;
      for (const [relId, fotos] of fotosByRelatorio) {
        const rel = relsMes.find((r: any) => r.id === relId);
        const relLabel = rel ? `${rel.nome_atividade || "Atividade"} — ${rel.data ? new Date(rel.data + "T12:00:00").toLocaleDateString("pt-BR") : ""}` : "Atividade";

        photoChildren.push(new Paragraph({
          spacing: { before: 200, after: 100 },
          children: [new TextRun({ text: relLabel, bold: true, font: "Arial", size: 20 })],
        }));

        for (const foto of fotos) {
          try {
            const url = foto.foto_url.startsWith("http")
              ? foto.foto_url
              : `${supabaseUrl}/storage/v1/object/public/fotos-relatorios/${foto.foto_url}`;
            const resp = await fetch(url);
            if (!resp.ok) continue;
            const buf = await resp.arrayBuffer();
            const ext = url.toLowerCase().includes(".png") ? "png" : "jpg";
            photoCount++;
            photoChildren.push(new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 150, after: 80 },
              children: [
                new ImageRun({
                  type: ext as "png" | "jpg",
                  data: new Uint8Array(buf),
                  transformation: { width: 420, height: 315 },
                  altText: { title: `Foto ${photoCount}`, description: `Registro fotográfico ${photoCount}`, name: `foto_${photoCount}` },
                }),
              ],
            }));
            photoChildren.push(new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { after: 100 },
              children: [new TextRun({ text: `Foto ${photoCount}`, font: "Arial", size: 16, italics: true })],
            }));
            // Page break every 2 photos
            if (photoCount % 2 === 0) {
              photoChildren.push(new Paragraph({ children: [new PageBreak()] }));
            }
          } catch { /* skip */ }
        }
      }
    }

    // ── ANEXO II - LISTAS DE PRESENÇA (DOCX only) ──
    const DIAS_MAP_REO: Record<string, number> = { dom: 0, seg: 1, ter: 2, qua: 3, qui: 4, sex: 5, sab: 6 };
    const presencaChildren: (Paragraph | DocxTable)[] = [];
    const turmasAtivas = turmas.filter((t: any) => t.ativa);

    const tableWidth = 9360;

    if (turmasAtivas.length > 0) {
      presencaChildren.push(new Paragraph({
        spacing: { before: 300, after: 300 },
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: "ANEXO II - LISTAS DE PRESENÇA", bold: true, font: "Arial", size: 26 })],
      }));
      for (let ti = 0; ti < turmasAtivas.length; ti++) {
        const turma = turmasAtivas[ti];
        const diasSemana: string[] = turma.dias_semana || [];
        const diasNum = diasSemana.map((d: string) => DIAS_MAP_REO[d.toLowerCase()]).filter((n: number) => n !== undefined);

        // Build dates for the month based on turma's dias_semana
        const datas: string[] = [];
        const datasDate: Date[] = [];
        const d = new Date(anoNum, mesNum - 1, 1);
        while (d.getMonth() === mesNum - 1) {
          if (diasNum.includes(d.getDay())) {
            datas.push(`${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`);
            datasDate.push(new Date(d));
          }
          d.setDate(d.getDate() + 1);
        }
        if (datas.length === 0) continue;

        // Get members for this turma
        const tpMembers = turmaParticipantes.filter((tp: any) => tp.turma_id === turma.id);
        const memberParts = tpMembers.map((tp: any) => partMap[tp.participante_id]).filter(Boolean);
        const sorted = [...memberParts].sort((a: any, b: any) => a.nome_completo.localeCompare(b.nome_completo));
        if (sorted.length === 0) continue;

        // Get attendance data for this turma in this month
        const turmaPresenca = presencaMes.filter((p: any) => p.turma_id === turma.id);
        const presencaSet = new Set(turmaPresenca.map((p: any) => `${p.participante_id}_${p.data}`));

        // Educator name
        const educador = profiles.find((p: any) => p.id === turma.educador_id);
        const bairroNome = bairroMap[turma.bairro_id] || "";

        // Page break between turmas (not before first)
        if (ti > 0) {
          presencaChildren.push(new Paragraph({ children: [new PageBreak()] }));
        }

        // Institutional header
        presencaChildren.push(new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 40 },
          children: [new TextRun({ text: "Sociedade Civil Nossa Senhora Aparecida", bold: true, font: "Arial", size: 18, color: "1A5276" })],
        }));
        presencaChildren.push(new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 100 },
          children: [new TextRun({ text: "Centro de Atenção Integral ao Adolescente - CAIA Medianeira", font: "Arial", size: 16, color: "2C3E50" })],
        }));
        presencaChildren.push(new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 60 },
          children: [new TextRun({ text: `LISTA DE PRESENÇA — ${MESES_NOMES[mesNum - 1].toUpperCase()} / ${anoNum}`, bold: true, font: "Arial", size: 22 })],
        }));
        presencaChildren.push(new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 40 },
          children: [new TextRun({ text: turma.nome, bold: true, font: "Arial", size: 20 })],
        }));
        const infoParts = [
          educador?.nome && `Educador(a): ${educador.nome}`,
          bairroNome && `Bairro: ${bairroNome}`,
          turma.periodo && `Período: ${turma.periodo === "manha" ? "Manhã" : turma.periodo === "tarde" ? "Tarde" : "Integral"}`,
        ].filter(Boolean).join("  ·  ");
        presencaChildren.push(new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
          children: [new TextRun({ text: infoParts, font: "Arial", size: 16, italics: true })],
        }));

        // Build table
        const loopTableWidth = tableWidth;
        const numColW = 500;
        const nameColW = 3200;
        const remainingW = tableWidth - numColW - nameColW;
        const dateColW = Math.max(Math.floor(remainingW / datas.length), 400);

        // Header row
        const headerCells = [
          headerCell("Nº", numColW, { shading: "1A5276" }),
          headerCell("Nome do Participante", nameColW, { shading: "1A5276" }),
          ...datas.map(dt => headerCell(dt, dateColW, { shading: "1A5276" })),
        ];
        const tableRows: DocxTableRow[] = [new DocxTableRow({ children: headerCells })];

        // Data rows
        for (let mi = 0; mi < sorted.length; mi++) {
          const member = sorted[mi];
          const isDesligado = member.status === "desligado";
          const cells = [
            dataCell(String(mi + 1), numColW, { alignment: AlignmentType.CENTER }),
            new DocxTableCell({
              borders: cellBorders,
              margins: cellMargins,
              width: { size: nameColW, type: WidthType.DXA },
              children: [new Paragraph({
                children: [new TextRun({
                  text: isDesligado ? `${member.nome_completo} (D)` : member.nome_completo,
                  font: "Arial", size: 16,
                  strike: isDesligado,
                  color: isDesligado ? "999999" : undefined,
                })],
              })],
            }),
            ...datasDate.map(dt => {
              const dateStr = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
              const key = `${member.id}_${dateStr}`;
              const presente = presencaSet.has(key);
              return dataCell(
                isDesligado ? "—" : (presente ? "■" : ""),
                dateColW,
                { alignment: AlignmentType.CENTER }
              );
            }),
          ];
          tableRows.push(new DocxTableRow({ children: cells }));
        }

        const colWidths = [numColW, nameColW, ...datas.map(() => dateColW)];
        const totalTableW = colWidths.reduce((a, b) => a + b, 0);

        presencaChildren.push(new DocxTable({
          width: { size: totalTableW, type: WidthType.DXA },
          columnWidths: colWidths,
          rows: tableRows,
        }));

        // Signature line
        presencaChildren.push(new Paragraph({
          spacing: { before: 400 },
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: `Assinatura do(a) Educador(a): ${"_".repeat(50)}`, font: "Arial", size: 18, italics: true })],
        }));
      }
    }
    // ── Build DOCX ──
    const doc = new Document({
      styles: {
        default: { document: { run: { font: "Arial", size: 20 } } },
      },
      sections: [{
        properties: {
          page: {
            size: { width: 12240, height: 15840 },
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
          },
        },
        headers: {
          default: new Header({
            children: [new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: "Sociedade Civil Nossa Senhora Aparecida", font: "Arial", size: 18, bold: true })],
            })],
          }),
        },
        footers: {
          default: new Footer({
            children: [new Paragraph({
              alignment: AlignmentType.RIGHT,
              children: [new TextRun({ children: [PageNumber.CURRENT], font: "Arial", size: 16 })],
            })],
          }),
        },
        children: [
          // ── Title ──
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 300 },
            children: [new TextRun({ text: "RELATÓRIO DE EXECUÇÃO DO OBJETO E DE EXECUÇÃO FINANCEIRA", bold: true, font: "Arial", size: 28 })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 100 },
            children: [new TextRun({ text: "Termo de Colaboração/Fomento nº 001/2022", font: "Arial", size: 20 })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 },
            children: [new TextRun({ text: `Execução: ${mesNome?.toUpperCase()}/${anoNum}`, font: "Arial", size: 20, bold: true })],
          }),

          // ── 1. Execução do Objeto ──
          sectionTitle("1. EXECUÇÃO DO OBJETO"),
          new Paragraph({
            spacing: { after: 200 },
            children: [new TextRun({ text: "Em atendimento, inciso I do caput do artigo 66 da Lei Federal nº 13.019/2014 e suas alterações, esta organização da sociedade civil, elaborou o relatório a seguir, a partir do cronograma acordado.", font: "Arial", size: 18 })],
          }),

          sectionTitle("1.1. Atividades, oficinas e/ou projetos desenvolvidos para o cumprimento do objeto:"),
          new DocxTable({ width: { size: tableWidth, type: WidthType.DXA }, columnWidths: [2800, 2500, 2200, 1860], rows: atividadesRows }),
          subNote("¹ Preencher este campo caso a atividade não tenha sido realizada no mês."),

          new Paragraph({ children: [new PageBreak()] }),

          sectionTitle("1.2. Atividades, serviços e ações da Equipe Técnica - Psicólogo(a) e Assistente Social"),
          new DocxTable({ width: { size: 7060, type: WidthType.DXA }, columnWidths: [5200, 1860], rows: equipeRows }),

          new Paragraph({ children: [new PageBreak()] }),

          sectionTitle("1.3. Comparativo"),
          new DocxTable({ width: { size: tableWidth, type: WidthType.DXA }, columnWidths: [3800, 1100, 2200, 2260], rows: metasRows }),
          subNote("² Descrever o motivo que ensejou o não alcance das metas e quais as providências adotadas pela Entidade em relação a sanar esta questão."),

          new Paragraph({ children: [new PageBreak()] }),

          sectionTitle("1.4. Recursos Humanos Envolvidos³"),
          new DocxTable({ width: { size: 8000, type: WidthType.DXA }, columnWidths: [3600, 2600, 1800], rows: rhRows }),
          subNote("³ Constar a equipe informada no Plano de Trabalho."),

          sectionTitle("1.5. Monitoramento e Avaliação"),
          new DocxTable({ width: { size: 7360, type: WidthType.DXA }, columnWidths: [2800, 2400, 1000, 1160], rows: monitorRows }),

          new Paragraph({ children: [new PageBreak()] }),

          // ── 2. Execução Financeira ──
          sectionTitle("2. EXECUÇÃO FINANCEIRA"),
          new Paragraph({
            spacing: { after: 200 },
            children: [new TextRun({ text: "Em atendimento, inciso II do caput do artigo 66 da Lei Federal nº 13.019/2014 e suas alterações, esta organização da sociedade civil, elaborou o relatório a seguir, a partir do cronograma acordado.", font: "Arial", size: 18 })],
          }),

          sectionTitle("2.1. Valores transferidos"),
          new DocxTable({ width: { size: 8000, type: WidthType.DXA }, columnWidths: [2400, 2800, 2800], rows: parcelasRows }),

          new Paragraph({ children: [new PageBreak()] }),

          sectionTitle("2.2. Despesas Efetuadas no mês"),
          new DocxTable({ width: { size: 8000, type: WidthType.DXA }, columnWidths: [1600, 4200, 2200], rows: despesasRows }),

          new Paragraph({ children: [new PageBreak()] }),

          sectionTitle("2.3. Resumo financeiro"),
          new DocxTable({ width: { size: 8000, type: WidthType.DXA }, columnWidths: [4500, 3500], rows: resumoRows }),

          sectionTitle("2.4 Saldo atualizado por categoria econômica"),
          new DocxTable({ width: { size: 9000, type: WidthType.DXA }, columnWidths: [1600, 2200, 1400, 1400, 1200, 1200], rows: catRows }),
          subNote("⁵ Considerar o valor gasto estimado de todos os meses."),
          subNote("⁶ Para se chegar ao saldo disponível é necessário realizar a seguinte equação: Valor previsto – valor gasto + valor estornado."),

          new Paragraph({ children: [new PageBreak()] }),

          // ── Signature ──
          new Paragraph({ spacing: { before: 600 }, children: [] }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 600 },
            children: [new TextRun({ text: "RAÚL OSCAR SENA VÉLEZ", bold: true, font: "Arial", size: 20 })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: "PRESIDENTE", font: "Arial", size: 20 })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: "CPF: 801.780.489-09", font: "Arial", size: 18 })],
          }),

          // ── Annexes ──
          ...(photoChildren.length > 0 ? [new Paragraph({ children: [new PageBreak()] }), ...photoChildren] : []),
          ...(presencaChildren.length > 0 ? [new Paragraph({ children: [new PageBreak()] }), ...presencaChildren] : []),
        ],
      }],
    });

    const buffer = await Packer.toBuffer(doc);
    const ts = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
    const fileName = `SysCFV_REO_${anoNum}-${String(mesNum).padStart(2, "0")}_${ts}.docx`;
    const storagePath = `reo/${fileName}`;

    const { error: uploadErr } = await supabase.storage
      .from("documentos")
      .upload(storagePath, buffer, { contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", upsert: true });
    if (uploadErr) throw uploadErr;

    const { data: urlData } = await supabase.storage
      .from("documentos")
      .createSignedUrl(storagePath, 600);

    return new Response(JSON.stringify({ url: urlData?.signedUrl, fileName }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
