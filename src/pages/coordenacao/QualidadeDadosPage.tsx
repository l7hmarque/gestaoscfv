import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, ShieldAlert, RefreshCw, ExternalLink, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";

type RelatorioDivergente = {
  id: string;
  data: string;
  nome_atividade: string | null;
  periodo_atividade: string | null;
  tipo_oficina: string | null;
  motivos_divergencia: string[] | null;
  educador_id: string | null;
  educador_nome?: string;
};

const MOTIVO_LABEL: Record<string, string> = {
  participantes_fora_do_territorio_da_turma: "Participantes fora do território",
  periodo_atividade_indefinido: "Período indefinido",
  sem_turma_vinculada: "Sem turma vinculada",
  sem_presenca_registrada: "Sem presença registrada",
};

function fmtDate(s: string) {
  if (!s) return "—";
  const [y, m, d] = s.split("-");
  return `${d}/${m}`;
}

export default function QualidadeDadosPage() {
  const [loading, setLoading] = useState(true);
  const [resumo, setResumo] = useState({ total: 0, divergentes: 0, sem_periodo: 0, sem_tipo_oficina: 0 });
  const [motivoCounts, setMotivoCounts] = useState<Record<string, number>>({});
  const [rows, setRows] = useState<RelatorioDivergente[]>([]);
  const [filtroMotivo, setFiltroMotivo] = useState<string>("todos");

  const carregar = async () => {
    setLoading(true);
    try {
      const [{ data: rel, error: e1 }, { data: profs }] = await Promise.all([
        (supabase as any)
          .from("relatorios_atividade")
          .select("id,data,nome_atividade,periodo_atividade,tipo_oficina,motivos_divergencia,flag_divergencia,educador_id")
          .order("data", { ascending: false }),
        supabase.from("profiles").select("id,nome"),
      ]);
      if (e1) throw e1;
      const profMap = new Map<string, string>();
      (profs ?? []).forEach((p: any) => profMap.set(p.id, p.nome));
      const all = (rel ?? []) as any[];
      const divergentes = all.filter((r) => r.flag_divergencia);
      const semPeriodo = all.filter((r) => !r.periodo_atividade).length;
      const semTipo = all.filter((r) => !r.tipo_oficina).length;
      const mc: Record<string, number> = {};
      divergentes.forEach((r) => {
        (r.motivos_divergencia ?? []).forEach((m: string) => {
          mc[m] = (mc[m] ?? 0) + 1;
        });
      });
      setResumo({ total: all.length, divergentes: divergentes.length, sem_periodo: semPeriodo, sem_tipo_oficina: semTipo });
      setMotivoCounts(mc);
      setRows(
        divergentes.map((r) => ({
          id: r.id,
          data: r.data,
          nome_atividade: r.nome_atividade,
          periodo_atividade: r.periodo_atividade,
          tipo_oficina: r.tipo_oficina,
          motivos_divergencia: r.motivos_divergencia,
          educador_id: r.educador_id,
          educador_nome: r.educador_id ? profMap.get(r.educador_id) ?? "—" : "—",
        })),
      );
    } catch (err: any) {
      toast.error("Falha ao carregar: " + (err?.message ?? "erro"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregar();
  }, []);

  const filtrados = useMemo(() => {
    if (filtroMotivo === "todos") return rows;
    return rows.filter((r) => (r.motivos_divergencia ?? []).includes(filtroMotivo));
  }, [rows, filtroMotivo]);

  const pctDiv = resumo.total ? Math.round((resumo.divergentes / resumo.total) * 1000) / 10 : 0;

  return (
    <div className="container mx-auto py-6 space-y-6 max-w-7xl">
      <header className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10 text-primary">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Qualidade de Dados</h1>
            <p className="text-sm text-muted-foreground">
              Relatórios de atividade sinalizados automaticamente pelos invariantes da Frente 2.
            </p>
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={carregar} disabled={loading} className="gap-2">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Recarregar
        </Button>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Relatórios totais" value={resumo.total} />
        <StatCard label="Com divergência" value={resumo.divergentes} tone="warning" extra={`${pctDiv}%`} />
        <StatCard label="Sem período" value={resumo.sem_periodo} tone={resumo.sem_periodo ? "warning" : "ok"} />
        <StatCard label="Sem tipo de oficina" value={resumo.sem_tipo_oficina} tone={resumo.sem_tipo_oficina ? "warning" : "ok"} />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Distribuição por motivo</CardTitle>
        </CardHeader>
        <CardContent>
          {Object.keys(motivoCounts).length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Nenhum motivo de divergência registrado.
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {Object.entries(motivoCounts)
                .sort((a, b) => b[1] - a[1])
                .map(([m, c]) => (
                  <Badge key={m} variant="secondary" className="text-xs">
                    {MOTIVO_LABEL[m] ?? m}: <span className="ml-1 font-bold">{c}</span>
                  </Badge>
                ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-base">Relatórios sinalizados ({filtrados.length})</CardTitle>
          <Select value={filtroMotivo} onValueChange={setFiltroMotivo}>
            <SelectTrigger className="w-[260px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os motivos</SelectItem>
              {Object.keys(motivoCounts).map((m) => (
                <SelectItem key={m} value={m}>
                  {MOTIVO_LABEL[m] ?? m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : filtrados.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Nada por aqui. 🎉</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px]">Data</TableHead>
                    <TableHead>Atividade</TableHead>
                    <TableHead>Educador</TableHead>
                    <TableHead>Período</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Motivos</TableHead>
                    <TableHead className="w-[60px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtrados.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-xs">{fmtDate(r.data)}</TableCell>
                      <TableCell className="text-sm">{r.nome_atividade ?? "—"}</TableCell>
                      <TableCell className="text-xs">{r.educador_nome}</TableCell>
                      <TableCell className="text-xs">{r.periodo_atividade ?? <span className="text-amber-600">indefinido</span>}</TableCell>
                      <TableCell className="text-xs">{r.tipo_oficina ?? "—"}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {(r.motivos_divergencia ?? []).map((m) => (
                            <Badge key={m} variant="outline" className="text-[10px] border-amber-500/40 text-amber-700">
                              {MOTIVO_LABEL[m] ?? m}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Link to={`/relatorios/${r.id}`}>
                          <Button size="icon" variant="ghost" className="h-7 w-7">
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ label, value, tone, extra }: { label: string; value: number; tone?: "ok" | "warning"; extra?: string }) {
  const border = tone === "warning" ? "border-l-amber-500" : tone === "ok" ? "border-l-emerald-500" : "border-l-primary/60";
  return (
    <Card className={`border-l-4 ${border}`}>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold mt-1">
          {value}
          {extra && <span className="text-sm font-normal text-muted-foreground ml-2">({extra})</span>}
        </p>
      </CardContent>
    </Card>
  );
}