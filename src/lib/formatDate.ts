/**
 * Helper único de formatação de datas — padrão SysCFV: DD/MM/AAAA (barra).
 * Banco continua ISO. Esses helpers são para EXIBIÇÃO e EXPORTAÇÃO.
 * Nomes de arquivo continuam em YYYY-MM-DD (ordenável) — ver src/lib/fileNaming.ts.
 */

const MES_FULL = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

function toDate(input: Date | string | number | null | undefined): Date | null {
  if (input == null || input === "") return null;
  if (input instanceof Date) return isNaN(input.getTime()) ? null : input;
  // ISO date-only YYYY-MM-DD → constrói local (sem deslocamento de fuso)
  if (typeof input === "string") {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input);
    if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }
  const d = new Date(input as any);
  return isNaN(d.getTime()) ? null : d;
}

const pad2 = (n: number) => String(n).padStart(2, "0");

/** DD/MM/AAAA */
export function formatDataBR(input: Date | string | number | null | undefined): string {
  const d = toDate(input);
  if (!d) return "";
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/** DD/MM/AAAA HH:mm */
export function formatDataHoraBR(input: Date | string | number | null | undefined): string {
  const d = toDate(input);
  if (!d) return "";
  return `${formatDataBR(d)} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** 19 de maio de 2026 */
export function formatDataExtensoBR(input: Date | string | number | null | undefined): string {
  const d = toDate(input);
  if (!d) return "";
  return `${d.getDate()} de ${MES_FULL[d.getMonth()]} de ${d.getFullYear()}`;
}

/** Parse de "19/05/2026" → Date local (para futuros inputs DD/MM/AAAA) */
export function parseDataBR(value: string): Date | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec((value || "").trim());
  if (!m) return null;
  const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  return isNaN(d.getTime()) ? null : d;
}

/** ISO YYYY-MM-DD (para gravar em banco a partir de um Date) */
export function toISODate(input: Date | string | number | null | undefined): string {
  const d = toDate(input);
  if (!d) return "";
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}