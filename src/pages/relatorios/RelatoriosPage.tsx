import { useEffect, useState } from "react";
import { Plus, ClipboardList, Calendar } from "lucide-react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

const OBJ_LABELS: Record<string, string> = { alcancado: "Alcançado", parcial: "Parcial", nao_alcancado: "Não Alcançado" };
const OBJ_VARIANT: Record<string, "default" | "secondary" | "destructive"> = { alcancado: "default", parcial: "secondary", nao_alcancado: "destructive" };

const RelatoriosPage = () => {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("relatorios_atividade")
        .select("*, relatorio_turmas(turma_id, turmas(nome)), profiles!relatorios_atividade_educador_id_fkey(nome)")
        .order("data", { ascending: false });
      setItems(data || []);
      setLoading(false);
    };
    fetch();
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Relatórios de Atividade</h1>
          <p className="text-sm text-muted-foreground">Registrar e acompanhar atividades realizadas</p>
        </div>
        <Button size="sm" asChild>
          <Link to="/relatorios/novo"><Plus className="h-4 w-4 mr-1" />Novo</Link>
        </Button>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground text-center py-8">Carregando...</div>
      ) : items.length === 0 ? (
        <div className="text-sm text-muted-foreground border border-dashed rounded-lg p-8 text-center">
          Nenhum relatório cadastrado.
        </div>
      ) : (
        <div className="grid gap-3">
          {items.map(item => (
            <Link key={item.id} to={`/relatorios/${item.id}`}>
              <Card className="hover:border-primary/40 transition-colors cursor-pointer">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <ClipboardList className="h-4 w-4 text-primary shrink-0" />
                        <span className="font-medium text-sm truncate">{item.nome_atividade || "Sem nome"}</span>
                      </div>
                      {item.profiles?.nome && <p className="text-xs text-muted-foreground mt-1 ml-6">Educador: {item.profiles.nome}</p>}
                      <p className="text-xs text-muted-foreground ml-6">
                        ELO: {item.score_elo?.toFixed(2) || "—"} · {item.num_participantes ?? 0}/{item.num_matriculados ?? 0} presentes
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(item.data + "T12:00:00"), "dd/MM/yyyy")}
                      </span>
                      {item.objetivo_alcancado && (
                        <Badge variant={OBJ_VARIANT[item.objetivo_alcancado] || "secondary"} className="text-[10px] px-1.5 py-0">
                          {OBJ_LABELS[item.objetivo_alcancado] || item.objetivo_alcancado}
                        </Badge>
                      )}
                      {item.relatorio_turmas?.length > 0 && (
                        <div className="flex gap-1 flex-wrap justify-end">
                          {item.relatorio_turmas.map((rt: any) => (
                            <Badge key={rt.turma_id} variant="secondary" className="text-[10px] px-1.5 py-0">
                              {rt.turmas?.nome}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default RelatoriosPage;
