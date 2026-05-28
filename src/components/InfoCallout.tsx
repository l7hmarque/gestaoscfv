import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Bloco orientador para topo de abas/seções de configuração.
 * Texto-guia explicando propósito, permissões e cuidados.
 */
export function InfoCallout({
  title,
  children,
  variant = "info",
  className,
}: {
  title?: string;
  children: React.ReactNode;
  variant?: "info" | "warning";
  className?: string;
}) {
  const styles =
    variant === "warning"
      ? "border-amber-500/40 bg-amber-500/5 text-amber-900 dark:text-amber-200"
      : "border-primary/30 bg-primary/5 text-foreground";
  return (
    <div className={cn("flex gap-2 items-start rounded-md border px-3 py-2 mb-3 text-[12px] leading-relaxed", styles, className)}>
      <Info className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
      <div>
        {title && <p className="font-semibold mb-0.5">{title}</p>}
        <div className="text-muted-foreground">{children}</div>
      </div>
    </div>
  );
}