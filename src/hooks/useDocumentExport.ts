import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, PageOrientation, BorderStyle, WidthType,
  ShadingType, PageBreak, HeadingLevel, LevelFormat, ImageRun,
} from "docx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { saveAs } from "file-saver";
import { format } from "date-fns";
import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { tipoAtividadeLabels } from "@/lib/constants";

// ===== TEMPLATE CACHE =====
const templateCache: Record<string, ArrayBuffer> = {};
const missingTemplates: Set<string> = new Set();

/** Limpa o cache negativo de templates ausentes (chame após upload de novo modelo). */
export function invalidateMissingTemplatesCache(templateName?: string) {
  if (templateName) missingTemplates.delete(templateName);
  else missingTemplates.clear();
}

async function loadTemplate(templateName: string): Promise<ArrayBuffer | null> {
  if (templateCache[templateName]) return templateCache[templateName];
  // Cache negativo: evita re-fetch de templates ausentes (poluem o console com 400)
  if (missingTemplates.has(templateName)) return null;
  try {
    const { data, error } = await supabase.storage.from("templates").download(templateName);
    if (error || !data) {
      console.info(`[docx] template '${templateName}' indisponível, usando fallback gerado.`, error?.message);
      missingTemplates.add(templateName);
      return null;
    }
    const buffer = await data.arrayBuffer();
    templateCache[templateName] = buffer;
    return buffer;
  } catch (e) {
    console.info(`[docx] erro ao baixar template '${templateName}', usando fallback.`, e);
    missingTemplates.add(templateName);
    return null;
  }
}

/**
 * Clean XML runs inside the DOCX zip so that tags like {TAG}
 * that Word may have split across multiple <w:r> elements are merged back
 * into a single run. Works with raw { } characters in XML text nodes.
 */
function cleanXmlRuns(zip: PizZip): void {
  const xmlFiles = Object.keys(zip.files).filter(f => f.endsWith(".xml"));

  for (const fileName of xmlFiles) {
    let content = zip.file(fileName)?.asText();
    if (!content || !content.includes("{")) continue;

    for (let pass = 0; pass < 15; pass++) {
      let changed = false;
      content = content.replace(
        /(\{[^}]*?)(<\/w:t>\s*<\/w:r>\s*<w:r(?:\s[^>]*)?>(?:\s*<w:rPr>[\s\S]*?<\/w:rPr>)?\s*<w:t(?:\s[^>]*)?>)([^{]*?\})/g,
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

// Cache for tag mappings from DB
const mappingsCache: Record<string, Record<string, string>> = {};

async function loadTagMappings(templateKey: string): Promise<Record<string, string>> {
  if (mappingsCache[templateKey]) return mappingsCache[templateKey];
  try {
    const { data } = await supabase
      .from("template_tag_mappings")
      .select("tag_name, data_field")
      .eq("template_key", templateKey);
    const map: Record<string, string> = {};
    data?.forEach((r: any) => { map[r.tag_name] = r.data_field; });
    mappingsCache[templateKey] = map;
    return map;
  } catch {
    return {};
  }
}

// Invalidate cache when templates are re-uploaded
export function invalidateMappingsCache(templateKey?: string) {
  if (templateKey) delete mappingsCache[templateKey];
  else Object.keys(mappingsCache).forEach(k => delete mappingsCache[k]);
}

/**
 * Remap data using DB tag mappings.
 * For each tag in the mappings, find the corresponding value in allData
 * and add it to the output keyed by the tag name.
 * Unmapped tags pass through from the original data.
 */
function remapDataWithMappings(
  originalData: Record<string, any>,
  tagMappings: Record<string, string>,
  allData: Record<string, any>
): Record<string, any> {
  if (Object.keys(tagMappings).length === 0) return originalData;

  const result: Record<string, any> = { ...originalData };

  // Build a lookup index: normalize all keys in allData so we can find values
  // regardless of casing convention (SCORE_ELO, score_elo, ScoreELO, etc.)
  const normalizedIndex: Record<string, any> = {};
  for (const [key, value] of Object.entries(allData)) {
    normalizedIndex[key] = value;
    normalizedIndex[key.toUpperCase()] = value;
    normalizedIndex[key.toLowerCase()] = value;
    // Also store snake_case → UPPER_SNAKE: "score_elo" → "SCORE_ELO"
    normalizedIndex[key.toUpperCase().replace(/\./g, "_")] = value;
  }

  for (const [tagName, fieldKey] of Object.entries(tagMappings)) {
    // Use fieldKey to resolve the value from allData
    const fieldUpper = fieldKey.toUpperCase().replace(/\./g, "_");
    const resolved =
      normalizedIndex[fieldKey] ??
      normalizedIndex[fieldUpper] ??
      normalizedIndex[fieldKey.toLowerCase()] ??
      allData[fieldKey] ??
      allData[fieldUpper];

    if (resolved !== undefined) {
      result[tagName] = resolved;
    }
  }

  return result;
}

function fillTemplate(templateBuffer: ArrayBuffer, data: Record<string, any>): Blob {
  const zip = new PizZip(templateBuffer);

  // Clean fragmented XML runs before docxtemplater processes the template
  cleanXmlRuns(zip);

  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    nullGetter: () => "",
  });

  try {
    doc.render(data);
  } catch (e: any) {
    console.error("Docxtemplater render error:", e);
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

// ===== PHOTO HELPERS =====
interface PhotoBuffer {
  buffer: ArrayBuffer;
  width: number;
  height: number;
  type: "jpg" | "png";
}

async function fetchPhotosAsBuffers(fotos: any[]): Promise<PhotoBuffer[]> {
  const results: PhotoBuffer[] = [];
  for (const foto of fotos) {
    try {
      const url = foto.foto_url;
      if (!url) continue;
      const resp = await fetch(url);
      if (!resp.ok) continue;
      const blob = await resp.blob();
      const buffer = await blob.arrayBuffer();
      const type = blob.type.includes("png") ? "png" as const : "jpg" as const;
      // Get dimensions
      let width = 800, height = 600;
      try {
        const bitmap = await createImageBitmap(blob);
        width = bitmap.width;
        height = bitmap.height;
        bitmap.close();
      } catch { /* use defaults */ }
      results.push({ buffer, width, height, type });
    } catch {
      // silently skip
    }
  }
  return results;
}

function buildPhotoSection(photos: PhotoBuffer[], caption: string): Paragraph[] {
  const paragraphs: Paragraph[] = [
    new Paragraph({ children: [new PageBreak()] }),
    new Paragraph({ spacing: { after: 200 }, alignment: AlignmentType.CENTER, children: [
      new TextRun({ text: "REGISTRO FOTOGRÁFICO", bold: true, size: 22, font: "Arial", color: ACCENT_COLOR }),
    ]}),
  ];
  for (const photo of photos) {
    const maxWidth = 450;
    const scale = maxWidth / photo.width;
    const scaledHeight = Math.round(photo.height * scale);
    paragraphs.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
      children: [new ImageRun({
        type: photo.type,
        data: photo.buffer,
        transformation: { width: maxWidth, height: scaledHeight },
      })],
    }));
    paragraphs.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [new TextRun({ text: caption, size: 16, font: "Arial", italics: true, color: SCNSA_BLUE })],
    }));
  }
  return paragraphs;
}

// ===== SHARED CONSTANTS (fallback) =====
// Paleta SCNSA — aplicada apenas em listas/relatórios institucionais
const SCNSA_BLUE = "1F3864";    // Azul institucional (cabeçalhos, faixas)
const SCNSA_RED = "9E1B32";     // Vermelho de destaque (títulos, score, BA)
// DOCX usa apenas branco + vermelho + azul SCNSA (sem cinza)
const SCNSA_GRAY = SCNSA_BLUE;  // Alias mantido por compat — agora aponta para azul
const SCNSA_INFO_BG = "FFFFFF"; // Fundo institucional sempre branco
const HEADER_COLOR = SCNSA_BLUE;
const ACCENT_COLOR = SCNSA_RED;
const LIGHT_BG = SCNSA_INFO_BG;
const cellBorder = { style: BorderStyle.SINGLE, size: 4, color: SCNSA_BLUE };
const borders = { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder };
const cellMargins = { top: 60, bottom: 60, left: 80, right: 80 };

const LIKERT_COLORS: Record<number, string> = {
  // Escala de intensidade em azul SCNSA (claro → escuro)
  1: "DCE3F0", 2: "B6C2DC", 3: "8094BE", 4: "4A65A0", 5: SCNSA_BLUE,
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

/** Sanitize undefined/null/"undefined"/"Undefined" → "" */
function safeStr(v: any, fallback = "—"): string {
  if (v == null || v === "undefined" || v === "Undefined" || v === "") return fallback;
  return String(v);
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
        children: [new Paragraph({ children: [new TextRun({ text: safeStr(value), size: 18, font: "Arial" })] })],
      }),
    ],
  });
}

function checkbox(checked: boolean, label: string): TextRun[] {
  return [
    new TextRun({ text: checked ? "■ " : "☐ ", size: 18, font: "Segoe UI Symbol", bold: checked }),
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
  doc.setFontSize(13); doc.setTextColor(0, 0, 0); doc.setFont("helvetica", "bold");
  doc.text(title, 105, y, { align: "center" });
  doc.setTextColor(0); doc.setFont("helvetica", "normal");
  return y + 8;
}

// ===== RELATÓRIO DE ATIVIDADE =====

function buildRelatorioTemplateData(item: any, turmaNames: string[], presenca: any[]) {
  const engOptions = ["Grupo participativo", "Grupo disperso", "Boa interação entre participantes", "Necessitou intervenção do educador"];
  const sitOptions = ["Nenhuma ocorrência", "Conflito entre participantes", "Situação de vulnerabilidade identificada", "Encaminhamento necessário", "Comunicação com família/responsável"];
  const objLabels: Record<string, string> = { alcancado: "Alcançado", parcial: "Parcial", nao_alcancado: "Não Alcançado" };

  // Handle tipo_atividade as array or legacy string
  const tipoArr: string[] = Array.isArray(item.tipo_atividade) ? item.tipo_atividade : (item.tipo_atividade ? [item.tipo_atividade] : []);
  const tipoDisplay = tipoArr.length > 0
    ? tipoAtividadeLabels(tipoArr, item.tipo_atividade_detalhe)
    : "—";

  return {
    DATA: item.data ? format(new Date(item.data + "T12:00:00"), "dd/MM/yyyy") : "",
    DIA_SEMANA: safeStr(item.dia_semana, ""),
    EDUCADOR: safeStr(item.profiles?.nome, ""),
    TURMAS: turmaNames.join(", ") || "",
    TIPO_ATIVIDADE: tipoDisplay,
    NOME_ATIVIDADE: safeStr(item.nome_atividade, ""),
    // Engajamento checkboxes — use [X]/[ ] for robust rendering
    ...Object.fromEntries(engOptions.map((opt, i) => [`ENG_${i + 1}`, item.engajamento?.includes(opt) ? "[X]" : "[ ]"])),
    ENG_1_LABEL: engOptions[0], ENG_2_LABEL: engOptions[1], ENG_3_LABEL: engOptions[2], ENG_4_LABEL: engOptions[3],
    // Objetivo checkboxes
    OBJ_1: item.objetivo_alcancado === "alcancado" ? "[X]" : "[ ]",
    OBJ_2: item.objetivo_alcancado === "parcial" ? "[X]" : "[ ]",
    OBJ_3: item.objetivo_alcancado === "nao_alcancado" ? "[X]" : "[ ]",
    // Situações checkboxes
    ...Object.fromEntries(sitOptions.map((opt, i) => [`SIT_${i + 1}`, item.situacoes_relevantes?.includes(opt) ? "[X]" : "[ ]"])),
    SIT_1_LABEL: sitOptions[0], SIT_2_LABEL: sitOptions[1], SIT_3_LABEL: sitOptions[2], SIT_4_LABEL: sitOptions[3], SIT_5_LABEL: sitOptions[4],
    // Competências
    INICIATIVA: safeStr(item.iniciativa, ""),
    INICIATIVA_LABEL: item.iniciativa ? LIKERT_LABELS[item.iniciativa] : "",
    AUTONOMIA: safeStr(item.autonomia, ""),
    AUTONOMIA_LABEL: item.autonomia ? LIKERT_LABELS[item.autonomia] : "",
    COLABORACAO: safeStr(item.colaboracao, ""),
    COLABORACAO_LABEL: item.colaboracao ? LIKERT_LABELS[item.colaboracao] : "",
    COMUNICACAO: safeStr(item.comunicacao, ""),
    COMUNICACAO_LABEL: item.comunicacao ? LIKERT_LABELS[item.comunicacao] : "",
    RESPEITO_MUTUO: safeStr(item.respeito_mutuo, ""),
    RESPEITO_MUTUO_LABEL: item.respeito_mutuo ? LIKERT_LABELS[item.respeito_mutuo] : "",
    SCORE_ELO: item.score_elo?.toFixed(2) || "",
    // Resumo
    NUM_PRESENTES: item.num_participantes ?? 0,
    NUM_MATRICULADOS: item.num_matriculados ?? 0,
    PCT_ADESAO: item.pct_adesao != null ? `${Number(item.pct_adesao).toFixed(0)}%` : "",
    ANALISE_IA: safeStr(item.analise_ia, ""),
    OBJETIVO: item.objetivo_alcancado ? (objLabels[item.objetivo_alcancado] || item.objetivo_alcancado) : "",
    INTERVENCOES: safeStr(item.intervencoes, ""),
    ATIVIDADES_REALIZADAS: safeStr(item.intervencoes, ""),
    OBSERVACOES: safeStr(item.observacoes, ""),
    // New tags
    NOME_GRUPO: safeStr(item._nome_grupo || turmaNames.join(", "), ""),
    PERIODO_SCFV: safeStr(item._periodo_scfv, ""),
    // Presença loop
    PRESENCA: presenca.map((p, i) => ({
      NUM: i + 1,
      NOME: safeStr(p.participantes?.nome_completo, "") + (p.participantes?.status === "busca_ativa" ? " (BA)" : ""),
      STATUS: p.presente ? "■" : "☐",
      JUSTIFICATIVA: safeStr(p.justificativa, ""),
    })),
    HAS_PRESENCA: presenca.length > 0,
    HAS_INTERVENCOES: !!item.intervencoes,
    HAS_OBSERVACOES: !!item.observacoes,
  };
}

export async function exportRelatorioDocx(item: any, turmaNames: string[], presenca: any[], fotos: any[]) {
  const blob = await buildRelatorioDocxBlob(item, turmaNames, presenca, fotos);
  saveAs(blob, `SysCFV_Relatorio_${fileTimestamp()}.docx`);
}

/**
 * Versão "blob-only" usada pela Biblioteca de Documentos.
 * Não chama saveAs — retorna o Blob para upload/zip.
 */
export async function buildRelatorioDocxBlob(item: any, turmaNames: string[], presenca: any[], fotos: any[]): Promise<Blob> {
  // Normalizar entradas para evitar crashes em propriedades ausentes
  item = item || {};
  turmaNames = Array.isArray(turmaNames) ? turmaNames : [];
  presenca = Array.isArray(presenca) ? presenca : [];
  fotos = Array.isArray(fotos) ? fotos : [];
  if (!Array.isArray(item.engajamento)) item.engajamento = item.engajamento ? [item.engajamento] : [];
  if (!Array.isArray(item.situacoes_relevantes)) item.situacoes_relevantes = item.situacoes_relevantes ? [item.situacoes_relevantes] : [];

  const template = await loadTemplate("relatorio.docx");
  
  if (template) {
    try {
      // Remove PRESENCA from template data so template doesn't render ugly list
      const baseData = buildRelatorioTemplateData(item, turmaNames, presenca);
      delete baseData.PRESENCA;
      baseData.HAS_PRESENCA = false;
      const tagMappings = await loadTagMappings("relatorio.docx");
      const data = remapDataWithMappings(baseData, tagMappings, baseData);
      const blob = fillTemplate(template, data);
      
      // If there's presença, we need to append the nice table to the template output
      if (presenca.length > 0) {
        // Can't easily append to docxtemplater output, so fall through to full fallback
        console.info("Template used but presença table generated via fallback code.");
      } else {
        return blob;
      }
    } catch (e) {
      console.error("Template fill failed, generating fallback DOCX:", e);
      toast.error("Modelo institucional com erro. Exportando versão padrão.");
    }
  }

  // Fallback: generate from scratch
  const children: any[] = [
    ...headerParagraphs(),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [
      new TextRun({ text: "RELATÓRIO DE ATIVIDADE", bold: true, size: 24, font: "Arial", color: ACCENT_COLOR }),
    ]}),
  ];

  // Turmas: uma por linha, fonte menor para legibilidade
  const turmasCellChildren = turmaNames.length > 0
    ? turmaNames.map(n => new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: `• ${n}`, size: 16, font: "Arial" })] }))
    : [new Paragraph({ children: [new TextRun({ text: "—", size: 18, font: "Arial" })] })];
  const tipoArrFb: string[] = Array.isArray(item.tipo_atividade) ? item.tipo_atividade : (item.tipo_atividade ? [item.tipo_atividade] : []);
  const tipoFbDisplay = tipoArrFb.length > 0 ? tipoAtividadeLabels(tipoArrFb, item.tipo_atividade_detalhe) : "—";

  const turmasRow = new TableRow({
    children: [
      new TableCell({
        width: { size: 2800, type: WidthType.DXA }, borders, margins: cellMargins,
        shading: { fill: LIGHT_BG, type: ShadingType.CLEAR },
        children: [new Paragraph({ children: [new TextRun({ text: "Turma(s)", bold: true, size: 18, font: "Arial" })] })],
      }),
      new TableCell({
        width: { size: 6560, type: WidthType.DXA }, borders, margins: cellMargins,
        children: turmasCellChildren,
      }),
    ],
  });
  const rows = [
    infoRow("Data", item.data ? format(new Date(item.data + "T12:00:00"), "dd/MM/yyyy") : ""),
    infoRow("Dia da Semana", item.dia_semana),
    infoRow("Educador", item.profiles?.nome),
    turmasRow,
    infoRow("Tipo de Atividade", tipoFbDisplay),
    infoRow("Nome da Atividade", item.nome_atividade),
  ];
  children.push(new Table({ width: { size: 9360, type: WidthType.DXA }, columnWidths: [2800, 6560], rows }));
  children.push(new Paragraph({ spacing: { after: 200 }, children: [] }));

  if (item.engajamento?.length > 0) {
    const engOptions = ["Grupo participativo", "Grupo disperso", "Boa interação entre participantes", "Necessitou intervenção do educador"];
    children.push(new Paragraph({ spacing: { after: 100 }, children: [new TextRun({ text: "Engajamento:", bold: true, size: 20, font: "Arial" })] }));
    children.push(new Paragraph({ spacing: { after: 200 }, children: engOptions.flatMap(opt => checkbox(item.engajamento.includes(opt), opt)) }));
  }

  if (item.situacoes_relevantes?.length > 0) {
    const sitOptions = ["Nenhuma ocorrência", "Conflito entre participantes", "Situação de vulnerabilidade identificada", "Encaminhamento necessário", "Comunicação com família/responsável"];
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
    children.push(new Paragraph({ spacing: { after: 50 }, children: [new TextRun({ text: "Atividades Realizadas:", bold: true, size: 18, font: "Arial" })] }));
    children.push(new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: item.intervencoes, size: 18, font: "Arial" })] }));
  }
  if (item.observacoes) {
    children.push(new Paragraph({ spacing: { after: 50 }, children: [new TextRun({ text: "Observações:", bold: true, size: 18, font: "Arial" })] }));
    children.push(new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: item.observacoes, size: 18, font: "Arial" })] }));
  }

  if (presenca.length > 0) {
    children.push(new Paragraph({ children: [new PageBreak()] }));
    // REO-style attendance table
    children.push(...headerParagraphs());
    children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 100 }, children: [
      new TextRun({ text: "LISTA DE FREQUÊNCIA", bold: true, size: 22, font: "Arial", color: ACCENT_COLOR }),
    ]}));
    children.push(new Paragraph({ spacing: { after: 50 }, children: [
      new TextRun({ text: `Atividade: ${safeStr(item.nome_atividade, "")}  |  Data: ${item.data ? format(new Date(item.data + "T12:00:00"), "dd/MM/yyyy") : ""}  |  Turma(s): ${turmaNames.join(", ")}`, size: 16, font: "Arial" }),
    ]}));
    children.push(new Paragraph({ spacing: { after: 100 }, children: [
      new TextRun({ text: `Educador(a): ${safeStr(item.profiles?.nome, "")}`, size: 16, font: "Arial" }),
    ]}));

    const presRows = [
      new TableRow({ children: [
        new TableCell({ width: { size: 600, type: WidthType.DXA }, borders, margins: cellMargins, shading: { fill: HEADER_COLOR, type: ShadingType.CLEAR }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Nº", bold: true, size: 14, font: "Arial", color: "FFFFFF" })] })] }),
        new TableCell({ width: { size: 7160, type: WidthType.DXA }, borders, margins: cellMargins, shading: { fill: HEADER_COLOR, type: ShadingType.CLEAR }, children: [new Paragraph({ children: [new TextRun({ text: "Nome do Participante", bold: true, size: 14, font: "Arial", color: "FFFFFF" })] })] }),
        new TableCell({ width: { size: 1600, type: WidthType.DXA }, borders, margins: cellMargins, shading: { fill: HEADER_COLOR, type: ShadingType.CLEAR }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Presença", bold: true, size: 14, font: "Arial", color: "FFFFFF" })] })] }),
      ]}),
      ...presenca.map((p, i) => new TableRow({ children: [
        new TableCell({ width: { size: 600, type: WidthType.DXA }, borders, margins: cellMargins, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: String(i + 1), size: 14, font: "Arial" })] })] }),
        new TableCell({ width: { size: 7160, type: WidthType.DXA }, borders, margins: cellMargins, children: [new Paragraph({ children: [
          new TextRun({ text: safeStr(p.participantes?.nome_completo, ""), size: 14, font: "Arial" }),
          ...(p.participantes?.status === "busca_ativa" ? [new TextRun({ text: " (BA)", size: 14, font: "Arial", bold: true, color: SCNSA_RED })] : []),
        ] })] }),
        new TableCell({
          width: { size: 1600, type: WidthType.DXA }, borders, margins: cellMargins,
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: p.presente ? "■" : "☐", size: 20, font: "Segoe UI Symbol", bold: true, color: "000000" })] })],
        }),
      ]})),
    ];
    children.push(new Table({ width: { size: 9360, type: WidthType.DXA }, columnWidths: [600, 7160, 1600], rows: presRows }));
    // Legend
    children.push(new Paragraph({ spacing: { before: 100 }, children: [new TextRun({ text: "Legenda: ■ Presente · ☐ Ausente · (BA) Em busca ativa no momento do registro.", size: 14, font: "Arial", italics: true, color: SCNSA_GRAY })] }));
    children.push(new Paragraph({ spacing: { before: 300 }, children: [] }));
    children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "________________________________", size: 18, font: "Arial" })] }));
    children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `Assinatura do(a) Educador(a)`, size: 16, font: "Arial", italics: true })] }));
  }

  // Photos section
  if (fotos && fotos.length > 0) {
    const photoCaption = `${item.data ? format(new Date(item.data + "T12:00:00"), "dd/MM/yy") : ""} - ${item.nome_atividade || "Atividade"} - Grupos: ${turmaNames.join(", ")}`;
    const photoBuffers = await fetchPhotosAsBuffers(fotos);
    if (photoBuffers.length > 0) {
      children.push(...buildPhotoSection(photoBuffers, photoCaption));
    }
  }

  const doc = new Document({
    styles: { default: { document: { run: { font: "Arial", size: 20 } } } },
    sections: [{ properties: { page: { margin: { top: 720, right: 720, bottom: 720, left: 720 } } }, children }],
  });
  return await Packer.toBlob(doc);
 }

export async function exportRelatorioPdf(item: any, turmaNames: string[], presenca: any[]) {
  // Generate PDF directly via jsPDF
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = pdfHeader(doc, 10);
  y = pdfTitle(doc, "RELATÓRIO DE ATIVIDADE", y);

  const info = [
    ["Data", item.data ? format(new Date(item.data + "T12:00:00"), "dd/MM/yyyy") : "—"],
    ["Dia da Semana", safeStr(item.dia_semana)],
    ["Educador", safeStr(item.profiles?.nome)],
    ["Turma(s)", turmaNames.length > 0 ? turmaNames.map(n => `• ${n}`).join("\n") : "—"],
    ["Tipo de Atividade", (() => {
      const arr = Array.isArray(item.tipo_atividade) ? item.tipo_atividade : (item.tipo_atividade ? [item.tipo_atividade] : []);
      return arr.length > 0 ? tipoAtividadeLabels(arr, item.tipo_atividade_detalhe) : "—";
    })()],
    ["Nome da Atividade", safeStr(item.nome_atividade)],
  ];
  autoTable(doc, {
    startY: y, body: info, theme: "grid",
    styles: { fontSize: 8, cellPadding: 2 },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 35, fillColor: [255, 255, 255] } },
  });
  y = (doc as any).lastAutoTable.finalY + 4;

  // Engajamento checkboxes
  const engOptions = ["Grupo participativo", "Grupo disperso", "Boa interação entre participantes", "Necessitou intervenção do educador"];
  doc.setFontSize(9); doc.setFont("helvetica", "bold");
  doc.text("Engajamento:", 14, y); y += 4; doc.setFont("helvetica", "normal"); doc.setFontSize(8);
  doc.text(engOptions.map(opt => `${item.engajamento?.includes(opt) ? "[X]" : "[ ]"} ${opt}`).join("   "), 14, y, { maxWidth: 180 });
  y += 6;

  // Situações
  const sitOptions = ["Nenhuma ocorrência", "Conflito entre participantes", "Situação de vulnerabilidade identificada", "Encaminhamento necessário", "Comunicação com família/responsável"];
  doc.setFontSize(9); doc.setFont("helvetica", "bold");
  doc.text("Situações Relevantes:", 14, y); y += 4; doc.setFont("helvetica", "normal"); doc.setFontSize(8);
  doc.text(sitOptions.map(opt => `${item.situacoes_relevantes?.includes(opt) ? "[X]" : "[ ]"} ${opt}`).join("   "), 14, y, { maxWidth: 180 });
  y += 8;

  // Competências
  const comps = [
    ["Iniciativa", item.iniciativa], ["Autonomia", item.autonomia],
    ["Colaboração", item.colaboracao], ["Comunicação", item.comunicacao],
    ["Respeito Mútuo", item.respeito_mutuo],
  ];
  const colorMap: Record<number, [number, number, number]> = {
    // Escala em preto puro: 1 = branco, 5 = preto
    1: [255, 255, 255], 2: [255, 255, 255], 3: [255, 255, 255], 4: [0, 0, 0], 5: [0, 0, 0],
  };
  autoTable(doc, {
    startY: y,
    head: [["Competência", "Valor", "Nível"]],
    body: comps.map(([l, v]) => [l, v || "—", v ? LIKERT_LABELS[v as number] : "—"]),
    headStyles: { fillColor: [0, 0, 0], textColor: [255, 255, 255], fontSize: 8 },
    styles: { fontSize: 8, cellPadding: 2 },
    columnStyles: { 0: { cellWidth: 40 }, 1: { cellWidth: 20, halign: "center" } },
    didParseCell: (data: any) => {
      if (data.section === "body" && data.column.index === 1) {
        const val = comps[data.row.index]?.[1] as number;
        if (val && colorMap[val]) {
          data.cell.styles.fillColor = colorMap[val];
          data.cell.styles.textColor = val >= 4 ? [255, 255, 255] : [0, 0, 0];
          data.cell.styles.fontStyle = "bold";
        }
      }
    },
  });
  y = (doc as any).lastAutoTable.finalY + 2;
  doc.setFontSize(10); doc.setTextColor(0, 0, 0); doc.setFont("helvetica", "bold");
  doc.text(`Score ELO: ${item.score_elo?.toFixed(2) || "—"}`, 196, y, { align: "right" });
  doc.setTextColor(0); doc.setFont("helvetica", "normal"); y += 6;

  // Summary
  autoTable(doc, {
    startY: y,
    body: [["Presentes", String(item.num_participantes ?? 0), "Ausentes", String(item.num_ausentes ?? 0), "% Adesão", item.pct_adesao != null ? `${Number(item.pct_adesao).toFixed(0)}%` : "—"]],
    theme: "grid", styles: { fontSize: 8, cellPadding: 2, halign: "center" },
    columnStyles: { 0: { fontStyle: "bold", fillColor: [255, 255, 255] }, 2: { fontStyle: "bold", fillColor: [255, 255, 255] }, 4: { fontStyle: "bold", fillColor: [255, 255, 255] } },
  });
  y = (doc as any).lastAutoTable.finalY + 4;

  const objLabels: Record<string, string> = { alcancado: "Alcançado", parcial: "Parcial", nao_alcancado: "Não Alcançado" };
  if (item.objetivo_alcancado) {
    doc.setFontSize(8); doc.setFont("helvetica", "bold");
    doc.text("Objetivo: ", 14, y); doc.setFont("helvetica", "normal");
    doc.text(objLabels[item.objetivo_alcancado] || item.objetivo_alcancado, 34, y); y += 5;
  }

  if (item.intervencoes) {
    doc.setFontSize(8); doc.setFont("helvetica", "bold"); doc.text("Atividades Realizadas:", 14, y); y += 4;
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
    doc.text("Lista de Frequência", 105, py, { align: "center" }); py += 5;
    doc.setFontSize(8); doc.setFont("helvetica", "normal");
    doc.text(`Referente à atividade: ${safeStr(item.nome_atividade, "")}  —  Data: ${item.data ? format(new Date(item.data + "T12:00:00"), "dd/MM/yyyy") : ""}  —  Turma(s): ${turmaNames.join(", ")}  —  Educador(a): ${safeStr(item.profiles?.nome, "")}`, 14, py, { maxWidth: 180 });
    py += 6;
    autoTable(doc, {
      startY: py,
      head: [["Nº", "Nome do Participante", "Presença", "Justificativa"]],
      body: presenca.map((p, i) => [
        i + 1,
        (p.participantes?.nome_completo || "") + (p.participantes?.status === "busca_ativa" ? " (BA)" : ""),
        p.presente ? "■" : "☐",
        p.justificativa || "",
      ]),
      headStyles: { fillColor: [0, 0, 0], fontSize: 7, textColor: [255, 255, 255] },
      styles: { fontSize: 7, cellPadding: 2 },
      columnStyles: { 0: { cellWidth: 8, halign: "center" }, 2: { cellWidth: 18, halign: "center", fontStyle: "bold" } },
      didParseCell: (data: any) => {
        // Sem destaque colorido em PDF (paleta preto/branco). (BA) permanece como texto.
      },
    });
    const finalY = (doc as any).lastAutoTable?.finalY || py;
    doc.setFontSize(7); doc.setFont("helvetica", "italic"); doc.setTextColor(0, 0, 0);
    doc.text("Legenda: ■ Presente · ☐ Ausente · (BA) Em busca ativa no momento do registro.", 14, finalY + 5);
    doc.setTextColor(0, 0, 0);
    // Assinatura do educador
    doc.setFont("helvetica", "normal"); doc.setFontSize(8);
    doc.text("________________________________", 105, finalY + 18, { align: "center" });
    doc.text("Assinatura do(a) Educador(a)", 105, finalY + 22, { align: "center" });
  }

  doc.save(`SysCFV_Relatorio_${fileTimestamp()}.pdf`);
}

// ===== PLANEJAMENTO =====

function buildPlanejamentoTemplateData(item: any, turmaNames: string[]) {
  return {
    TITULO: safeStr(item.titulo, ""),
    EDUCADOR: safeStr(item.profiles?.nome, ""),
    DATA_APLICACAO: item.data_aplicacao ? format(new Date(item.data_aplicacao + "T12:00:00"), "dd/MM/yyyy") : "",
    TURMAS: turmaNames.join(", ") || "",
    TEMA: safeStr(item.tema, ""),
    QUESTAO_GERADORA: safeStr(item.questao_geradora, ""),
    OBJETIVOS: safeStr(item.objetivos, ""),
    ROTEIRO: safeStr(item.roteiro, ""),
    MATERIAIS: safeStr(item.materiais, ""),
    APOIO_TECNICO: safeStr(item.apoio_tecnico, ""),
    FORMA_AVALIACAO: item.forma_avaliacao?.join(", ") || "",
  };
}

export async function exportPlanejamentoDocx(item: any, turmaNames: string[]) {
  const blob = await buildPlanejamentoDocxBlob(item, turmaNames);
  saveAs(blob, `SysCFV_Planejamento_${fileTimestamp()}.docx`);
}

/**
 * Versão "blob-only" usada pela Biblioteca de Documentos.
 */
export async function buildPlanejamentoDocxBlob(item: any, turmaNames: string[]): Promise<Blob> {
  item = item || {};
  turmaNames = Array.isArray(turmaNames) ? turmaNames : [];
  if (!Array.isArray(item.forma_avaliacao)) item.forma_avaliacao = item.forma_avaliacao ? [item.forma_avaliacao] : [];

  const template = await loadTemplate("planejamento.docx");

  if (template) {
    try {
      const baseData = buildPlanejamentoTemplateData(item, turmaNames);
      const tagMappings = await loadTagMappings("planejamento.docx");
      const data = remapDataWithMappings(baseData, tagMappings, baseData);
      const blob = fillTemplate(template, data);
      return blob;
    } catch (e) {
      console.error("Template fill failed, generating fallback DOCX:", e);
      toast.error("Modelo institucional com erro. Exportando versão padrão.");
    }
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
  return await Packer.toBlob(doc);
 }

export async function exportPlanejamentoPdf(item: any, turmaNames: string[]) {
  const template = await loadTemplate("planejamento.docx");
  if (template) {
    try {
      const baseData = buildPlanejamentoTemplateData(item, turmaNames);
      const tagMappings = await loadTagMappings("planejamento.docx");
      const data = remapDataWithMappings(baseData, tagMappings, baseData);
      const blob = fillTemplate(template, data);
      saveAs(blob, `SysCFV_Planejamento_${fileTimestamp()}.docx`);
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
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 35, fillColor: [255, 255, 255] } },
  });

  const finalY = (doc as any).lastAutoTable.finalY;
  doc.setFontSize(8);
  doc.text("________________________________", 105, finalY + 20, { align: "center" });
  doc.text(item.profiles?.nome || "Educador", 105, finalY + 25, { align: "center" });

  doc.save(`SysCFV_Planejamento_${fileTimestamp()}.pdf`);
}

// ===== FICHA DE INSCRIÇÃO =====

function buildFichaTemplateData(p: any) {
  const periodoInverso = p.periodo === "manha" ? "Tarde" : p.periodo === "tarde" ? "Manhã" : "—";
  return {
    NOME_COMPLETO: p.nome_completo || "—",
    CPF: p.cpf || "—",
    DATA_NASCIMENTO: p.data_nascimento || "—",
    GENERO: p.genero || "—",
    COR_RACA: p.cor_raca || "—",
    PERIODO: p.periodo || "—",
    PERIODO_SCFV: periodoInverso,
    STATUS: p.status || "—",
    ESCOLA: p.escola || "—",
    SERIE: p.serie || "—",
    ENDERECO: `${p.endereco_rua || ""} ${p.endereco_numero ? "Nº " + p.endereco_numero : ""}`.trim() || "—",
    ENDERECO_RUA: p.endereco_rua || "—",
    ENDERECO_NUMERO: p.endereco_numero || "—",
    ENDERECO_BAIRRO: p.endereco_bairro || "—",
    BAIRRO: p.endereco_bairro || "—",
    BAIRRO_SCFV: p._bairro_scfv || "—",
    UF_ORIGEM: p.uf_origem || "—",
    SITUACAO_MORADIA: p.situacao_moradia || "—",
    RESPONSAVEL1_NOME: p.responsavel1_nome || "—",
    RESPONSAVEL1_WHATSAPP: p.responsavel1_whatsapp || "—",
    VINCULO_RESP1: p.vinculo_resp1 || "—",
    RESPONSAVEL2_NOME: p.responsavel2_nome || "—",
    RESPONSAVEL2_WHATSAPP: p.responsavel2_whatsapp || "—",
    VINCULO_RESP2: p.vinculo_resp2 || "—",
    // Lowercase aliases for template compatibility
    responsavel2: p.responsavel2_nome || "—",
    ORIGEM_ENCAMINHAMENTO: p.origem_encaminhamento || "—",
    RESPONSAVEL_TECNICO: p.responsavel_tecnico || "—",
    CATEGORIA_VULNERABILIDADE: p.categoria_vulnerabilidade || "—",
    VULNERABILIDADE: p.categoria_vulnerabilidade || "—",
    INICIOU_EM: p.iniciou_em || "—",
    INICIO_SCFV: p.iniciou_em || "—",
    DATA_DESLIGAMENTO: p.data_desligamento || "—",
    DIAS_CONTRATURNO: p.dias_contraturno || "—",
    RESTRICAO_ALIMENTAR: p.restricao_alimentar || "—",
    LAUDO: p.laudo || "—",
    REMEDIO: p.remedio_continuo || "—",
    REMEDIO_CONTINUO: p.remedio_continuo || "—",
    outras_cond: p.outras_condicoes || "—",
    OUTRAS_COND: p.outras_condicoes || "—",
    FOTO_URL: p.foto_url || "—",
    TURMAS: p._turmas_nomes || "—",
    DOCUMENTOS: p._documentos_lista || "—",
    PONTO_TRANSPORTE: p._ponto_transporte || "—",
    NOME_GRUPO: p._nome_grupo || "—",
    nomegrupo: p._nome_grupo || "—",
    JUST_DESLG: p.justificativa_desligamento || "—",
    JUST_DESLIG: p.justificativa_desligamento || "—",
    MOTIVO_DESLG: p.motivo_desligamento || "—",
    MOTIVO_DESLIG: p.motivo_desligamento || "—",
  };
}

export async function exportFichaInscricaoDocx(p: any) {
  const template = await loadTemplate("ficha_inscricao.docx");

  if (template) {
    try {
      const baseData = buildFichaTemplateData(p);
      const tagMappings = await loadTagMappings("ficha_inscricao.docx");
      const data = remapDataWithMappings(baseData, tagMappings, baseData);
      const blob = fillTemplate(template, data);
      saveAs(blob, `SysCFV_FichaInscricao_${fileTimestamp()}.docx`);
      return;
    } catch (e) {
      console.error("Template fill failed, generating fallback DOCX:", e);
      toast.error("Modelo institucional com erro. Exportando versão padrão.");
    }
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
  saveAs(await Packer.toBlob(doc), `SysCFV_FichaInscricao_${fileTimestamp()}.docx`);
}

export async function exportFichaInscricaoPdf(p: any) {
  const template = await loadTemplate("ficha_inscricao.docx");
  if (template) {
    try {
      const baseData = buildFichaTemplateData(p);
      const tagMappings = await loadTagMappings("ficha_inscricao.docx");
      const data = remapDataWithMappings(baseData, tagMappings, baseData);
      const blob = fillTemplate(template, data);
      saveAs(blob, `SysCFV_FichaInscricao_${fileTimestamp()}.docx`);
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
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 35, fillColor: [255, 255, 255] } },
  });

  const finalY = (doc as any).lastAutoTable.finalY;
  doc.setFontSize(8);
  doc.text("________________________________                    ________________________________", 105, finalY + 20, { align: "center" });
  doc.text("Responsável                                                        Coordenação SCFV", 105, finalY + 25, { align: "center" });

  doc.save(`SysCFV_FichaInscricao_${fileTimestamp()}.pdf`);
}

// ===== MATRIZ DE FREQUÊNCIA =====
export async function exportMatrizFrequenciaDocx(
  turma: any, participantes: { nome: string; presencas: Record<string, boolean | string> }[], datas: string[], preenchida: boolean
) {
  const template = await loadTemplate("matriz_frequencia.docx");

  if (template) {
    try {
      const dateHeaders = datas.map(d => format(new Date(d + "T12:00:00"), "dd/MM"));
      const baseData = {
        TURMA: turma.nome || "—",
        PERIODO: turma.periodo || "—",
        FAIXA_ETARIA: turma.faixa_etaria || "—",
        DATA_EXPORT: format(new Date(), "dd/MM/yyyy HH:mm"),
        PARTICIPANTES: participantes.map((p, i) => ({
          NUM: i + 1,
          NOME: p.nome,
          ...Object.fromEntries(datas.map((d, di) => [`D${di + 1}`, preenchida ? (p.presencas[d] === "D" ? "—" : p.presencas[d] ? "■" : "") : ""])),
        })),
        DATAS: dateHeaders.map((d, i) => ({ HEADER: d, INDEX: i + 1 })),
      };
      const tagMappings = await loadTagMappings("matriz_frequencia.docx");
      const data = remapDataWithMappings(baseData, tagMappings, baseData);
      const blob = fillTemplate(template, data);
      saveAs(blob, `SysCFV_Frequencia_${fileTimestamp()}.docx`);
      return;
    } catch (e) {
      console.error("Template fill failed, generating fallback DOCX:", e);
      toast.error("Modelo institucional com erro. Exportando versão padrão.");
    }
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
    ...datas.map(d => new TableCell({ width: { size: dateColWidth, type: WidthType.DXA }, borders, margins: cellMargins, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: preenchida ? (p.presencas[d] === "D" ? "—" : p.presencas[d] ? "■" : "") : "", size: 16, font: "Segoe UI Symbol", bold: !!p.presencas[d] && p.presencas[d] !== "D", color: p.presencas[d] === "D" ? SCNSA_GRAY : undefined })] })] })),
  ]}));

  const children = [
    ...headerParagraphs(),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 100 }, children: [new TextRun({ text: preenchida ? "LISTA DE FREQUÊNCIA" : "LISTA DE CHAMADA", bold: true, size: 22, font: "Arial", color: ACCENT_COLOR })] }),
    new Paragraph({ spacing: { after: 100 }, children: [new TextRun({ text: `Turma: ${turma.nome}  |  Período: ${turma.periodo || "—"}  |  Faixa Etária: ${turma.faixa_etaria || "—"}`, size: 18, font: "Arial" })] }),
    new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: `Exportado em: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, size: 16, font: "Arial", italics: true })] }),
    new Table({ width: { size: totalWidth, type: WidthType.DXA }, columnWidths: [numColWidth, nameColWidth, ...datas.map(() => dateColWidth)], rows: [headerRow, ...dataRows] }),
    new Paragraph({ spacing: { before: 200 }, children: [new TextRun({ text: "Legenda: ■ Presente · vazio Ausente · — Sem aula/desligado · (BA) Em busca ativa", size: 14, font: "Arial", italics: true, color: SCNSA_GRAY })] }),
    new Paragraph({ spacing: { before: 400 }, children: [] }),
    new Paragraph({ children: [new TextRun({ text: "________________________________", size: 18, font: "Arial" })] }),
    new Paragraph({ children: [new TextRun({ text: "Assinatura do Educador", size: 16, font: "Arial" })] }),
  ];

  const doc = new Document({
    styles: { default: { document: { run: { font: "Arial", size: 16 } } } },
    sections: [{ properties: { page: { size: { width: 11906, height: 16838, orientation: PageOrientation.LANDSCAPE }, margin: { top: 500, right: 500, bottom: 500, left: 500 } } }, children }],
  });
  const slug = (turma.nome || "Turma").replace(/\s+/g, "_").replace(/[^\w\-]/g, "");
  const baseName = preenchida ? "ListaFrequencia" : "ListaChamada";
  saveAs(await Packer.toBlob(doc), `SysCFV_${baseName}_${slug}_${fileTimestamp()}.docx`);
}

export async function exportMatrizFrequenciaPdf(
  turma: any, participantes: { nome: string; presencas: Record<string, boolean | string> }[], datas: string[], preenchida: boolean
) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  let y = 8;
  doc.setFontSize(9); doc.setFont("helvetica", "bold");
  doc.text("PREFEITURA MUNICIPAL DE MEDIANEIRA", 148, y, { align: "center" });
  y += 3; doc.setFont("helvetica", "normal"); doc.setFontSize(8);
  doc.text("SECRETARIA DE ASSISTÊNCIA SOCIAL — CAIA — SCFV", 148, y, { align: "center" });
  y += 5; doc.setFontSize(11); doc.setTextColor(158, 27, 50); doc.setFont("helvetica", "bold");
  doc.text(preenchida ? "LISTA DE FREQUÊNCIA" : "LISTA DE CHAMADA", 148, y, { align: "center" });
  doc.setTextColor(0); doc.setFont("helvetica", "normal"); y += 5;
  doc.setFontSize(8);
  doc.text(`Turma: ${turma.nome}  |  Período: ${turma.periodo || "—"}  |  Faixa: ${turma.faixa_etaria || "—"}  |  Exportado: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, 14, y);
  y += 4;

  const dateHeaders = datas.map(d => format(new Date(d + "T12:00:00"), "dd/MM"));
  autoTable(doc, {
    startY: y,
    head: [["Nº", "Nome", ...dateHeaders]],
    body: participantes.map((p, i) => [i + 1, p.nome, ...datas.map(d => preenchida ? (p.presencas[d] === "D" ? "—" : p.presencas[d] ? "■" : "") : "")]),
    headStyles: { fillColor: [31, 56, 100], fontSize: 6, cellPadding: 1.5, textColor: [255,255,255] },
    styles: { fontSize: 6, cellPadding: 1.5 },
    columnStyles: { 0: { cellWidth: 8 }, 1: { cellWidth: 40 } },
    didParseCell: (data: any) => {
      if (data.section === "body" && data.column.index >= 2) {
        data.cell.styles.halign = "center";
        if (String(data.cell.raw) === "■") data.cell.styles.fontStyle = "bold";
      }
      if (data.section === "body" && data.column.index === 1) {
        const txt = String(data.cell.raw || "");
        if (txt.includes("(BA)")) data.cell.styles.textColor = [158, 27, 50];
      }
    },
  });
  const finalY = (doc as any).lastAutoTable?.finalY || y;
  doc.setFontSize(7); doc.setFont("helvetica", "italic"); doc.setTextColor(90, 103, 112);
  doc.text("Legenda: ■ Presente · vazio Ausente · — Sem aula/desligado · (BA) Em busca ativa", 14, finalY + 4);
  doc.setTextColor(0,0,0); doc.setFont("helvetica", "normal");

  const slug = (turma.nome || "Turma").replace(/\s+/g, "_").replace(/[^\w\-]/g, "");
  const baseName = preenchida ? "ListaFrequencia" : "ListaChamada";
  doc.save(`SysCFV_${baseName}_${slug}_${fileTimestamp()}.pdf`);
}

// ===== LISTA DE CHAMADA (em branco, por mês — para impressão e marcação manual) =====
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

  y += 5; doc.setFontSize(12); doc.setTextColor(158, 27, 50); doc.setFont("helvetica", "bold");
  doc.text("LISTA DE CHAMADA — SCFV", 148, y, { align: "center" });
  doc.setFontSize(8); doc.setTextColor(90, 103, 112); doc.setFont("helvetica", "italic");
  y += 4; doc.text("Para preenchimento manual durante a atividade", 148, y, { align: "center" });
  doc.setTextColor(0); doc.setFont("helvetica", "normal"); y += 4;

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

  // Table — linhas altas para escrita manual + coluna Observações
  const obsColIndex = 2 + datas.length;
  autoTable(doc, {
    startY: y,
    head: [
      ["Nº", "Nome do Participante", ...dateHeaders, "Observações"],
      ["", "", ...dayLabels, ""],
    ],
    body: participantes.map((p, i) => [
      i + 1,
      p.nome,
      ...datas.map(() => ""),
      "",
    ]),
    headStyles: { fillColor: [31, 56, 100], fontSize: 7, cellPadding: 1.5, halign: "center", textColor: [255,255,255] },
    styles: { fontSize: 7, cellPadding: 2, minCellHeight: 9, lineColor: [120, 120, 120], lineWidth: 0.2 },
    columnStyles: {
      0: { cellWidth: 7, halign: "center" },
      1: { cellWidth: 50 },
      [obsColIndex]: { cellWidth: 40 },
    },
    didParseCell: (data: any) => {
      // Centraliza colunas de data
      if (data.section === "body" && data.column.index >= 2 && data.column.index < obsColIndex) {
        data.cell.styles.halign = "center";
      }
      // Destaca (BA) no nome em vermelho
      if (data.section === "body" && data.column.index === 1) {
        const txt = String(data.cell.raw || "");
        if (txt.includes("(BA)")) data.cell.styles.textColor = [158, 27, 50];
      }
    },
  });

  // Legend + Footer (3 assinaturas)
  const finalY = (doc as any).lastAutoTable?.finalY || 180;
  doc.setFontSize(7); doc.setFont("helvetica", "italic"); doc.setTextColor(90, 103, 112);
  doc.text("Legenda: marque ■ ou X na data de presença · (BA) = participante em busca ativa.", 14, finalY + 5);
  doc.setTextColor(0); doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text("________________________________", 30, finalY + 18, { align: "center" });
  doc.text("Educador(a)", 30, finalY + 22, { align: "center" });
  doc.text("________________________________", 148, finalY + 18, { align: "center" });
  doc.text("Coordenação", 148, finalY + 22, { align: "center" });
  doc.text("____ /____ /________", 250, finalY + 18, { align: "center" });
  doc.text("Data", 250, finalY + 22, { align: "center" });

  const slug = (turma.nome || "Turma").replace(/\s+/g, "_").replace(/[^\w\-]/g, "");
  doc.save(`SysCFV_ListaChamada_${slug}_${ano}-${String(mes + 1).padStart(2, "0")}.pdf`);
}

// ===== PRONTUÁRIO TÉCNICO =====
const TIPO_ATD_LABEL: Record<string, string> = {
  visita_domiciliar: "Visita Domiciliar",
  atendimento_individual: "Atendimento Individual",
  atendimento_familiar: "Atendimento Familiar",
  encaminhamento: "Encaminhamento",
  busca_ativa: "Busca Ativa",
  acolhida: "Acolhida",
  desligamento: "Desligamento",
  outro: "Outro",
};

export async function exportProntuarioPdf(
  participante: any,
  atendimentos: any[],
  profiles: any[],
  bairros: any[]
) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = 12;

  // Header institucional
  doc.setFontSize(10); doc.setFont("helvetica", "bold");
  doc.text("SOCIEDADE CIVIL NOSSA SENHORA APARECIDA", 105, y, { align: "center" });
  y += 4; doc.setFont("helvetica", "normal"); doc.setFontSize(8);
  doc.text("Centro de Atenção Integral ao Adolescente - Medianeira", 105, y, { align: "center" });

  y += 6; doc.setFontSize(13); doc.setTextColor(180, 30, 30); doc.setFont("helvetica", "bold");
  doc.text("PRONTUÁRIO TÉCNICO — SCFV/CAIA", 105, y, { align: "center" });
  doc.setTextColor(0); doc.setFont("helvetica", "normal"); y += 8;

  // Dados do participante
  doc.setFontSize(10); doc.setFont("helvetica", "bold");
  doc.text("DADOS DO PARTICIPANTE", 14, y); y += 5;
  doc.setFont("helvetica", "normal"); doc.setFontSize(9);

  const bairroNome = bairros.find((b: any) => b.id === participante.bairro_id)?.nome || "—";
  const periodoLabel = participante.periodo === "manha" ? "Manhã" : participante.periodo === "tarde" ? "Tarde" : participante.periodo === "integral" ? "Integral" : "—";
  const idade = participante.data_nascimento ? Math.floor((Date.now() - new Date(participante.data_nascimento).getTime()) / 31557600000) + " anos" : "—";

  const dados = [
    ["Nome", participante.nome_completo || "—"],
    ["Data de Nascimento", `${participante.data_nascimento || "—"} (${idade})`],
    ["Bairro CAIA", bairroNome],
    ["Período", periodoLabel],
    ["Escola", participante.escola || "—"],
    ["Série", participante.serie || "—"],
    ["Responsável 1", `${participante.responsavel1_nome || "—"} — ${participante.responsavel1_whatsapp || "—"}`],
    ["Responsável 2", `${participante.responsavel2_nome || "—"} — ${participante.responsavel2_whatsapp || "—"}`],
    ["Laudo", participante.laudo || "Nenhum"],
    ["Vulnerabilidade", participante.categoria_vulnerabilidade || "Não informado"],
    ["Origem", participante.origem_encaminhamento || "—"],
  ];

  autoTable(doc, {
    startY: y,
    head: [],
    body: dados,
    theme: "plain",
    styles: { fontSize: 8, cellPadding: 1.5 },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 40 } },
    margin: { left: 14, right: 14 },
  });

  y = (doc as any).lastAutoTable?.finalY + 6 || y + 60;

  // Observações sigilosas
  if (participante.observacoes_sigilosas) {
    doc.setFontSize(10); doc.setFont("helvetica", "bold");
    doc.text("OBSERVAÇÕES SIGILOSAS", 14, y); y += 5;
    doc.setFont("helvetica", "normal"); doc.setFontSize(8);
    const lines = doc.splitTextToSize(participante.observacoes_sigilosas, 180);
    doc.text(lines, 14, y);
    y += lines.length * 3.5 + 4;
  }

  // Atendimentos
  doc.setFontSize(10); doc.setFont("helvetica", "bold");
  doc.text("REGISTRO DE ATENDIMENTOS", 14, y); y += 5;

  if (atendimentos.length === 0) {
    doc.setFont("helvetica", "normal"); doc.setFontSize(8);
    doc.text("Nenhum atendimento registrado.", 14, y);
  } else {
    const rows = atendimentos.map(a => [
      a.data_atendimento,
      TIPO_ATD_LABEL[a.tipo] || a.tipo,
      profiles.find((p: any) => p.id === a.profissional_id)?.nome || "—",
      a.descricao,
      a.encaminhamento || "—",
    ]);

    autoTable(doc, {
      startY: y,
      head: [["Data", "Tipo", "Profissional", "Descrição", "Encaminhamento"]],
      body: rows,
      headStyles: { fillColor: [180, 30, 30], fontSize: 7, cellPadding: 2 },
      styles: { fontSize: 7, cellPadding: 2 },
      columnStyles: { 0: { cellWidth: 18 }, 1: { cellWidth: 25 }, 2: { cellWidth: 25 }, 3: { cellWidth: 70 } },
      margin: { left: 14, right: 14 },
    });
  }

  // Rodapé
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7); doc.setTextColor(100);
    doc.text(`Emitido em ${format(new Date(), "dd/MM/yyyy HH:mm")} — Documento sigiloso — Página ${i}/${pageCount}`, 105, 290, { align: "center" });
    doc.setTextColor(0);
  }

  doc.save(`SysCFV_Prontuario_${participante.nome_completo.replace(/\s+/g, "_")}_${fileTimestamp()}.pdf`);
}
