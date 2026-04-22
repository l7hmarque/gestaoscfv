import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Package, CalendarClock, Utensils, HeartPulse, ChevronRight, TrendingDown } from "lucide-react";
import { useCozinhaStats, REFEICOES, DIAS_SEMANA } from "@/hooks/useCozinhaData";
import { Skeleton } from "@/components/ui/skeleton";

interface Props { onGoToRestricoes: () => void }

export default function PainelTab({ onGoToRestricoes }: Props) {
  const { data, isLoading } = useCozinhaStats();

  if (isLoading) return <div className="grid grid-cols-2 md:grid-cols-4 gap-4">{Array.from({length:8}).map((_,i)=><Skeleton key={i} className="h-28"/>)}</div>;
  if (!data) return <p className="text-muted-foreground">Sem dados.</p>;

  const kpis = [
    { label: "Refeições hoje (Manhã)", value: data.refeicoes_hoje?.manha ?? 0, icon: Utensils, border: "border-l-primary" },
    { label: "Refeições hoje (Tarde)", value: data.refeicoes_hoje?.tarde ?? 0, icon: Utensils, border: "border-l-primary" },
    { label: "Estoque baixo", value: data.estoque_baixo, icon: TrendingDown, border: data.estoque_baixo > 0 ? "border-l-destructive" : "border-l-emerald-500" },
    { label: "Vencendo em 7d", value: data.vencendo_7d, icon: CalendarClock, border: data.vencendo_7d > 0 ? "border-l-amber-500" : "border-l-emerald-500" },
    { label: "Vencidos", value: data.vencidos, icon: AlertTriangle, border: data.vencidos > 0 ? "border-l-destructive" : "border-l-emerald-500" },
    { label: "Total de itens", value: data.total_itens, icon: Package, border: "border-l-muted-foreground" },
    { label: "Valor estimado", value: `R$ ${(data.valor_estoque ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, icon: Package, border: "border-l-muted-foreground" },
    { label: "Restrições alimentares", value: data.total_restricoes, icon: HeartPulse, border: data.total_restricoes > 0 ? "border-l-amber-500" : "border-l-muted-foreground", action: onGoToRestricoes },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <Card key={k.label} className={`border-l-4 ${k.border} ${k.action ? "cursor-pointer hover:shadow-md transition-shadow" : ""}`} onClick={k.action}>
            <CardContent className="pt-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">{k.label}</p>
                  <p className="text-2xl font-bold mt-1">{k.value}</p>
                </div>
                <k.icon className="h-5 w-5 text-muted-foreground" />
              </div>
              {k.action && <Button variant="link" size="sm" className="px-0 mt-2 h-auto">Ver detalhes <ChevronRight className="h-3 w-3"/></Button>}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Próximas refeições da semana</CardTitle></CardHeader>
        <CardContent>
          {(data.proximas_refeicoes?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum cardápio cadastrado para esta semana.</p>
          ) : (
            <ul className="space-y-2">
              {data.proximas_refeicoes.map((r, i) => {
                const dia = DIAS_SEMANA.find(d => d.num === r.dia_semana)?.label ?? "—";
                const ref = REFEICOES.find(x => x.key === r.refeicao)?.label ?? r.refeicao;
                return (
                  <li key={i} className="flex items-center justify-between border-b last:border-0 pb-2">
                    <div>
                      <p className="text-sm font-medium">{dia} · {ref}</p>
                      <p className="text-sm text-muted-foreground">{r.prato || "—"}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Top 10 itens mais consumidos (30 dias)</CardTitle></CardHeader>
        <CardContent>
          {(data.top_consumo_30d?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">Sem movimentações no período.</p>
          ) : (
            <ul className="space-y-1">
              {data.top_consumo_30d.map((it, i) => (
                <li key={i} className="flex justify-between text-sm border-b last:border-0 py-1">
                  <span>{i + 1}. {it.nome}</span>
                  <span className="font-medium">{Number(it.total).toLocaleString("pt-BR")}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}