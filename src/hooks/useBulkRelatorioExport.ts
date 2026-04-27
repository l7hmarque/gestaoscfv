import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, BorderStyle, WidthType, ShadingType, PageBreak, ImageRun,
} from "docx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx-js-style";
import { saveAs } from "file-saver";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/fetchAllRows";
import { sysCfvFileName } from "@/lib/fileNaming";
import { toast } from "sonner";

const HEADER_COLOR = "323232";
const ACCENT_COLOR = "000000";
const LIGHT_BG = "F5F5F5";
const cellBorder = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
const borders = { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder };
const cellMargins = { top: 60, bottom: 60, left: 80, right: 80 };

const LIKERT_LABELS: Record<number, string> = {
  1: "Muito Baixo", 2: "Baixo", 3: "Moderado", 4: "Alto", 5: "Excepcional",
};

function safe(v: any, fallback = ""): string {
  if (v == null || v === "undefined" || v === "Undefined" || v === "") return fallback;
  return String(v);
}

function headerParagraphs(): Paragraph[] {
  return [
    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "PREFEITURA MUNICIPAL DE MEDIANEIRA", bold: true, size: 20, font: "Arial" })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "SECRETARIA DE ASSISTÊNCIA SOCIAL", size: 18, font: "Arial" })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "CAIA — Centro de Atendimento Integrado ao Adolescente", size: 18, font: "Arial" })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Serviço de Convivência e Fortalecimento de Vínculos — SCFV", size: 16, font: "Arial", italics: true })] }),
    new Paragraph({ spacing: { after: 200 }, children: [] }),
  ];
}

function infoRow(label: string, value: string): TableRow {
  return new TableRow({
    children: [
      new TableCell({ width: { size: 2800, type: WidthType.DXA }, borders, margins: cellMargins, shading: { fill: LIGHT_BG, type: ShadingType.CLEAR }, children: [new Paragraph({ children: [new TextRun({ text: label, bold: true, size: 18, font: "Arial" })] })] }),
      new TableCell({ width: { size: 6560, type: WidthType.DXA }, borders, margins: cellMargins, children: [new Paragraph({ children: [new TextRun({ text: value || "—", size: 18, font: "Arial" })] })] }),
    ],
  });
}

interface BulkExportParams {
  dateFrom: string;
  dateTo: string;
  educadorId: string; // "todos" or a profile id
}

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
      let width = 800, height = 600;
      try {
        const bitmap = await createImageBitmap(blob);
        width = bitmap.width; height = bitmap.height;
        bitmap.close();
      } catch { /* defaults */ }
      results.push({ buffer, width, height, type });
    } catch { /* skip */ }
  }
  return results;
}

export async function exportBulkRelatorios({ dateFrom, dateTo, educadorId }: BulkExportParams) {
  toast.info("Carregando dados para exportação...");

  // Fetch all needed data
  const [relatorios, relPresenca, relTurmas, relFotos, profiles, turmas, participantes] = await Promise.all([
    fetchAllRows("relatorios_atividade", { select: "*, profiles!relatorios_atividade_educador_id_fkey(nome), planejamentos!relatorios_atividade_planejamento_id_fkey(titulo)", order: { column: "data", ascending: true } }),
    fetchAllRows("relatorio_presenca", { select: "*, participantes(nome_completo)" }),
    fetchAllRows("relatorio_turmas", { select: "*, turmas(nome)" }),
    fetchAllRows("relatorio_fotos", { select: "*" }),
    fetchAllRows("profiles", { select: "id, nome" }),
    fetchAllRows("turmas", { select: "id, nome" }),
    fetchAllRows("participantes", { select: "id, nome_completo, status, data_desligamento" }),
  ]);

  // Filter by date range
  let filtered = (relatorios || []).filter((r: any) => r.data >= dateFrom && r.data <= dateTo);
  
  // Filter by educator
  if (educadorId !== "todos") {
    filtered = filtered.filter((r: any) => r.educador_id === educadorId);
  }

  if (filtered.length === 0) {
    toast.error("Nenhum relatório encontrado no período selecionado.");
    return;
  }

  toast.info(`Exportando ${filtered.length} relatório(s)...`);

  // Build lookup maps
  const presencaByRel = new Map<string, any[]>();
  (relPresenca || []).forEach((rp: any) => {
    const arr = presencaByRel.get(rp.relatorio_id) || [];
    arr.push(rp);
    presencaByRel.set(rp.relatorio_id, arr);
  });

  const turmasByRel = new Map<string, any[]>();
  (relTurmas || []).forEach((rt: any) => {
    const arr = turmasByRel.get(rt.relatorio_id) || [];
    arr.push(rt);
    turmasByRel.set(rt.relatorio_id, arr);
  });

  const fotosByRel = new Map<string, any[]>();
  (relFotos || []).forEach((rf: any) => {
    const arr = fotosByRel.get(rf.relatorio_id) || [];
    arr.push(rf);
    fotosByRel.set(rf.relatorio_id, arr);
  });

  // Generate all formats in parallel — use allSettled so one failure doesn't block others
  const results = await Promise.allSettled([
    generateBulkDocx(filtered, presencaByRel, turmasByRel, fotosByRel, dateFrom, dateTo),
    generateBulkPdf(filtered, presencaByRel, turmasByRel, dateFrom, dateTo),
    generateBulkXlsx(filtered, presencaByRel, turmasByRel, dateFrom, dateTo),
  ]);

  const formatNames = ["DOCX", "PDF", "XLSX"];
  const failed = results
    .map((r, i) => r.status === "rejected" ? formatNames[i] : null)
    .filter(Boolean);
  
  if (failed.length > 0) {
    console.error("Export failures:", results.filter(r => r.status === "rejected"));
    toast.error(`Falha ao gerar: ${failed.join(", ")}`);
  }
  
  const succeeded = formatNames.length - failed.length;
  if (succeeded > 0) {
    toast.success(`${filtered.length} relatório(s) exportados em ${formatNames.filter(f => !failed.includes(f)).join(", ")}!`);
  }
}

async function generateBulkDocx(
  relatorios: any[], presencaByRel: Map<string, any[]>, turmasByRel: Map<string, any[]>,
  fotosByRel: Map<string, any[]>, dateFrom: string, dateTo: string
) {
  const sections: any[] = [];

  for (let idx = 0; idx < relatorios.length; idx++) {
    const item = relatorios[idx];
    const turmaNames = (turmasByRel.get(item.id) || []).map((rt: any) => rt.turmas?.nome || "").filter(Boolean);
    const presenca = presencaByRel.get(item.id) || [];
    const fotos = fotosByRel.get(item.id) || [];

    const children: any[] = [
      ...headerParagraphs(),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [
        new TextRun({ text: "RELATÓRIO DE ATIVIDADE", bold: true, size: 24, font: "Arial", color: ACCENT_COLOR }),
      ]}),
    ];

    const rows = [
      infoRow("Data", item.data ? format(new Date(item.data + "T12:00:00"), "dd/MM/yyyy") : ""),
      infoRow("Dia da Semana", safe(item.dia_semana)),
      infoRow("Educador", safe(item.profiles?.nome)),
      infoRow("Turma(s)", turmaNames.join(", ")),
      infoRow("Tipo de Atividade", Array.isArray(item.tipo_atividade) ? item.tipo_atividade.join(", ") : safe(item.tipo_atividade)),
      infoRow("Nome da Atividade", safe(item.nome_atividade)),
      infoRow("Score ELO", item.score_elo?.toFixed(2) || ""),
      infoRow("Presentes/Matriculados", `${item.num_participantes ?? 0}/${item.num_matriculados ?? 0}`),
      infoRow("% Adesão", item.pct_adesao != null ? `${Number(item.pct_adesao).toFixed(0)}%` : ""),
    ];
    if (item.objetivo_alcancado) {
      const objLabels: Record<string, string> = { alcancado: "Alcançado", parcial: "Parcial", nao_alcancado: "Não Alcançado" };
      rows.push(infoRow("Objetivo", objLabels[item.objetivo_alcancado] || item.objetivo_alcancado));
    }
    if (item.intervencoes) rows.push(infoRow("Intervenções", item.intervencoes));
    if (item.observacoes) rows.push(infoRow("Observações", item.observacoes));
    if (item.analise_ia) rows.push(infoRow("Análise IA", item.analise_ia));

    children.push(new Table({ width: { size: 9360, type: WidthType.DXA }, columnWidths: [2800, 6560], rows }));

    // Attendance table
    if (presenca.length > 0) {
      children.push(new Paragraph({ children: [new PageBreak()] }));
      children.push(...headerParagraphs());
      children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 100 }, children: [
        new TextRun({ text: "LISTA DE PRESENÇA", bold: true, size: 22, font: "Arial", color: ACCENT_COLOR }),
      ]}));
      children.push(new Paragraph({ spacing: { after: 50 }, children: [
        new TextRun({ text: `Atividade: ${safe(item.nome_atividade)}  |  Data: ${item.data ? format(new Date(item.data + "T12:00:00"), "dd/MM/yyyy") : ""}  |  Turma(s): ${turmaNames.join(", ")}`, size: 16, font: "Arial" }),
      ]}));
      children.push(new Paragraph({ spacing: { after: 100 }, children: [
        new TextRun({ text: `Educador(a): ${safe(item.profiles?.nome)}`, size: 16, font: "Arial" }),
      ]}));

      const presRows = [
        new TableRow({ children: [
          new TableCell({ width: { size: 600, type: WidthType.DXA }, borders, margins: cellMargins, shading: { fill: HEADER_COLOR, type: ShadingType.CLEAR }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Nº", bold: true, size: 14, font: "Arial", color: "FFFFFF" })] })] }),
          new TableCell({ width: { size: 6260, type: WidthType.DXA }, borders, margins: cellMargins, shading: { fill: HEADER_COLOR, type: ShadingType.CLEAR }, children: [new Paragraph({ children: [new TextRun({ text: "Nome do Participante", bold: true, size: 14, font: "Arial", color: "FFFFFF" })] })] }),
          new TableCell({ width: { size: 1200, type: WidthType.DXA }, borders, margins: cellMargins, shading: { fill: HEADER_COLOR, type: ShadingType.CLEAR }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Presença", bold: true, size: 14, font: "Arial", color: "FFFFFF" })] })] }),
          new TableCell({ width: { size: 1300, type: WidthType.DXA }, borders, margins: cellMargins, shading: { fill: HEADER_COLOR, type: ShadingType.CLEAR }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Assinatura", bold: true, size: 14, font: "Arial", color: "FFFFFF" })] })] }),
        ]}),
        ...presenca.map((p, i) => new TableRow({ children: [
          new TableCell({ width: { size: 600, type: WidthType.DXA }, borders, margins: cellMargins, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: String(i + 1), size: 14, font: "Arial" })] })] }),
          new TableCell({ width: { size: 6260, type: WidthType.DXA }, borders, margins: cellMargins, children: [new Paragraph({ children: [new TextRun({ text: safe(p.participantes?.nome_completo), size: 14, font: "Arial" })] })] }),
          new TableCell({
            width: { size: 1200, type: WidthType.DXA }, borders, margins: cellMargins,
            shading: { fill: p.presente ? "E0E0E0" : "FFFFFF", type: ShadingType.CLEAR },
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: p.presente ? "✓" : "", size: 18, font: "Arial", bold: true })] })],
          }),
          new TableCell({ width: { size: 1300, type: WidthType.DXA }, borders, margins: cellMargins, children: [new Paragraph({ children: [] })] }),
        ]})),
      ];
      children.push(new Table({ width: { size: 9360, type: WidthType.DXA }, columnWidths: [600, 6260, 1200, 1300], rows: presRows }));
      children.push(new Paragraph({ spacing: { before: 300 }, children: [] }));
      children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "________________________________", size: 18, font: "Arial" })] }));
      children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Assinatura do(a) Educador(a)", size: 16, font: "Arial", italics: true })] }));
    }

    // Photos
    if (fotos.length > 0) {
      const photoBuffers = await fetchPhotosAsBuffers(fotos);
      if (photoBuffers.length > 0) {
        children.push(new Paragraph({ children: [new PageBreak()] }));
        children.push(new Paragraph({ spacing: { after: 200 }, alignment: AlignmentType.CENTER, children: [
          new TextRun({ text: "REGISTRO FOTOGRÁFICO", bold: true, size: 22, font: "Arial", color: ACCENT_COLOR }),
        ]}));
        children.push(new Paragraph({ spacing: { after: 100 }, alignment: AlignmentType.CENTER, children: [
          new TextRun({ text: `${safe(item.nome_atividade)} — ${item.data ? format(new Date(item.data + "T12:00:00"), "dd/MM/yyyy") : ""}`, size: 16, font: "Arial", italics: true }),
        ]}));
        for (const photo of photoBuffers) {
          const maxW = 450;
          const scale = maxW / photo.width;
          const scaledH = Math.round(photo.height * scale);
          children.push(new Paragraph({
            alignment: AlignmentType.CENTER, spacing: { after: 120 },
            children: [new ImageRun({ type: photo.type, data: photo.buffer, transformation: { width: maxW, height: scaledH } })],
          }));
        }
      }
    }

    sections.push({ properties: { page: { margin: { top: 720, right: 720, bottom: 720, left: 720 } } }, children });
  }

  const doc = new Document({
    styles: { default: { document: { run: { font: "Arial", size: 20 } } } },
    sections,
  });
  saveAs(await Packer.toBlob(doc), sysCfvFileName("Relatorios_Lote", "docx", `${dateFrom}_a_${dateTo}`));
}

async function generateBulkPdf(
  relatorios: any[], presencaByRel: Map<string, any[]>, turmasByRel: Map<string, any[]>,
  dateFrom: string, dateTo: string
) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  
  for (let idx = 0; idx < relatorios.length; idx++) {
    const item = relatorios[idx];
    const turmaNames = (turmasByRel.get(item.id) || []).map((rt: any) => rt.turmas?.nome || "").filter(Boolean);
    const presenca = presencaByRel.get(item.id) || [];

    if (idx > 0) doc.addPage();

    let y = 10;
    doc.setFontSize(10); doc.setFont("helvetica", "bold");
    doc.text("PREFEITURA MUNICIPAL DE MEDIANEIRA", 105, y, { align: "center" });
    y += 4; doc.setFont("helvetica", "normal"); doc.setFontSize(9);
    doc.text("SECRETARIA DE ASSISTÊNCIA SOCIAL — CAIA — SCFV", 105, y, { align: "center" });
    y += 6; doc.setFontSize(13); doc.setTextColor(0, 0, 0); doc.setFont("helvetica", "bold");
    doc.text("RELATÓRIO DE ATIVIDADE", 105, y, { align: "center" });
    doc.setTextColor(0); doc.setFont("helvetica", "normal"); y += 8;

    const info = [
      ["Data", item.data ? format(new Date(item.data + "T12:00:00"), "dd/MM/yyyy") : ""],
      ["Educador", safe(item.profiles?.nome)],
      ["Turma(s)", turmaNames.join(", ")],
      ["Atividade", safe(item.nome_atividade)],
      ["Score ELO", item.score_elo?.toFixed(2) || ""],
      ["Presentes/Matriculados", `${item.num_participantes ?? 0}/${item.num_matriculados ?? 0}`],
      ["% Adesão", item.pct_adesao != null ? `${Number(item.pct_adesao).toFixed(0)}%` : ""],
    ];
    if (item.intervencoes) info.push(["Intervenções", item.intervencoes]);
    if (item.observacoes) info.push(["Observações", item.observacoes]);

    autoTable(doc, {
      startY: y, body: info, theme: "grid",
      styles: { fontSize: 8, cellPadding: 2 },
      columnStyles: { 0: { fontStyle: "bold", cellWidth: 35, fillColor: [245, 245, 245] } },
    });
    y = (doc as any).lastAutoTable.finalY + 4;

    // Attendance
    if (presenca.length > 0) {
      doc.addPage();
      let py = 10;
      doc.setFontSize(10); doc.setFont("helvetica", "bold");
      doc.text("PREFEITURA MUNICIPAL DE MEDIANEIRA", 105, py, { align: "center" });
      py += 4; doc.setFont("helvetica", "normal"); doc.setFontSize(9);
      doc.text("SECRETARIA DE ASSISTÊNCIA SOCIAL — CAIA — SCFV", 105, py, { align: "center" });
      py += 6; doc.setFontSize(11); doc.setFont("helvetica", "bold");
      doc.text("LISTA DE PRESENÇA", 105, py, { align: "center" }); py += 4;
      doc.setFontSize(8); doc.setFont("helvetica", "normal");
      doc.text(`Atividade: ${safe(item.nome_atividade)}  |  Data: ${item.data ? format(new Date(item.data + "T12:00:00"), "dd/MM/yyyy") : ""}  |  Turma(s): ${turmaNames.join(", ")}`, 14, py);
      py += 4;
      doc.text(`Educador(a): ${safe(item.profiles?.nome)}`, 14, py);

      autoTable(doc, {
        startY: py,
        head: [["Nº", "Nome do Participante", "Presença", "Assinatura"]],
        body: presenca.map((p, i) => [i + 1, safe(p.participantes?.nome_completo), p.presente ? "✓" : "", ""]),
        headStyles: { fillColor: [50, 50, 50], fontSize: 7, textColor: [255, 255, 255] },
        styles: { fontSize: 7, cellPadding: 2 },
        columnStyles: { 0: { cellWidth: 8, halign: "center" }, 2: { cellWidth: 18, halign: "center" }, 3: { cellWidth: 35 } },
        alternateRowStyles: { fillColor: [245, 245, 245] },
        didParseCell: (data: any) => {
          if (data.section === "body" && data.column.index === 2) {
            const isPresente = data.cell.raw === "✓";
            data.cell.styles.fillColor = isPresente ? [235, 235, 235] : [255, 255, 255];
            data.cell.styles.textColor = [0, 0, 0];
            data.cell.styles.fontStyle = "bold";
          }
        },
      });
    }
  }

  doc.save(sysCfvFileName("Relatorios_Lote", "pdf", `${dateFrom}_a_${dateTo}`));
}

async function generateBulkXlsx(
  relatorios: any[], presencaByRel: Map<string, any[]>, turmasByRel: Map<string, any[]>,
  dateFrom: string, dateTo: string
) {
  const wb = XLSX.utils.book_new();
  const border = { style: "thin" as const, color: { rgb: "000000" } };
  const borderObj = { top: border, bottom: border, left: border, right: border };

  // Summary sheet
  const summaryRows: any[][] = [
    ["Sociedade Civil Nossa Senhora Aparecida"],
    ["Centro de Atenção Integral ao Adolescente - CAIA Medianeira"],
    [`RELATÓRIOS DE ATIVIDADE — ${dateFrom} a ${dateTo}`],
    [],
    ["Data", "Educador", "Atividade", "Turma(s)", "Score ELO", "Presentes", "Matriculados", "% Adesão", "Objetivo"],
  ];

  const objLabels: Record<string, string> = { alcancado: "Alcançado", parcial: "Parcial", nao_alcancado: "Não Alcançado" };

  relatorios.forEach((r: any) => {
    const turmaNames = (turmasByRel.get(r.id) || []).map((rt: any) => rt.turmas?.nome || "").filter(Boolean);
    summaryRows.push([
      r.data ? format(new Date(r.data + "T12:00:00"), "dd/MM/yyyy") : "",
      safe(r.profiles?.nome),
      safe(r.nome_atividade),
      turmaNames.join(", "),
      r.score_elo ? Number(r.score_elo).toFixed(2) : "",
      r.num_participantes ?? 0,
      r.num_matriculados ?? 0,
      r.pct_adesao != null ? `${Number(r.pct_adesao).toFixed(0)}%` : "",
      r.objetivo_alcancado ? (objLabels[r.objetivo_alcancado] || r.objetivo_alcancado) : "",
    ]);
  });

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  wsSummary["!cols"] = [{ wch: 12 }, { wch: 25 }, { wch: 35 }, { wch: 25 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 10 }, { wch: 15 }];
  // Style header rows
  for (let r = 0; r < 3; r++) {
    const addr = XLSX.utils.encode_cell({ r, c: 0 });
    if (wsSummary[addr]) wsSummary[addr].s = { font: { bold: true, sz: 14 }, alignment: { horizontal: "center" } };
  }
  // Style table header
  for (let c = 0; c < 9; c++) {
    const addr = XLSX.utils.encode_cell({ r: 4, c });
    if (wsSummary[addr]) wsSummary[addr].s = { font: { bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "1A5276" } }, border: borderObj };
  }
  // Borders on data
  const range = XLSX.utils.decode_range(wsSummary["!ref"] || "A1");
  for (let r = 4; r <= range.e.r; r++) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      if (!wsSummary[addr]) wsSummary[addr] = { v: "", t: "s" };
      wsSummary[addr].s = { ...(wsSummary[addr].s || {}), border: borderObj };
    }
  }
  // Merges for inst header
  wsSummary["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 8 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 8 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: 8 } },
  ];
  XLSX.utils.book_append_sheet(wb, wsSummary, "Resumo");

  // One sheet per report's attendance
  const usedNames = new Set<string>(["Resumo"]);
  relatorios.forEach((r: any) => {
    const presenca = presencaByRel.get(r.id) || [];
    if (presenca.length === 0) return;

    const turmaNames = (turmasByRel.get(r.id) || []).map((rt: any) => rt.turmas?.nome || "").filter(Boolean);
    const dateStr = r.data ? format(new Date(r.data + "T12:00:00"), "dd-MM") : "sem-data";
    let sheetName = `${dateStr} ${safe(r.nome_atividade).slice(0, 20)}`.replace(/[:\\/?*[\]]/g, "").slice(0, 31);
    let suffix = 2;
    while (usedNames.has(sheetName)) {
      const tag = ` (${suffix})`;
      sheetName = sheetName.slice(0, 31 - tag.length) + tag;
      suffix++;
    }
    usedNames.add(sheetName);

    const rows: any[][] = [
      ["Sociedade Civil Nossa Senhora Aparecida"],
      ["Centro de Atenção Integral ao Adolescente - CAIA Medianeira"],
      [`LISTA DE PRESENÇA — ${safe(r.nome_atividade)} — ${r.data ? format(new Date(r.data + "T12:00:00"), "dd/MM/yyyy") : ""}`],
      [`Educador(a): ${safe(r.profiles?.nome)}  |  Turma(s): ${turmaNames.join(", ")}`],
      [],
      ["Nº", "Nome do Participante", "Presença"],
    ];

    presenca.forEach((p: any, i: number) => {
      rows.push([i + 1, safe(p.participantes?.nome_completo), p.presente ? "✓" : ""]);
    });

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [{ wch: 5 }, { wch: 45 }, { wch: 12 }];
    ws["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 2 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 2 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: 2 } },
      { s: { r: 3, c: 0 }, e: { r: 3, c: 2 } },
    ];
    // Style
    for (let r2 = 0; r2 < 4; r2++) {
      const addr = XLSX.utils.encode_cell({ r: r2, c: 0 });
      if (ws[addr]) ws[addr].s = { font: { bold: true, sz: r2 < 2 ? 12 : 10 }, alignment: { horizontal: "center" } };
    }
    for (let c = 0; c < 3; c++) {
      const addr = XLSX.utils.encode_cell({ r: 5, c });
      if (ws[addr]) ws[addr].s = { font: { bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "1A5276" } }, border: borderObj, alignment: { horizontal: "center" } };
    }
    const range2 = XLSX.utils.decode_range(ws["!ref"] || "A1");
    for (let r2 = 5; r2 <= range2.e.r; r2++) {
      for (let c = 0; c <= 2; c++) {
        const addr = XLSX.utils.encode_cell({ r: r2, c });
        if (!ws[addr]) ws[addr] = { v: "", t: "s" };
        ws[addr].s = { ...(ws[addr].s || {}), border: borderObj };
      }
    }

    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  });

  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  saveAs(new Blob([buf], { type: "application/octet-stream" }), sysCfvFileName("Relatorios_Lote", "xlsx", `${dateFrom}_a_${dateTo}`));
}
