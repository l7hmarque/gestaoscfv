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
  desligado?: boolean;
  data_desligamento?: string | null;
  transferido?: boolean;
  data_transferencia?: string | null;
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
  const totalCols = 2 + datas.length;

  // --- Styles ---
  const border = { style: "thin" as const, color: { rgb: "000000" } };
  const borders = { top: border, bottom: border, left: border, right: border };
  const borderLight = { style: "thin" as const, color: { rgb: "AAAAAA" } };
  const bordersLight = { top: borderLight, bottom: borderLight, left: borderLight, right: borderLight };
  const noBorder = { top: { style: "thin" as const, color: { rgb: "FFFFFF" } }, bottom: { style: "thin" as const, color: { rgb: "FFFFFF" } }, left: { style: "thin" as const, color: { rgb: "FFFFFF" } }, right: { style: "thin" as const, color: { rgb: "FFFFFF" } } };

  // Header styles with borders
  const institutionStyle = {
    font: { bold: true, sz: 11, color: { rgb: "1A5276" } },
    alignment: { horizontal: "center" as const, vertical: "center" as const, wrapText: true },
    border: borders,
    fill: { fgColor: { rgb: "EBF5FB" } },
  };
  const subtitleStyle = {
    font: { bold: true, sz: 9, color: { rgb: "2C3E50" } },
    alignment: { horizontal: "center" as const, vertical: "center" as const, wrapText: true },
    border: borders,
    fill: { fgColor: { rgb: "EBF5FB" } },
  };
  const titleStyle = {
    font: { bold: true, sz: 13, color: { rgb: "FFFFFF" } },
    alignment: { horizontal: "center" as const, vertical: "center" as const },
    border: borders,
    fill: { fgColor: { rgb: "1A5276" } },
  };
  const turmaNameStyle = {
    font: { bold: true, sz: 12 },
    alignment: { horizontal: "center" as const, vertical: "center" as const },
    border: bordersLight,
    fill: { fgColor: { rgb: "D5F5E3" } },
  };
  const infoStyle = {
    font: { sz: 9 },
    alignment: { horizontal: "center" as const, vertical: "center" as const },
    border: bordersLight,
    fill: { fgColor: { rgb: "FAFAFA" } },
  };
  const hdrStyle = {
    font: { bold: true, color: { rgb: "FFFFFF" }, sz: 8 },
    fill: { fgColor: { rgb: "1A5276" } },
    border: borders,
    alignment: { horizontal: "center" as const, vertical: "center" as const, wrapText: true },
  };
  const cellStyle = { border: borders, alignment: { vertical: "center" as const }, font: { sz: 8 } };
  const cellStrikeStyle = { border: borders, alignment: { vertical: "center" as const }, font: { sz: 8, strike: true, color: { rgb: "999999" } } };
  const cellCenterStyle = { border: borders, alignment: { horizontal: "center" as const, vertical: "center" as const }, font: { sz: 8 } };
  const signStyle = {
    font: { sz: 9, italic: true },
    alignment: { horizontal: "center" as const, vertical: "center" as const },
    border: { top: border, bottom: noBorder.bottom, left: noBorder.left, right: noBorder.right },
  };

  // Build AOA
  const rows: any[][] = [];

  // Row 0: Institution
  rows.push(["Sociedade Civil Nossa Senhora Aparecida"]);
  // Row 1: CAIA
  rows.push(["Centro de Atenção Integral ao Adolescente"]);
  // Row 2: Termo
  rows.push(["SCFV CAIA - Termo de Colaboração 001/2022"]);
  // Row 3: blank separator
  rows.push([""]);
  // Row 4: Title
  rows.push([`LISTA DE PRESENÇA — ${MESES_NOMES[mesNum - 1].toUpperCase()} / ${anoNum}`]);
  // Row 5: Turma name (large and bold)
  rows.push([`${turma.nome}`]);
  // Row 6: Info line
  const periodoInfo = turma.periodo ? periodoLabel[turma.periodo] || turma.periodo : "";
  const faixaInfo = turma.faixa_etaria ? faixaLabel[turma.faixa_etaria] || turma.faixa_etaria : "";
  const educadorInfo = turma.profiles?.nome || "";
  const bairroInfo = turma.bairros?.nome || "";
  const infoParts = [
    periodoInfo && `Período: ${periodoInfo}`,
    faixaInfo && `Faixa: ${faixaInfo}`,
    educadorInfo && `Educador(a): ${educadorInfo}`,
    bairroInfo && `Bairro: ${bairroInfo}`,
  ].filter(Boolean).join("  ·  ");
  rows.push([infoParts]);
  // Row 7: blank separator
  rows.push([""]);

  const headerStartRow = 8;
  // Row 7: Table header
  rows.push(["Nº", "Nome do Participante", ...datas]);

  // Data rows - desligados/transferidos at bottom with strikethrough
  const activeMembers = sorted.filter(m => !m.desligado && !m.transferido);
  const transferidoMembers = sorted.filter(m => m.transferido && !m.desligado);
  const desligadoMembers = sorted.filter(m => m.desligado);
  const orderedMembers = [...activeMembers, ...transferidoMembers, ...desligadoMembers];

  orderedMembers.forEach((m, i) => {
    const label = m.desligado
      ? `${m.nome} (D${m.data_desligamento ? " " + m.data_desligamento : ""})`
      : m.transferido
        ? `${m.nome} (T${m.data_transferencia ? " " + m.data_transferencia : ""})`
        : m.nome;
    rows.push([i + 1, label, ...datas.map(() => (m.desligado || m.transferido) ? "—" : "")]);
  });

  // Blank row + signature
  rows.push([]);
  const signRow = headerStartRow + 1 + orderedMembers.length + 1;
  rows.push(["", `Assinatura do(a) Educador(a): ${"_".repeat(60)}`]);

  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Merges for header rows
  const merges: XLSX.Range[] = [];
  for (let r = 0; r <= 7; r++) {
    merges.push({ s: { r, c: 0 }, e: { r, c: totalCols - 1 } });
  }
  merges.push({ s: { r: signRow, c: 1 }, e: { r: signRow, c: totalCols - 1 } });
  ws["!merges"] = merges;

  // Apply styles
  const totalRows = rows.length;
  for (let r = 0; r < totalRows; r++) {
    for (let c = 0; c < totalCols; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      if (!ws[addr]) ws[addr] = { v: "", t: "s" };

      if (r === 0) ws[addr].s = institutionStyle;
      else if (r === 1) ws[addr].s = subtitleStyle;
      else if (r === 2) ws[addr].s = subtitleStyle;
      else if (r === 3) ws[addr].s = { border: bordersLight, fill: { fgColor: { rgb: "FFFFFF" } } };
      else if (r === 4) ws[addr].s = titleStyle;
      else if (r === 5) ws[addr].s = turmaNameStyle;
      else if (r === 6) ws[addr].s = infoStyle;
      else if (r === 7) ws[addr].s = { border: bordersLight, fill: { fgColor: { rgb: "FFFFFF" } } };
      else if (r === headerStartRow) ws[addr].s = hdrStyle;
      else if (r > headerStartRow && r < headerStartRow + 1 + orderedMembers.length) {
        const memberIdx = r - headerStartRow - 1;
        const isDesligado = memberIdx >= activeMembers.length + transferidoMembers.length;
        const isTransferido = !isDesligado && memberIdx >= activeMembers.length;
        if (isDesligado || isTransferido) {
          const strikeColor = isTransferido ? "CC8800" : "999999";
          ws[addr].s = c === 0 ? { ...cellCenterStyle, font: { ...cellCenterStyle.font, strike: true, color: { rgb: strikeColor } } } : (c >= 2 ? { ...cellCenterStyle, font: { ...cellCenterStyle.font, strike: true, color: { rgb: strikeColor } } } : { ...cellStrikeStyle, font: { ...cellStrikeStyle.font, color: { rgb: strikeColor } } });
        } else {
          ws[addr].s = c === 0 ? cellCenterStyle : (c >= 2 ? cellCenterStyle : cellStyle);
        }
      } else if (r === signRow) {
        ws[addr].s = signStyle;
      } else {
        ws[addr].s = { border: noBorder };
      }
    }
  }

  // Column widths — auto-fit name column based on content, ensure header text fits
  const maxNameLen = Math.max(20, ...orderedMembers.map(m => {
    const label = m.desligado
      ? `${m.nome} (D${m.data_desligamento ? " " + m.data_desligamento : ""})`
      : m.transferido
        ? `${m.nome} (T${m.data_transferencia ? " " + m.data_transferencia : ""})`
        : m.nome;
    return label.length;
  }));
  let nameColWidth = Math.min(maxNameLen + 2, 55);
  // Ensure total width is enough to fit the institutional header text (~58 chars)
  const minTotalWidth = 60;
  const currentTotalWidth = 4 + nameColWidth + datas.length * 6;
  if (currentTotalWidth < minTotalWidth) {
    nameColWidth += (minTotalWidth - currentTotalWidth);
  }
  ws["!cols"] = [{ wch: 4 }, { wch: nameColWidth }, ...datas.map(() => ({ wch: 6 }))];

  // Row heights
  ws["!rows"] = [];
  ws["!rows"][0] = { hpt: 22 };
  ws["!rows"][1] = { hpt: 16 };
  ws["!rows"][2] = { hpt: 14 };
  ws["!rows"][4] = { hpt: 22 };
  ws["!rows"][5] = { hpt: 22 };
  ws["!rows"][6] = { hpt: 16 };
  for (let r = headerStartRow + 1; r < headerStartRow + 1 + orderedMembers.length; r++) {
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
