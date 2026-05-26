import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type StatusType =
  | "ativo" | "inativo" | "pendente" | "concluido" | "cancelado"
  | "busca-ativa" | "desligado"
  | "aprovado" | "rejeitado" | "rascunho" | "enviado"
  | "success" | "warning" | "info" | "danger" | "neutral";

const map: Record<StatusType, { variant: any; label?: string }> = {
  ativo:        { variant: "success",     label: "Ativo" },
  inativo:      { variant: "muted",       label: "Inativo" },
  pendente:     { variant: "warning",     label: "Pendente" },
  concluido:    { variant: "success",     label: "Concluído" },
  cancelado:    { variant: "destructive", label: "Cancelado" },
  "busca-ativa":{ variant: "warning",     label: "Busca Ativa" },
  desligado:    { variant: "destructive", label: "Desligado" },
  aprovado:     { variant: "success",     label: "Aprovado" },
  rejeitado:    { variant: "destructive", label: "Rejeitado" },
  rascunho:     { variant: "muted",       label: "Rascunho" },
  enviado:      { variant: "info",        label: "Enviado" },
  success:      { variant: "success" },
  warning:      { variant: "warning" },
  info:         { variant: "info" },
  danger:       { variant: "destructive" },
  neutral:      { variant: "muted" },
};

interface StatusBadgeProps {
  status: StatusType;
  children?: React.ReactNode;
  className?: string;
}

/**
 * Badge semântico para representar status de entidades de forma consistente.
 * Usa as variantes (success, warning, info, muted, destructive) já mapeadas no design system.
 */
export function StatusBadge({ status, children, className }: StatusBadgeProps) {
  const cfg = map[status] ?? map.neutral;
  return (
    <Badge variant={cfg.variant} className={cn("font-medium", className)}>
      {children ?? cfg.label ?? status}
    </Badge>
  );
}