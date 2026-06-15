import i18n from "@/i18n";

/**
 * Traduz códigos de erro do PostgREST/Postgres em mensagens amigáveis ao usuário.
 *
 * Garantias:
 * - SEMPRE faz console.error("[supabase]", error) — o desenvolvedor enxerga o
 *   erro cru completo no DevTools, mesmo quando o toast mostra texto amigável.
 * - Tradução vem do i18n (errors.db.<code>). Se a chave não existir, cai no
 *   fallback do chamador; se também não houver fallback, usa error.message.
 *
 * Códigos cobertos hoje (PostgREST + PostgreSQL):
 * - 22007 invalid datetime / 22008 datetime field overflow
 * - 22P02 invalid text representation (uuid, enum, numeric)
 * - 23502 not_null_violation
 * - 23503 foreign_key_violation
 * - 23505 unique_violation
 * - 23514 check_violation
 * - 42501 insufficient_privilege (RLS)
 * - PGRST116 no rows / PGRST301 jwt expired
 */
export function handleSupabaseError(error: unknown, fallback?: string): string {
  // Log cru sempre, para preservar contexto de debug em produção.
  console.error("[supabase]", error);

  const err = error as { code?: string; message?: string } | null | undefined;
  if (!err) return fallback || "Erro desconhecido";

  const code = err.code;
  if (code) {
    const translated = i18n.t(`errors.db.${code}`, { defaultValue: "" });
    if (translated) return translated;
  }

  return fallback || err.message || "Erro desconhecido";
}