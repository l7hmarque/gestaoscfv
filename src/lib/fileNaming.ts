function p(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * Gera nome de arquivo padronizado: SysELO_{categoria}[_{sufixo}]_{YYYY-MM-DD}_{HHmmss}.{ext}
 */
export function sysEloFileName(categoria: string, ext: string, sufixo?: string): string {
  const d = new Date();
  const ts = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
  return `SysELO_${categoria}${sufixo ? "_" + sufixo : ""}_${ts}.${ext}`;
}

/**
 * Versão Deno-compatible inline (para copiar em Edge Functions que não importam de src/)
 * Gera timestamp no formato YYYY-MM-DD_HHmmss
 */
export function sysEloTimestamp(): string {
  const d = new Date();
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}
