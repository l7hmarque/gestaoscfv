import * as XLSX from "xlsx-js-style";

/**
 * Auto-fit column widths based on cell content.
 * Respects existing !cols as minimums, and applies a max cap.
 * Call AFTER populating the sheet data.
 */
export function autoFitColumns(ws: XLSX.WorkSheet, opts?: { min?: number; max?: number; padding?: number }) {
  const min = opts?.min ?? 4;
  const max = opts?.max ?? 60;
  const padding = opts?.padding ?? 2;

  const range = XLSX.utils.decode_range(ws["!ref"] || "A1");
  const existing = ws["!cols"] || [];
  const colWidths: number[] = [];

  for (let c = range.s.c; c <= range.e.c; c++) {
    let best = existing[c]?.wch ?? min;
    for (let r = range.s.r; r <= range.e.r; r++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = ws[addr];
      if (!cell || cell.v == null) continue;
      const val = String(cell.v);
      // For multiline, use the longest line
      const lines = val.split("\n");
      const longest = Math.max(...lines.map(l => l.length));
      if (longest + padding > best) best = longest + padding;
    }
    colWidths.push(Math.min(best, max));
  }

  ws["!cols"] = colWidths.map(w => ({ wch: w }));
}
