import { Link } from "react-router-dom";
import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import type { EventoTecnico } from "@/lib/indicadorTimelineFetchers";

function formatDate(iso: string) {
  const d = new Date(iso.length <= 10 ? iso + "T12:00:00" : iso);
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }) + (iso.includes("T")
    ? " — " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : "");
}

export function EventoTecnicoCard({ ev, unidade }: { ev: EventoTecnico; unidade?: string }) {
  const positive = (ev.delta ?? 0) > 0;
  const negative = (ev.delta ?? 0) < 0;
  const linkClass = positive
    ? "text-emerald-700 hover:underline font-medium"
    : negative
    ? "text-red-700 hover:underline font-medium"
    : "text-primary hover:underline";
  return (
    <div className="border border-border rounded-md p-3 bg-card hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            {formatDate(ev.data)}
          </p>
          <p className="text-[12px] font-bold text-foreground mt-0.5">{ev.titulo}</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {ev.delta !== undefined && ev.delta !== 0 && (
            <span
              className={`inline-flex items-center gap-0.5 text-[11px] font-semibold px-1.5 py-0.5 rounded ${
                positive
                  ? "bg-emerald-50 text-emerald-700"
                  : negative
                  ? "bg-red-50 text-red-700"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {positive ? <ArrowUpRight size={11} /> : negative ? <ArrowDownRight size={11} /> : <Minus size={11} />}
              {positive ? "+" : ""}{ev.delta}
            </span>
          )}
          {ev.valorApos !== undefined && (
            <span className="text-[11px] font-mono font-semibold text-foreground bg-muted px-1.5 py-0.5 rounded">
              {ev.valorApos}{unidade || ""}
            </span>
          )}
        </div>
      </div>
      <dl className="space-y-1">
        {ev.contexto.map((c, i) => (
          <div key={i} className="flex gap-2 text-[11px] leading-snug">
            <dt className="text-muted-foreground shrink-0 min-w-[110px]">{c.campo}</dt>
            <dd className="text-foreground break-words min-w-0 flex-1">
              {c.link ? (
                <Link to={c.link} className={linkClass}>
                  {c.valor}
                </Link>
              ) : (
                c.valor
              )}
            </dd>
          </div>
        ))}
      </dl>
      {ev.autor && (
        <p className="text-[10px] text-muted-foreground mt-2 pt-2 border-t border-border">
          por {ev.autor}
        </p>
      )}
    </div>
  );
}