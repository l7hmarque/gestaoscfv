import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, PageOrientation, BorderStyle, WidthType,
  ShadingType, PageBreak, HeadingLevel, LevelFormat,
} from "docx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { saveAs } from "file-saver";
import { format } from "date-fns";

// ===== SHARED CONSTANTS =====
const HEADER_COLOR = "1A5276";
const ACCENT_COLOR = "C62828";
const LIGHT_BG = "F5F5F5";
const cellBorder = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
const borders = { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder };
const cellMargins = { top: 60, bottom: 60, left: 80, right: 80 };

const LIKERT_COLORS: Record<number, string> = {
  1: "E53935", 2: "FB8C00", 3: "FDD835", 4: "43A047", 5: "1565C0",
};
const LIKERT_LABELS: Record<number, string> = {
  1: "Muito Baixo", 2: "Baixo", 3: "Moderado", 4: "Alto", 5: "Excepcional",
};

function headerParagraphs(): Paragraph[] {
  return [
    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "PREFEITURA MUNICIPAL DE MEDIANEIRA", bold: true, size: 20, font: "Arial" })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "SECRETARIA DE ASSISTÊNCIA SOCIAL", size: 18, font: "Arial" })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "CAIA — Centro de Atendimento Integrado ao Adolescente", size: 18, font: "Arial" })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Serviço de Convivência e Fortalecimento de Vínculos — SCFV", size: 16, font: "Arial", italics: true })] }),
    new Paragraph({ spacing: { after: 200 }, children: [] }),
  ];
}

function infoRow(label: string, value: string | null | undefined): TableRow {
  return new TableRow({
    children: [
      new TableCell({
        width: { size: 2800, type: WidthType.DXA },
        borders, margins: cellMargins,
        shading: { fill: LIGHT_BG, type: ShadingType.CLEAR },
        children: [new Paragraph({ children: [new TextRun({ text: label, bold: true, size: 18, font: "Arial" })] })],
      }),
      new TableCell({
        width: { size: 6560, type: WidthType.DXA },
        borders, margins: cellMargins,
        children: [new Paragraph({ children: [new TextRun({ text: value || "—", size: 18, font: "Arial" })] })],
      }),
    ],
  });
}

function checkbox(checked: boolean, label: string): TextRun[] {
  return [
    new TextRun({ text: checked ? "☑ " : "☐ ", size: 18, font: "Segoe UI Symbol" }),
    new TextRun({ text: label + "   ", size: 18, font: "Arial" }),
  ];
}

// ===== RELATÓRIO DE ATIVIDADE =====
export async function exportRelatorioDocx(item: any, turmaNames: string[], presenca: any[], fotos: any[]) {
  const children: any[] = [
    ...headerParagraphs(),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [
      new TextRun({ text: "RELATÓRIO DE ATIVIDADE", bold: true, size: 24, font: "Arial", color: ACCENT_COLOR }),
    ]}),
  ];

  // Info table
  const rows = [
    infoRow("Data", item.data ? format(new Date(item.data + "T12:00:00"), "dd/MM/yyyy") : ""),
    infoRow("Dia da Semana", item.dia_semana),
    infoRow("Educador", item.profiles?.nome),
    infoRow("Turma(s)", turmaNames.join(", ")),
    infoRow("Tipo de Atividade", item.tipo_atividade),
    infoRow("Nome da Atividade", item.nome_atividade),
  ];
  children.push(new Table({ width: { size: 9360, type: WidthType.DXA }, columnWidths: [2800, 6560], rows }));
  children.push(new Paragraph({ spacing: { after: 200 }, children: [] }));

  // Engajamento checkboxes
  if (item.engajamento?.length > 0) {
    const engOptions = ["Participaram ativamente", "Demonstraram interesse", "Houve resistência inicial", "Precisaram de estímulo constante", "Interagiram entre si"];
    children.push(new Paragraph({ spacing: { after: 100 }, children: [new TextRun({ text: "Engajamento:", bold: true, size: 20, font: "Arial" })] }));
    children.push(new Paragraph({ spacing: { after: 200 }, children: engOptions.flatMap(opt => checkbox(item.engajamento.includes(opt), opt)) }));
  }

  // Situações relevantes checkboxes
  if (item.situacoes_relevantes?.length > 0) {
    const sitOptions = ["Conflito entre participantes", "Avanço significativo", "Dificuldade de concentração", "Acolhimento emocional necessário", "Destaque positivo de participante"];
    children.push(new Paragraph({ spacing: { after: 100 }, children: [new TextRun({ text: "Situações Relevantes:", bold: true, size: 20, font: "Arial" })] }));
    children.push(new Paragraph({ spacing: { after: 200 }, children: sitOptions.flatMap(opt => checkbox(item.situacoes_relevantes.includes(opt), opt)) }));
  }

  // Competências com cores
  children.push(new Paragraph({ spacing: { before: 200, after: 100 }, children: [new TextRun({ text: "Competências — Score ELO", bold: true, size: 22, font: "Arial" })] }));
  const competencias = [
    { label: "Iniciativa", value: item.iniciativa },
    { label: "Autonomia", value: item.autonomia },
    { label: "Colaboração", value: item.colaboracao },
    { label: "Comunicação", value: item.comunicacao },
    { label: "Respeito Mútuo", value: item.respeito_mutuo },
  ];
  const compRows = competencias.map(c => new TableRow({
    children: [
      new TableCell({
        width: { size: 3000, type: WidthType.DXA }, borders, margins: cellMargins,
        children: [new Paragraph({ children: [new TextRun({ text: c.label, bold: true, size: 18, font: "Arial" })] })],
      }),
      new TableCell({
        width: { size: 1500, type: WidthType.DXA }, borders, margins: cellMargins,
        shading: c.value ? { fill: LIKERT_COLORS[c.value] || "FFFFFF", type: ShadingType.CLEAR } : undefined,
        children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [
          new TextRun({ text: c.value ? String(c.value) : "—", bold: true, size: 20, font: "Arial", color: c.value && c.value >= 3 ? "FFFFFF" : "000000" }),
        ]})],
      }),
      new TableCell({
        width: { size: 4860, type: WidthType.DXA }, borders, margins: cellMargins,
        children: [new Paragraph({ children: [new TextRun({ text: c.value ? LIKERT_LABELS[c.value] : "—", size: 18, font: "Arial" })] })],
      }),
    ],
  }));
  children.push(new Table({ width: { size: 9360, type: WidthType.DXA }, columnWidths: [3000, 1500, 4860], rows: compRows }));

  // Score ELO total
  children.push(new Paragraph({ spacing: { before: 100, after: 200 }, alignment: AlignmentType.RIGHT, children: [
    new TextRun({ text: `Score ELO: ${item.score_elo?.toFixed(2) || "—"}`, bold: true, size: 22, font: "Arial", color: ACCENT_COLOR }),
  ]}));

  // Resumo numbers
  children.push(new Table({
    width: { size: 9360, type: WidthType.DXA }, columnWidths: [3120, 3120, 3120],
    rows: [new TableRow({ children: [
      ...[{ l: "Presentes", v: item.num_participantes }, { l: "Ausentes", v: item.num_ausentes }, { l: "% Adesão", v: item.pct_adesao != null ? `${Number(item.pct_adesao).toFixed(0)}%` : "—" }].map(x =>
        new TableCell({ width: { size: 3120, type: WidthType.DXA }, borders, margins: cellMargins, children: [
          new Paragraph({ alignment: AlignmentType.CENTER, children: [
            new TextRun({ text: `${x.l}: `, size: 18, font: "Arial" }),
            new TextRun({ text: String(x.v ?? 0), bold: true, size: 20, font: "Arial" }),
          ]}),
        ]}),
      ),
    ]})]
  }));
  children.push(new Paragraph({ spacing: { after: 100 }, children: [] }));

  // Objetivo
  if (item.objetivo_alcancado) {
    const objLabels: Record<string, string> = { alcancado: "Alcançado", parcial: "Parcial", nao_alcancado: "Não Alcançado" };
    children.push(new Paragraph({ spacing: { after: 100 }, children: [
      new TextRun({ text: "Objetivo: ", bold: true, size: 18, font: "Arial" }),
      new TextRun({ text: objLabels[item.objetivo_alcancado] || item.objetivo_alcancado, size: 18, font: "Arial" }),
    ]}));
  }

  // Intervenções e Observações
  if (item.intervencoes) {
    children.push(new Paragraph({ spacing: { after: 50 }, children: [new TextRun({ text: "Intervenções:", bold: true, size: 18, font: "Arial" })] }));
    children.push(new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: item.intervencoes, size: 18, font: "Arial" })] }));
  }
  if (item.observacoes) {
    children.push(new Paragraph({ spacing: { after: 50 }, children: [new TextRun({ text: "Observações:", bold: true, size: 18, font: "Arial" })] }));
    children.push(new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: item.observacoes, size: 18, font: "Arial" })] }));
  }

  // Presença
  if (presenca.length > 0) {
    children.push(new Paragraph({ children: [new PageBreak()] }));
    children.push(new Paragraph({ spacing: { after: 100 }, children: [new TextRun({ text: "Lista de Presença", bold: true, size: 22, font: "Arial" })] }));
    const presRows = [
      new TableRow({ children: [
        new TableCell({ width: { size: 500, type: WidthType.DXA }, borders, margins: cellMargins, shading: { fill: HEADER_COLOR, type: ShadingType.CLEAR }, children: [new Paragraph({ children: [new TextRun({ text: "Nº", bold: true, size: 16, font: "Arial", color: "FFFFFF" })] })] }),
        new TableCell({ width: { size: 6360, type: WidthType.DXA }, borders, margins: cellMargins, shading: { fill: HEADER_COLOR, type: ShadingType.CLEAR }, children: [new Paragraph({ children: [new TextRun({ text: "Nome", bold: true, size: 16, font: "Arial", color: "FFFFFF" })] })] }),
        new TableCell({ width: { size: 1200, type: WidthType.DXA }, borders, margins: cellMargins, shading: { fill: HEADER_COLOR, type: ShadingType.CLEAR }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Presente", bold: true, size: 16, font: "Arial", color: "FFFFFF" })] })] }),
        new TableCell({ width: { size: 1300, type: WidthType.DXA }, borders, margins: cellMargins, shading: { fill: HEADER_COLOR, type: ShadingType.CLEAR }, children: [new Paragraph({ children: [new TextRun({ text: "Justificativa", bold: true, size: 16, font: "Arial", color: "FFFFFF" })] })] }),
      ]}),
      ...presenca.map((p, i) => new TableRow({ children: [
        new TableCell({ width: { size: 500, type: WidthType.DXA }, borders, margins: cellMargins, children: [new Paragraph({ children: [new TextRun({ text: String(i + 1), size: 16, font: "Arial" })] })] }),
        new TableCell({ width: { size: 6360, type: WidthType.DXA }, borders, margins: cellMargins, children: [new Paragraph({ children: [new TextRun({ text: p.participantes?.nome_completo || "", size: 16, font: "Arial" })] })] }),
        new TableCell({ width: { size: 1200, type: WidthType.DXA }, borders, margins: cellMargins, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: p.presente ? "✓" : "✗", size: 18, font: "Arial", bold: true, color: p.presente ? "43A047" : "E53935" })] })] }),
        new TableCell({ width: { size: 1300, type: WidthType.DXA }, borders, margins: cellMargins, children: [new Paragraph({ children: [new TextRun({ text: p.justificativa || "", size: 14, font: "Arial" })] })] }),
      ]})),
    ];
    children.push(new Table({ width: { size: 9360, type: WidthType.DXA }, columnWidths: [500, 6360, 1200, 1300], rows: presRows }));
  }

  const doc = new Document({
    styles: { default: { document: { run: { font: "Arial", size: 20 } } } },
    sections: [{ properties: { page: { margin: { top: 720, right: 720, bottom: 720, left: 720 } } }, children }],
  });
  const buffer = await Packer.toBuffer(doc);
  saveAs(new Blob([buffer]), `SysELO_Relatorio_${item.data || "sem-data"}.docx`);
}

export function exportRelatorioPdf(item: any, turmaNames: string[], presenca: any[]) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = 10;
  doc.setFontSize(10);
  doc.text("PREFEITURA MUNICIPAL DE MEDIANEIRA — SCFV/CAIA", 105, y, { align: "center" });
  y += 6;
  doc.setFontSize(14);
  doc.setTextColor(198, 40, 40);
  doc.text("RELATÓRIO DE ATIVIDADE", 105, y, { align: "center" });
  doc.setTextColor(0);
  y += 8;

  // Info
  const info = [
    ["Data", item.data ? format(new Date(item.data + "T12:00:00"), "dd/MM/yyyy") : "—"],
    ["Dia", item.dia_semana || "—"],
    ["Educador", item.profiles?.nome || "—"],
    ["Turma(s)", turmaNames.join(", ") || "—"],
    ["Tipo", item.tipo_atividade || "—"],
    ["Atividade", item.nome_atividade || "—"],
  ];
  autoTable(doc, {
    startY: y, body: info, styles: { fontSize: 8, cellPadding: 2 },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 30 } },
    theme: "grid",
  });
  y = (doc as any).lastAutoTable.finalY + 4;

  // Competências
  const comps = [
    ["Iniciativa", item.iniciativa], ["Autonomia", item.autonomia],
    ["Colaboração", item.colaboracao], ["Comunicação", item.comunicacao],
    ["Respeito Mútuo", item.respeito_mutuo],
  ];
  const colorMap: Record<number, [number, number, number]> = {
    1: [229, 57, 53], 2: [251, 140, 0], 3: [253, 216, 53], 4: [67, 160, 71], 5: [21, 101, 192],
  };
  autoTable(doc, {
    startY: y,
    head: [["Competência", "Valor", "Nível"]],
    body: comps.map(([l, v]) => [l, v || "—", v ? LIKERT_LABELS[v as number] : "—"]),
    headStyles: { fillColor: [26, 82, 118], fontSize: 8 },
    styles: { fontSize: 8, cellPadding: 2 },
    didParseCell: (data: any) => {
      if (data.section === "body" && data.column.index === 1) {
        const val = comps[data.row.index]?.[1] as number;
        if (val && colorMap[val]) {
          data.cell.styles.fillColor = colorMap[val];
          data.cell.styles.textColor = val >= 3 ? [255, 255, 255] : [0, 0, 0];
          data.cell.styles.fontStyle = "bold";
        }
      }
    },
  });
  y = (doc as any).lastAutoTable.finalY + 2;
  doc.setFontSize(10);
  doc.setTextColor(198, 40, 40);
  doc.text(`Score ELO: ${item.score_elo?.toFixed(2) || "—"}`, 200, y, { align: "right" });
  doc.setTextColor(0);
  y += 6;

  // Summary
  doc.setFontSize(8);
  doc.text(`Presentes: ${item.num_participantes ?? 0}  |  Ausentes: ${item.num_ausentes ?? 0}  |  Adesão: ${item.pct_adesao?.toFixed(0) ?? 0}%`, 14, y);
  y += 5;

  if (item.intervencoes) { doc.text("Intervenções: " + item.intervencoes, 14, y, { maxWidth: 180 }); y += 8; }
  if (item.observacoes) { doc.text("Observações: " + item.observacoes, 14, y, { maxWidth: 180 }); y += 8; }

  // Presença
  if (presenca.length > 0) {
    doc.addPage();
    doc.setFontSize(12);
    doc.text("Lista de Presença", 14, 15);
    autoTable(doc, {
      startY: 20,
      head: [["Nº", "Nome", "Presente", "Justificativa"]],
      body: presenca.map((p, i) => [i + 1, p.participantes?.nome_completo || "", p.presente ? "✓" : "✗", p.justificativa || ""]),
      headStyles: { fillColor: [26, 82, 118], fontSize: 7 },
      styles: { fontSize: 7, cellPadding: 1.5 },
    });
  }

  doc.save(`SysELO_Relatorio_${item.data || "sem-data"}.pdf`);
}

// ===== PLANEJAMENTO =====
export async function exportPlanejamentoDocx(item: any, turmaNames: string[]) {
  const children: any[] = [
    ...headerParagraphs(),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [
      new TextRun({ text: "REGISTRO DE PLANEJAMENTO", bold: true, size: 24, font: "Arial", color: ACCENT_COLOR }),
    ]}),
  ];

  const rows = [
    infoRow("Título", item.titulo),
    infoRow("Educador", item.profiles?.nome),
    infoRow("Data Aplicação", item.data_aplicacao ? format(new Date(item.data_aplicacao + "T12:00:00"), "dd/MM/yyyy") : ""),
    infoRow("Turma(s)", turmaNames.join(", ")),
    infoRow("Tema / Demanda", item.tema),
    infoRow("Questão Geradora", item.questao_geradora),
    infoRow("Objetivos Foco", item.objetivos),
    infoRow("Roteiro da Atividade", item.roteiro),
    infoRow("Materiais Necessários", item.materiais),
    infoRow("Apoio Técnico", item.apoio_tecnico),
  ];
  if (item.forma_avaliacao?.length > 0) {
    rows.push(infoRow("Formas de Avaliação", item.forma_avaliacao.join(", ")));
  }
  children.push(new Table({ width: { size: 9360, type: WidthType.DXA }, columnWidths: [2800, 6560], rows }));

  // Assinatura
  children.push(new Paragraph({ spacing: { before: 600 }, children: [] }));
  children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "________________________________", size: 18, font: "Arial" })] }));
  children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: item.profiles?.nome || "Educador", size: 18, font: "Arial" })] }));

  const doc = new Document({
    styles: { default: { document: { run: { font: "Arial", size: 20 } } } },
    sections: [{ properties: { page: { margin: { top: 720, right: 720, bottom: 720, left: 720 } } }, children }],
  });
  const buffer = await Packer.toBuffer(doc);
  saveAs(new Blob([buffer]), `SysELO_Planejamento_${item.titulo?.replace(/\s/g, "_") || "sem-titulo"}.docx`);
}

export function exportPlanejamentoPdf(item: any, turmaNames: string[]) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  doc.setFontSize(10);
  doc.text("PREFEITURA MUNICIPAL DE MEDIANEIRA — SCFV/CAIA", 105, 10, { align: "center" });
  doc.setFontSize(14);
  doc.setTextColor(198, 40, 40);
  doc.text("REGISTRO DE PLANEJAMENTO", 105, 18, { align: "center" });
  doc.setTextColor(0);

  const fields = [
    ["Título", item.titulo || "—"],
    ["Educador", item.profiles?.nome || "—"],
    ["Data Aplicação", item.data_aplicacao ? format(new Date(item.data_aplicacao + "T12:00:00"), "dd/MM/yyyy") : "—"],
    ["Turma(s)", turmaNames.join(", ") || "—"],
    ["Tema / Demanda", item.tema || "—"],
    ["Questão Geradora", item.questao_geradora || "—"],
    ["Objetivos Foco", item.objetivos || "—"],
    ["Roteiro", item.roteiro || "—"],
    ["Materiais", item.materiais || "—"],
    ["Apoio Técnico", item.apoio_tecnico || "—"],
    ["Avaliação", item.forma_avaliacao?.join(", ") || "—"],
  ];
  autoTable(doc, {
    startY: 24, body: fields, theme: "grid",
    styles: { fontSize: 8, cellPadding: 3 },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 35 } },
  });

  doc.save(`SysELO_Planejamento_${item.titulo?.replace(/\s/g, "_") || "sem-titulo"}.pdf`);
}

// ===== FICHA DE INSCRIÇÃO =====
export async function exportFichaInscricaoDocx(p: any) {
  const children: any[] = [
    ...headerParagraphs(),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [
      new TextRun({ text: "FICHA DE INSCRIÇÃO E CADASTRO", bold: true, size: 24, font: "Arial", color: ACCENT_COLOR }),
    ]}),
  ];

  const rows = [
    infoRow("Nome Completo", p.nome_completo),
    infoRow("Data de Nascimento", p.data_nascimento),
    infoRow("Gênero", p.genero),
    infoRow("Cor/Raça", p.cor_raca),
    infoRow("Período", p.periodo),
    infoRow("Status", p.status),
    infoRow("Escola", p.escola),
    infoRow("Série", p.serie),
    infoRow("Endereço", `${p.endereco_rua || ""} ${p.endereco_numero ? "Nº " + p.endereco_numero : ""}`),
    infoRow("Bairro", p.endereco_bairro),
    infoRow("UF Origem", p.uf_origem),
    infoRow("Sit. Moradia", p.situacao_moradia),
    infoRow("Responsável 1", p.responsavel1_nome),
    infoRow("CPF Resp. 1", p.responsavel1_cpf),
    infoRow("WhatsApp Resp. 1", p.responsavel1_whatsapp),
    infoRow("Responsável 2", p.responsavel2_nome),
    infoRow("WhatsApp Resp. 2", p.responsavel2_whatsapp),
    infoRow("Origem/Encaminhamento", p.origem_encaminhamento),
    infoRow("Resp. Técnico", p.responsavel_tecnico),
    infoRow("Vulnerabilidade", p.categoria_vulnerabilidade),
    infoRow("Início SCFV", p.iniciou_em),
    infoRow("Restrição Alimentar", p.restricao_alimentar),
    infoRow("Laudo", p.laudo),
  ];
  children.push(new Table({ width: { size: 9360, type: WidthType.DXA }, columnWidths: [2800, 6560], rows }));

  // Assinaturas
  children.push(new Paragraph({ spacing: { before: 600 }, children: [] }));
  children.push(new Paragraph({ alignment: AlignmentType.LEFT, children: [
    new TextRun({ text: "________________________________                    ________________________________", size: 18, font: "Arial" }),
  ]}));
  children.push(new Paragraph({ alignment: AlignmentType.LEFT, children: [
    new TextRun({ text: "Responsável                                                        Coordenação SCFV", size: 16, font: "Arial" }),
  ]}));

  const doc = new Document({
    styles: { default: { document: { run: { font: "Arial", size: 20 } } } },
    sections: [{ properties: { page: { margin: { top: 720, right: 720, bottom: 720, left: 720 } } }, children }],
  });
  const buffer = await Packer.toBuffer(doc);
  saveAs(new Blob([buffer]), `SysELO_FichaInscricao_${p.nome_completo?.replace(/\s/g, "_") || "participante"}.docx`);
}

export function exportFichaInscricaoPdf(p: any) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  doc.setFontSize(10);
  doc.text("PREFEITURA MUNICIPAL DE MEDIANEIRA — SCFV/CAIA", 105, 10, { align: "center" });
  doc.setFontSize(14);
  doc.setTextColor(198, 40, 40);
  doc.text("FICHA DE INSCRIÇÃO E CADASTRO", 105, 18, { align: "center" });
  doc.setTextColor(0);

  const fields = [
    ["Nome Completo", p.nome_completo || "—"],
    ["Nascimento", p.data_nascimento || "—"],
    ["Gênero", p.genero || "—"],
    ["Cor/Raça", p.cor_raca || "—"],
    ["Período", p.periodo || "—"],
    ["Status", p.status || "—"],
    ["Escola", p.escola || "—"],
    ["Série", p.serie || "—"],
    ["Endereço", `${p.endereco_rua || ""} ${p.endereco_numero ? "Nº " + p.endereco_numero : ""}`],
    ["Bairro", p.endereco_bairro || "—"],
    ["UF Origem", p.uf_origem || "—"],
    ["Sit. Moradia", p.situacao_moradia || "—"],
    ["Responsável 1", p.responsavel1_nome || "—"],
    ["CPF Resp. 1", p.responsavel1_cpf || "—"],
    ["WhatsApp 1", p.responsavel1_whatsapp || "—"],
    ["Responsável 2", p.responsavel2_nome || "—"],
    ["WhatsApp 2", p.responsavel2_whatsapp || "—"],
    ["Origem", p.origem_encaminhamento || "—"],
    ["Resp. Técnico", p.responsavel_tecnico || "—"],
    ["Vulnerabilidade", p.categoria_vulnerabilidade || "—"],
    ["Início SCFV", p.iniciou_em || "—"],
    ["Restr. Alimentar", p.restricao_alimentar || "—"],
    ["Laudo", p.laudo || "—"],
  ];
  autoTable(doc, {
    startY: 24, body: fields, theme: "grid",
    styles: { fontSize: 8, cellPadding: 2.5 },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 35 } },
  });

  doc.save(`SysELO_FichaInscricao_${p.nome_completo?.replace(/\s/g, "_") || "participante"}.pdf`);
}

// ===== MATRIZ DE FREQUÊNCIA =====
export async function exportMatrizFrequenciaDocx(
  turma: any, participantes: { nome: string; presencas: Record<string, boolean> }[], datas: string[], preenchida: boolean
) {
  const dateHeaders = datas.map(d => format(new Date(d + "T12:00:00"), "dd/MM"));
  const numColWidth = 400;
  const nameColWidth = 4000;
  const dateColWidth = Math.min(800, Math.floor((15840 - 1440 - numColWidth - nameColWidth) / Math.max(datas.length, 1)));
  const totalWidth = numColWidth + nameColWidth + dateColWidth * datas.length;

  const headerRow = new TableRow({ children: [
    new TableCell({ width: { size: numColWidth, type: WidthType.DXA }, borders, margins: cellMargins, shading: { fill: HEADER_COLOR, type: ShadingType.CLEAR }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Nº", bold: true, size: 14, font: "Arial", color: "FFFFFF" })] })] }),
    new TableCell({ width: { size: nameColWidth, type: WidthType.DXA }, borders, margins: cellMargins, shading: { fill: HEADER_COLOR, type: ShadingType.CLEAR }, children: [new Paragraph({ children: [new TextRun({ text: "Nome do Participante", bold: true, size: 14, font: "Arial", color: "FFFFFF" })] })] }),
    ...dateHeaders.map((d, i) => new TableCell({
      width: { size: dateColWidth, type: WidthType.DXA }, borders, margins: cellMargins,
      shading: { fill: HEADER_COLOR, type: ShadingType.CLEAR },
      children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: d, bold: true, size: 12, font: "Arial", color: "FFFFFF" })] })],
    })),
  ]});

  const dataRows = participantes.map((p, i) => new TableRow({ children: [
    new TableCell({ width: { size: numColWidth, type: WidthType.DXA }, borders, margins: cellMargins, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: String(i + 1), size: 14, font: "Arial" })] })] }),
    new TableCell({ width: { size: nameColWidth, type: WidthType.DXA }, borders, margins: cellMargins, children: [new Paragraph({ children: [new TextRun({ text: p.nome, size: 14, font: "Arial" })] })] }),
    ...datas.map(d => new TableCell({
      width: { size: dateColWidth, type: WidthType.DXA }, borders, margins: cellMargins,
      children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [
        new TextRun({ text: preenchida ? (p.presencas[d] ? "✓" : "") : "", size: 14, font: "Arial" }),
      ]})],
    })),
  ]}));

  const children = [
    ...headerParagraphs(),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 100 }, children: [
      new TextRun({ text: "LISTA DE FREQUÊNCIA", bold: true, size: 22, font: "Arial", color: ACCENT_COLOR }),
    ]}),
    new Paragraph({ spacing: { after: 100 }, children: [
      new TextRun({ text: `Turma: ${turma.nome}  |  Período: ${turma.periodo || "—"}  |  Faixa Etária: ${turma.faixa_etaria || "—"}`, size: 18, font: "Arial" }),
    ]}),
    new Paragraph({ spacing: { after: 200 }, children: [
      new TextRun({ text: `Exportado em: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, size: 16, font: "Arial", italics: true }),
    ]}),
    new Table({
      width: { size: totalWidth, type: WidthType.DXA },
      columnWidths: [numColWidth, nameColWidth, ...datas.map(() => dateColWidth)],
      rows: [headerRow, ...dataRows],
    }),
    new Paragraph({ spacing: { before: 400 }, children: [] }),
    new Paragraph({ children: [new TextRun({ text: "________________________________", size: 18, font: "Arial" })] }),
    new Paragraph({ children: [new TextRun({ text: "Assinatura do Educador", size: 16, font: "Arial" })] }),
  ];

  const doc = new Document({
    styles: { default: { document: { run: { font: "Arial", size: 16 } } } },
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838, orientation: PageOrientation.LANDSCAPE },
          margin: { top: 500, right: 500, bottom: 500, left: 500 },
        },
      },
      children,
    }],
  });
  const buffer = await Packer.toBuffer(doc);
  saveAs(new Blob([buffer]), `SysELO_Frequencia_${turma.nome?.replace(/\s/g, "_")}_${preenchida ? "preenchida" : "branco"}.docx`);
}

export function exportMatrizFrequenciaPdf(
  turma: any, participantes: { nome: string; presencas: Record<string, boolean> }[], datas: string[], preenchida: boolean
) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  doc.setFontSize(9);
  doc.text("PREFEITURA MUNICIPAL DE MEDIANEIRA — SCFV/CAIA", 148, 8, { align: "center" });
  doc.setFontSize(12);
  doc.setTextColor(198, 40, 40);
  doc.text("LISTA DE FREQUÊNCIA", 148, 14, { align: "center" });
  doc.setTextColor(0);
  doc.setFontSize(8);
  doc.text(`Turma: ${turma.nome}  |  Período: ${turma.periodo || "—"}  |  Faixa: ${turma.faixa_etaria || "—"}  |  Exportado: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, 14, 20);

  const dateHeaders = datas.map(d => format(new Date(d + "T12:00:00"), "dd/MM"));
  autoTable(doc, {
    startY: 24,
    head: [["Nº", "Nome", ...dateHeaders]],
    body: participantes.map((p, i) => [
      i + 1, p.nome,
      ...datas.map(d => preenchida ? (p.presencas[d] ? "✓" : "") : ""),
    ]),
    headStyles: { fillColor: [26, 82, 118], fontSize: 6, cellPadding: 1.5 },
    styles: { fontSize: 6, cellPadding: 1.5 },
    columnStyles: { 0: { cellWidth: 8 }, 1: { cellWidth: 40 } },
  });

  doc.save(`SysELO_Frequencia_${turma.nome?.replace(/\s/g, "_")}_${preenchida ? "preenchida" : "branco"}.pdf`);
}
