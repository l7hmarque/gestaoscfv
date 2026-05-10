const MES_ABREV = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const MES_FULL = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

/** "2026-05" → "Mai/26" */
export function formatMesLabel(mes: string): string {
  if (!mes) return "";
  const [y, m] = mes.split("-");
  const idx = Number(m) - 1;
  if (!MES_ABREV[idx]) return mes;
  return `${MES_ABREV[idx]}/${(y || "").slice(2)}`;
}

/** "2026-05" → "Maio de 2026" */
export function formatMesExtenso(mes: string): string {
  if (!mes) return "";
  const [y, m] = mes.split("-");
  const idx = Number(m) - 1;
  if (!MES_FULL[idx]) return mes;
  return `${MES_FULL[idx]} de ${y}`;
}

export const MES_NOMES = MES_FULL;
export const MES_ABREVIADOS = MES_ABREV;