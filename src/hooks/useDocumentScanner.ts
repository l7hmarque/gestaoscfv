import { useState, useRef, useCallback } from "react";
import jsPDF from "jspdf";

export interface ScannedPage {
  dataUrl: string;
  width: number;
  height: number;
}

export interface ScanSession {
  categoria: string;
  pages: ScannedPage[];
}

const CATEGORIES = [
  { value: "ficha_inscricao", label: "Ficha de Inscrição" },
  { value: "laudo_medico", label: "Laudo Médico" },
  { value: "receita_medicamento", label: "Receita de Medicamento" },
  { value: "comprovante_escolar", label: "Comprovante Escolar" },
  { value: "termo_imagem", label: "Termo de Autorização de Imagem" },
  { value: "outro", label: "Outro" },
] as const;

export { CATEGORIES };

function compressImage(file: File, quality = 0.85): Promise<ScannedPage> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      // Limit max dimension to 2000px for reasonable PDF size
      const maxDim = 2000;
      let w = img.width;
      let h = img.height;
      if (w > maxDim || h > maxDim) {
        const ratio = Math.min(maxDim / w, maxDim / h);
        w = Math.round(w * ratio);
        h = Math.round(h * ratio);
      }
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, w, h);
      const dataUrl = canvas.toDataURL("image/jpeg", quality);
      resolve({ dataUrl, width: w, height: h });
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

export function imagesToPdf(pages: ScannedPage[]): Blob {
  // A4 dimensions in mm
  const a4w = 210;
  const a4h = 297;
  const margin = 10;
  const usableW = a4w - margin * 2;
  const usableH = a4h - margin * 2;

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  pages.forEach((page, i) => {
    if (i > 0) pdf.addPage();
    const ratio = Math.min(usableW / page.width, usableH / page.height);
    const imgW = page.width * ratio;
    const imgH = page.height * ratio;
    const x = margin + (usableW - imgW) / 2;
    const y = margin + (usableH - imgH) / 2;
    pdf.addImage(page.dataUrl, "JPEG", x, y, imgW, imgH);
  });

  return pdf.output("blob");
}

export function useDocumentScanner() {
  const [scanSession, setScanSession] = useState<ScanSession | null>(null);
  const scanInputRef = useRef<HTMLInputElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  const startScan = useCallback((categoria: string) => {
    setScanSession({ categoria, pages: [] });
    // Small delay to ensure state is set before triggering input
    setTimeout(() => scanInputRef.current?.click(), 50);
  }, []);

  const handleScanCapture = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    const page = await compressImage(file);
    setScanSession((prev) => prev ? { ...prev, pages: [...prev.pages, page] } : null);
  }, []);

  const addPageToScan = useCallback(() => {
    scanInputRef.current?.click();
  }, []);

  const removePageFromScan = useCallback((index: number) => {
    setScanSession((prev) => prev ? { ...prev, pages: prev.pages.filter((_, i) => i !== index) } : null);
  }, []);

  const finalizeScan = useCallback((): { blob: Blob; categoria: string } | null => {
    if (!scanSession || scanSession.pages.length === 0) return null;
    const blob = imagesToPdf(scanSession.pages);
    const categoria = scanSession.categoria;
    setScanSession(null);
    return { blob, categoria };
  }, [scanSession]);

  const cancelScan = useCallback(() => {
    setScanSession(null);
  }, []);

  const processUploadFile = useCallback(async (file: File): Promise<Blob> => {
    if (file.type === "application/pdf") return file;
    // Convert image to PDF
    const page = await compressImage(file);
    return imagesToPdf([page]);
  }, []);

  return {
    scanSession,
    scanInputRef,
    uploadInputRef,
    startScan,
    handleScanCapture,
    addPageToScan,
    removePageFromScan,
    finalizeScan,
    cancelScan,
    processUploadFile,
  };
}
