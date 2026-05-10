import { ReactNode, useState } from "react";
import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";

export function Accordion({
  title,
  count,
  defaultOpen = false,
  children,
}: {
  title: string;
  count?: number;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-l-4 border-primary/40 bg-card rounded-r-md">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 p-3 hover:bg-muted/50 text-left"
      >
        <ChevronRight className={`h-4 w-4 transition-transform ${open ? "rotate-90" : ""}`} />
        <span className="font-semibold flex-1">{title}</span>
        {count != null && <Badge variant="secondary">{count}</Badge>}
      </button>
      {open && <div className="px-3 pb-3">{children}</div>}
    </div>
  );
}

export function AcordeonItem({
  title,
  count,
  checked,
  indeterminate,
  onToggleAll,
  children,
}: {
  title: string;
  count?: number;
  checked?: boolean;
  indeterminate?: boolean;
  onToggleAll?: () => void;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border rounded-md bg-background">
      <div className="flex items-center gap-2 p-2 hover:bg-muted/30">
        {onToggleAll && (
          <Checkbox
            checked={indeterminate ? "indeterminate" : checked}
            onCheckedChange={() => onToggleAll()}
            aria-label="Selecionar todos do mês"
          />
        )}
        <button type="button" onClick={() => setOpen(o => !o)} className="flex-1 flex items-center gap-2 text-left">
          <ChevronRight className={`h-4 w-4 transition-transform ${open ? "rotate-90" : ""}`} />
          <span className="text-sm font-medium flex-1">{title}</span>
          {count != null && <Badge variant="outline">{count}</Badge>}
        </button>
      </div>
      {open && <div className="px-2 pb-2">{children}</div>}
    </div>
  );
}