import { useState, useEffect } from "react";
import { Plus, Users, Eye } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

const periodoLabel: Record<string, string> = { manha: "Manhã", tarde: "Tarde", integral: "Integral" };
const faixaLabel: Record<string, string> = { "6-8": "6-8 anos", "9-11": "9-11 anos", "12-17": "12-17 anos", idosos: "Idosos" };
const diasLabel: Record<string, string> = { seg: "Seg", ter: "Ter", qua: "Qua", qui: "Qui", sex: "Sex", sab: "Sáb" };

interface TurmaRow {
  id: string; nome: string; periodo: string | null; faixa_etaria: string | null;
  tipo: string | null; ativa: boolean | null; dias_semana: string[] | null;
  educador_id: string | null; bairro_id: string | null;
  profiles?: { nome: string } | null; bairros?: { nome: string } | null;
  participante_count: number;
}

const TurmasPage = () => {
  const [turmas, setTurmas] = useState<TurmaRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchTurmas(); }, []);

  const fetchTurmas = async () => {
    setLoading(true);
    const { data } = await supabase.from("turmas").select("*, profiles(nome), bairros(nome)").order("nome");
    if (data) {
      const counts = await Promise.all(data.map((t) =>
        supabase.from("turma_participantes").select("id", { count: "exact", head: true }).eq("turma_id", t.id)
      ));
      setTurmas(data.map((t, i) => ({ ...t, participante_count: counts[i].count || 0 } as TurmaRow)));
    }
    setLoading(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Turmas</h1>
          <p className="text-sm text-muted-foreground">{turmas.length} turma{turmas.length !== 1 ? "s" : ""}</p>
        </div>
        <Button size="sm" asChild>
          <Link to="/turmas/nova"><Plus className="h-4 w-4 mr-1" />Nova Turma</Link>
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
      ) : turmas.length === 0 ? (
        <div className="text-sm text-muted-foreground border border-dashed rounded-lg p-8 text-center">Nenhuma turma cadastrada.</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {turmas.map((t) => (
            <Link key={t.id} to={`/turmas/${t.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between">
                    <h3 className="text-sm font-semibold text-foreground">{t.nome}</h3>
                    <Badge variant={t.ativa ? "default" : "secondary"} className="text-[10px]">{t.ativa ? "Ativa" : "Inativa"}</Badge>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {t.periodo && <Badge variant="outline" className="text-[10px]">{periodoLabel[t.periodo]}</Badge>}
                    {t.faixa_etaria && <Badge variant="outline" className="text-[10px]">{faixaLabel[t.faixa_etaria] || t.faixa_etaria}</Badge>}
                    {t.tipo === "extraordinaria" && <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">Extra</Badge>}
                  </div>
                  {t.dias_semana && t.dias_semana.length > 0 && (
                    <p className="text-xs text-muted-foreground">{t.dias_semana.map((d) => diasLabel[d] || d).join(", ")}</p>
                  )}
                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Users className="h-3 w-3" />{t.participante_count} participante{t.participante_count !== 1 ? "s" : ""}
                    </div>
                    {t.profiles?.nome && <span className="text-xs text-muted-foreground truncate max-w-[120px]">{t.profiles.nome}</span>}
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

export default TurmasPage;
