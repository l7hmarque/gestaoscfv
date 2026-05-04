import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  icon?: ReactNode;
  className?: string;
  variant?: "default" | "gradient";
}

/**
 * Header padronizado para todas as páginas.
 * - default: simples, com título/subtítulo + ações
 * - gradient: card com gradient sutil para landing/destaques
 */
export function PageHeader({ title, subtitle, actions, icon, className, variant = "default" }: PageHeaderProps) {
  if (variant === "gradient") {
    return (
      <div className={cn("rounded-md border bg-gradient-header p-4 sm:p-5 shadow-xs", className)}>
        <div className="page-header">
          <div className="flex items-start gap-3 min-w-0">
            {icon && <div className="shrink-0 grid place-items-center h-10 w-10 rounded-md bg-primary/10 text-primary">{icon}</div>}
            <div className="min-w-0">
              <h1 className="page-title truncate">{title}</h1>
              {subtitle && <p className="page-subtitle">{subtitle}</p>}
            </div>
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("page-header mb-4 sm:mb-5", className)}>
      <div className="flex items-start gap-3 min-w-0">
        {icon && <div className="shrink-0 grid place-items-center h-9 w-9 rounded-md bg-primary/10 text-primary">{icon}</div>}
        <div className="min-w-0">
          <h1 className="page-title truncate">{title}</h1>
          {subtitle && <p className="page-subtitle">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}