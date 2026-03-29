import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, PageOrientation, BorderStyle, WidthType,
  ShadingType, PageBreak, HeadingLevel, LevelFormat,
} from "docx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { saveAs } from "file-saver";
import { format } from "date-fns";
import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// ===== TEMPLATE CACHE =====
const templateCache: Record<string, ArrayBuffer> = {};

async function loadTemplate(templateName: string): Promise<ArrayBuffer | null> {
  if (templateCache[templateName]) return templateCache[templateName];
  try {
    const { data, error } = await supabase.storage.from("templates").download(templateName);
    if (error || !data) return null;
    const buffer = await data.arrayBuffer();
    templateCache[templateName] = buffer;
    return buffer;
  } catch {
    return null;
  }
}

/**
 * Clean XML runs inside the DOCX zip so that delimiter tags like <<TAG>>
 * that Word may have split across multiple <w:r> elements are merged back
 * into a single run. This ensures docxtemplater can recognise them.
 */
function cleanXmlRuns(zip: PizZip): void {
  const xmlFiles = Object.keys(zip.files).filter(f => f.endsWith(".xml"));
  const delimiterRegex = /<<|>>/g;

  for (const fileName of xmlFiles) {
    let content = zip.file(fileName)?.asText();
    if (!content || (!content.includes("<<") && !content.includes("&lt;&lt;"))) continue;

    // Merge runs: find sequences where a delimiter tag is split across
    // multiple <w:t> elements within the same paragraph and collapse them.
    // Strategy: strip </w:t></w:r><w:r><w:t> (and variants with <w:rPr>)
    // between fragments of the same tag.
    // We work on the raw XML: replace encoded delimiters first.
    content = content.replace(/&lt;&lt;/g, "<<").replace(/&gt;&gt;/g, ">>");

    // Remove run boundaries inside incomplete delimiter expressions.
    // Pattern: </w:t></w:r><w:r [optional rPr]><w:t [optional attrs]> between << and >>
    const runBoundary = /<\/w:t>\s*<\/w:r>\s*<w:r(?:\s[^>]*)?>(?:\s*<w:rPr>[\s\S]*?<\/w:rPr>)?\s*<w:t(?:\s[^>]*)?>/g;

    // Iteratively clean until stable (max 10 passes for safety)
    for (let pass = 0; pass < 10; pass++) {
      let changed = false;
      // Find all partial tag sequences and merge their runs
      content = content.replace(
        /(<<[^>]*?)(<\/w:t>\s*<\/w:r>\s*<w:r(?:\s[^>]*)?>(?:\s*<w:rPr>[\s\S]*?<\/w:rPr>)?\s*<w:t(?:\s[^>]*)?>)([\s\S]*?>>)/g,
        (_match, before, _boundary, after) => {
          changed = true;
          return before + after;
        }
      );
      if (!changed) break;
    }

    zip.file(fileName, content);
  }
}

function fillTemplate(templateBuffer: ArrayBuffer, data: Record<string, any>): Blob {
  const zip = new PizZip(templateBuffer);

  // Clean fragmented XML runs before docxtemplater processes the template
  cleanXmlRuns(zip);

  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: { start: "<<", end: ">>" },
  });

  try {
    doc.render(data);
  } catch (e: any) {
    console.error("Docxtemplater render error:", e);
    // Log which tags were expected vs found for debugging
    if (e.properties?.errors) {
      console.error("Tag errors:", e.properties.errors.map((err: any) => err.properties?.id || err.message));
    }
    throw e;
  }

  const out = doc.getZip().generate({
    type: "blob",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
  return out;
}

function fileTimestamp(): string {
  return format(new Date(), "yyyy-MM-dd_HHmmss");
}

// ===== SHARED CONSTANTS (fallback) =====
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
        width: { size: 2800, type: WidthType.DXA }, borders, margins: cellMargins,
        shading: { fill: LIGHT_BG, type: ShadingType.CLEAR },
        children: [new Paragraph({ children: [new TextRun({ text: label, bold: true, size: 18, font: "Arial" })] })],
      }),
      new TableCell({
        width: { size: 6560, type: WidthType.DXA }, borders, margins: cellMargins,
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

// ===== PDF HELPERS =====
function pdfHeader(doc: jsPDF, y: number): number {
  doc.setFontSize(10); doc.setFont("helvetica", "bold");
  doc.text("PREFEITURA MUNICIPAL DE MEDIANEIRA", 105, y, { align: "center" });
  y += 4; doc.setFont("helvetica", "normal"); doc.setFontSize(9);
  doc.text("SECRETARIA DE ASSISTÊNCIA SOCIAL", 105, y, { align: "center" });
  y += 4;
  doc.text("CAIA — Centro de Atendimento Integrado ao Adolescente", 105, y, { align: "center" });
  y += 4; doc.setFont("helvetica", "italic"); doc.setFontSize(8);
  doc.text("Serviço de Convivência e Fortalecimento de Vínculos — SCFV", 105, y, { align: "center" });
  y += 6; doc.setFont("helvetica", "normal");
  return y;
}

function pdfTitle(doc: jsPDF, title: string, y: number): number {
  doc.setFontSize(13); doc.setTextColor(198, 40, 40); doc.setFont("helvetica", "bold");
  doc.text(title, 105, y, { align: "center" });
  doc.setTextColor(0); doc.setFont("helvetica", "normal");
  return y + 8;
}

// ===== RELATÓRIO DE ATIVIDADE =====

function buildRelatorioTemplateData(item: any, turmaNames: string[], presenca: any[]) {
  const engOptions = ["Participaram ativamente", "Demonstraram interesse", "Houve resistência inicial", "Precisaram de estímulo constante", "Interagiram entre si"];
  const sitOptions = ["Conflito entre participantes", "Avanço significativo", "Dificuldade de concentração", "Acolhimento emocional necessário", "Destaque positivo de participante"];
  const objLabels: Record<string, string> = { alcancado: "Alcançado", parcial: "Parcial", nao_alcancado: "Não Alcançado" };

  return {
    DATA: item.data ? format(new Date(item.data + "T12:00:00"), "dd/MM/yyyy") : "—",
    DIA_SEMANA: item.dia_semana || "—",
    EDUCADOR: item.profiles?.nome || "—",
    TURMAS: turmaNames.join(", ") || "—",
    TIPO_ATIVIDADE: item.tipo_atividade || "—",
    NOME_ATIVIDADE: item.nome_atividade || "—",
    // Engajamento checkboxes
    ...Object.fromEntries(engOptions.map((opt, i) => [`ENG_${i + 1}`, item.engajamento?.includes(opt) ? "☑" : "☐"])),
    ENG_1_LABEL: engOptions[0], ENG_2_LABEL: engOptions[1], ENG_3_LABEL: engOptions[2], ENG_4_LABEL: engOptions[3], ENG_5_LABEL: engOptions[4],
    // Situações checkboxes
    ...Object.fromEntries(sitOptions.map((opt, i) => [`SIT_${i + 1}`, item.situacoes_relevantes?.includes(opt) ? "☑" : "☐"])),
    SIT_1_LABEL: sitOptions[0], SIT_2_LABEL: sitOptions[1], SIT_3_LABEL: sitOptions[2], SIT_4_LABEL: sitOptions[3], SIT_5_LABEL: sitOptions[4],
    // Competências
    INICIATIVA: item.iniciativa || "—",
    INICIATIVA_LABEL: item.iniciativa ? LIKERT_LABELS[item.iniciativa] : "—",
    AUTONOMIA: item.autonomia || "—",
    AUTONOMIA_LABEL: item.autonomia ? LIKERT_LABELS[item.autonomia] : "—",
    COLABORACAO: item.colaboracao || "—",
    COLABORACAO_LABEL: item.colaboracao ? LIKERT_LABELS[item.colaboracao] : "—",
    COMUNICACAO: item.comunicacao || "—",
    COMUNICACAO_LABEL: item.comunicacao ? LIKERT_LABELS[item.comunicacao] : "—",
    RESPEITO_MUTUO: item.respeito_mutuo || "—",
    RESPEITO_MUTUO_LABEL: item.respeito_mutuo ? LIKERT_LABELS[item.respeito_mutuo] : "—",
    SCORE_ELO: item.score_elo?.toFixed(2) || "—",
    // Resumo
    NUM_PRESENTES: item.num_participantes ?? 0,
    NUM_AUSENTES: item.num_ausentes ?? 0,
    PCT_ADESAO: item.pct_adesao != null ? `${Number(item.pct_adesao).toFixed(0)}%` : "—",
    OBJETIVO: item.objetivo_alcancado ? (objLabels[item.objetivo_alcancado] || item.objetivo_alcancado) : "—",
    INTERVENCOES: item.intervencoes || "—",
    OBSERVACOES: item.observacoes || "—",
    // Presença loop
    PRESENCA: presenca.map((p, i) => ({
      NUM: i + 1,
      NOME: p.participantes?.nome_completo || "",
      STATUS: p.presente ? "✓" : "✗",
      JUSTIFICATIVA: p.justificativa || "",
    })),
    HAS_PRESENCA: presenca.length > 0,
    HAS_INTERVENCOES: !!item.intervencoes,
    HAS_OBSERVACOES: !!item.observacoes,
  };
}

export async function exportRelatorioDocx(item: any, turmaNames: string[], presenca: any[], fotos: any[]) {
  const template = await loadTemplate("relatorio.docx");
  
  if (template) {
    // Template-based export
    const data = buildRelatorioTemplateData(item, turmaNames, presenca);
    const blob = fillTemplate(template, data);
    saveAs(blob, `SysELO_Relatorio_${fileTimestamp()}.docx`);
    return;
  }

  // Fallback: generate from scratch
  const children: any[] = [
    ...headerParagraphs(),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [
      new TextRun({ text: "RELATÓRIO DE ATIVIDADE", bold: true, size: 24, font: "Arial", color: ACCENT_COLOR }),
    ]}),
  ];

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

  if (item.engajamento?.length > 0) {
    const engOptions = ["Participaram ativamente", "Demonstraram interesse", "Houve resistência inicial", "Precisaram de estímulo constante", "Interagiram entre si"];
    children.push(new Paragraph({ spacing: { after: 100 }, children: [new TextRun({ text: "Engajamento:", bold: true, size: 20, font: "Arial" })] }));
    children.push(new Paragraph({ spacing: { after: 200 }, children: engOptions.flatMap(opt => checkbox(item.engajamento.includes(opt), opt)) }));
  }

  if (item.situacoes_relevantes?.length > 0) {
    const sitOptions = ["Conflito entre participantes", "Avanço significativo", "Dificuldade de concentração", "Acolhimento emocional necessário", "Destaque positivo de participante"];
    children.push(new Paragraph({ spacing: { after: 100 }, children: [new TextRun({ text: "Situações Relevantes:", bold: true, size: 20, font: "Arial" })] }));
    children.push(new Paragraph({ spacing: { after: 200 }, children: sitOptions.flatMap(opt => checkbox(item.situacoes_relevantes.includes(opt), opt)) }));
  }

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
      new TableCell({ width: { size: 3000, type: WidthType.DXA }, borders, margins: cellMargins, children: [new Paragraph({ children: [new TextRun({ text: c.label, bold: true, size: 18, font: "Arial" })] })] }),
      new TableCell({ width: { size: 1500, type: WidthType.DXA }, borders, margins: cellMargins, shading: c.value ? { fill: LIKERT_COLORS[c.value] || "FFFFFF", type: ShadingType.CLEAR } : undefined, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: c.value ? String(c.value) : "—", bold: true, size: 20, font: "Arial", color: c.value && c.value >= 3 ? "FFFFFF" : "000000" })] })] }),
      new TableCell({ width: { size: 4860, type: WidthType.DXA }, borders, margins: cellMargins, children: [new Paragraph({ children: [new TextRun({ text: c.value ? LIKERT_LABELS[c.value] : "—", size: 18, font: "Arial" })] })] }),
    ],
  }));
  children.push(new Table({ width: { size: 9360, type: WidthType.DXA }, columnWidths: [3000, 1500, 4860], rows: compRows }));
  children.push(new Paragraph({ spacing: { before: 100, after: 200 }, alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `Score ELO: ${item.score_elo?.toFixed(2) || "—"}`, bold: true, size: 22, font: "Arial", color: ACCENT_COLOR })] }));

  children.push(new Table({
    width: { size: 9360, type: WidthType.DXA }, columnWidths: [3120, 3120, 3120],
    rows: [new TableRow({ children: [
      ...[{ l: "Presentes", v: item.num_participantes }, { l: "Ausentes", v: item.num_ausentes }, { l: "% Adesão", v: item.pct_adesao != null ? `${Number(item.pct_adesao).toFixed(0)}%` : "—" }].map(x =>
        new TableCell({ width: { size: 3120, type: WidthType.DXA }, borders, margins: cellMargins, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${x.l}: `, size: 18, font: "Arial" }), new TextRun({ text: String(x.v ?? 0), bold: true, size: 20, font: "Arial" })] })] }),
      ),
    ]})]
  }));
  children.push(new Paragraph({ spacing: { after: 100 }, children: [] }));

  if (item.objetivo_alcancado) {
    const objLabels: Record<string, string> = { alcancado: "Alcançado", parcial: "Parcial", nao_alcancado: "Não Alcançado" };
    children.push(new Paragraph({ spacing: { after: 100 }, children: [new TextRun({ text: "Objetivo: ", bold: true, size: 18, font: "Arial" }), new TextRun({ text: objLabels[item.objetivo_alcancado] || item.objetivo_alcancado, size: 18, font: "Arial" })] }));
  }

  if (item.intervencoes) {
    children.push(new Paragraph({ spacing: { after: 50 }, children: [new TextRun({ text: "Intervenções:", bold: true, size: 18, font: "Arial" })] }));
    children.push(new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: item.intervencoes, size: 18, font: "Arial" })] }));
  }
  if (item.observacoes) {
    children.push(new Paragraph({ spacing: { after: 50 }, children: [new TextRun({ text: "Observações:", bold: true, size: 18, font: "Arial" })] }));
    children.push(new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: item.observacoes, size: 18, font: "Arial" })] }));
  }

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
  saveAs(new Blob([new Uint8Array(buffer)]), `SysELO_Relatorio_${fileTimestamp()}.docx`);
}

export async function exportRelatorioPdf(item: any, turmaNames: string[], presenca: any[]) {
  // Try template-based approach first — generates filled DOCX since browser can't convert to PDF
  const template = await loadTemplate("relatorio.docx");
  if (template) {
    try {
      const data = buildRelatorioTemplateData(item, turmaNames, presenca);
      const blob = fillTemplate(template, data);
      saveAs(blob, `SysELO_Relatorio_${fileTimestamp()}.docx`);
      toast.info("O modelo institucional foi exportado em DOCX. Para converter em PDF, abra no Word e salve como PDF.");
      return;
    } catch (e) {
      console.error("Template fill failed, using jsPDF fallback:", e);
    }
  }

  // jsPDF fallback (simplified layout)
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = pdfHeader(doc, 10);
  y = pdfTitle(doc, "RELATÓRIO DE ATIVIDADE", y);

  const info = [
    ["Data", item.data ? format(new Date(item.data + "T12:00:00"), "dd/MM/yyyy") : "—"],
    ["Dia da Semana", item.dia_semana || "—"],
    ["Educador", item.profiles?.nome || "—"],
    ["Turma(s)", turmaNames.join(", ") || "—"],
    ["Tipo de Atividade", item.tipo_atividade || "—"],
    ["Nome da Atividade", item.nome_atividade || "—"],
  ];
  autoTable(doc, {
    startY: y, body: info, theme: "grid",
    styles: { fontSize: 8, cellPadding: 2 },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 35, fillColor: [245, 245, 245] } },
  });
  y = (doc as any).lastAutoTable.finalY + 4;

  // Engajamento checkboxes
  const engOptions = ["Participaram ativamente", "Demonstraram interesse", "Houve resistência inicial", "Precisaram de estímulo constante", "Interagiram entre si"];
  doc.setFontSize(9); doc.setFont("helvetica", "bold");
  doc.text("Engajamento:", 14, y); y += 4; doc.setFont("helvetica", "normal"); doc.setFontSize(8);
  doc.text(engOptions.map(opt => `${item.engajamento?.includes(opt) ? "☑" : "☐"} ${opt}`).join("   "), 14, y, { maxWidth: 180 });
  y += 6;

  // Situações
  const sitOptions = ["Conflito entre participantes", "Avanço significativo", "Dificuldade de concentração", "Acolhimento emocional necessário", "Destaque positivo de participante"];
  doc.setFontSize(9); doc.setFont("helvetica", "bold");
  doc.text("Situações Relevantes:", 14, y); y += 4; doc.setFont("helvetica", "normal"); doc.setFontSize(8);
  doc.text(sitOptions.map(opt => `${item.situacoes_relevantes?.includes(opt) ? "☑" : "☐"} ${opt}`).join("   "), 14, y, { maxWidth: 180 });
  y += 8;

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
    columnStyles: { 0: { cellWidth: 40 }, 1: { cellWidth: 20, halign: "center" } },
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
  doc.setFontSize(10); doc.setTextColor(198, 40, 40); doc.setFont("helvetica", "bold");
  doc.text(`Score ELO: ${item.score_elo?.toFixed(2) || "—"}`, 196, y, { align: "right" });
  doc.setTextColor(0); doc.setFont("helvetica", "normal"); y += 6;

  // Summary
  autoTable(doc, {
    startY: y,
    body: [["Presentes", String(item.num_participantes ?? 0), "Ausentes", String(item.num_ausentes ?? 0), "% Adesão", item.pct_adesao != null ? `${Number(item.pct_adesao).toFixed(0)}%` : "—"]],
    theme: "grid", styles: { fontSize: 8, cellPadding: 2, halign: "center" },
    columnStyles: { 0: { fontStyle: "bold", fillColor: [245, 245, 245] }, 2: { fontStyle: "bold", fillColor: [245, 245, 245] }, 4: { fontStyle: "bold", fillColor: [245, 245, 245] } },
  });
  y = (doc as any).lastAutoTable.finalY + 4;

  const objLabels: Record<string, string> = { alcancado: "Alcançado", parcial: "Parcial", nao_alcancado: "Não Alcançado" };
  if (item.objetivo_alcancado) {
    doc.setFontSize(8); doc.setFont("helvetica", "bold");
    doc.text("Objetivo: ", 14, y); doc.setFont("helvetica", "normal");
    doc.text(objLabels[item.objetivo_alcancado] || item.objetivo_alcancado, 34, y); y += 5;
  }

  if (item.intervencoes) {
    doc.setFontSize(8); doc.setFont("helvetica", "bold"); doc.text("Intervenções:", 14, y); y += 4;
    doc.setFont("helvetica", "normal"); doc.text(item.intervencoes, 14, y, { maxWidth: 180 });
    y += Math.ceil(item.intervencoes.length / 90) * 4 + 3;
  }
  if (item.observacoes) {
    doc.setFontSize(8); doc.setFont("helvetica", "bold"); doc.text("Observações:", 14, y); y += 4;
    doc.setFont("helvetica", "normal"); doc.text(item.observacoes, 14, y, { maxWidth: 180 });
    y += Math.ceil(item.observacoes.length / 90) * 4 + 3;
  }

  // Presença
  if (presenca.length > 0) {
    doc.addPage();
    let py = pdfHeader(doc, 10);
    doc.setFontSize(11); doc.setFont("helvetica", "bold");
    doc.text("Lista de Presença", 105, py, { align: "center" }); py += 5;
    autoTable(doc, {
      startY: py,
      head: [["Nº", "Nome", "Presente", "Justificativa"]],
      body: presenca.map((p, i) => [i + 1, p.participantes?.nome_completo || "", p.presente ? "✓" : "✗", p.justificativa || ""]),
      headStyles: { fillColor: [26, 82, 118], fontSize: 7 },
      styles: { fontSize: 7, cellPadding: 1.5 },
      columnStyles: { 0: { cellWidth: 8 }, 2: { cellWidth: 15, halign: "center" } },
    });
  }

  doc.save(`SysELO_Relatorio_${fileTimestamp()}.pdf`);
}

// ===== PLANEJAMENTO =====

function buildPlanejamentoTemplateData(item: any, turmaNames: string[]) {
  return {
    TITULO: item.titulo || "—",
    EDUCADOR: item.profiles?.nome || "—",
    DATA_APLICACAO: item.data_aplicacao ? format(new Date(item.data_aplicacao + "T12:00:00"), "dd/MM/yyyy") : "—",
    TURMAS: turmaNames.join(", ") || "—",
    TEMA: item.tema || "—",
    QUESTAO_GERADORA: item.questao_geradora || "—",
    OBJETIVOS: item.objetivos || "—",
    ROTEIRO: item.roteiro || "—",
    MATERIAIS: item.materiais || "—",
    APOIO_TECNICO: item.apoio_tecnico || "—",
    FORMA_AVALIACAO: item.forma_avaliacao?.join(", ") || "—",
  };
}

export async function exportPlanejamentoDocx(item: any, turmaNames: string[]) {
  const template = await loadTemplate("planejamento.docx");

  if (template) {
    const data = buildPlanejamentoTemplateData(item, turmaNames);
    const blob = fillTemplate(template, data);
    saveAs(blob, `SysELO_Planejamento_${fileTimestamp()}.docx`);
    return;
  }

  // Fallback
  const children: any[] = [
    ...headerParagraphs(),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [new TextRun({ text: "REGISTRO DE PLANEJAMENTO", bold: true, size: 24, font: "Arial", color: ACCENT_COLOR })] }),
  ];
  const rows = [
    infoRow("Título", item.titulo), infoRow("Educador", item.profiles?.nome),
    infoRow("Data Aplicação", item.data_aplicacao ? format(new Date(item.data_aplicacao + "T12:00:00"), "dd/MM/yyyy") : ""),
    infoRow("Turma(s)", turmaNames.join(", ")), infoRow("Tema / Demanda", item.tema),
    infoRow("Questão Geradora", item.questao_geradora), infoRow("Objetivos Foco", item.objetivos),
    infoRow("Roteiro da Atividade", item.roteiro), infoRow("Materiais Necessários", item.materiais),
    infoRow("Apoio Técnico", item.apoio_tecnico),
  ];
  if (item.forma_avaliacao?.length > 0) rows.push(infoRow("Formas de Avaliação", item.forma_avaliacao.join(", ")));
  children.push(new Table({ width: { size: 9360, type: WidthType.DXA }, columnWidths: [2800, 6560], rows }));
  children.push(new Paragraph({ spacing: { before: 600 }, children: [] }));
  children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "________________________________", size: 18, font: "Arial" })] }));
  children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: item.profiles?.nome || "Educador", size: 18, font: "Arial" })] }));

  const doc = new Document({ styles: { default: { document: { run: { font: "Arial", size: 20 } } } }, sections: [{ properties: { page: { margin: { top: 720, right: 720, bottom: 720, left: 720 } } }, children }] });
  const buffer = await Packer.toBuffer(doc);
  saveAs(new Blob([new Uint8Array(buffer)]), `SysELO_Planejamento_${fileTimestamp()}.docx`);
}

export async function exportPlanejamentoPdf(item: any, turmaNames: string[]) {
  const template = await loadTemplate("planejamento.docx");
  if (template) {
    try {
      const data = buildPlanejamentoTemplateData(item, turmaNames);
      const blob = fillTemplate(template, data);
      saveAs(blob, `SysELO_Planejamento_${fileTimestamp()}.docx`);
      toast.info("O modelo institucional foi exportado em DOCX. Para converter em PDF, abra no Word e salve como PDF.");
      return;
    } catch (e) {
      console.error("Template fill failed, using jsPDF fallback:", e);
    }
  }

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = pdfHeader(doc, 10);
  y = pdfTitle(doc, "REGISTRO DE PLANEJAMENTO", y);

  const fields = [
    ["Título", item.titulo || "—"], ["Educador", item.profiles?.nome || "—"],
    ["Data Aplicação", item.data_aplicacao ? format(new Date(item.data_aplicacao + "T12:00:00"), "dd/MM/yyyy") : "—"],
    ["Turma(s)", turmaNames.join(", ") || "—"], ["Tema / Demanda", item.tema || "—"],
    ["Questão Geradora", item.questao_geradora || "—"], ["Objetivos Foco", item.objetivos || "—"],
    ["Roteiro", item.roteiro || "—"], ["Materiais", item.materiais || "—"],
    ["Apoio Técnico", item.apoio_tecnico || "—"], ["Avaliação", item.forma_avaliacao?.join(", ") || "—"],
  ];
  autoTable(doc, {
    startY: y, body: fields, theme: "grid",
    styles: { fontSize: 8, cellPadding: 3 },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 35, fillColor: [245, 245, 245] } },
  });

  const finalY = (doc as any).lastAutoTable.finalY;
  doc.setFontSize(8);
  doc.text("________________________________", 105, finalY + 20, { align: "center" });
  doc.text(item.profiles?.nome || "Educador", 105, finalY + 25, { align: "center" });

  doc.save(`SysELO_Planejamento_${fileTimestamp()}.pdf`);
}

// ===== FICHA DE INSCRIÇÃO =====

function buildFichaTemplateData(p: any) {
  return {
    NOME_COMPLETO: p.nome_completo || "—",
    DATA_NASCIMENTO: p.data_nascimento || "—",
    GENERO: p.genero || "—",
    COR_RACA: p.cor_raca || "—",
    PERIODO: p.periodo || "—",
    STATUS: p.status || "—",
    ESCOLA: p.escola || "—",
    SERIE: p.serie || "—",
    ENDERECO: `${p.endereco_rua || ""} ${p.endereco_numero ? "Nº " + p.endereco_numero : ""}`.trim() || "—",
    BAIRRO: p.endereco_bairro || "—",
    UF_ORIGEM: p.uf_origem || "—",
    SITUACAO_MORADIA: p.situacao_moradia || "—",
    RESPONSAVEL1_NOME: p.responsavel1_nome || "—",
    RESPONSAVEL1_CPF: p.responsavel1_cpf || "—",
    RESPONSAVEL1_WHATSAPP: p.responsavel1_whatsapp || "—",
    RESPONSAVEL2_NOME: p.responsavel2_nome || "—",
    RESPONSAVEL2_WHATSAPP: p.responsavel2_whatsapp || "—",
    ORIGEM_ENCAMINHAMENTO: p.origem_encaminhamento || "—",
    RESPONSAVEL_TECNICO: p.responsavel_tecnico || "—",
    VULNERABILIDADE: p.categoria_vulnerabilidade || "—",
    INICIO_SCFV: p.iniciou_em || "—",
    RESTRICAO_ALIMENTAR: p.restricao_alimentar || "—",
    LAUDO: p.laudo || "—",
  };
}

export async function exportFichaInscricaoDocx(p: any) {
  const template = await loadTemplate("ficha_inscricao.docx");

  if (template) {
    const data = buildFichaTemplateData(p);
    const blob = fillTemplate(template, data);
    saveAs(blob, `SysELO_FichaInscricao_${fileTimestamp()}.docx`);
    return;
  }

  // Fallback
  const children: any[] = [
    ...headerParagraphs(),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [new TextRun({ text: "FICHA DE INSCRIÇÃO E CADASTRO", bold: true, size: 24, font: "Arial", color: ACCENT_COLOR })] }),
  ];
  const rows = [
    infoRow("Nome Completo", p.nome_completo), infoRow("Data de Nascimento", p.data_nascimento),
    infoRow("Gênero", p.genero), infoRow("Cor/Raça", p.cor_raca), infoRow("Período", p.periodo),
    infoRow("Status", p.status), infoRow("Escola", p.escola), infoRow("Série", p.serie),
    infoRow("Endereço", `${p.endereco_rua || ""} ${p.endereco_numero ? "Nº " + p.endereco_numero : ""}`),
    infoRow("Bairro", p.endereco_bairro), infoRow("UF Origem", p.uf_origem),
    infoRow("Sit. Moradia", p.situacao_moradia), infoRow("Responsável 1", p.responsavel1_nome),
    infoRow("CPF Resp. 1", p.responsavel1_cpf), infoRow("WhatsApp Resp. 1", p.responsavel1_whatsapp),
    infoRow("Responsável 2", p.responsavel2_nome), infoRow("WhatsApp Resp. 2", p.responsavel2_whatsapp),
    infoRow("Origem/Encaminhamento", p.origem_encaminhamento), infoRow("Resp. Técnico", p.responsavel_tecnico),
    infoRow("Vulnerabilidade", p.categoria_vulnerabilidade), infoRow("Início SCFV", p.iniciou_em),
    infoRow("Restrição Alimentar", p.restricao_alimentar), infoRow("Laudo", p.laudo),
  ];
  children.push(new Table({ width: { size: 9360, type: WidthType.DXA }, columnWidths: [2800, 6560], rows }));
  children.push(new Paragraph({ spacing: { before: 600 }, children: [] }));
  children.push(new Paragraph({ alignment: AlignmentType.LEFT, children: [new TextRun({ text: "________________________________                    ________________________________", size: 18, font: "Arial" })] }));
  children.push(new Paragraph({ alignment: AlignmentType.LEFT, children: [new TextRun({ text: "Responsável                                                        Coordenação SCFV", size: 16, font: "Arial" })] }));

  const doc = new Document({ styles: { default: { document: { run: { font: "Arial", size: 20 } } } }, sections: [{ properties: { page: { margin: { top: 720, right: 720, bottom: 720, left: 720 } } }, children }] });
  const buffer = await Packer.toBuffer(doc);
  saveAs(new Blob([new Uint8Array(buffer)]), `SysELO_FichaInscricao_${fileTimestamp()}.docx`);
}

export async function exportFichaInscricaoPdf(p: any) {
  const template = await loadTemplate("ficha_inscricao.docx");
  if (template) {
    try {
      const data = buildFichaTemplateData(p);
      const blob = fillTemplate(template, data);
      saveAs(blob, `SysELO_FichaInscricao_${fileTimestamp()}.docx`);
      toast.info("O modelo institucional foi exportado em DOCX. Para converter em PDF, abra no Word e salve como PDF.");
      return;
    } catch (e) {
      console.error("Template fill failed, using jsPDF fallback:", e);
    }
  }

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = pdfHeader(doc, 10);
  y = pdfTitle(doc, "FICHA DE INSCRIÇÃO E CADASTRO", y);

  const fields = [
    ["Nome Completo", p.nome_completo || "—"], ["Nascimento", p.data_nascimento || "—"],
    ["Gênero", p.genero || "—"], ["Cor/Raça", p.cor_raca || "—"],
    ["Período", p.periodo || "—"], ["Status", p.status || "—"],
    ["Escola", p.escola || "—"], ["Série", p.serie || "—"],
    ["Endereço", `${p.endereco_rua || ""} ${p.endereco_numero ? "Nº " + p.endereco_numero : ""}`],
    ["Bairro", p.endereco_bairro || "—"], ["UF Origem", p.uf_origem || "—"],
    ["Sit. Moradia", p.situacao_moradia || "—"], ["Responsável 1", p.responsavel1_nome || "—"],
    ["CPF Resp. 1", p.responsavel1_cpf || "—"], ["WhatsApp 1", p.responsavel1_whatsapp || "—"],
    ["Responsável 2", p.responsavel2_nome || "—"], ["WhatsApp 2", p.responsavel2_whatsapp || "—"],
    ["Origem", p.origem_encaminhamento || "—"], ["Resp. Técnico", p.responsavel_tecnico || "—"],
    ["Vulnerabilidade", p.categoria_vulnerabilidade || "—"], ["Início SCFV", p.iniciou_em || "—"],
    ["Restr. Alimentar", p.restricao_alimentar || "—"], ["Laudo", p.laudo || "—"],
  ];
  autoTable(doc, {
    startY: y, body: fields, theme: "grid",
    styles: { fontSize: 8, cellPadding: 2.5 },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 35, fillColor: [245, 245, 245] } },
  });

  const finalY = (doc as any).lastAutoTable.finalY;
  doc.setFontSize(8);
  doc.text("________________________________                    ________________________________", 105, finalY + 20, { align: "center" });
  doc.text("Responsável                                                        Coordenação SCFV", 105, finalY + 25, { align: "center" });

  doc.save(`SysELO_FichaInscricao_${fileTimestamp()}.pdf`);
}

// ===== MATRIZ DE FREQUÊNCIA =====
export async function exportMatrizFrequenciaDocx(
  turma: any, participantes: { nome: string; presencas: Record<string, boolean> }[], datas: string[], preenchida: boolean
) {
  const template = await loadTemplate("matriz_frequencia.docx");

  if (template) {
    const dateHeaders = datas.map(d => format(new Date(d + "T12:00:00"), "dd/MM"));
    const data = {
      TURMA: turma.nome || "—",
      PERIODO: turma.periodo || "—",
      FAIXA_ETARIA: turma.faixa_etaria || "—",
      DATA_EXPORT: format(new Date(), "dd/MM/yyyy HH:mm"),
      PARTICIPANTES: participantes.map((p, i) => ({
        NUM: i + 1,
        NOME: p.nome,
        ...Object.fromEntries(datas.map((d, di) => [`D${di + 1}`, preenchida ? (p.presencas[d] ? "✓" : "") : ""])),
      })),
      DATAS: dateHeaders.map((d, i) => ({ HEADER: d, INDEX: i + 1 })),
    };
    const blob = fillTemplate(template, data);
    saveAs(blob, `SysELO_Frequencia_${fileTimestamp()}.docx`);
    return;
  }

  // Fallback
  const dateHeaders = datas.map(d => format(new Date(d + "T12:00:00"), "dd/MM"));
  const numColWidth = 400;
  const nameColWidth = 4000;
  const dateColWidth = Math.min(800, Math.floor((15840 - 1440 - numColWidth - nameColWidth) / Math.max(datas.length, 1)));
  const totalWidth = numColWidth + nameColWidth + dateColWidth * datas.length;

  const headerRow = new TableRow({ children: [
    new TableCell({ width: { size: numColWidth, type: WidthType.DXA }, borders, margins: cellMargins, shading: { fill: HEADER_COLOR, type: ShadingType.CLEAR }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Nº", bold: true, size: 14, font: "Arial", color: "FFFFFF" })] })] }),
    new TableCell({ width: { size: nameColWidth, type: WidthType.DXA }, borders, margins: cellMargins, shading: { fill: HEADER_COLOR, type: ShadingType.CLEAR }, children: [new Paragraph({ children: [new TextRun({ text: "Nome do Participante", bold: true, size: 14, font: "Arial", color: "FFFFFF" })] })] }),
    ...dateHeaders.map(d => new TableCell({ width: { size: dateColWidth, type: WidthType.DXA }, borders, margins: cellMargins, shading: { fill: HEADER_COLOR, type: ShadingType.CLEAR }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: d, bold: true, size: 12, font: "Arial", color: "FFFFFF" })] })] })),
  ]});

  const dataRows = participantes.map((p, i) => new TableRow({ children: [
    new TableCell({ width: { size: numColWidth, type: WidthType.DXA }, borders, margins: cellMargins, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: String(i + 1), size: 14, font: "Arial" })] })] }),
    new TableCell({ width: { size: nameColWidth, type: WidthType.DXA }, borders, margins: cellMargins, children: [new Paragraph({ children: [new TextRun({ text: p.nome, size: 14, font: "Arial" })] })] }),
    ...datas.map(d => new TableCell({ width: { size: dateColWidth, type: WidthType.DXA }, borders, margins: cellMargins, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: preenchida ? (p.presencas[d] ? "✓" : "") : "", size: 14, font: "Arial" })] })] })),
  ]}));

  const children = [
    ...headerParagraphs(),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 100 }, children: [new TextRun({ text: "LISTA DE FREQUÊNCIA", bold: true, size: 22, font: "Arial", color: ACCENT_COLOR })] }),
    new Paragraph({ spacing: { after: 100 }, children: [new TextRun({ text: `Turma: ${turma.nome}  |  Período: ${turma.periodo || "—"}  |  Faixa Etária: ${turma.faixa_etaria || "—"}`, size: 18, font: "Arial" })] }),
    new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: `Exportado em: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, size: 16, font: "Arial", italics: true })] }),
    new Table({ width: { size: totalWidth, type: WidthType.DXA }, columnWidths: [numColWidth, nameColWidth, ...datas.map(() => dateColWidth)], rows: [headerRow, ...dataRows] }),
    new Paragraph({ spacing: { before: 400 }, children: [] }),
    new Paragraph({ children: [new TextRun({ text: "________________________________", size: 18, font: "Arial" })] }),
    new Paragraph({ children: [new TextRun({ text: "Assinatura do Educador", size: 16, font: "Arial" })] }),
  ];

  const doc = new Document({
    styles: { default: { document: { run: { font: "Arial", size: 16 } } } },
    sections: [{ properties: { page: { size: { width: 11906, height: 16838, orientation: PageOrientation.LANDSCAPE }, margin: { top: 500, right: 500, bottom: 500, left: 500 } } }, children }],
  });
  const buffer = await Packer.toBuffer(doc);
  saveAs(new Blob([new Uint8Array(buffer)]), `SysELO_Frequencia_${fileTimestamp()}.docx`);
}

export async function exportMatrizFrequenciaPdf(
  turma: any, participantes: { nome: string; presencas: Record<string, boolean> }[], datas: string[], preenchida: boolean
) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  let y = 8;
  doc.setFontSize(9); doc.setFont("helvetica", "bold");
  doc.text("PREFEITURA MUNICIPAL DE MEDIANEIRA", 148, y, { align: "center" });
  y += 3; doc.setFont("helvetica", "normal"); doc.setFontSize(8);
  doc.text("SECRETARIA DE ASSISTÊNCIA SOCIAL — CAIA — SCFV", 148, y, { align: "center" });
  y += 5; doc.setFontSize(11); doc.setTextColor(198, 40, 40); doc.setFont("helvetica", "bold");
  doc.text("LISTA DE FREQUÊNCIA", 148, y, { align: "center" });
  doc.setTextColor(0); doc.setFont("helvetica", "normal"); y += 5;
  doc.setFontSize(8);
  doc.text(`Turma: ${turma.nome}  |  Período: ${turma.periodo || "—"}  |  Faixa: ${turma.faixa_etaria || "—"}  |  Exportado: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, 14, y);
  y += 4;

  const dateHeaders = datas.map(d => format(new Date(d + "T12:00:00"), "dd/MM"));
  autoTable(doc, {
    startY: y,
    head: [["Nº", "Nome", ...dateHeaders]],
    body: participantes.map((p, i) => [i + 1, p.nome, ...datas.map(d => preenchida ? (p.presencas[d] ? "✓" : "") : "")]),
    headStyles: { fillColor: [26, 82, 118], fontSize: 6, cellPadding: 1.5 },
    styles: { fontSize: 6, cellPadding: 1.5 },
    columnStyles: { 0: { cellWidth: 8 }, 1: { cellWidth: 40 } },
  });

  doc.save(`SysELO_Frequencia_${fileTimestamp()}.pdf`);
}

// ===== LISTA DE PRESENÇA (em branco, por mês) =====
const DIAS_MAP: Record<string, number> = {
  seg: 1, ter: 2, qua: 3, qui: 4, sex: 5, sab: 6, dom: 0,
  segunda: 1, terca: 2, quarta: 3, quinta: 4, sexta: 5, sabado: 6, domingo: 0,
};

function calcularDatasDoMes(ano: number, mes: number, diasSemana: string[]): Date[] {
  const diasNum = diasSemana.map(d => DIAS_MAP[d]).filter(d => d !== undefined);
  const datas: Date[] = [];
  const primeiroDia = new Date(ano, mes, 1);
  const ultimoDia = new Date(ano, mes + 1, 0);
  for (let d = primeiroDia; d <= ultimoDia; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
    if (diasNum.includes(d.getDay())) datas.push(new Date(d));
  }
  return datas;
}

export async function exportListaPresencaPdf(
  turma: any, participantes: { nome: string }[], ano: number, mes: number
) {
  const diasSemana = turma.dias_semana || [];
  const datas = calcularDatasDoMes(ano, mes, diasSemana);
  if (datas.length === 0) return;

  const meses = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  let y = 8;

  // Header institucional
  doc.setFontSize(9); doc.setFont("helvetica", "bold");
  doc.text("SOCIEDADE CIVIL NOSSA SENHORA APARECIDA", 148, y, { align: "center" });
  y += 3.5; doc.setFont("helvetica", "normal"); doc.setFontSize(7.5);
  doc.text("Centro de Atenção Integral ao Adolescente - Medianeira", 148, y, { align: "center" });

  y += 5; doc.setFontSize(11); doc.setTextColor(26, 82, 118); doc.setFont("helvetica", "bold");
  doc.text("LISTA DE PRESENÇA - SCFV", 148, y, { align: "center" });
  doc.setTextColor(0); doc.setFont("helvetica", "normal"); y += 5;

  // Info turma
  doc.setFontSize(8);
  const bairroNome = turma.bairros?.nome || "—";
  const periodoLabel = turma.periodo === "manha" ? "Manhã" : turma.periodo === "tarde" ? "Tarde" : turma.periodo === "integral" ? "Integral" : "—";
  const faixaLabel = turma.faixa_etaria || "—";
  doc.text(`Turma: ${turma.nome}  |  Bairro: ${bairroNome}  |  Período: ${periodoLabel}  |  Faixa: ${faixaLabel}  |  Mês: ${meses[mes]}/${ano}`, 14, y);
  y += 4;

  // Date headers
  const dateHeaders = datas.map(d => format(d, "dd/MM"));
  const dayNames: Record<number, string> = { 0: "Dom", 1: "Seg", 2: "Ter", 3: "Qua", 4: "Qui", 5: "Sex", 6: "Sáb" };
  const dayLabels = datas.map(d => dayNames[d.getDay()]);

  // Table
  autoTable(doc, {
    startY: y,
    head: [
      ["Nº", "Nome do Participante", ...dateHeaders],
      ["", "", ...dayLabels],
    ],
    body: participantes.map((p, i) => [
      i + 1,
      p.nome,
      ...datas.map(() => "☐"),
    ]),
    headStyles: { fillColor: [26, 82, 118], fontSize: 6, cellPadding: 1.5, halign: "center" },
    styles: { fontSize: 6, cellPadding: 1.5 },
    columnStyles: {
      0: { cellWidth: 7, halign: "center" },
      1: { cellWidth: 45 },
    },
    didParseCell: (data: any) => {
      // Style the checkbox cells
      if (data.section === "body" && data.column.index >= 2) {
        data.cell.styles.halign = "center";
        data.cell.styles.fontSize = 7;
      }
    },
  });

  // Footer - assinatura
  const finalY = (doc as any).lastAutoTable?.finalY || 180;
  doc.setFontSize(8);
  doc.text("________________________________", 14, finalY + 12);
  doc.text("Assinatura do Educador(a)", 14, finalY + 16);
  doc.text("________________________________", 180, finalY + 12);
  doc.text("Assinatura do Coordenador(a)", 180, finalY + 16);

  doc.save(`SysELO_Lista_Presenca_${turma.nome.replace(/\s+/g, "_")}_${meses[mes]}_${ano}.pdf`);
}
