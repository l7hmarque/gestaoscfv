/**
 * Tokens visuais compartilhados pelos gráficos do Dashboard.
 * Centraliza cor de fonte (preta), grade fina contínua e cinza forte.
 */

export const chartColors = {
  primary: "hsl(0,58%,56%)",     // vermelho SysCFV (série principal)
  graySecondary: "hsl(215,15%,45%)", // cinza forte para séries secundárias
  text: "hsl(0,0%,10%)",         // preto para fontes
  grid: "hsl(220,13%,80%)",      // grade fina
  axisGray: "hsl(210,22%,49%)",
  green: "hsl(142,50%,40%)",
};

export const axisTick = { fontSize: 11, fill: chartColors.text } as const;
export const axisTickSm = { fontSize: 10, fill: chartColors.text } as const;
export const axisTickXs = { fontSize: 9, fill: chartColors.text } as const;

/** Props padrão para <CartesianGrid />: linha contínua fina horizontal+vertical. */
export const gridProps = {
  stroke: chartColors.grid,
  strokeWidth: 0.5,
  horizontal: true,
  vertical: true,
} as const;

export const legendStyle = { fontSize: 11, color: chartColors.text } as const;