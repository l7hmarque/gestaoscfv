import * as XLSX from "xlsx-js-style";

const INST_LINES = [
  "Sociedade Civil Nossa Senhora Aparecida",
  "Centro de Atenção Integral ao Adolescente",
  "SCFV CAIA - Termo de Colaboração 001/2022",
];

const border = { style: "thin" as const, color: { rgb: "000000" } };
const borders = { top: border, bottom: border, left: border, right: border };
const borderLight = { style: "thin" as const, color: { rgb: "AAAAAA" } };
const bordersLight = { top: borderLight, bottom: borderLight, left: borderLight, right: borderLight };

const instStyles = [
  {
    font: { bold: true, sz: 12, color: { rgb: "1A5276" } },
    alignment: { horizontal: "center" as const, vertical: "center" as const, wrapText: true },
    border: borders,
    fill: { fgColor: { rgb: "EBF5FB" } },
  },
  {
    font: { bold: true, sz: 10, color: { rgb: "2C3E50" } },
    alignment: { horizontal: "center" as const, vertical: "center" as const, wrapText: true },
    border: borders,
    fill: { fgColor: { rgb: "EBF5FB" } },
  },
  {
    font: { bold: true, sz: 9, color: { rgb: "2C3E50" } },
    alignment: { horizontal: "center" as const, vertical: "center" as const, wrapText: true },
    border: borders,
    fill: { fgColor: { rgb: "EBF5FB" } },
  },
];

const titleStyle = {
  font: { bold: true, sz: 13, color: { rgb: "FFFFFF" } },
  alignment: { horizontal: "center" as const, vertical: "center" as const },
  border: borders,
  fill: { fgColor: { rgb: "1A5276" } },
};

const turmaInfoStyle = {
  font: { bold: true, sz: 11 },
  alignment: { horizontal: "center" as const, vertical: "center" as const },
  border: bordersLight,
  fill: { fgColor: { rgb: "D5F5E3" } },
};

const subInfoStyle = {
  font: { sz: 9 },
  alignment: { horizontal: "center" as const, vertical: "center" as const },
  border: bordersLight,
  fill: { fgColor: { rgb: "FAFAFA" } },
};

/**
 * Prepend institutional header rows to any sheet data array.
 * Returns [instLine1, instLine2, instLine3, blank, title, turmaInfo?, subInfo?, blank, ...originalRows]
 * Also returns the 0-based row index where the original data starts.
 */
export function addInstitutionalHeader(
  rows: any[][],
  title: string,
  turmaInfo?: string,
  subInfo?: string,
): { data: any[][]; dataStartOffset: number } {
  const header: any[][] = [
    [INST_LINES[0]],
    [INST_LINES[1]],
    [INST_LINES[2]],
    [""],
    [title],
  ];
  if (turmaInfo) header.push([turmaInfo]);
  if (subInfo) header.push([subInfo]);
  header.push([""]);
  return { data: [...header, ...rows], dataStartOffset: header.length };
}

/**
 * Apply institutional header styles to a worksheet.
 * Assumes rows 0-2 are inst lines, row 3 blank, row 4 title, then optional turma/sub info.
 * Merges each header row across totalCols.
 */
export function applyInstitutionalStyle(
  ws: XLSX.WorkSheet,
  totalCols: number,
  opts?: { hasTurmaInfo?: boolean; hasSubInfo?: boolean },
) {
  const merges: XLSX.Range[] = ws["!merges"] || [];
  const hasTurma = opts?.hasTurmaInfo ?? false;
  const hasSub = opts?.hasSubInfo ?? false;

  // Rows: 0=inst1, 1=inst2, 2=inst3, 3=blank, 4=title, 5?=turma, 6?=sub, 7?=blank
  const blankRow = 3;
  const titleRow = 4;
  const turmaRow = hasTurma ? 5 : -1;
  const subRow = hasTurma && hasSub ? 6 : (!hasTurma && hasSub ? 5 : -1);
  const lastHeaderRow = Math.max(titleRow, turmaRow, subRow) + 1; // blank separator

  for (let r = 0; r <= lastHeaderRow; r++) {
    merges.push({ s: { r, c: 0 }, e: { r, c: totalCols - 1 } });
    for (let c = 0; c < totalCols; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      if (!ws[addr]) ws[addr] = { v: "", t: "s" };

      if (r <= 2) {
        ws[addr].s = instStyles[r];
      } else if (r === blankRow || r === lastHeaderRow) {
        ws[addr].s = { border: bordersLight, fill: { fgColor: { rgb: "FFFFFF" } } };
      } else if (r === titleRow) {
        ws[addr].s = titleStyle;
      } else if (r === turmaRow) {
        ws[addr].s = turmaInfoStyle;
      } else if (r === subRow) {
        ws[addr].s = subInfoStyle;
      }
    }
  }

  ws["!merges"] = merges;

  // Row heights
  const rowInfo = ws["!rows"] || [];
  rowInfo[0] = { hpt: 22 };
  rowInfo[1] = { hpt: 18 };
  rowInfo[2] = { hpt: 16 };
  rowInfo[titleRow] = { hpt: 22 };
  if (turmaRow >= 0) rowInfo[turmaRow] = { hpt: 22 };
  if (subRow >= 0) rowInfo[subRow] = { hpt: 16 };
  ws["!rows"] = rowInfo;

  // Ensure min total width for header text
  const cols = ws["!cols"] || [];
  let totalWidth = 0;
  for (let c = 0; c < totalCols; c++) totalWidth += (cols[c]?.wch || 8);
  if (totalWidth < 60 && cols.length >= 2) {
    cols[1] = { wch: (cols[1]?.wch || 20) + (60 - totalWidth) };
    ws["!cols"] = cols;
  }
}

/** Apply bold + colored background to a table header row */
export function applyTableHeaderStyle(ws: XLSX.WorkSheet, row: number, colCount: number) {
  for (let c = 0; c < colCount; c++) {
    const addr = XLSX.utils.encode_cell({ r: row, c });
    if (!ws[addr]) ws[addr] = { v: "", t: "s" };
    ws[addr].s = {
      font: { bold: true, color: { rgb: "FFFFFF" }, sz: 9 },
      fill: { fgColor: { rgb: "1A5276" } },
      border: borders,
      alignment: { horizontal: "center" as const, vertical: "center" as const, wrapText: true },
    };
  }
}

/** Apply thin borders to all non-empty cells */
export function applyAllBorders(ws: XLSX.WorkSheet) {
  const range = XLSX.utils.decode_range(ws["!ref"] || "A1");
  for (let r = range.s.r; r <= range.e.r; r++) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      if (ws[addr]) {
        ws[addr].s = { ...(ws[addr].s || {}), border: borders };
      }
    }
  }
}
