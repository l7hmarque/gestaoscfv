import { useMemo, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from "recharts";
import { Download, Loader2 } from "lucide-react";
import { useIndicadorTimeline } from "@/hooks/useIndicadorTimeline";
import { INDICADOR_LABELS, type IndicadorId } from "@/lib/indicadorTimelineFetchers";
import { EventoTecnicoCard } from "./EventoTecnicoCard";

const PAGE_SIZE = 20;

export function IndicadorTimelineDrawer({
  indicadorId,
  onClose,
}: {
  indicadorId: IndicadorId | null;
  onClose: () => void;
}) {
  const { data, isLoading } = useIndicadorTimeline(indicadorId);
  const [tipoFiltro, setTipoFiltro] = useState<string>("todos");
  const [limite, setLimite] = useState(PAGE_SIZE);

  const tiposDisponiveis = useMemo(() => {
    if (!data) return [];
    return Array.from(new Set(data.eventos.map((e) => e.tipo)));
  }, [data]);

  const eventosFiltrados = useMemo(() => {
    if (!data) return [];
    return tipoFiltro === "todos" ? data.eventos : data.eventos.filter((e) => e.tipo === tipoFiltro);
  }, [data, tipoFiltro]);

  const exportarCSV = () => {
    if (!data) return;
    const linhas = ["data;tipo;delta;valor_apos;titulo;contexto"];
    eventosFiltrados.forEach((e) => {
      const ctx = e.contexto.map((c) => `${c.campo}: ${c.valor}`).join(" | ");
      linhas.push(
        [e.data, e.tipo, e.delta ?? "", e.valorApos ?? "", e.titulo, ctx]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(";")
      );
    });
    const blob = new Blob(["\ufeff" + linhas.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    a.href = url;
    a.download = `SysCFV_Timeline_${indicadorId}_${ts}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const valorAtual = data?.pontos[data.pontos.length - 1]?.value;
  const valorInicio = data?.pontos[0]?.value;
  const delta30 =
    valorAtual !== undefined && valorInicio !== undefined ? +(valorAtual - valorInicio).toFixed(2) : 0;

  return (
    <Sheet open={indicadorId !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="left" className="w-full sm:max-w-[560px] overflow-y-auto p-0">
        <SheetHeader className="px-5 pt-5 pb-3 border-b border-border">
          <SheetTitle className="text-base">
            {indicadorId ? INDICADOR_LABELS[indicadorId] : ""}
          </SheetTitle>
          {data && valorAtual !== undefined && (
            <div className="flex items-baseline gap-3 mt-1">
              <span className="text-2xl font-bold">{valorAtual}{data.unidade || ""}</span>
              <span
                className={`text-xs font-medium ${
                  delta30 > 0 ? "text-emerald-600" : delta30 < 0 ? "text-red-500" : "text-muted-foreground"
                }`}
              >
                {delta30 > 0 ? "▲ +" : delta30 < 0 ? "▼ " : ""}
                {delta30}{data.unidade || ""} no período
              </span>
              <span className="text-[11px] text-muted-foreground">
                pico: {data.stats.max}{data.unidade || ""}
              </span>
            </div>
          )}
        </SheetHeader>

        {isLoading || !data ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="animate-spin text-muted-foreground" size={20} />
          </div>
        ) : (
          <>
            {/* Gráfico */}
            <div className="px-5 py-4 border-b border-border">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
                Evolução
              </p>
              <div className="h-44">
                {data.pontos.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data.pontos}>
                      <defs>
                        <linearGradient id="indGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(0,58%,56%)" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="hsl(0,58%,56%)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,13%,90%)" />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 10, fill: "hsl(215,14%,46%)" }}
                        axisLine={false}
                        tickLine={false}
                        interval="preserveStartEnd"
                      />
                      <YAxis tick={{ fontSize: 10, fill: "hsl(215,14%,46%)" }} axisLine={false} tickLine={false} width={32} />
                      <Tooltip contentStyle={{ fontSize: 11, borderRadius: 6 }} />
                      <Area
                        type="monotone"
                        dataKey="value"
                        stroke="hsl(0,58%,56%)"
                        strokeWidth={2}
                        fill="url(#indGrad)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-xs text-muted-foreground pt-8 text-center">Sem dados no período</p>
                )}
              </div>
              <div className="grid grid-cols-4 gap-2 mt-3 text-center">
                <Stat label="Min" value={`${data.stats.min}${data.unidade || ""}`} />
                <Stat label="Máx" value={`${data.stats.max}${data.unidade || ""}`} />
                <Stat label="Média" value={`${data.stats.media}${data.unidade || ""}`} />
                <Stat label="Mediana" value={`${data.stats.mediana}${data.unidade || ""}`} />
              </div>
            </div>

            {/* Histórico */}
            <div className="px-5 py-4">
              <div className="flex items-center justify-between mb-3 gap-2">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                  Histórico técnico
                </p>
                {tiposDisponiveis.length > 1 && (
                  <Select value={tipoFiltro} onValueChange={setTipoFiltro}>
                    <SelectTrigger className="w-[160px] h-7 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos os tipos</SelectItem>
                      {tiposDisponiveis.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {eventosFiltrados.length === 0 ? (
                <p className="text-xs text-muted-foreground py-6 text-center">Nenhum evento registrado.</p>
              ) : (
                <div className="space-y-2">
                  {eventosFiltrados.slice(0, limite).map((ev, i) => (
                    <EventoTecnicoCard key={i} ev={ev} unidade={data.unidade} />
                  ))}
                  {eventosFiltrados.length > limite && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-xs"
                      onClick={() => setLimite((l) => l + PAGE_SIZE)}
                    >
                      Ver mais ({eventosFiltrados.length - limite} restantes)
                    </Button>
                  )}
                </div>
              )}
            </div>

            <div className="px-5 py-3 border-t border-border bg-muted/30 sticky bottom-0">
              <Button variant="outline" size="sm" className="w-full text-xs" onClick={exportarCSV}>
                <Download size={12} className="mr-1.5" /> Exportar histórico (CSV)
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-muted/40 rounded p-1.5">
      <p className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-xs font-semibold text-foreground">{value}</p>
    </div>
  );
}