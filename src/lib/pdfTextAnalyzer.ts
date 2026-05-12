// Detecta se um PDF pode ser processado em modo TEXTO PURO (mais barato/rápido)
// ou se precisa de VISÃO (camada de imagem ausente OU marca-texto amarelo presente).
//
// Estratégia:
// 1) Para cada página, extrai texto via pdfjs-dist e conta caracteres não-whitespace.
// 2) Para cada página, renderiza um thumbnail pequeno e amostra pixels procurando
//    áreas amarelas (marca-texto). Se >= 0.3% dos pixels forem amarelos, considera
//    "marcada" — a página vai forçar VISÃO para preservar a regra de modalidade 7.
// 3) Decisão final:
//    - Qualquer página com marca amarela → VISÃO (fluxo atual).
//    - Caso contrário, se >= 80% das páginas tiverem texto → TEXTO PURO.
//    - Senão → VISÃO.

import * as pdfjsLib from "pdfjs-dist";
// @ts-ignore - vite resolve o worker como url
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

const MIN_CHARS_PER_PAGE = 50;
const TEXT_PAGE_THRESHOLD = 0.8; // 80% das páginas com texto → modo texto
const YELLOW_PIXEL_RATIO = 0.003; // 0,3% de pixels amarelos basta para considerar "marcada"
const THUMB_WIDTH = 160;

export type PdfAnalysis =
  | { mode: "text"; pagesText: string[]; numPages: number; hasYellow: false; reason: string }
  | { mode: "vision"; pagesText: null; numPages: number; hasYellow: boolean; reason: string };

function isYellowPixel(r: number, g: number, b: number): boolean {
  // Amarelo de marca-texto: alto R, alto G, baixo B, e R≈G.
  return r > 200 && g > 180 && b < 160 && Math.abs(r - g) < 50;
}

async function pageHasYellow(page: any): Promise<boolean> {
  try {
    const viewport = page.getViewport({ scale: 1 });
    const scale = THUMB_WIDTH / viewport.width;
    const scaled = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(scaled.width);
    canvas.height = Math.ceil(scaled.height);
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return false;
    await page.render({ canvasContext: ctx, viewport: scaled }).promise;
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = img.data;
    let yellow = 0;
    const total = (data.length / 4);
    // amostra 1 a cada 4 pixels para velocidade
    for (let i = 0; i < data.length; i += 16) {
      if (isYellowPixel(data[i], data[i + 1], data[i + 2])) yellow++;
    }
    const sampledTotal = total / 4;
    return yellow / sampledTotal >= YELLOW_PIXEL_RATIO;
  } catch (e) {
    console.warn("pageHasYellow fail", e);
    return false;
  }
}

export async function analyzePdf(file: File): Promise<PdfAnalysis> {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise;
  const numPages = pdf.numPages;
  const pagesText: string[] = [];
  let pagesWithText = 0;
  let yellowDetected = false;

  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);
    // Texto
    const tc = await page.getTextContent();
    const text = tc.items.map((it: any) => ("str" in it ? it.str : "")).join(" ");
    const cleanLen = text.replace(/\s+/g, "").length;
    pagesText.push(text);
    if (cleanLen >= MIN_CHARS_PER_PAGE) pagesWithText++;

    // Marca amarela — só vale a pena checar se a página parece ter texto
    // (escaneada irá pra visão de qualquer jeito). Faz no máximo nas 6 primeiras
    // páginas + amostragem para PDFs grandes (custo de render acumula).
    const shouldSniff = i <= 6 || i % 10 === 0;
    if (!yellowDetected && shouldSniff) {
      const y = await pageHasYellow(page);
      if (y) yellowDetected = true;
    }
  }

  const textRatio = pagesWithText / numPages;
  if (yellowDetected) {
    return {
      mode: "vision",
      pagesText: null,
      numPages,
      hasYellow: true,
      reason: "marca-texto amarelo detectada — usando visão p/ classificar modalidade 7",
    };
  }
  if (textRatio >= TEXT_PAGE_THRESHOLD) {
    return {
      mode: "text",
      pagesText,
      numPages,
      hasYellow: false,
      reason: `${pagesWithText}/${numPages} páginas com texto nativo — modo texto`,
    };
  }
  return {
    mode: "vision",
    pagesText: null,
    numPages,
    hasYellow: false,
    reason: `${pagesWithText}/${numPages} páginas com texto — abaixo do limite, usando visão`,
  };
}