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
import { exportXLSX } from "@/hooks/useDataExport";
import { Download } from "lucide-react";

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
  const [detalheTarget, setDetalheTarget] = useState<{ id: string; nome: string } | null>(null);

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

  const handleExport = () => {
    const headers = [
      { key: "nome", label: "Profissional" },
      { key: "cargo", label: "Cargo" },
      { key: "relatorios_mes", label: "Relatórios (mês)" },
      { key: "presencas_mes", label: "Presenças (mês)" },
      { key: "planejamentos_mes", label: "Planejamentos (mês)" },
      { key: "turmas_atribuidas", label: "Turmas" },
      { key: "ultimo_lancamento", label: "Último lançamento" },
      { key: "tempo_medio_relatorio_s", label: "Méd. Relatório (s)" },
      { key: "tempo_medio_planejamento_s", label: "Méd. Planejamento (s)" },
      { key: "tempo_medio_presenca_s", label: "Méd. Presença (s)" },
      { key: "tempo_total_burocratico_dia_s", label: "Total Dia (s)" },
      { key: "tempo_total_burocratico_semana_s", label: "Total Semana (s)" },
      { key: "tempo_total_burocratico_mes_s", label: "Total Mês (s)" },
    ];
    const rows = educadores.map((e) => ({
      ...e,
      cargo: e.cargo || "—",
      ultimo_lancamento: e.ultimo_lancamento ? new Date(e.ultimo_lancamento).toLocaleDateString("pt-BR") : "—",
    }));
    exportXLSX(rows, headers, `Produtividade_${MESES[mes-1]}_${ano}`);
  };

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
          <Button size="sm" variant="outline" onClick={handleExport} disabled={educadores.length === 0}>
            <Download className="h-3 w-3 mr-1" /> Exportar XLSX
          </Button>
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
                  <th className="text-right">Ações</th>
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
                    <td className="text-right">
                      <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]" onClick={() => setDetalheTarget({ id: e.profile_id, nome: e.nome })}>
                        <ListChecks className="h-3 w-3 mr-1" /> Detalhar
                      </Button>
                    </td>
                  </tr>
                ))}
                {educadores.length === 0 && <tr><td colSpan={13} className="text-center text-muted-foreground py-6">Nenhum educador encontrado.</td></tr>}
              </tbody>
            </table>
          </div>
          <p className="text-[10px] text-muted-foreground mt-3">
            Médias e somas em segundos correspondem ao tempo gasto preenchendo relatórios, planejamentos, presenças, atendimentos, encaminhamentos e busca ativa (telemetria invisível). Use <strong>Detalhar</strong> para ver lançamento por lançamento.
          </p>
        </CardContent>
      </Card>
      <DetalheSheet target={detalheTarget} onClose={() => setDetalheTarget(null)} />
    </div>
  );
}

function DetalheSheet({ target, onClose }: { target: { id: string; nome: string } | null; onClose: () => void }) {
  const [tipo, setTipo] = useState("_all");
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [offset, setOffset] = useState(0);
  const limit = 50;

  const { data, isFetching } = useQuery({
    queryKey: ["lancamentos-detalhados", target?.id, tipo, de, ate, offset],
    enabled: !!target,
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("get_lancamentos_detalhados", {
        _profile_id: target!.id,
        _tipo: tipo === "_all" ? null : tipo,
        _de: de || null,
        _ate: ate || null,
        _limit: limit,
        _offset: offset,
      });
      if (error) throw error;
      return data as { rows: any[]; total: number };
    },
  });

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const durs = [...rows.map((r: any) => r.duracao_segundos)].sort((a, b) => a - b);
  const p50 = durs[Math.floor(durs.length / 2)] ?? 0;
  const p90 = durs[Math.floor(durs.length * 0.9)] ?? 0;
  const maior = durs[durs.length - 1] ?? 0;

  return (
    <Sheet open={!!target} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Lançamentos de {target?.nome}</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-2 items-end">
            <div>
              <label className="text-xs text-muted-foreground">Tipo</label>
              <Select value={tipo} onValueChange={(v) => { setTipo(v); setOffset(0); }}>
                <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
                <SelectContent>{TIPOS_LANC.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">De</label>
              <Input type="date" value={de} onChange={(e) => { setDe(e.target.value); setOffset(0); }} className="w-[150px]" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Até</label>
              <Input type="date" value={ate} onChange={(e) => { setAte(e.target.value); setOffset(0); }} className="w-[150px]" />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <MiniStat label="Total" value={String(total)} />
            <MiniStat label="Mediana" value={fmtSec(p50)} />
            <MiniStat label="p90" value={fmtSec(p90)} />
            <MiniStat label="Mais demorado" value={fmtSec(maior)} />
          </div>

          <div className="overflow-x-auto border rounded">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-muted-foreground bg-muted/50">
                  <th className="p-2">Data/Hora</th>
                  <th className="p-2">Tipo</th>
                  <th className="p-2">Registro</th>
                  <th className="p-2 text-right">Duração</th>
                </tr>
              </thead>
              <tbody>
                {isFetching && <tr><td colSpan={4} className="text-center py-6"><Loader2 className="h-4 w-4 animate-spin inline" /></td></tr>}
                {!isFetching && rows.length === 0 && <tr><td colSpan={4} className="text-center text-muted-foreground py-6">Nenhum lançamento.</td></tr>}
                {!isFetching && rows.map((r: any) => (
                  <tr key={r.id} className="border-t">
                    <td className="p-2 whitespace-nowrap">{new Date(r.salvo_em).toLocaleString("pt-BR")}</td>
                    <td className="p-2"><Badge variant="outline" className="text-[10px]">{r.tipo}</Badge></td>
                    <td className="p-2 truncate max-w-[260px]" title={r.titulo}>{r.titulo || r.registro_id || "—"}</td>
                    <td className="p-2 text-right font-mono">{fmtSec(r.duracao_segundos)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{total === 0 ? "0" : `${offset + 1}–${Math.min(offset + limit, total)}`} de {total}</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - limit))}>Anterior</Button>
              <Button size="sm" variant="outline" disabled={offset + limit >= total} onClick={() => setOffset(offset + limit)}>Próxima</Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border rounded p-2">
      <div className="text-[10px] text-muted-foreground uppercase">{label}</div>
      <div className="text-sm font-semibold">{value}</div>
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