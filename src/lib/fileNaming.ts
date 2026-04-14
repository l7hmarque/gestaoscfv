function p(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * Gera nome de arquivo padronizado: SysCFV_{categoria}[_{sufixo}]_{YYYY-MM-DD}_{HHmmss}.{ext}
 */
export function sysCfvFileName(categoria: string, ext: string, sufixo?: string): string {
  const d = new Date();
  const ts = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
  return `SysCFV_${categoria}${sufixo ? "_" + sufixo : ""}_${ts}.${ext}`;
}

/**
 * Versão Deno-compatible inline (para copiar em Edge Functions que não importam de src/)
 * Gera timestamp no formato YYYY-MM-DD_HHmmss
 */
export function sysCfvTimestamp(): string {
  const d = new Date();
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}
