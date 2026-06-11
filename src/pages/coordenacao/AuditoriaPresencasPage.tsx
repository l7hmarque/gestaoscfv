import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, RefreshCw, AlertTriangle, Copy, UserX, FileWarning, FileX, ArrowRight, ShieldCheck, Wrench, Trash2, Link2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";

type Resumo = {
  pares_duplicados: number;
  presencas_faltantes: number;
  presencas_orfas: number;
  relatorios_sem_turma: number;
  relatorios_sem_presenca: number;
};

type Duplicado = { turma_id: string; turma_nome: string; data: string; qtd_relatorios: number; relatorio_ids: string[] };
type Faltante = { relatorio_id: string; data: string; turma_id: string; turma_nome: string; participante_id: string; participante_nome: string; participante_status: string };
type Orfa = { presenca_id: string; relatorio_id: string; data: string; participante_id: string; participante_nome: string };
type RelMin = { relatorio_id: string; data: string; nome_atividade: string | null };

type Auditoria = {
  periodo: { de: string; ate: string };
  resumo: Resumo;
  pares_duplicados: Duplicado[];
  presencas_faltantes: Faltante[];
  presencas_orfas: Orfa[];
  relatorios_sem_turma: RelMin[];
  relatorios_sem_presenca: RelMin[];
};

function firstDayOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}
function lastDayOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);
}
function fmtDate(s: string) {
  if (!s) return "—";
  const [y, m, d] = s.split("-");
  return `${d}/${m}/${y}`;
}

export default function AuditoriaPresencasPage() {
  const [de, setDe] = useState(firstDayOfMonth());
  const [ate, setAte] = useState(lastDayOfMonth());
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Auditoria | null>(null);

  const carregar = async () => {
    setLoading(true);
    const { data: r, error } = await supabase.rpc("auditar_integridade_presencas" as any, { _de: de, _ate: ate });
    setLoading(false);
    if (error) {
      toast.error("Falha ao auditar: " + error.message);
      return;
    }
    setData(r as unknown as Auditoria);
  };

  useEffect(() => { carregar(); /* eslint-disable-next-line */ }, []);

  const total = useMemo(() => {
    if (!data) return 0;
    const r = data.resumo;
    return r.pares_duplicados + r.presencas_faltantes + r.presencas_orfas + r.relatorios_sem_turma + r.relatorios_sem_presenca;
  }, [data]);

  // ── Reconciliação ───────────────────────────────────────────────────────
  const [dlg, setDlg] = useState<null | { tipo: "dup" | "orfa" | "falt" | "vazio"; payload: any }>(null);
  const [just, setJust] = useState("");
  const [manterId, setManterId] = useState<string>("");
  const [acaoOrfa, setAcaoOrfa] = useState<"excluir" | "vincular">("excluir");
  const [statusFalt, setStatusFalt] = useState<"P" | "A" | "J">("P");
  const [busy, setBusy] = useState(false);

  const abrir = (tipo: any, payload: any) => {
    setJust(""); setManterId(payload?.relatorio_ids?.[0] ?? ""); setAcaoOrfa("excluir"); setStatusFalt("P");
    setDlg({ tipo, payload });
  };

  const executar = async () => {
    if (!dlg) return;
    if (just.trim().length < 10) { toast.error("Justificativa precisa ter pelo menos 10 caracteres."); return; }
    setBusy(true);
    try {
      let res: any;
      if (dlg.tipo === "dup") {
        const descartar = (dlg.payload.relatorio_ids as string[]).filter((x) => x !== manterId);
        res = await supabase.rpc("reconciliar_duplicados" as any, { _manter_id: manterId, _descartar_ids: descartar, _justificativa: just });
      } else if (dlg.tipo === "orfa") {
        res = await supabase.rpc("resolver_presenca_orfa" as any, { _presenca_id: dlg.payload.presenca_id, _acao: acaoOrfa, _justificativa: just });
      } else if (dlg.tipo === "falt") {
        res = await supabase.rpc("completar_presenca_faltante" as any, { _relatorio_id: dlg.payload.relatorio_id, _participante_id: dlg.payload.participante_id, _status: statusFalt, _justificativa: just });
      } else {
        res = await supabase.rpc("excluir_relatorio_vazio" as any, { _relatorio_id: dlg.payload.relatorio_id, _justificativa: just });
      }
      if (res.error) throw res.error;
      toast.success("Reconciliação aplicada.");
      setDlg(null);
      await carregar();
    } catch (e: any) {
      toast.error("Falha: " + (e?.message ?? String(e)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6 max-w-7xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <ShieldCheck className="h-7 w-7 text-primary" />
            Auditoria de Presenças
          </h1>
          <p className="text-muted-foreground mt-1">
            Diagnóstico read-only. Nenhuma ação aqui altera dados. Use para identificar onde a coordenação precisa intervir.
          </p>
        </div>
        <Button asChild variant="ghost">
          <Link to="/coordenacao"><ArrowRight className="h-4 w-4 mr-2" /> Voltar à Coordenação</Link>
        </Button>
      </div>

      <Card>
        <CardContent className="p-4 flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <Label htmlFor="de">De</Label>
            <Input id="de" type="date" value={de} onChange={(e) => setDe(e.target.value)} className="w-40" />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="ate">Até</Label>
            <Input id="ate" type="date" value={ate} onChange={(e) => setAte(e.target.value)} className="w-40" />
          </div>
          <Button onClick={carregar} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Auditar período
          </Button>
          {data && (
            <Badge variant={total === 0 ? "default" : "destructive"} className="ml-auto text-sm">
              {total === 0 ? "Tudo certo no período" : `${total} ocorrências encontradas`}
            </Badge>
          )}
        </CardContent>
      </Card>

      {loading && (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {data && !loading && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <KpiCard icon={<Copy className="h-5 w-5" />} label="Relatórios duplicados" value={data.resumo.pares_duplicados} tone={data.resumo.pares_duplicados ? "warn" : "ok"} />
            <KpiCard icon={<UserX className="h-5 w-5" />} label="Presenças faltantes" value={data.resumo.presencas_faltantes} tone={data.resumo.presencas_faltantes ? "warn" : "ok"} />
            <KpiCard icon={<AlertTriangle className="h-5 w-5" />} label="Presenças órfãs" value={data.resumo.presencas_orfas} tone={data.resumo.presencas_orfas ? "warn" : "ok"} />
            <KpiCard icon={<FileWarning className="h-5 w-5" />} label="Sem turma" value={data.resumo.relatorios_sem_turma} tone={data.resumo.relatorios_sem_turma ? "warn" : "ok"} />
            <KpiCard icon={<FileX className="h-5 w-5" />} label="Sem presença" value={data.resumo.relatorios_sem_presenca} tone={data.resumo.relatorios_sem_presenca ? "warn" : "ok"} />
          </div>

          <Tabs defaultValue="duplicados">
            <TabsList className="flex-wrap h-auto">
              <TabsTrigger value="duplicados">Duplicados ({data.resumo.pares_duplicados})</TabsTrigger>
              <TabsTrigger value="faltantes">Faltantes ({data.resumo.presencas_faltantes})</TabsTrigger>
              <TabsTrigger value="orfas">Órfãs ({data.resumo.presencas_orfas})</TabsTrigger>
              <TabsTrigger value="sem_turma">Sem turma ({data.resumo.relatorios_sem_turma})</TabsTrigger>
              <TabsTrigger value="sem_presenca">Sem presença ({data.resumo.relatorios_sem_presenca})</TabsTrigger>
            </TabsList>

            <TabsContent value="duplicados">
              <Card><CardHeader><CardTitle className="text-base">Pares (Turma × Data) com 2+ relatórios</CardTitle></CardHeader>
                <CardContent className="p-0">
                  {data.pares_duplicados.length === 0 ? <Vazio msg="Nenhum par duplicado." /> : (
                    <Table>
                      <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Turma</TableHead><TableHead>Qtd.</TableHead><TableHead>Relatórios</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {data.pares_duplicados.map((d, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-mono text-xs">{fmtDate(d.data)}</TableCell>
                            <TableCell>{d.turma_nome}</TableCell>
                            <TableCell><Badge variant="destructive">{d.qtd_relatorios}</Badge></TableCell>
                            <TableCell className="space-x-1">
                              {d.relatorio_ids.map((rid) => (
                                <Button key={rid} asChild variant="link" size="sm" className="h-auto p-0">
                                  <Link to={`/relatorios/${rid}`}>{rid.slice(0, 8)}</Link>
                                </Button>
                              ))}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="faltantes">
              <Card><CardHeader><CardTitle className="text-base">Participantes ativos sem marcação (P/A/J)</CardTitle></CardHeader>
                <CardContent className="p-0">
                  {data.presencas_faltantes.length === 0 ? <Vazio msg="Toda chamada está completa no período." /> : (
                    <Table>
                      <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Turma</TableHead><TableHead>Participante</TableHead><TableHead>Status</TableHead><TableHead>Relatório</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {data.presencas_faltantes.map((f, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-mono text-xs">{fmtDate(f.data)}</TableCell>
                            <TableCell>{f.turma_nome}</TableCell>
                            <TableCell>{f.participante_nome}</TableCell>
                            <TableCell><Badge variant="outline" className="capitalize">{f.participante_status}</Badge></TableCell>
                            <TableCell><Button asChild variant="link" size="sm" className="h-auto p-0"><Link to={`/relatorios/${f.relatorio_id}`}>abrir</Link></Button></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="orfas">
              <Card><CardHeader><CardTitle className="text-base">Presenças de participantes fora das turmas do relatório</CardTitle></CardHeader>
                <CardContent className="p-0">
                  {data.presencas_orfas.length === 0 ? <Vazio msg="Nenhuma presença órfã." /> : (
                    <Table>
                      <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Participante</TableHead><TableHead>Relatório</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {data.presencas_orfas.slice(0, 500).map((o, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-mono text-xs">{fmtDate(o.data)}</TableCell>
                            <TableCell>{o.participante_nome ?? o.participante_id.slice(0, 8)}</TableCell>
                            <TableCell><Button asChild variant="link" size="sm" className="h-auto p-0"><Link to={`/relatorios/${o.relatorio_id}`}>abrir</Link></Button></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                  {data.presencas_orfas.length > 500 && <div className="p-3 text-xs text-muted-foreground">Mostrando primeiras 500 de {data.presencas_orfas.length}.</div>}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="sem_turma">
              <Card><CardHeader><CardTitle className="text-base">Relatórios sem turma vinculada</CardTitle></CardHeader>
                <CardContent className="p-0">
                  {data.relatorios_sem_turma.length === 0 ? <Vazio msg="Todos os relatórios têm turma." /> : (
                    <Table>
                      <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Atividade</TableHead><TableHead /></TableRow></TableHeader>
                      <TableBody>
                        {data.relatorios_sem_turma.map((r) => (
                          <TableRow key={r.relatorio_id}>
                            <TableCell className="font-mono text-xs">{fmtDate(r.data)}</TableCell>
                            <TableCell>{r.nome_atividade ?? "—"}</TableCell>
                            <TableCell><Button asChild variant="link" size="sm" className="h-auto p-0"><Link to={`/relatorios/${r.relatorio_id}`}>abrir</Link></Button></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="sem_presenca">
              <Card><CardHeader><CardTitle className="text-base">Relatórios sem nenhuma presença registrada</CardTitle></CardHeader>
                <CardContent className="p-0">
                  {data.relatorios_sem_presenca.length === 0 ? <Vazio msg="Todos os relatórios têm presença." /> : (
                    <Table>
                      <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Atividade</TableHead><TableHead /></TableRow></TableHeader>
                      <TableBody>
                        {data.relatorios_sem_presenca.map((r) => (
                          <TableRow key={r.relatorio_id}>
                            <TableCell className="font-mono text-xs">{fmtDate(r.data)}</TableCell>
                            <TableCell>{r.nome_atividade ?? "—"}</TableCell>
                            <TableCell><Button asChild variant="link" size="sm" className="h-auto p-0"><Link to={`/relatorios/${r.relatorio_id}`}>abrir</Link></Button></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}

function KpiCard({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone: "ok" | "warn" }) {
  return (
    <Card className={tone === "warn" && value > 0 ? "border-destructive/40" : ""}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className={tone === "warn" && value > 0 ? "text-destructive" : "text-muted-foreground"}>{icon}</div>
          <div className={`text-2xl font-bold tabular-nums ${tone === "warn" && value > 0 ? "text-destructive" : ""}`}>{value}</div>
        </div>
        <div className="text-xs text-muted-foreground mt-1">{label}</div>
      </CardContent>
    </Card>
  );
}

function Vazio({ msg }: { msg: string }) {
  return <div className="p-6 text-sm text-muted-foreground text-center">{msg}</div>;
}