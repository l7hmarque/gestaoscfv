import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { FileText, FileSpreadsheet, FileType2 } from "lucide-react";

export type ExportFormat = "docx" | "pdf" | "xlsx";

const META: Record<ExportFormat, { label: string; Icon: any }> = {
  docx: { label: "DOCX (Word)", Icon: FileText },
  pdf: { label: "PDF", Icon: FileType2 },
  xlsx: { label: "XLSX (Excel)", Icon: FileSpreadsheet },
};

interface Props {
  available: ExportFormat[];
  value: ExportFormat[];
  onChange: (v: ExportFormat[]) => void;
  label?: string;
  className?: string;
}

/**
 * Seletor multi-formato reutilizável. Substitui blocos de "um botão por
 * formato" por checkboxes + um único botão Exportar no callsite.
 */
export function FormatPicker({ available, value, onChange, label = "Formatos", className }: Props) {
  const toggle = (f: ExportFormat) => {
    onChange(value.includes(f) ? value.filter((x) => x !== f) : [...value, f]);
  };
  return (
    <div className={className}>
      <Label className="text-xs font-medium mb-2 block">{label}</Label>
      <div className="flex flex-wrap gap-3">
        {available.map((f) => {
          const { label: lbl, Icon } = META[f];
          const checked = value.includes(f);
          return (
            <label
              key={f}
              className="flex items-center gap-1.5 cursor-pointer rounded-md border border-border px-2 py-1 hover:bg-muted/40"
            >
              <Checkbox checked={checked} onCheckedChange={() => toggle(f)} />
              <Icon className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-sm">{lbl}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
