import * as XLSX from "xlsx-js-style";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { saveAs } from "file-saver";
import { sysEloFileName } from "@/lib/fileNaming";
import { autoFitColumns } from "@/lib/xlsxAutoFit";

export { sysEloFileName as exportFileName };

export function exportXLSX(data: Record<string, any>[], headers: { key: string; label: string }[], category: string) {
  const rows = data.map(r => {
    const obj: Record<string, any> = {};
    headers.forEach(h => { obj[h.label] = r[h.key] ?? ""; });
    return obj;
  });
  const ws = XLSX.utils.json_to_sheet(rows);
  autoFitColumns(ws);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, category);
  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  saveAs(new Blob([buf], { type: "application/octet-stream" }), sysEloFileName(category, "xlsx"));
}

export function exportPDF(data: Record<string, any>[], headers: { key: string; label: string }[], category: string) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  doc.setFontSize(14);
  doc.text(`SysELO — ${category}`, 14, 15);
  doc.setFontSize(8);
  doc.text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, 14, 21);

  autoTable(doc, {
    startY: 26,
    head: [headers.map(h => h.label)],
    body: data.map(r => headers.map(h => r[h.key] != null ? String(r[h.key]) : "")),
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: { fillColor: [198, 40, 40], textColor: 255, fontSize: 7 },
    alternateRowStyles: { fillColor: [245, 245, 245] },
  });

  doc.save(sysEloFileName(category, "pdf"));
}

export function generateXLSXBuffer(data: Record<string, any>[], headers: { key: string; label: string }[], sheetName: string): Uint8Array {
  const rows = data.map(r => {
    const obj: Record<string, any> = {};
    headers.forEach(h => { obj[h.label] = r[h.key] ?? ""; });
    return obj;
  });
  const ws = XLSX.utils.json_to_sheet(rows);
  autoFitColumns(ws);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  return new Uint8Array(XLSX.write(wb, { bookType: "xlsx", type: "array" }));
}
