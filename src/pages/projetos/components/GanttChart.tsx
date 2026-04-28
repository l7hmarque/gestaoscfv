import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { formatDataBR } from "@/lib/projetoHelpers";

type Tarefa = {
  id: string;
  titulo: string;
  inicio_previsto: string | null;
  prazo: string | null;
  progresso_pct: number | null;
};

type Dep = { tarefa_id: string; depende_de_id: string };

type Props = {
  tarefas: Tarefa[];
  dependencias: Dep[];
  prazoProjeto?: string | null;
  onSelect: (id: string) => void;
};

const ROW_H = 28;
const DAY_W = 24;

function parseDate(s: string | null): Date | null {
  if (!s) return null;
  return new Date(s.slice(0, 10) + "T00:00:00");
}

function diffDays(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

export function GanttChart({ tarefas, dependencias, prazoProjeto, onSelect }: Props) {
  const data = useMemo(() => {
    const validas = tarefas.filter(t => t.inicio_previsto || t.prazo);
    if (validas.length === 0) return null;

    const datas: Date[] = [];
    validas.forEach(t => {
      const i = parseDate(t.inicio_previsto);
      const f = parseDate(t.prazo);
      if (i) datas.push(i);
      if (f) datas.push(f);
    });
    const prazoP = parseDate(prazoProjeto ?? null);
    if (prazoP) datas.push(prazoP);

    const min = new Date(Math.min(...datas.map(d => d.getTime())));
    const max = new Date(Math.max(...datas.map(d => d.getTime())));
    min.setDate(min.getDate() - 2);
    max.setDate(max.getDate() + 2);
    const totalDias = diffDays(min, max) + 1;

    const linhas = validas.map((t, idx) => {
      const inicio = parseDate(t.inicio_previsto) ?? parseDate(t.prazo)!;
      const fim = parseDate(t.prazo) ?? parseDate(t.inicio_previsto)!;
      const x = diffDays(min, inicio) * DAY_W;
      const w = Math.max(DAY_W, (diffDays(inicio, fim) + 1) * DAY_W);
      return { tarefa: t, idx, x, w, y: idx * ROW_H + 4 };
    });

    const linhasPorId: Record<string, typeof linhas[number]> = {};
    linhas.forEach(l => { linhasPorId[l.tarefa.id] = l; });

    const setasFS = dependencias
      .map(d => {
        const a = linhasPorId[d.depende_de_id];
        const b = linhasPorId[d.tarefa_id];
        if (!a || !b) return null;
        return { x1: a.x + a.w, y1: a.y + ROW_H / 2 - 2, x2: b.x, y2: b.y + ROW_H / 2 - 2 };
      })
      .filter(Boolean) as { x1: number; y1: number; x2: number; y2: number }[];

    const prazoX = prazoP ? diffDays(min, prazoP) * DAY_W : null;

    return { linhas, totalDias, min, prazoX, setasFS };
  }, [tarefas, dependencias, prazoProjeto]);

  if (!data) {
    return (
      <Card><CardContent className="p-8 text-center text-muted-foreground text-sm">
        Adicione datas (início ou prazo) às tarefas para visualizar o Gantt.
      </CardContent></Card>
    );
  }

  const W = data.totalDias * DAY_W;
  const H = data.linhas.length * ROW_H + 8;

  return (
    <Card><CardContent className="p-0 overflow-auto">
      <div className="flex">
        {/* Coluna nomes */}
        <div className="shrink-0 border-r bg-muted/20" style={{ width: 200 }}>
          <div className="h-8 border-b text-xs font-semibold flex items-center px-2">Tarefa</div>
          {data.linhas.map(l => (
            <button
              key={l.tarefa.id}
              className="block w-full text-left text-xs px-2 truncate hover:bg-accent border-b"
              style={{ height: ROW_H }}
              onClick={() => onSelect(l.tarefa.id)}
              title={l.tarefa.titulo}
            >
              {l.tarefa.titulo}
            </button>
          ))}
        </div>
        {/* Timeline */}
        <div className="relative">
          <div className="h-8 border-b flex text-[10px] text-muted-foreground">
            {Array.from({ length: data.totalDias }).map((_, i) => {
              const d = new Date(data.min);
              d.setDate(d.getDate() + i);
              const showLabel = d.getDay() === 1 || i === 0;
              return (
                <div key={i} className="border-r flex items-center justify-center" style={{ width: DAY_W }}>
                  {showLabel ? `${d.getDate()}/${d.getMonth() + 1}` : ""}
                </div>
              );
            })}
          </div>
          <svg width={W} height={H} className="block">
            {data.prazoX !== null && (
              <line x1={data.prazoX} y1={0} x2={data.prazoX} y2={H} stroke="hsl(var(--destructive))" strokeWidth={1.5} strokeDasharray="4 3" />
            )}
            {data.setasFS.map((s, i) => (
              <g key={i}>
                <path
                  d={`M ${s.x1} ${s.y1} L ${s.x1 + 6} ${s.y1} L ${s.x1 + 6} ${s.y2} L ${s.x2} ${s.y2}`}
                  fill="none" stroke="hsl(var(--muted-foreground))" strokeWidth={1}
                />
                <polygon points={`${s.x2},${s.y2} ${s.x2 - 4},${s.y2 - 3} ${s.x2 - 4},${s.y2 + 3}`} fill="hsl(var(--muted-foreground))" />
              </g>
            ))}
            {data.linhas.map(l => {
              const pct = Math.max(0, Math.min(100, l.tarefa.progresso_pct ?? 0));
              return (
                <g key={l.tarefa.id} style={{ cursor: "pointer" }} onClick={() => onSelect(l.tarefa.id)}>
                  <rect x={l.x} y={l.y} width={l.w} height={ROW_H - 8} rx={3} fill="hsl(var(--primary) / 0.2)" stroke="hsl(var(--primary))" />
                  <rect x={l.x} y={l.y} width={(l.w * pct) / 100} height={ROW_H - 8} rx={3} fill="hsl(var(--primary))" />
                  <title>{l.tarefa.titulo} — {formatDataBR(l.tarefa.inicio_previsto)} → {formatDataBR(l.tarefa.prazo)}</title>
                </g>
              );
            })}
          </svg>
        </div>
      </div>
    </CardContent></Card>
  );
}