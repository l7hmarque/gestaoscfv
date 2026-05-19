import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ListChecks } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";

const TIPOS_LANC = [
  { value: "_all", label: "Todos os tipos" },
  { value: "relatorio", label: "Relatórios" },
  { value: "planejamento", label: "Planejamentos" },
  { value: "presenca", label: "Presenças" },
  { value: "atendimento", label: "Atendimentos" },
  { value: "encaminhamento", label: "Encaminhamentos" },
  { value: "busca_ativa", label: "Busca Ativa" },
];

const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

function fmtSec(s: number) {
  if (!s) return "—";
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r ? `${m}m${r}s` : `${m}m`;
}

export function ProdutividadeTab() {
  const now = new Date();
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [ano, setAno] = useState(now.getFullYear());

  const { data, isLoading } = useQuery({
    queryKey: ["produtividade-educadores", mes, ano],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("get_produtividade_educadores", { _mes: mes, _ano: ano });
      if (error) throw error;
      return data as any;
    },
  });

  if (isLoading) return <div className="py-10 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (!data || data.error) return <Card><CardContent className="p-6 text-sm text-destructive">Sem acesso.</CardContent></Card>;

  const educadores: any[] = data.educadores ?? [];
  const totalRel = educadores.reduce((s, e) => s + (e.relatorios_mes || 0), 0);
  const totalPres = educadores.reduce((s, e) => s + (e.presencas_mes || 0), 0);
  const totalPlan = educadores.reduce((s, e) => s + (e.planejamentos_mes || 0), 0);
  const semLanc = educadores.filter(e => {
    if (!e.ultimo_lancamento) return true;
    return (Date.now() - new Date(e.ultimo_lancamento).getTime()) / 86400000 > 7;
  }).length;

  const corPrazo = (d: number) => {
    if (d <= 0) return "destructive";
    if (d <= 5) return "secondary";
    return "outline";
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={String(mes)} onValueChange={(v) => setMes(parseInt(v))}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>{MESES.map((m, i) => <SelectItem key={i} value={String(i+1)}>{m}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={String(ano)} onValueChange={(v) => setAno(parseInt(v))}>
          <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
          <SelectContent>{[2025, 2026, 2027].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
        </Select>
        <div className="ml-auto flex gap-2 text-xs flex-wrap">
          <Badge variant={corPrazo(data.dias_para_prazo_relatorios) as any}>Prazo relatórios: {data.dias_para_prazo_relatorios}d</Badge>
          <Badge variant={corPrazo(data.dias_para_prazo_presencas) as any}>Prazo presenças: {data.dias_para_prazo_presencas}d</Badge>
          {semLanc > 0 && <Badge variant="destructive">{semLanc} sem lançar há 7+ dias</Badge>}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <StatCard label="Total relatórios (mês)" value={totalRel} />
        <StatCard label="Total presenças (mês)" value={totalPres} />
        <StatCard label="Total planejamentos (mês)" value={totalPlan} />
        <StatCard label="Educadores monitorados" value={educadores.length} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Produtividade por profissional</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-muted-foreground border-b">
                  <th className="py-2 pr-2">Profissional</th>
                  <th className="text-center">Rel.</th>
                  <th className="text-center">Pres.</th>
                  <th className="text-center">Plan.</th>
                  <th className="text-center">Turmas</th>
                  <th>Último</th>
                  <th className="text-right">Méd. Rel.</th>
                  <th className="text-right">Méd. Plan.</th>
                  <th className="text-right">Méd. Pres.</th>
                  <th className="text-right">Dia</th>
                  <th className="text-right">Semana</th>
                  <th className="text-right">Mês</th>
                </tr>
              </thead>
              <tbody>
                {educadores.map((e) => (
                  <tr key={e.profile_id} className="border-b last:border-0">
                    <td className="py-2 pr-2 font-medium">{e.nome}<div className="text-[10px] text-muted-foreground">{e.cargo || "—"}</div></td>
                    <td className="text-center">{e.relatorios_mes}</td>
                    <td className="text-center">{e.presencas_mes}</td>
                    <td className="text-center">{e.planejamentos_mes}</td>
                    <td className="text-center">{e.turmas_atribuidas}</td>
                    <td className="whitespace-nowrap">{e.ultimo_lancamento ? new Date(e.ultimo_lancamento).toLocaleDateString("pt-BR") : "—"}</td>
                    <td className="text-right">{fmtSec(e.tempo_medio_relatorio_s)}</td>
                    <td className="text-right">{fmtSec(e.tempo_medio_planejamento_s)}</td>
                    <td className="text-right">{fmtSec(e.tempo_medio_presenca_s)}</td>
                    <td className="text-right">{fmtSec(e.tempo_total_burocratico_dia_s)}</td>
                    <td className="text-right">{fmtSec(e.tempo_total_burocratico_semana_s)}</td>
                    <td className="text-right">{fmtSec(e.tempo_total_burocratico_mes_s)}</td>
                  </tr>
                ))}
                {educadores.length === 0 && <tr><td colSpan={12} className="text-center text-muted-foreground py-6">Nenhum educador encontrado.</td></tr>}
              </tbody>
            </table>
          </div>
          <p className="text-[10px] text-muted-foreground mt-3">
            Médias e somas em segundos correspondem ao tempo gasto preenchendo relatórios, planejamentos e presenças (telemetria invisível). Dados começam a partir da ativação da telemetria.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card className="border-l-4 border-l-primary/60">
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold mt-1">{value}</p>
      </CardContent>
    </Card>
  );
}