import { useEffect, useState } from "react";
import { AlertTriangle, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";

interface Pendencias {
  total: number;
  periodo_divergente: number;
  desligados_incompletos: number;
  planejamentos_sem_turma: number;
  sem_data_nascimento: number;
  turmas_sem_educador: number;
  turmas_vazias: number;
}

export function PendenciasIntegridadeBanner() {
  const [data, setData] = useState<Pendencias | null>(null);

  useEffect(() => {
    supabase.rpc("get_pendencias_integridade" as any).then(({ data: d }) => {
      if (d) setData(d as unknown as Pendencias);
    });
  }, []);

  if (!data || data.total === 0) return null;

  const items = [
    { label: "turmas sem educador", n: data.turmas_sem_educador },
    { label: "períodos divergentes", n: data.periodo_divergente },
    { label: "desligados incompletos", n: data.desligados_incompletos },
    { label: "planejamentos sem turma", n: data.planejamentos_sem_turma },
    { label: "turmas vazias", n: data.turmas_vazias },
    { label: "sem data de nascimento", n: data.sem_data_nascimento },
  ].filter((i) => i.n > 0);

  return (
    <Card className="border-l-4 border-l-destructive bg-destructive/5 p-3 print:hidden">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-sm font-medium text-foreground">
              {data.total} pendência{data.total > 1 ? "s" : ""} de integridade detectada{data.total > 1 ? "s" : ""}
            </p>
            <Link
              to="/integridade"
              className="text-xs text-destructive hover:underline flex items-center gap-0.5"
            >
              Revisar <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {items.map((i, idx) => (
              <span key={i.label}>
                <strong className="text-foreground">{i.n}</strong> {i.label}
                {idx < items.length - 1 ? " • " : ""}
              </span>
            ))}
          </p>
        </div>
      </div>
    </Card>
  );
}
