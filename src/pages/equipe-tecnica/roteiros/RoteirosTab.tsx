import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, MapPin, Plus, Loader2, Users } from "lucide-react";
import { useRoteiros, STATUS_ROTEIRO_LABELS, STATUS_ROTEIRO_COLORS } from "@/hooks/useRoteirosVisita";

export function RoteirosTab() {
  const { data: roteiros, isLoading } = useRoteiros();

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold">Roteiros de Visita Domiciliar</h3>
          <p className="text-xs text-muted-foreground">Selecione participantes em Busca Ativa ou Matrícula Pendente para montar roteiros agrupados por bairro.</p>
        </div>
        <Button asChild size="sm">
          <Link to="/equipe-tecnica/roteiros/novo"><Plus className="h-4 w-4 mr-1" /> Novo Roteiro</Link>
        </Button>
      </div>

      {isLoading && <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>}

      {!isLoading && (roteiros ?? []).length === 0 && (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
          Nenhum roteiro criado ainda. Clique em "Novo Roteiro" para começar.
        </CardContent></Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {(roteiros ?? []).map(r => {
          const [yy, mm, dd] = r.data_visita.slice(0, 10).split("-");
          const dataBR = `${dd}/${mm}/${yy}`;
          const pct = r.total > 0 ? Math.round((r.realizadas / r.total) * 100) : 0;
          return (
            <Link key={r.id} to={`/equipe-tecnica/roteiros/${r.id}`}>
              <Card className="hover:shadow-md transition-shadow border-l-4" style={{ borderLeftColor: r.status === "concluido" ? "#22c55e" : r.status === "em_andamento" ? "#3b82f6" : "#9ca3af" }}>
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold leading-tight line-clamp-2">{r.titulo}</p>
                    <Badge variant="outline" className={`text-[10px] shrink-0 ${STATUS_ROTEIRO_COLORS[r.status]}`}>{STATUS_ROTEIRO_LABELS[r.status]}</Badge>
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {dataBR}</span>
                    {r.horario_saida && <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {r.horario_saida.slice(0, 5)}</span>}
                    <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {r.responsaveis?.length ?? 0}</span>
                    <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {r.total} visitas</span>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>Progresso</span><span>{r.realizadas}/{r.total} ({pct}%)</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}