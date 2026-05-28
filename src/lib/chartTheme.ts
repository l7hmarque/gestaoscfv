/**
 * Tokens visuais compartilhados pelos gráficos do Dashboard.
 * Centraliza cor de fonte (preta), grade fina contínua e cinza forte.
 */

export const chartColors = {
  primary: "hsl(0,58%,56%)",        // vermelho SysCFV (acento / alertas)
  institutional: "hsl(18,80%,50%)", // laranja institucional do site (#E5541B aprox)
  blueSCNSA: "hsl(210,80%,48%)",    // azul institucional SCNSA
  graySecondary: "hsl(215,15%,45%)",
  text: "hsl(0,0%,10%)",
  grid: "hsl(220,13%,80%)",
  axisGray: "hsl(210,22%,49%)",
  green: "hsl(142,50%,40%)",
};

/**
 * Paleta institucional para gráficos demográficos (faixa etária, bairros, gênero, período).
 * Deriva do laranja do site público + escala de cinzas neutros + azul SCNSA como contraste.
 */
export const chartPaletteInstitucional = [
  "hsl(18,80%,50%)",    // laranja institucional
  "hsl(210,80%,48%)",   // azul SCNSA
  "hsl(215,15%,40%)",   // grafite
  "hsl(18,55%,65%)",    // laranja claro
  "hsl(210,55%,68%)",   // azul claro
  "hsl(215,12%,72%)",   // cinza claro
  "hsl(28,70%,40%)",    // âmbar escuro
  "hsl(200,50%,35%)",   // azul petróleo
  "hsl(0,58%,56%)",     // vermelho SysCFV (acento)
];

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