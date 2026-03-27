import { useEffect, useState } from "react";
import { Plus, FileText, Calendar } from "lucide-react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

const PlanejamentosPage = () => {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("planejamentos")
        .select("*, planejamento_turmas(turma_id, turmas(nome)), profiles!planejamentos_educador_id_fkey(nome)")
        .order("created_at", { ascending: false });
      setItems(data || []);
      setLoading(false);
    };
    fetch();
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Planejamentos</h1>
          <p className="text-sm text-muted-foreground">Planejar atividades educativas</p>
        </div>
        <Button size="sm" asChild>
          <Link to="/planejamentos/novo"><Plus className="h-4 w-4 mr-1" />Novo</Link>
        </Button>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground text-center py-8">Carregando...</div>
      ) : items.length === 0 ? (
        <div className="text-sm text-muted-foreground border border-dashed rounded-lg p-8 text-center">
          Nenhum planejamento cadastrado.
        </div>
      ) : (
        <div className="grid gap-3">
          {items.map(item => (
            <Link key={item.id} to={`/planejamentos/${item.id}`}>
              <Card className="hover:border-primary/40 transition-colors cursor-pointer">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-primary shrink-0" />
                        <span className="font-medium text-sm truncate">{item.titulo}</span>
                      </div>
                      {item.tema && <p className="text-xs text-muted-foreground mt-1 ml-6">Tema: {item.tema}</p>}
                      {item.profiles?.nome && <p className="text-xs text-muted-foreground ml-6">Educador: {item.profiles.nome}</p>}
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {item.data_aplicacao && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(item.data_aplicacao + "T12:00:00"), "dd/MM/yyyy")}
                        </span>
                      )}
                      {item.planejamento_turmas?.length > 0 && (
                        <div className="flex gap-1 flex-wrap justify-end">
                          {item.planejamento_turmas.map((pt: any) => (
                            <Badge key={pt.turma_id} variant="secondary" className="text-[10px] px-1.5 py-0">
                              {pt.turmas?.nome}
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

export default PlanejamentosPage;
