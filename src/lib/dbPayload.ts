/**
 * Helpers para normalização de payloads enviados ao Supabase/Postgres.
 *
 * O Postgres rejeita string vazia ("") em colunas de tipos date, timestamp,
 * timestamptz, uuid, numeric e enum. Inputs HTML controlados retornam "" quando
 * o usuário limpa o campo, então qualquer .update/.insert que dê spread em um
 * formulário precisa converter esses "" para null antes de enviar.
 *
 * Regras de segurança:
 * - SÓ converte "" → null. `undefined` é preservado e termina removido pelo
 *   JSON.stringify, garantindo que UPDATE parcial não sobrescreva colunas
 *   ausentes do formulário corrente.
 * - A lista de `fields` é obrigatória — não há modo agressivo que varra todas
 *   as chaves, justamente para evitar transformar "" intencional em null em
 *   colunas TEXT/VARCHAR.
 */
export function sanitizeEmptyStrings<T extends Record<string, any>>(
  payload: T,
  fields: readonly string[],
): T {
  const out: Record<string, any> = { ...payload };
  for (const k of fields) {
    if (out[k] === "") out[k] = null;
  }
  return out as T;
}