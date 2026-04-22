// Janela de check-in para o portal da família.
// Regra: para o dia D, o check-in é permitido de D-7 até as 06:00 (horário GMT-3) de D.
// Após 06:00 de D, a janela fecha. Helpers usam o timezone America/Sao_Paulo
// para evitar problemas de fuso no navegador da família.

export const CHECKIN_HORA_LIMITE = 6; // 06:00 GMT-3
export const CHECKIN_MAX_DIAS_FUTURO = 7;
export const CHECKIN_TIMEZONE = "America/Sao_Paulo";

/** Retorna o "agora" como objeto Date convertido p/ America/Sao_Paulo. */
export function nowSP(): Date {
  const str = new Date().toLocaleString("en-US", { timeZone: CHECKIN_TIMEZONE });
  return new Date(str);
}

/** Converte uma data ISO (YYYY-MM-DD) para Date local sem deslocamento de fuso. */
export function parseDataISO(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

/** Formata Date como YYYY-MM-DD usando o timezone de São Paulo. */
export function toISODateSP(d: Date): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: CHECKIN_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(d); // já vem YYYY-MM-DD
}

/** Hoje em São Paulo (YYYY-MM-DD). */
export function hojeSP(): string {
  return toISODateSP(new Date());
}

/** Diferença em dias inteiros (data alvo - hoje), considerando SP. */
export function diasAteSP(dataAlvoISO: string): number {
  const hoje = parseDataISO(hojeSP());
  const alvo = parseDataISO(dataAlvoISO);
  const ms = alvo.getTime() - hoje.getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

/**
 * Verifica se a janela de check-in para o dia alvo (YYYY-MM-DD) está aberta.
 * - Aberta se diff em dias está entre 0 e 7 (inclusive)
 * - Se diff = 0 (hoje), só aberto se hora SP < 06:00
 */
export function isCheckinAberto(dataAlvoISO: string): boolean {
  const diff = diasAteSP(dataAlvoISO);
  if (diff < 0 || diff > CHECKIN_MAX_DIAS_FUTURO) return false;
  if (diff === 0) {
    const agora = nowSP();
    return agora.getHours() < CHECKIN_HORA_LIMITE;
  }
  return true;
}

/** Próxima data ISO em que o check-in deve ser feito por padrão. */
export function dataDefaultCheckin(): string {
  const agora = nowSP();
  const hoje = hojeSP();
  // Entre 00:00 e 06:00 → confirmar para hoje
  if (agora.getHours() < CHECKIN_HORA_LIMITE) return hoje;
  // Após 06:00 → confirmar para amanhã
  const amanha = new Date(parseDataISO(hoje));
  amanha.setDate(amanha.getDate() + 1);
  return toISODateSP(amanha);
}

/** Retorna texto amigável para "quando posso confirmar de novo". */
export function proximaJanelaTexto(dataAlvoISO: string): string {
  const diff = diasAteSP(dataAlvoISO);
  if (diff < 0) return "Esta data já passou";
  if (diff === 0) return "Janela encerrada às 06:00 — fale com a coordenação";
  return `Confirmação aberta até as 06:00 de ${formatarBR(dataAlvoISO)}`;
}

export function formatarBR(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y.slice(2)}`;
}

/** Mapeia day-of-week (0=dom, 1=seg... 6=sab) para chave usada em turmas.dias_semana. */
const DIA_SEMANA_KEYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"];
export function diaSemanaKey(iso: string): string {
  const d = parseDataISO(iso);
  return DIA_SEMANA_KEYS[d.getDay()];
}

/** Próximos N dias úteis (seg–sex) a partir do default. */
export function proximosDiasUteis(qtd: number = 7): string[] {
  const out: string[] = [];
  let cursor = new Date(parseDataISO(dataDefaultCheckin()));
  while (out.length < qtd) {
    const dow = cursor.getDay();
    if (dow >= 1 && dow <= 5) out.push(toISODateSP(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}