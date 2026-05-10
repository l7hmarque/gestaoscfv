/**
 * Escala de cores semântica para scores ELO (0–5) usada nos gráficos do dashboard.
 * Mantém HSL alinhado ao design system cinza/vermelho técnico.
 */
export function eloColor(value: number): string {
  if (value < 2) return "hsl(0,72%,50%)";        // crítico — vermelho
  if (value < 3) return "hsl(25,85%,55%)";       // baixo — laranja
  if (value < 4) return "hsl(45,85%,52%)";       // médio — amarelo
  return "hsl(142,55%,42%)";                      // bom — verde
}

export function eloLabel(value: number): string {
  if (value < 2) return "Crítico";
  if (value < 3) return "Baixo";
  if (value < 4) return "Médio";
  return "Bom";
}