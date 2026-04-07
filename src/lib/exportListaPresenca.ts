import * as XLSX from "xlsx-js-style";
import { saveAs } from "file-saver";
import { sysEloFileName } from "@/lib/fileNaming";
import { format } from "date-fns";

const MESES_NOMES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const DIAS_MAP: Record<string, number> = { dom: 0, seg: 1, ter: 2, qua: 3, qui: 4, sex: 5, sab: 6 };

interface TurmaInfo {
  id: string;
  nome: string;
  periodo?: string | null;
  faixa_etaria?: string | null;
  dias_semana?: string[] | null;
  profiles?: { nome: string } | null;
  bairros?: { nome: string } | null;
}

interface MemberInfo {
  nome: string;
}

const periodoLabel: Record<string, string> = { manha: "Manhã", tarde: "Tarde", integral: "Integral" };
const faixaLabel: Record<string, string> = { "6-8": "6-8 anos", "9-11": "9-11 anos", "12-17": "12-17 anos", idosos: "Idosos" };

function buildSheet(turma: TurmaInfo, members: MemberInfo[], mesNum: number, anoNum: number): XLSX.WorkSheet | null {
  const diasSemana: string[] = turma.dias_semana || [];
  const diasNum = diasSemana.map(d => DIAS_MAP[d.toLowerCase()]).filter(n => n !== undefined);
  const datas: string[] = [];
  const d = new Date(anoNum, mesNum - 1, 1);
  while (d.getMonth() === mesNum - 1) {
    if (diasNum.includes(d.getDay())) datas.push(format(d, "dd/MM"));
    d.setDate(d.getDate() + 1);
  }
  if (datas.length === 0) return null;

  const sorted = [...members].sort((a, b) => a.nome.localeCompare(b.nome));
  const totalCols = 2 + datas.length; // Nº + Nome + datas

  // --- Styles ---
  const border = { style: "thin" as const, color: { rgb: "000000" } };
  const borders = { top: border, bottom: border, left: border, right: border };
  const noBorder = { top: { style: "thin" as const, color: { rgb: "FFFFFF" } }, bottom: { style: "thin" as const, color: { rgb: "FFFFFF" } }, left: { style: "thin" as const, color: { rgb: "FFFFFF" } }, right: { style: "thin" as const, color: { rgb: "FFFFFF" } } };

  const titleStyle = { font: { bold: true, sz: 12 }, alignment: { horizontal: "center" as const, vertical: "center" as const, wrapText: true }, border: noBorder };
  const subtitleStyle = { font: { bold: true, sz: 10 }, alignment: { horizontal: "center" as const, vertical: "center" as const }, border: noBorder };
  const infoStyle = { font: { sz: 9 }, alignment: { horizontal: "left" as const, vertical: "center" as const }, border: noBorder };
  const infoRightStyle = { font: { sz: 9 }, alignment: { horizontal: "right" as const, vertical: "center" as const }, border: noBorder };
  const hdrStyle = { font: { bold: true, color: { rgb: "FFFFFF" }, sz: 8 }, fill: { fgColor: { rgb: "1A5276" } }, border: borders, alignment: { horizontal: "center" as const, vertical: "center" as const, wrapText: true } };
  const cellStyle = { border: borders, alignment: { vertical: "center" as const }, font: { sz: 8 } };
  const cellCenterStyle = { border: borders, alignment: { horizontal: "center" as const, vertical: "center" as const }, font: { sz: 8 } };
  const signStyle = { font: { sz: 9 }, alignment: { horizontal: "center" as const, vertical: "center" as const }, border: noBorder };

  // Build AOA
  const rows: any[][] = [];

  // Row 0: Institution name (merged)
  rows.push(["Sociedade Civil Nossa Senhora Aparecida"]);
  // Row 1: CAIA
  rows.push(["Centro de Atenção Integral ao Adolescente - CAIA Medianeira"]);
  // Row 2: blank
  rows.push([""]);
  // Row 3: Title
  rows.push([`LISTA DE PRESENÇA — ${MESES_NOMES[mesNum - 1].toUpperCase()} / ${anoNum}`]);
  // Row 4: Turma info line
  const turmaInfo = `Turma: ${turma.nome}`;
  const periodoInfo = turma.periodo ? `Período: ${periodoLabel[turma.periodo] || turma.periodo}` : "";
  const faixaInfo = turma.faixa_etaria ? `Faixa: ${faixaLabel[turma.faixa_etaria] || turma.faixa_etaria}` : "";
  rows.push([turmaInfo]);
  // Row 5: Educador + Bairro
  const educadorInfo = turma.profiles?.nome ? `Educador(a): ${turma.profiles.nome}` : "";
  const bairroInfo = turma.bairros?.nome ? `Bairro: ${turma.bairros.nome}` : "";
  rows.push([educadorInfo]);
  // Row 6: blank separator
  rows.push([""]);

  const headerStartRow = 7;
  // Row 7: Table header
  rows.push(["Nº", "Nome do Participante", ...datas]);

  // Data rows
  sorted.forEach((m, i) => {
    rows.push([i + 1, m.nome, ...datas.map(() => "")]);
  });

  // Blank row after data
  const signRow = headerStartRow + 1 + sorted.length + 1;
  rows.push([]); // blank

  // Signature row
  rows.push(["", "Assinatura do(a) Educador(a): _________________________________________"]);

  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Merges for header rows (span all columns)
  const merges: XLSX.Range[] = [];
  for (let r = 0; r <= 6; r++) {
    merges.push({ s: { r, c: 0 }, e: { r, c: totalCols - 1 } });
  }
  // Signature merge
  merges.push({ s: { r: signRow, c: 1 }, e: { r: signRow, c: totalCols - 1 } });
  ws["!merges"] = merges;

  // Apply styles
  const totalRows = rows.length;
  for (let r = 0; r < totalRows; r++) {
    for (let c = 0; c < totalCols; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      if (!ws[addr]) ws[addr] = { v: "", t: "s" };

      if (r === 0) ws[addr].s = titleStyle;
      else if (r === 1) ws[addr].s = subtitleStyle;
      else if (r === 2 || r === 6) ws[addr].s = { border: noBorder };
      else if (r === 3) ws[addr].s = { ...subtitleStyle, font: { bold: true, sz: 11 } };
      else if (r === 4) ws[addr].s = infoStyle;
      else if (r === 5) ws[addr].s = infoStyle;
      else if (r === headerStartRow) ws[addr].s = hdrStyle;
      else if (r > headerStartRow && r < headerStartRow + 1 + sorted.length) {
        ws[addr].s = c === 0 ? cellCenterStyle : (c >= 2 ? cellCenterStyle : cellStyle);
      } else if (r === signRow) {
        ws[addr].s = signStyle;
      } else {
        ws[addr].s = { border: noBorder };
      }
    }
  }

  // Add periodo/faixa info to row 4 (right side)
  const extraInfo = [periodoInfo, faixaInfo].filter(Boolean).join("   |   ");
  if (extraInfo && totalCols > 3) {
    // Put in merged header, already merged. Append to turma info
    const addr4 = XLSX.utils.encode_cell({ r: 4, c: 0 });
    ws[addr4] = { v: `${turmaInfo}     |     ${extraInfo}`, t: "s", s: infoStyle };
  }

  // Add bairro to row 5
  if (bairroInfo) {
    const addr5 = XLSX.utils.encode_cell({ r: 5, c: 0 });
    ws[addr5] = { v: `${educadorInfo}     |     ${bairroInfo}`, t: "s", s: infoStyle };
  }

  // Column widths for landscape A4
  ws["!cols"] = [{ wch: 4 }, { wch: 32 }, ...datas.map(() => ({ wch: 6 }))];

  // Row heights
  ws["!rows"] = [];
  ws["!rows"][0] = { hpt: 20 };
  ws["!rows"][1] = { hpt: 16 };
  ws["!rows"][3] = { hpt: 18 };
  for (let r = headerStartRow + 1; r < headerStartRow + 1 + sorted.length; r++) {
    ws["!rows"][r] = { hpt: 18 };
  }

  return ws;
}

function sanitizeSheetName(name: string, existingNames: string[]): string {
  let sheetName = name.replace(/[:\\/?*[\]]/g, "").slice(0, 31);
  let suffix = 2;
  while (existingNames.includes(sheetName)) {
    const tag = ` (${suffix})`;
    sheetName = name.replace(/[:\\/?*[\]]/g, "").slice(0, 31 - tag.length) + tag;
    suffix++;
  }
  return sheetName;
}

/** Export a single turma attendance list */
export function exportSingleListaPresenca(turma: TurmaInfo, members: MemberInfo[], mesNum: number, anoNum: number) {
  const ws = buildSheet(turma, members, mesNum, anoNum);
  if (!ws) return false;

  const wb = XLSX.utils.book_new();
  const sheetTitle = sanitizeSheetName(`${turma.nome} - ${MESES_NOMES[mesNum - 1]} ${anoNum}`, []);
  XLSX.utils.book_append_sheet(wb, ws, sheetTitle);
  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  saveAs(new Blob([buf], { type: "application/octet-stream" }), sysEloFileName("ListaPresenca", "xlsx", `${turma.nome}_${anoNum}-${String(mesNum).padStart(2, "0")}`));
  return true;
}

/** Export all turmas into one workbook with one sheet per turma */
export function exportAllListasPresenca(
  turmas: TurmaInfo[],
  membersByTurma: Record<string, MemberInfo[]>,
  mesNum: number,
  anoNum: number
): { success: boolean; sheetsAdded: number } {
  const wb = XLSX.utils.book_new();
  let sheetsAdded = 0;

  for (const t of turmas) {
    const members = membersByTurma[t.id] || [];
    const ws = buildSheet(t, members, mesNum, anoNum);
    if (!ws) continue;

    const sheetName = sanitizeSheetName(t.nome, wb.SheetNames || []);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    sheetsAdded++;
  }

  if (sheetsAdded === 0) return { success: false, sheetsAdded: 0 };

  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  saveAs(new Blob([buf], { type: "application/octet-stream" }), sysEloFileName("ListasPresenca", "xlsx", `${MESES_NOMES[mesNum - 1]}_${anoNum}`));
  return { success: true, sheetsAdded };
}
