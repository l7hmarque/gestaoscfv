import type { TooltipProps } from "recharts";

interface RichTooltipExtra {
  /** Override visible label (e.g. mês por extenso). */
  labelFormatter?: (label: string) => string;
  /** Format each numeric value (e.g. "82%"). */
  valueFormatter?: (value: number, name: string) => string;
  /** Optional sub-label rendered abaixo do título. */
  sublabel?: string;
}

export function RichTooltip({
  active,
  payload,
  label,
  labelFormatter,
  valueFormatter,
  sublabel,
}: TooltipProps<number, string> & RichTooltipExtra) {
  if (!active || !payload?.length) return null;
  const title = labelFormatter && typeof label === "string" ? labelFormatter(label) : (label as string);
  return (
    <div className="rounded-md border border-border bg-popover/95 backdrop-blur px-3 py-2 shadow-lg text-[12px] tabular-nums">
      {title && <p className="font-semibold text-foreground mb-0.5">{title}</p>}
      {sublabel && <p className="text-[10px] text-muted-foreground mb-1">{sublabel}</p>}
      <div className="space-y-0.5">
        {payload.map((entry, idx) => {
          const raw = Number(entry.value ?? 0);
          const formatted = valueFormatter ? valueFormatter(raw, String(entry.name)) : raw.toLocaleString("pt-BR");
          return (
            <div key={idx} className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-sm" style={{ background: entry.color || entry.fill }} />
              <span className="text-muted-foreground">{entry.name}</span>
              <span className="ml-auto font-medium text-foreground">{formatted}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}