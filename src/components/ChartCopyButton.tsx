import { useRef, forwardRef, useImperativeHandle, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Copy, Check } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface ChartCopyWrapperProps {
  children: ReactNode;
  className?: string;
}

export interface ChartCopyRef {
  copyToClipboard: () => Promise<void>;
}

export const ChartCopyWrapper = forwardRef<HTMLDivElement, ChartCopyWrapperProps>(
  ({ children, className }, ref) => (
    <div ref={ref} className={className}>
      {children}
    </div>
  )
);
ChartCopyWrapper.displayName = "ChartCopyWrapper";

export function ChartCopyButton({ targetRef }: { targetRef: React.RefObject<HTMLDivElement | null> }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!targetRef.current) return;
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(targetRef.current, {
        backgroundColor: "#ffffff",
        scale: 2,
        logging: false,
      });
      canvas.toBlob(async (blob) => {
        if (!blob) {
          toast.error("Falha ao gerar imagem");
          return;
        }
        try {
          await navigator.clipboard.write([
            new ClipboardItem({ "image/png": blob }),
          ]);
          setCopied(true);
          toast.success("Gráfico copiado! Cole no Word com Ctrl+V");
          setTimeout(() => setCopied(false), 2000);
        } catch {
          // Fallback: download
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = "grafico.png";
          a.click();
          URL.revokeObjectURL(url);
          toast.info("Imagem baixada (clipboard não suportado)");
        }
      }, "image/png");
    } catch (err) {
      toast.error("Erro ao capturar gráfico");
      console.error(err);
    }
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-6 w-6"
      onClick={handleCopy}
      title="Copiar gráfico para colar no Word"
    >
      {copied ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
    </Button>
  );
}
