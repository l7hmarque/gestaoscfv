import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { saveAs } from "file-saver";

function timestamp() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}_${String(d.getHours()).padStart(2,"0")}${String(d.getMinutes()).padStart(2,"0")}${String(d.getSeconds()).padStart(2,"0")}`;
}

export function exportFileName(category: string, ext: string) {
  return `SysELO_${category}_${timestamp()}.${ext}`;
}

export function exportXLSX(data: Record<string, any>[], headers: { key: string; label: string }[], category: string) {
  const rows = data.map(r => {
    const obj: Record<string, any> = {};
    headers.forEach(h => { obj[h.label] = r[h.key] ?? ""; });
    return obj;
  });
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, category);
  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  saveAs(new Blob([buf], { type: "application/octet-stream" }), exportFileName(category, "xlsx"));
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

  doc.save(exportFileName(category, "pdf"));
}

export function generateXLSXBuffer(data: Record<string, any>[], headers: { key: string; label: string }[], sheetName: string): Uint8Array {
  const rows = data.map(r => {
    const obj: Record<string, any> = {};
    headers.forEach(h => { obj[h.label] = r[h.key] ?? ""; });
    return obj;
  });
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  return new Uint8Array(XLSX.write(wb, { bookType: "xlsx", type: "array" }));
}
