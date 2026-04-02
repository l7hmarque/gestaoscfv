import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useIsDemo, guardDemo } from "@/hooks/useIsDemo";
import { toast } from "sonner";
import { format, subDays, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { Plus, AlertTriangle, Users, FileText, ClipboardList, Activity } from "lucide-react";

const TIPOS_ATENDIMENTO = [
  { value: "visita_domiciliar", label: "Visita Domiciliar" },
  { value: "atendimento_individual", label: "Atendimento Individual" },
  { value: "atendimento_familiar", label: "Atendimento Familiar" },
  { value: "encaminhamento", label: "Encaminhamento" },
  { value: "busca_ativa", label: "Busca Ativa" },
  { value: "acolhida", label: "Acolhida" },
  { value: "desligamento", label: "Desligamento" },
  { value: "outro", label: "Outro" },
];

const PIE_COLORS = ["hsl(var(--primary))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))", "#6366f1", "#f59e0b", "#ef4444"];

const EquipeTecnicaPage = () => {
  const { user } = useAuth();
  const isDemo = useIsDemo();
  const [atendimentos, setAtendimentos] = useState<any[]>([]);
  const [participantes, setParticipantes] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [presenca, setPresenca] = useState<any[]>([]);
  const [turmas, setTurmas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [filterTipo, setFilterTipo] = useState("");
  const [filterProf, setFilterProf] = useState("");
  const [form, setForm] = useState({ participante_id: "", data_atendimento: format(new Date(), "yyyy-MM-dd"), tipo: "atendimento_individual", descricao: "", encaminhamento: "" });
  const [myProfileId, setMyProfileId] = useState("");

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    const [{ data: atd }, { data: part }, { data: prof }, { data: pres }, { data: turm }] = await Promise.all([
      supabase.from("atendimentos").select("*").order("data_atendimento", { ascending: false }),
      supabase.from("participantes").select("id, nome_completo, status, data_nascimento, bairro_id, periodo, laudo, categoria_vulnerabilidade").order("nome_completo"),
      supabase.from("profiles").select("id, nome, cargo, user_id"),
      supabase.from("presenca").select("participante_id, data, presente").gte("data", format(subDays(new Date(), 90), "yyyy-MM-dd")),
      supabase.from("turmas").select("id, nome, dias_semana").eq("ativa", true),
      supabase.from("turma_participantes").select("turma_id"),
    ]);
    setAtendimentos(atd || []);
    setParticipantes(part || []);
    setProfiles(prof || []);
    setPresenca(pres || []);
    setTurmas(turm || []);

    // Build turma participant count map
    const tpMap: Record<string, number> = {};
    (arguments[5]?.data || []).forEach((tp: any) => {
      tpMap[tp.turma_id] = (tpMap[tp.turma_id] || 0) + 1;
    });
    setTpCountMap(tpMap);

    if (user) {
      const me = (prof || []).find((p: any) => p.user_id === user.id);
      if (me) setMyProfileId(me.id);
    }
    setLoading(false);
  };

  const handleCreate = async () => {
    if (guardDemo(isDemo)) return;
    if (!form.participante_id || !form.descricao.trim()) { toast.error("Preencha participante e descrição"); return; }
    const { error } = await supabase.from("atendimentos").insert({
      participante_id: form.participante_id,
      profissional_id: myProfileId,
      data_atendimento: form.data_atendimento,
      tipo: form.tipo,
      descricao: form.descricao,
      encaminhamento: form.encaminhamento || null,
    } as any);
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success("Atendimento registrado!");
    setDialogOpen(false);
    setForm({ participante_id: "", data_atendimento: format(new Date(), "yyyy-MM-dd"), tipo: "atendimento_individual", descricao: "", encaminhamento: "" });
    loadAll();
  };

  // Dashboard calculations
  const now = new Date();
  const mesAtual = startOfMonth(now);
  const fimMes = endOfMonth(now);

  const atdMes = useMemo(() => atendimentos.filter(a => a.data_atendimento >= format(mesAtual, "yyyy-MM-dd") && a.data_atendimento <= format(fimMes, "yyyy-MM-dd")), [atendimentos]);
  const participantesAtivos = useMemo(() => participantes.filter(p => p.status === "ativo"), [participantes]);
  const pendentes = useMemo(() => participantes.filter(p => p.status === "pendente"), [participantes]);
  const comLaudo = useMemo(() => participantesAtivos.filter(p => p.laudo && p.laudo.trim()).length, [participantesAtivos]);

  // Atendimentos por tipo (pie)
  const porTipo = useMemo(() => {
    const map: Record<string, number> = {};
    atdMes.forEach(a => { map[a.tipo] = (map[a.tipo] || 0) + 1; });
    return Object.entries(map).map(([tipo, count]) => ({ name: TIPOS_ATENDIMENTO.find(t => t.value === tipo)?.label || tipo, value: count }));
  }, [atdMes]);

  // Atendimentos por mês (line)
  const porMes = useMemo(() => {
    const map: Record<string, number> = {};
    atendimentos.forEach(a => { const k = a.data_atendimento.slice(0, 7); map[k] = (map[k] || 0) + 1; });
    return Object.entries(map).sort().slice(-6).map(([mes, count]) => ({ mes, count }));
  }, [atendimentos]);

  // Vulnerabilidade
  const porVulnerabilidade = useMemo(() => {
    const map: Record<string, number> = {};
    participantesAtivos.forEach(p => { const cat = p.categoria_vulnerabilidade || "Não informado"; map[cat] = (map[cat] || 0) + 1; });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [participantesAtivos]);

  // Alertas de frequência
  const alertasFrequencia = useMemo(() => {
    const ultimosDias = format(subDays(now, 30), "yyyy-MM-dd");
    const porParticipante: Record<string, { total: number; faltas: number }> = {};
    presenca.filter(p => p.data >= ultimosDias).forEach(p => {
      if (!porParticipante[p.participante_id]) porParticipante[p.participante_id] = { total: 0, faltas: 0 };
      porParticipante[p.participante_id].total++;
      if (!p.presente) porParticipante[p.participante_id].faltas++;
    });
    return Object.entries(porParticipante)
      .filter(([, v]) => v.total >= 3 && (v.faltas / v.total) > 0.35)
      .map(([pid, v]) => {
        const p = participantes.find(x => x.id === pid);
        return p ? { ...p, faltas: v.faltas, total: v.total, pct: Math.round((1 - v.faltas / v.total) * 100) } : null;
      })
      .filter(Boolean);
  }, [presenca, participantes]);

  // Mapa de calor (dias da semana)
  const mapaCalor = useMemo(() => {
    const diasMap: Record<string, number> = { seg: 0, ter: 0, qua: 0, qui: 0, sex: 0 };
    turmas.forEach(t => {
      (t.dias_semana || []).forEach((d: string) => {
        const key = d.toLowerCase().slice(0, 3);
        if (diasMap[key] !== undefined) diasMap[key]++;
      });
    });
    const max = Math.max(...Object.values(diasMap), 1);
    return Object.entries(diasMap).map(([dia, count]) => ({
      dia: dia === "seg" ? "Segunda" : dia === "ter" ? "Terça" : dia === "qua" ? "Quarta" : dia === "qui" ? "Quinta" : "Sexta",
      count,
      intensity: count / max,
    }));
  }, [turmas]);

  // Filtered atendimentos
  const filteredAtd = useMemo(() => {
    return atendimentos.filter(a => {
      if (filterTipo && filterTipo !== "__all__" && a.tipo !== filterTipo) return false;
      if (filterProf && filterProf !== "__all__" && a.profissional_id !== filterProf) return false;
      return true;
    });
  }, [atendimentos, filterTipo, filterProf]);

  const profName = (id: string) => profiles.find(p => p.id === id)?.nome || "—";
  const partName = (id: string) => participantes.find(p => p.id === id)?.nome_completo || "—";
  const tipoLabel = (v: string) => TIPOS_ATENDIMENTO.find(t => t.value === v)?.label || v;

  if (loading) return <div className="flex justify-center py-12"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">Equipe Técnica</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1"><Plus className="h-4 w-4" />Novo Atendimento</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Registrar Atendimento</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Participante</Label>
                <Select value={form.participante_id} onValueChange={v => setForm(f => ({ ...f, participante_id: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {participantesAtivos.map(p => <SelectItem key={p.id} value={p.id}>{p.nome_completo}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Data</Label>
                  <Input type="date" value={form.data_atendimento} onChange={e => setForm(f => ({ ...f, data_atendimento: e.target.value }))} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Tipo</Label>
                  <Select value={form.tipo} onValueChange={v => setForm(f => ({ ...f, tipo: v }))}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TIPOS_ATENDIMENTO.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="text-xs">Descrição</Label>
                <Textarea value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} className="mt-1 min-h-[100px]" placeholder="Relato do atendimento..." />
              </div>
              <div>
                <Label className="text-xs">Encaminhamento (opcional)</Label>
                <Textarea value={form.encaminhamento} onChange={e => setForm(f => ({ ...f, encaminhamento: e.target.value }))} className="mt-1 min-h-[60px]" placeholder="Encaminhamento realizado..." />
              </div>
              <Button onClick={handleCreate} className="w-full">Registrar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="dashboard" className="space-y-4">
        <TabsList>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="atendimentos">Atendimentos</TabsTrigger>
          <TabsTrigger value="alertas">Alertas</TabsTrigger>
        </TabsList>

        {/* DASHBOARD */}
        <TabsContent value="dashboard" className="space-y-4">
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card><CardContent className="pt-4 text-center">
              <ClipboardList className="h-5 w-5 mx-auto text-primary mb-1" />
              <p className="text-2xl font-bold">{atdMes.length}</p>
              <p className="text-xs text-muted-foreground">Atendimentos (mês)</p>
            </CardContent></Card>
            <Card><CardContent className="pt-4 text-center">
              <Users className="h-5 w-5 mx-auto text-primary mb-1" />
              <p className="text-2xl font-bold">{new Set(atdMes.map(a => a.participante_id)).size}</p>
              <p className="text-xs text-muted-foreground">Participantes atendidos</p>
            </CardContent></Card>
            <Card><CardContent className="pt-4 text-center">
              <FileText className="h-5 w-5 mx-auto text-primary mb-1" />
              <p className="text-2xl font-bold">{comLaudo}/{participantesAtivos.length}</p>
              <p className="text-xs text-muted-foreground">Com laudo ({participantesAtivos.length > 0 ? Math.round(comLaudo / participantesAtivos.length * 100) : 0}%)</p>
            </CardContent></Card>
            <Card><CardContent className="pt-4 text-center">
              <AlertTriangle className="h-5 w-5 mx-auto text-amber-500 mb-1" />
              <p className="text-2xl font-bold">{pendentes.length}</p>
              <p className="text-xs text-muted-foreground">Matrículas pendentes</p>
            </CardContent></Card>
          </div>

          {pendentes.length > 0 && (
            <Card className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
              <CardContent className="pt-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <span className="text-sm font-medium">{pendentes.length} matrícula(s) pendente(s) aguardando aprovação</span>
                </div>
                <Button variant="outline" size="sm" asChild><Link to="/participantes?status=pendente">Ver pendentes</Link></Button>
              </CardContent>
            </Card>
          )}

          <div className="grid md:grid-cols-2 gap-4">
            {/* Atendimentos por tipo */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Atendimentos por Tipo (Mês)</CardTitle></CardHeader>
              <CardContent>
                {porTipo.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={porTipo} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, value }) => `${name}: ${value}`} labelLine={false}>
                        {porTipo.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : <p className="text-sm text-muted-foreground text-center py-8">Sem dados no mês</p>}
              </CardContent>
            </Card>

            {/* Atendimentos por mês */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Atendimentos por Mês</CardTitle></CardHeader>
              <CardContent>
                {porMes.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={porMes}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="mes" fontSize={10} />
                      <YAxis fontSize={10} />
                      <Tooltip />
                      <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} name="Atendimentos" />
                    </LineChart>
                  </ResponsiveContainer>
                ) : <p className="text-sm text-muted-foreground text-center py-8">Sem dados</p>}
              </CardContent>
            </Card>

            {/* Vulnerabilidade */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Distribuição por Vulnerabilidade</CardTitle></CardHeader>
              <CardContent>
                {porVulnerabilidade.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={porVulnerabilidade} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, value }) => `${name}: ${value}`} labelLine={false}>
                        {porVulnerabilidade.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : <p className="text-sm text-muted-foreground text-center py-8">Sem dados</p>}
              </CardContent>
            </Card>

            {/* Mapa de calor */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Volume por Dia da Semana</CardTitle></CardHeader>
              <CardContent>
                <div className="flex gap-2 justify-center py-6">
                  {mapaCalor.map(d => (
                    <div key={d.dia} className="flex flex-col items-center gap-1">
                      <div
                        className="w-12 h-12 rounded-lg flex items-center justify-center text-xs font-bold"
                        style={{
                          backgroundColor: `hsl(var(--primary) / ${0.15 + d.intensity * 0.85})`,
                          color: d.intensity > 0.5 ? "hsl(var(--primary-foreground))" : "hsl(var(--foreground))",
                        }}
                      >
                        {d.count}
                      </div>
                      <span className="text-[10px] text-muted-foreground">{d.dia}</span>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground text-center">Turmas ativas por dia (probabilidade de maior volume)</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ATENDIMENTOS */}
        <TabsContent value="atendimentos" className="space-y-3">
          <div className="flex gap-2 flex-wrap">
            <Select value={filterTipo} onValueChange={setFilterTipo}>
              <SelectTrigger className="w-48"><SelectValue placeholder="Tipo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos</SelectItem>
                {TIPOS_ATENDIMENTO.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterProf} onValueChange={setFilterProf}>
              <SelectTrigger className="w-48"><SelectValue placeholder="Profissional" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos</SelectItem>
                {profiles.filter(p => p.cargo && (p.cargo.toLowerCase().includes("social") || p.cargo.toLowerCase().includes("psicol") || p.cargo.toLowerCase().includes("técnic"))).map(p => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
              </SelectContent>
            </Select>
            {(filterTipo || filterProf) && <Button variant="ghost" size="sm" onClick={() => { setFilterTipo(""); setFilterProf(""); }}>Limpar</Button>}
          </div>
          <div className="border rounded-lg overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Data</TableHead>
                  <TableHead className="text-xs">Participante</TableHead>
                  <TableHead className="text-xs">Tipo</TableHead>
                  <TableHead className="text-xs">Profissional</TableHead>
                  <TableHead className="text-xs">Resumo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAtd.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhum atendimento registrado</TableCell></TableRow>
                ) : filteredAtd.map(a => (
                  <TableRow key={a.id}>
                    <TableCell className="text-xs">{a.data_atendimento}</TableCell>
                    <TableCell className="text-xs font-medium">
                      <Link to={`/participantes/${a.participante_id}`} className="text-primary hover:underline">{partName(a.participante_id)}</Link>
                    </TableCell>
                    <TableCell><Badge variant="secondary" className="text-[10px]">{tipoLabel(a.tipo)}</Badge></TableCell>
                    <TableCell className="text-xs">{profName(a.profissional_id)}</TableCell>
                    <TableCell className="text-xs max-w-[200px] truncate">{a.descricao}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* ALERTAS */}
        <TabsContent value="alertas" className="space-y-4">
          {pendentes.length > 0 && (
            <Card className="border-amber-500/50">
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-500" />Matrículas Pendentes ({pendentes.length})</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-1">
                  {pendentes.map(p => (
                    <div key={p.id} className="flex items-center justify-between py-1 border-b last:border-0">
                      <Link to={`/participantes/${p.id}`} className="text-sm text-primary hover:underline">{p.nome_completo}</Link>
                      <Badge variant="outline" className="text-[10px]">Pendente</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {alertasFrequencia.length > 0 && (
            <Card className="border-destructive/50">
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Activity className="h-4 w-4 text-destructive" />Alertas de Frequência ({alertasFrequencia.length})</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-1">
                  {alertasFrequencia.map((a: any) => (
                    <div key={a.id} className="flex items-center justify-between py-1 border-b last:border-0">
                      <Link to={`/participantes/${a.id}`} className="text-sm text-primary hover:underline">{a.nome_completo}</Link>
                      <span className="text-xs text-muted-foreground">{a.faltas}/{a.total} faltas ({a.pct}% presença)</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {pendentes.length === 0 && alertasFrequencia.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <Activity className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Nenhum alerta no momento</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default EquipeTecnicaPage;
