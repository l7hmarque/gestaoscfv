import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx-js-style";
import { saveAs } from "file-saver";
import { format } from "date-fns";
import JSZip from "jszip";
import { fetchAllRows } from "@/lib/fetchAllRows";
import { sysCfvFileName } from "@/lib/fileNaming";
import { toast } from "sonner";
import { buildRelatorioDocxBlob } from "@/hooks/useDocumentExport";
import type { ExportFormat } from "@/components/FormatPicker";

function safe(v: any, fallback = ""): string {
  if (v == null || v === "undefined" || v === "Undefined" || v === "") return fallback;
  return String(v);
}

interface BulkExportParams {
  dateFrom: string;
  dateTo: string;
  educadorId: string; // "todos" or a profile id
  /** Formatos a gerar. Default: todos os 3 (compatibilidade com chamadas antigas). */
  formatos?: ExportFormat[];
}

function slug(s: string): string {
  return (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\w\-]/g, "_").slice(0, 40);
}

export async function exportBulkRelatorios({
  dateFrom,
  dateTo,
  educadorId,
  formatos = ["docx", "pdf", "xlsx"],
}: BulkExportParams) {
  if (formatos.length === 0) {
    toast.error("Selecione ao menos um formato");
    return;
  }
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

  // Gera apenas os formatos solicitados — usa Promise.allSettled para tolerar falha parcial.
  const formatJobs: { name: ExportFormat; run: () => Promise<void> }[] = [];
  if (formatos.includes("docx")) {
    formatJobs.push({
      name: "docx",
      run: () => generateBulkDocxZip(filtered, presencaByRel, turmasByRel, fotosByRel, dateFrom, dateTo),
    });
  }
  if (formatos.includes("pdf")) {
    formatJobs.push({
      name: "pdf",
      run: () => generateBulkPdf(filtered, presencaByRel, turmasByRel, dateFrom, dateTo),
    });
  }
  if (formatos.includes("xlsx")) {
    formatJobs.push({
      name: "xlsx",
      run: () => generateBulkXlsx(filtered, presencaByRel, turmasByRel, dateFrom, dateTo),
    });
  }

  const results = await Promise.allSettled(formatJobs.map((j) => j.run()));
  const failed = results
    .map((r, i) => (r.status === "rejected" ? formatJobs[i].name.toUpperCase() : null))
    .filter(Boolean) as string[];

  if (failed.length > 0) {
    console.error("Export failures:", results.filter((r) => r.status === "rejected"));
    toast.error(`Falha ao gerar: ${failed.join(", ")}`);
  }
  const succeededNames = formatJobs.map((j) => j.name.toUpperCase()).filter((n) => !failed.includes(n));
  if (succeededNames.length > 0) {
    toast.success(`${filtered.length} relatório(s) exportados em ${succeededNames.join(", ")}!`);
  }
}

/**
 * Gera N arquivos DOCX (um por relatório) usando o builder único
 * `buildRelatorioDocxBlob` (a fonte canônica) e empacota num ZIP.
 * Elimina ~110 linhas de duplicação de cabeçalho/lista de presença.
 */
async function generateBulkDocxZip(
  relatorios: any[],
  presencaByRel: Map<string, any[]>,
  turmasByRel: Map<string, any[]>,
  fotosByRel: Map<string, any[]>,
  dateFrom: string,
  dateTo: string
) {
  const zip = new JSZip();
  for (const item of relatorios) {
    const turmaNames = (turmasByRel.get(item.id) || [])
      .map((rt: any) => rt.turmas?.nome || "")
      .filter(Boolean);
    const presenca = presencaByRel.get(item.id) || [];
    const fotos = fotosByRel.get(item.id) || [];
    try {
      const blob = await buildRelatorioDocxBlob(item, turmaNames, presenca, fotos);
      const dateStr = item.data ? format(new Date(item.data + "T12:00:00"), "yyyy-MM-dd") : "sem-data";
      const titulo = slug(item.nome_atividade || "Relatorio");
      const fname = `${dateStr}_${titulo}.docx`;
      zip.file(fname, blob);
    } catch (e) {
      console.warn("[bulk-docx] falha em relatório", item.id, e);
    }
  }
  const content = await zip.generateAsync({ type: "blob" });
  saveAs(content, sysCfvFileName("Relatorios_Lote", "zip", `${dateFrom}_a_${dateTo}`));
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

      // Paleta SCNSA + ■ presente · vazio ausente · (BA) busca ativa.
      // Coluna de assinatura do participante removida (decisão institucional —
      // o sistema é a fonte de verdade da frequência preenchida).
      autoTable(doc, {
        startY: py,
        head: [["Nº", "Nome do Participante", "Presença"]],
        body: presenca.map((p, i) => {
          const baTag = p.participantes?.status === "busca_ativa" ? " (BA)" : "";
          return [i + 1, safe(p.participantes?.nome_completo) + baTag, p.presente ? "■" : ""];
        }),
        headStyles: { fillColor: [0, 0, 0], fontSize: 7, textColor: [255, 255, 255] },
        styles: { fontSize: 7, cellPadding: 2 },
        columnStyles: { 0: { cellWidth: 8, halign: "center" }, 2: { cellWidth: 18, halign: "center" } },
        didParseCell: (data: any) => {
          if (data.section === "body" && data.column.index === 2) {
            data.cell.styles.halign = "center";
            data.cell.styles.fontStyle = "bold";
          }
          // PDF preto/branco: sem destaque colorido
        },
      });
      const finalY = (doc as any).lastAutoTable?.finalY || py;
      doc.setFontSize(7); doc.setFont("helvetica", "italic"); doc.setTextColor(90, 103, 112);
      doc.text(
        "Legenda: ■ Presente · vazio Ausente · (BA) Em busca ativa.",
        14,
        finalY + 4
      );
      doc.setTextColor(0); doc.setFont("helvetica", "normal");
      // Assinatura única do educador no rodapé
      doc.setFontSize(8);
      doc.text("________________________________", 105, finalY + 18, { align: "center" });
      doc.text("Assinatura do(a) Educador(a)", 105, finalY + 22, { align: "center" });
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
