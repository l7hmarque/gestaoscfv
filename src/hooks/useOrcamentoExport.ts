import * as XLSX from "xlsx-js-style";
import { saveAs } from "file-saver";
import { sysEloFileName } from "@/lib/fileNaming";

const headerStyle = { font: { bold: true, sz: 10, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "C62828" } }, alignment: { horizontal: "center" as const }, border: { top: { style: "thin" as const }, bottom: { style: "thin" as const }, left: { style: "thin" as const }, right: { style: "thin" as const } } };
const cellStyle = { font: { sz: 9 }, border: { top: { style: "thin" as const }, bottom: { style: "thin" as const }, left: { style: "thin" as const }, right: { style: "thin" as const } } };
const boldCell = { ...cellStyle, font: { sz: 9, bold: true } };

interface Item { id: string; item_num: number; descricao: string; unidade_medida: string; quantidade: number; }
interface Cotacao { id: string; fornecedor_nome: string; cnpj: string | null; data_emissao: string | null; data_validade: string | null; }
interface Preco { id: string; cotacao_id: string; item_id: string; preco_unitario: number; }
interface Orc { titulo: string; objeto: string | null; mes_referencia: string; categoria_id: string | null; }
interface Cat { id: string; codigo: string; descricao: string; }

function getPreco(precos: Preco[], cotacaoId: string, itemId: string): number {
  return precos.find(p => p.cotacao_id === cotacaoId && p.item_id === itemId)?.preco_unitario || 0;
}

export function exportOrcamentoXLSX(orc: Orc, items: Item[], cotacoes: Cotacao[], precos: Preco[], categorias: Cat[]) {
  const wb = XLSX.utils.book_new();
  const cat = categorias.find(c => c.id === orc.categoria_id);

  for (const cot of cotacoes) {
    const data: any[][] = [];
    data.push(["PREFEITURA MUNICIPAL DE MEDIANEIRA"]);
    data.push(["SECRETARIA DE ASSISTÊNCIA SOCIAL"]);
    data.push(["CAIA — Serviço de Convivência e Fortalecimento de Vínculos"]);
    data.push([]);
    data.push([`ORÇAMENTO: ${orc.titulo}`]);
    data.push([`Objeto: ${orc.objeto || "—"}`]);
    data.push([`Categoria: ${cat ? `${cat.codigo} — ${cat.descricao}` : "—"}`]);
    data.push([`Fornecedor: ${cot.fornecedor_nome}`, "", `CNPJ: ${cot.cnpj || "—"}`]);
    data.push([`Emissão: ${cot.data_emissao || "—"}`, "", `Validade: ${cot.data_validade || "—"}`]);
    data.push([]);
    data.push(["ITEM", "DESCRIÇÃO", "UNID.", "QTD.", "VL. UNIT.", "VL. TOTAL"]);

    let total = 0;
    for (const item of items) {
      const preco = getPreco(precos, cot.id, item.id);
      const subtotal = preco * item.quantidade;
      total += subtotal;
      data.push([item.item_num, item.descricao, item.unidade_medida, item.quantidade, preco, subtotal]);
    }
    data.push(["", "", "", "", "TOTAL:", total]);

    const ws = XLSX.utils.aoa_to_sheet(data);
    ws["!cols"] = [{ wch: 6 }, { wch: 40 }, { wch: 8 }, { wch: 8 }, { wch: 12 }, { wch: 14 }];

    const headerRow = 10;
    for (let c = 0; c < 6; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r: headerRow, c })];
      if (cell) cell.s = headerStyle;
    }
    for (let r = headerRow + 1; r < data.length; r++) {
      for (let c = 0; c < 6; c++) {
        const cell = ws[XLSX.utils.encode_cell({ r, c })];
        if (cell) cell.s = r === data.length - 1 ? boldCell : cellStyle;
      }
    }

    XLSX.utils.book_append_sheet(wb, ws, cot.fornecedor_nome.substring(0, 31));
  }

  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  saveAs(new Blob([buf]), sysEloFileName("Orcamento", "xlsx"));
}

export function exportMapaComparativoXLSX(orc: Orc, items: Item[], cotacoes: Cotacao[], precos: Preco[], categorias: Cat[]) {
  const cat = categorias.find(c => c.id === orc.categoria_id);
  const data: any[][] = [];

  data.push(["PREFEITURA MUNICIPAL DE MEDIANEIRA"]);
  data.push(["SECRETARIA DE ASSISTÊNCIA SOCIAL"]);
  data.push(["MAPA COMPARATIVO DE PREÇOS"]);
  data.push([]);
  data.push([`Orçamento: ${orc.titulo}`, "", `Categoria: ${cat ? cat.codigo : "—"}`]);
  data.push([]);

  const header = ["ITEM", "DESCRIÇÃO", "UNID.", "QTD."];
  for (const cot of cotacoes) {
    header.push(`${cot.fornecedor_nome} (Unit.)`, `${cot.fornecedor_nome} (Total)`);
  }
  header.push("MENOR PREÇO");
  data.push(header);

  for (const item of items) {
    const row: any[] = [item.item_num, item.descricao, item.unidade_medida, item.quantidade];
    let menorTotal = Infinity;
    for (const cot of cotacoes) {
      const preco = getPreco(precos, cot.id, item.id);
      const total = preco * item.quantidade;
      row.push(preco, total);
      if (total > 0 && total < menorTotal) menorTotal = total;
    }
    row.push(menorTotal === Infinity ? 0 : menorTotal);
    data.push(row);
  }

  const totalsRow: any[] = ["", "", "", "TOTAL"];
  let menorGlobal = Infinity;
  let menorFornecedor = "";
  for (const cot of cotacoes) {
    const total = items.reduce((s, item) => s + getPreco(precos, cot.id, item.id) * item.quantidade, 0);
    totalsRow.push("", total);
    if (total > 0 && total < menorGlobal) {
      menorGlobal = total;
      menorFornecedor = cot.fornecedor_nome;
    }
  }
  totalsRow.push(menorGlobal === Infinity ? 0 : menorGlobal);
  data.push(totalsRow);

  data.push([]);
  data.push([`Fornecedor com menor preço global: ${menorFornecedor}`]);

  const ws = XLSX.utils.aoa_to_sheet(data);
  const numCols = 4 + cotacoes.length * 2 + 1;
  ws["!cols"] = [{ wch: 6 }, { wch: 35 }, { wch: 7 }, { wch: 6 }, ...Array(cotacoes.length * 2).fill({ wch: 14 }), { wch: 14 }];

  const headerRow = 6;
  for (let c = 0; c < numCols; c++) {
    const cell = ws[XLSX.utils.encode_cell({ r: headerRow, c })];
    if (cell) cell.s = headerStyle;
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Mapa Comparativo");
  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  saveAs(new Blob([buf]), sysEloFileName("MapaComparativo", "xlsx"));
}
