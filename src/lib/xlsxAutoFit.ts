import * as XLSX from "xlsx-js-style";

/**
 * Auto-fit column widths based on cell content + apply wrapText globally.
 * Respects existing !cols as minimums, and applies a max cap.
 * Call AFTER populating the sheet data.
 */
export function autoFitColumns(ws: XLSX.WorkSheet, opts?: { min?: number; max?: number; padding?: number; wrapText?: boolean }) {
  const min = opts?.min ?? 4;
  const max = opts?.max ?? 120;
  const padding = opts?.padding ?? 2;
  const wrapText = opts?.wrapText ?? true;

  const range = XLSX.utils.decode_range(ws["!ref"] || "A1");
  const existing = ws["!cols"] || [];
  const colWidths: number[] = [];

  // Track max line count per row for auto row height
  const rowLineCounts: number[] = new Array(range.e.r - range.s.r + 1).fill(1);

  for (let c = range.s.c; c <= range.e.c; c++) {
    let best = existing[c]?.wch ?? min;
    const colMax = max;
    for (let r = range.s.r; r <= range.e.r; r++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = ws[addr];
      if (!cell || cell.v == null) continue;
      const val = String(cell.v);
      const lines = val.split("\n");
      const longest = Math.max(...lines.map(l => l.length));
      if (longest + padding > best) best = longest + padding;

      // Estimate wrapped lines for row height
      if (wrapText) {
        const colWidthEstimate = Math.min(best, colMax);
        const wrappedLines = lines.reduce((acc, l) => acc + Math.max(1, Math.ceil(l.length / Math.max(colWidthEstimate, 8))), 0);
        const rIdx = r - range.s.r;
        if (wrappedLines > rowLineCounts[rIdx]) rowLineCounts[rIdx] = wrappedLines;
      }
    }
    colWidths.push(Math.min(best, colMax));
  }

  ws["!cols"] = colWidths.map(w => ({ wch: w }));

  if (wrapText) {
    // Apply wrapText to all cells, preserving existing styles
    for (let r = range.s.r; r <= range.e.r; r++) {
      for (let c = range.s.c; c <= range.e.c; c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        const cell = ws[addr];
        if (!cell) continue;
        const existingStyle = (cell as any).s || {};
        const existingAlign = existingStyle.alignment || {};
        (cell as any).s = {
          ...existingStyle,
          alignment: { ...existingAlign, wrapText: true, vertical: existingAlign.vertical || "center" },
        };
      }
    }

    // Set row heights proportional to wrapped content (cap at 200pt)
    const existingRows = ws["!rows"] || [];
    const newRows: any[] = [];
    for (let r = range.s.r; r <= range.e.r; r++) {
      const rIdx = r - range.s.r;
      const lines = rowLineCounts[rIdx] || 1;
      const existingHpt = existingRows[r]?.hpt;
      const calcHpt = Math.min(15 + (lines - 1) * 13, 200);
      newRows[r] = { hpt: Math.max(existingHpt || 15, calcHpt) };
    }
    ws["!rows"] = newRows;
  }
}
