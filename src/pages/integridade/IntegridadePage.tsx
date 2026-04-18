import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, CheckCircle2, Loader2, Users, GraduationCap, FileText, Calendar, UserX, UsersRound, ArrowRight, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { PERIODO_LABELS } from "@/lib/constants";

interface Detalhes {
  periodo_divergente: Array<{ participante_id: string; participante_nome: string; participante_periodo: string; turma_id: string; turma_nome: string; turma_periodo: string }>;
  desligados_incompletos: Array<{ id: string; nome: string; data_desligamento: string | null; motivo_desligamento: string | null }>;
  planejamentos_sem_turma: Array<{ id: string; titulo: string; data_aplicacao: string | null; educador_nome: string | null }>;
  sem_data_nascimento: Array<{ id: string; nome: string; periodo: string | null }>;
  turmas_sem_educador: Array<{ id: string; nome: string; periodo: string | null; faixa_etaria: string | null }>;
  turmas_vazias: Array<{ id: string; nome: string; periodo: string | null; faixa_etaria: string | null }>;
}

interface Profile { id: string; nome: string; cargo: string | null }

const periodoLabel = (p: string | null | undefined) =>
  p ? (PERIODO_LABELS[p as keyof typeof PERIODO_LABELS] ?? p) : "—";

export default function IntegridadePage() {
  const [data, setData] = useState<Detalhes | null>(null);
  const [loading, setLoading] = useState(true);
  const [educadores, setEducadores] = useState<Profile[]>([]);

  const load = async () => {
    setLoading(true);
    const [{ data: det }, { data: profs }] = await Promise.all([
      supabase.rpc("get_pendencias_integridade_detalhes" as any),
      supabase.from("profiles").select("id, nome, cargo").eq("ativo", true).order("nome"),
    ]);
    if (det) setData(det as unknown as Detalhes);
    setEducadores((profs ?? []).filter((p) => /educador|oficineiro|coorden|tecnic/i.test(p.cargo ?? "")));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const total =
    (data?.periodo_divergente.length ?? 0) +
    (data?.desligados_incompletos.length ?? 0) +
    (data?.planejamentos_sem_turma.length ?? 0) +
    (data?.sem_data_nascimento.length ?? 0) +
    (data?.turmas_sem_educador.length ?? 0) +
    (data?.turmas_vazias.length ?? 0);

  return (
    <div className="container mx-auto p-6 space-y-6 max-w-7xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <AlertTriangle className="h-7 w-7 text-destructive" />
            Central de Integridade
          </h1>
          <p className="text-muted-foreground mt-1">
            Revise e corrija inconsistências dos dados institucionais. Alterações aplicadas aqui são imediatas.
          </p>
        </div>
        <Button variant="outline" onClick={load}>
          <RefreshCw className="h-4 w-4 mr-2" /> Atualizar
        </Button>
      </div>

      {total === 0 ? (
        <Card className="border-l-4 border-l-success">
          <CardContent className="p-8 text-center space-y-2">
            <CheckCircle2 className="h-12 w-12 text-success mx-auto" />
            <h2 className="text-xl font-semibold">Tudo em ordem!</h2>
            <p className="text-muted-foreground">Nenhuma pendência de integridade detectada no momento.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <PeriodoDivergenteSection items={data!.periodo_divergente} onRefresh={load} />
          <TurmasSemEducadorSection items={data!.turmas_sem_educador} educadores={educadores} onRefresh={load} />
          <DesligadosIncompletosSection items={data!.desligados_incompletos} onRefresh={load} />
          <SemDataNascimentoSection items={data!.sem_data_nascimento} onRefresh={load} />
          <PlanejamentosSemTurmaSection items={data!.planejamentos_sem_turma} />
          <TurmasVaziasSection items={data!.turmas_vazias} />
        </>
      )}
    </div>
  );
}

/* ---------- Seções ---------- */

function SectionShell({
  icon: Icon, title, count, description, children,
}: { icon: any; title: string; count: number; description: string; children: React.ReactNode }) {
  if (count === 0) return null;
  return (
    <Card className="border-l-4 border-l-destructive">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Icon className="h-5 w-5 text-destructive" />
            {title}
            <Badge variant="destructive">{count}</Badge>
          </CardTitle>
        </div>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

interface TurmaOpt { id: string; nome: string; periodo: string; faixa_etaria: string | null }

function PeriodoDivergenteSection({ items, onRefresh }: { items: Detalhes["periodo_divergente"]; onRefresh: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [turmas, setTurmas] = useState<TurmaOpt[]>([]);
  const [destino, setDestino] = useState<Record<string, string>>({});

  useEffect(() => {
    supabase.from("turmas").select("id, nome, periodo, faixa_etaria").eq("ativa", true).order("nome")
      .then(({ data }) => setTurmas((data ?? []) as TurmaOpt[]));
  }, []);

  const alinharCadastro = async (participante_id: string, novo: string) => {
    setBusy(participante_id + ":cad");
    const { error } = await supabase.from("participantes").update({ periodo: novo as any }).eq("id", participante_id);
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    toast.success("Período do cadastro atualizado");
    onRefresh();
  };

  const moverTurma = async (it: Detalhes["periodo_divergente"][number]) => {
    const nova_turma_id = destino[`${it.participante_id}-${it.turma_id}`];
    if (!nova_turma_id) { toast.error("Selecione a nova turma"); return; }
    setBusy(it.participante_id + ":turma");
    // Remove vínculo antigo e cria novo
    const { error: delErr } = await supabase
      .from("turma_participantes")
      .delete()
      .eq("participante_id", it.participante_id)
      .eq("turma_id", it.turma_id);
    if (delErr) { setBusy(null); toast.error(delErr.message); return; }
    const { error: insErr } = await supabase
      .from("turma_participantes")
      .insert({ participante_id: it.participante_id, turma_id: nova_turma_id });
    setBusy(null);
    if (insErr) { toast.error(insErr.message); return; }
    toast.success("Participante movido para a nova turma");
    onRefresh();
  };

  return (
    <SectionShell
      icon={Users}
      title="Períodos divergentes"
      count={items.length}
      description="Participante e turma com períodos diferentes. Escolha mover o participante para uma turma do período correto, ou ajustar o cadastro se o período no perfil estiver errado."
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Participante</TableHead>
            <TableHead>Cadastro</TableHead>
            <TableHead>Turma atual</TableHead>
            <TableHead>Período da turma</TableHead>
            <TableHead>Mover para turma de {""}</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((it) => {
            const key = `${it.participante_id}-${it.turma_id}`;
            const opcoes = turmas.filter((t) => t.periodo === it.participante_periodo);
            return (
              <TableRow key={key}>
                <TableCell>
                  <Link to={`/participantes/${it.participante_id}`} className="text-primary hover:underline">
                    {it.participante_nome}
                  </Link>
                </TableCell>
                <TableCell><Badge variant="outline">{periodoLabel(it.participante_periodo)}</Badge></TableCell>
                <TableCell>
                  <Link to={`/turmas/${it.turma_id}`} className="text-primary hover:underline">{it.turma_nome}</Link>
                </TableCell>
                <TableCell><Badge variant="outline">{periodoLabel(it.turma_periodo)}</Badge></TableCell>
                <TableCell>
                  <Select
                    value={destino[key] ?? ""}
                    onValueChange={(v) => setDestino((s) => ({ ...s, [key]: v }))}
                  >
                    <SelectTrigger className="w-[280px]">
                      <SelectValue placeholder={`Turmas de ${periodoLabel(it.participante_periodo)}`} />
                    </SelectTrigger>
                    <SelectContent>
                      {opcoes.length === 0 ? (
                        <div className="px-2 py-1.5 text-sm text-muted-foreground">Nenhuma turma do período</div>
                      ) : (
                        opcoes.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.nome}{t.faixa_etaria ? ` (${t.faixa_etaria})` : ""}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex gap-2 justify-end flex-wrap">
                    <Button
                      size="sm"
                      disabled={busy === it.participante_id + ":turma" || !destino[key]}
                      onClick={() => moverTurma(it)}
                    >
                      {busy === it.participante_id + ":turma" ? <Loader2 className="h-3 w-3 animate-spin" /> : <ArrowRight className="h-3 w-3 mr-1" />}
                      Mover de turma
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy === it.participante_id + ":cad"}
                      onClick={() => alinharCadastro(it.participante_id, it.turma_periodo)}
                      title="Use se o período no cadastro do participante é que está errado"
                    >
                      {busy === it.participante_id + ":cad" ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                      Ajustar cadastro
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </SectionShell>
  );
}

function TurmasSemEducadorSection({
  items, educadores, onRefresh,
}: { items: Detalhes["turmas_sem_educador"]; educadores: Profile[]; onRefresh: () => void }) {
  const [sel, setSel] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const salvar = async (turma_id: string) => {
    const educador_id = sel[turma_id];
    if (!educador_id) { toast.error("Selecione um educador"); return; }
    setBusy(turma_id);
    const { error } = await supabase.from("turmas").update({ educador_id }).eq("id", turma_id);
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    toast.success("Educador vinculado");
    onRefresh();
  };

  return (
    <SectionShell
      icon={GraduationCap}
      title="Turmas sem educador"
      count={items.length}
      description="Atribua um educador responsável para garantir registros corretos de presença e relatórios."
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Turma</TableHead>
            <TableHead>Período</TableHead>
            <TableHead>Faixa</TableHead>
            <TableHead>Educador</TableHead>
            <TableHead className="text-right">Ação</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((t) => (
            <TableRow key={t.id}>
              <TableCell>
                <Link to={`/turmas/${t.id}`} className="text-primary hover:underline">{t.nome}</Link>
              </TableCell>
              <TableCell>{periodoLabel(t.periodo)}</TableCell>
              <TableCell>{t.faixa_etaria ?? "—"}</TableCell>
              <TableCell>
                <Select value={sel[t.id] ?? ""} onValueChange={(v) => setSel((s) => ({ ...s, [t.id]: v }))}>
                  <SelectTrigger className="w-[220px]"><SelectValue placeholder="Selecionar educador" /></SelectTrigger>
                  <SelectContent>
                    {educadores.map((e) => (
                      <SelectItem key={e.id} value={e.id}>{e.nome}{e.cargo ? ` — ${e.cargo}` : ""}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell className="text-right">
                <Button size="sm" disabled={busy === t.id || !sel[t.id]} onClick={() => salvar(t.id)}>
                  {busy === t.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Salvar"}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </SectionShell>
  );
}

function DesligadosIncompletosSection({ items, onRefresh }: { items: Detalhes["desligados_incompletos"]; onRefresh: () => void }) {
  const [edit, setEdit] = useState<Record<string, { data: string; motivo: string }>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const get = (id: string, item: Detalhes["desligados_incompletos"][number]) =>
    edit[id] ?? { data: item.data_desligamento ?? "", motivo: item.motivo_desligamento ?? "" };

  const salvar = async (id: string) => {
    const v = edit[id];
    if (!v?.data || !v?.motivo?.trim()) { toast.error("Preencha data e motivo"); return; }
    setBusy(id);
    const { error } = await supabase.from("participantes").update({
      data_desligamento: v.data, motivo_desligamento: v.motivo.trim(),
    }).eq("id", id);
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    toast.success("Desligamento completado");
    onRefresh();
  };

  return (
    <SectionShell
      icon={UserX}
      title="Desligamentos incompletos"
      count={items.length}
      description="Participantes desligados sem data ou motivo registrados."
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Participante</TableHead>
            <TableHead>Data de desligamento</TableHead>
            <TableHead>Motivo</TableHead>
            <TableHead className="text-right">Ação</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((p) => {
            const v = get(p.id, p);
            return (
              <TableRow key={p.id}>
                <TableCell>
                  <Link to={`/participantes/${p.id}`} className="text-primary hover:underline">{p.nome}</Link>
                </TableCell>
                <TableCell>
                  <Input type="date" value={v.data} className="w-[160px]"
                    onChange={(e) => setEdit((s) => ({ ...s, [p.id]: { ...v, data: e.target.value } }))} />
                </TableCell>
                <TableCell>
                  <Textarea rows={1} value={v.motivo} placeholder="Motivo do desligamento"
                    onChange={(e) => setEdit((s) => ({ ...s, [p.id]: { ...v, motivo: e.target.value } }))} />
                </TableCell>
                <TableCell className="text-right">
                  <Button size="sm" disabled={busy === p.id} onClick={() => salvar(p.id)}>
                    {busy === p.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Salvar"}
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </SectionShell>
  );
}

function SemDataNascimentoSection({ items, onRefresh }: { items: Detalhes["sem_data_nascimento"]; onRefresh: () => void }) {
  const [edit, setEdit] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const salvar = async (id: string) => {
    const data = edit[id];
    if (!data) { toast.error("Informe a data"); return; }
    setBusy(id);
    const { error } = await supabase.from("participantes").update({ data_nascimento: data }).eq("id", id);
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    toast.success("Data de nascimento registrada");
    onRefresh();
  };

  return (
    <SectionShell
      icon={Calendar}
      title="Participantes sem data de nascimento"
      count={items.length}
      description="Necessário para faixa etária correta nos indicadores e REO."
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Participante</TableHead>
            <TableHead>Período</TableHead>
            <TableHead>Data de nascimento</TableHead>
            <TableHead className="text-right">Ação</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((p) => (
            <TableRow key={p.id}>
              <TableCell>
                <Link to={`/participantes/${p.id}`} className="text-primary hover:underline">{p.nome}</Link>
              </TableCell>
              <TableCell>{periodoLabel(p.periodo)}</TableCell>
              <TableCell>
                <Input type="date" value={edit[p.id] ?? ""} className="w-[160px]"
                  onChange={(e) => setEdit((s) => ({ ...s, [p.id]: e.target.value }))} />
              </TableCell>
              <TableCell className="text-right">
                <Button size="sm" disabled={busy === p.id || !edit[p.id]} onClick={() => salvar(p.id)}>
                  {busy === p.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Salvar"}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </SectionShell>
  );
}

function PlanejamentosSemTurmaSection({ items }: { items: Detalhes["planejamentos_sem_turma"] }) {
  return (
    <SectionShell
      icon={FileText}
      title="Planejamentos sem turma"
      count={items.length}
      description="Vincule cada planejamento a uma ou mais turmas para que apareçam nos relatórios."
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Título</TableHead>
            <TableHead>Educador</TableHead>
            <TableHead>Data de aplicação</TableHead>
            <TableHead className="text-right">Ação</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((p) => (
            <TableRow key={p.id}>
              <TableCell className="font-medium">{p.titulo}</TableCell>
              <TableCell>{p.educador_nome ?? "—"}</TableCell>
              <TableCell>{p.data_aplicacao ?? "—"}</TableCell>
              <TableCell className="text-right">
                <Button size="sm" variant="outline" asChild>
                  <Link to={`/planejamentos/${p.id}`}>Vincular turmas <ArrowRight className="h-3 w-3 ml-1" /></Link>
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </SectionShell>
  );
}

function TurmasVaziasSection({ items }: { items: Detalhes["turmas_vazias"] }) {
  return (
    <SectionShell
      icon={UsersRound}
      title="Turmas vazias"
      count={items.length}
      description="Turmas ativas sem participantes vinculados. Adicione participantes ou desative a turma."
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Turma</TableHead>
            <TableHead>Período</TableHead>
            <TableHead>Faixa etária</TableHead>
            <TableHead className="text-right">Ação</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((t) => (
            <TableRow key={t.id}>
              <TableCell className="font-medium">{t.nome}</TableCell>
              <TableCell>{periodoLabel(t.periodo)}</TableCell>
              <TableCell>{t.faixa_etaria ?? "—"}</TableCell>
              <TableCell className="text-right">
                <Button size="sm" variant="outline" asChild>
                  <Link to={`/turmas/${t.id}`}>Gerenciar turma <ArrowRight className="h-3 w-3 ml-1" /></Link>
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </SectionShell>
  );
}
