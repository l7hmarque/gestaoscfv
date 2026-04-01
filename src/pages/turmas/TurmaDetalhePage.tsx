import { useState, useEffect } from "react";
import { ArrowLeft, UserPlus, Trash2, Pencil, Save, AlertTriangle, FileText, TrendingUp, Users, BarChart3, ClipboardList, Calendar as CalendarIcon } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import { isBairroSCFV } from "@/lib/constants";
import { useIsDemo, guardDemo } from "@/hooks/useIsDemo";
import { format } from "date-fns";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const periodoLabel: Record<string, string> = { manha: "Manhã", tarde: "Tarde", integral: "Integral" };
const faixaLabel: Record<string, string> = { "6-8": "6-8 anos", "9-11": "9-11 anos", "12-17": "12-17 anos", idosos: "Idosos" };
const diasLabel: Record<string, string> = { seg: "Seg", ter: "Ter", qua: "Qua", qui: "Qui", sex: "Sex", sab: "Sáb" };
const diasOptions = [
  { value: "seg", label: "Segunda" }, { value: "ter", label: "Terça" }, { value: "qua", label: "Quarta" },
  { value: "qui", label: "Quinta" }, { value: "sex", label: "Sexta" }, { value: "sab", label: "Sábado" },
];

interface MemberRow { tp_id: string; participante_id: string; nome: string; periodo: string | null; }
interface AlertInfo { consecutiveFaults: number; adesao: number; lastPresent: string | null; }
interface TurmaDashboard { taxaAdesao: number; totalPresencas: number; totalRegistros: number; medianElo: number; stdElo: number; eloCount: number; }
interface LinkedPlan { id: string; titulo: string; data_aplicacao: string | null; }
interface LinkedReport { id: string; nome_atividade: string | null; data: string; score_elo: number | null; }

function calcAge(dob: string): number {
  const b = new Date(dob);
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  if (now.getMonth() < b.getMonth() || (now.getMonth() === b.getMonth() && now.getDate() < b.getDate())) age--;
  return age;
}

const TurmaDetalhePage = () => {
  const { id } = useParams();
  const [turma, setTurma] = useState<any>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [allParticipantes, setAllParticipantes] = useState<{ id: string; nome_completo: string; periodo: string | null }[]>([]);
  const [bairros, setBairros] = useState<Tables<"bairros">[]>([]);
  const [educadores, setEducadores] = useState<Tables<"profiles">[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [addSearch, setAddSearch] = useState("");
  const [form, setForm] = useState<Record<string, any>>({});
  const [alerts, setAlerts] = useState<Record<string, AlertInfo>>({});
  const [participantesData, setParticipantesData] = useState<Record<string, any>>({});
  const [dashboard, setDashboard] = useState<TurmaDashboard>({ taxaAdesao: 0, totalPresencas: 0, totalRegistros: 0, medianElo: 0, stdElo: 0, eloCount: 0 });
  const [linkedPlans, setLinkedPlans] = useState<LinkedPlan[]>([]);
  const [linkedReports, setLinkedReports] = useState<LinkedReport[]>([]);

  useEffect(() => { fetchAll(); }, [id]);

  const fetchAll = async () => {
    setLoading(true);
    const [{ data: t }, { data: tp }, { data: ap }, { data: b }, { data: e }, { data: ptData }, { data: rtData }] = await Promise.all([
      supabase.from("turmas").select("*, profiles(nome), bairros(nome)").eq("id", id!).single(),
      supabase.from("turma_participantes").select("id, participante_id, participantes(nome_completo, periodo)").eq("turma_id", id!),
      supabase.from("participantes").select("id, nome_completo, periodo").eq("status", "ativo").order("nome_completo"),
      supabase.from("bairros").select("*").order("nome"),
      supabase.from("profiles").select("*").order("nome"),
      supabase.from("planejamento_turmas").select("planejamento_id, planejamentos(id, titulo, data_aplicacao)").eq("turma_id", id!),
      supabase.from("relatorio_turmas").select("relatorio_id, relatorios_atividade(id, nome_atividade, data, score_elo)").eq("turma_id", id!),
    ]);
    setTurma(t);
    const membersList = (tp || []).map((r: any) => ({ tp_id: r.id, participante_id: r.participante_id, nome: r.participantes?.nome_completo || "", periodo: r.participantes?.periodo }));
    setMembers(membersList);
    setAllParticipantes(ap || []);
    setBairros(b || []);
    setEducadores(e || []);
    if (t) setForm({ nome: t.nome, periodo: t.periodo, faixa_etaria: t.faixa_etaria || "", tipo: t.tipo, bairro_id: t.bairro_id || "", educador_id: t.educador_id || "", dias_semana: t.dias_semana || [], ativa: t.ativa });

    // Load attendance for alerts
    if (membersList.length > 0) {
      const pIds = membersList.map((m: MemberRow) => m.participante_id);
      const [{ data: presData }, { data: partData }] = await Promise.all([
        supabase.from("presenca").select("participante_id, data, presente").eq("turma_id", id!).in("participante_id", pIds).order("data", { ascending: false }),
        supabase.from("participantes").select("id, data_nascimento, responsavel1_nome, responsavel1_whatsapp, responsavel2_nome, responsavel2_whatsapp, endereco_rua, endereco_numero, endereco_bairro").in("id", pIds),
      ]);

      const partMap: Record<string, any> = {};
      (partData || []).forEach((p: any) => { partMap[p.id] = p; });
      setParticipantesData(partMap);

      const alertMap: Record<string, AlertInfo> = {};
      pIds.forEach((pid: string) => {
        const records = (presData || []).filter((r: any) => r.participante_id === pid);
        if (records.length === 0) return;

        // Count consecutive faults from most recent
        let consecutiveFaults = 0;
        for (const r of records) {
          if (!r.presente) consecutiveFaults++;
          else break;
        }

        // Calculate adhesion
        const total = records.length;
        const present = records.filter((r: any) => r.presente).length;
        const adesao = total > 0 ? (present / total) * 100 : 100;

        // Last present date
        const lastPresentRecord = records.find((r: any) => r.presente);
        const lastPresent = lastPresentRecord?.data || null;

        if (consecutiveFaults >= 3 || adesao < 65) {
          alertMap[pid] = { consecutiveFaults, adesao: Number(adesao.toFixed(1)), lastPresent };
        }
      });
      setAlerts(alertMap);
    }

    // Linked plans & reports
    const plans: LinkedPlan[] = (ptData || []).map((r: any) => r.planejamentos).filter(Boolean).sort((a: any, b: any) => (b.data_aplicacao || "").localeCompare(a.data_aplicacao || ""));
    setLinkedPlans(plans);
    const reports: LinkedReport[] = (rtData || []).map((r: any) => r.relatorios_atividade).filter(Boolean).sort((a: any, b: any) => b.data.localeCompare(a.data));
    setLinkedReports(reports);

    // Dashboard stats
    const { data: allPres } = await supabase.from("presenca").select("presente").eq("turma_id", id!);
    const totalReg = (allPres || []).length;
    const totalPres = (allPres || []).filter((p: any) => p.presente).length;
    const taxaAdesao = totalReg > 0 ? (totalPres / totalReg) * 100 : 0;

    const eloScores = reports.map(r => r.score_elo).filter((s): s is number => s != null);
    const sortedElo = [...eloScores].sort((a, b) => a - b);
    const medianElo = sortedElo.length > 0 ? sortedElo[Math.floor(sortedElo.length / 2)] : 0;
    const meanElo = eloScores.length > 0 ? eloScores.reduce((a, b) => a + b, 0) / eloScores.length : 0;
    const stdElo = eloScores.length > 1 ? Math.sqrt(eloScores.reduce((s, v) => s + (v - meanElo) ** 2, 0) / (eloScores.length - 1)) : 0;
    setDashboard({ taxaAdesao: Number(taxaAdesao.toFixed(1)), totalPresencas: totalPres, totalRegistros: totalReg, medianElo: Number(medianElo.toFixed(2)), stdElo: Number(stdElo.toFixed(2)), eloCount: eloScores.length });

    setLoading(false);
  };

  const isDemo = useIsDemo();

  const addParticipante = async (pId: string) => {
    if (guardDemo(isDemo)) return;
    const { error } = await supabase.from("turma_participantes").insert({ turma_id: id!, participante_id: pId });
    if (error) { toast.error(error.message.includes("duplicate") ? "Já está na turma" : error.message); return; }
    toast.success("Adicionado!");
    fetchAll();
  };

  const removeParticipante = async (tpId: string) => {
    if (guardDemo(isDemo)) return;
    await supabase.from("turma_participantes").delete().eq("id", tpId);
    toast.success("Removido");
    fetchAll();
  };

  const handleSave = async () => {
    if (guardDemo(isDemo)) return;
    setSaving(true);
    const payload: Record<string, unknown> = { ...form };
    if (!payload.bairro_id) payload.bairro_id = null;
    if (!payload.educador_id) payload.educador_id = null;
    if (!payload.faixa_etaria) payload.faixa_etaria = null;
    const { error } = await supabase.from("turmas").update(payload as any).eq("id", id!);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Turma atualizada!");
    setEditing(false);
    fetchAll();
  };

  const toggleDia = (dia: string) => {
    setForm((f) => ({ ...f, dias_semana: f.dias_semana.includes(dia) ? f.dias_semana.filter((d: string) => d !== dia) : [...f.dias_semana, dia] }));
  };

  const alertMembers = members.filter(m => alerts[m.participante_id]);

  const exportBuscaAtiva = async () => {
    const cellBorder = { style: BorderStyle.SINGLE, size: 1, color: "999999" };
    const borders = { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder };

    const headerCells = ["Nome", "Idade", "Responsável", "Telefone", "Endereço", "Última Presença", "Motivo"].map(text =>
      new DocxTableCell({
        borders,
        width: { size: 1400, type: WidthType.DXA },
        children: [new Paragraph({ children: [new TextRun({ text, bold: true, size: 18, font: "Arial" })] })],
      })
    );

    const dataRows = alertMembers.map(m => {
      const pData = participantesData[m.participante_id] || {};
      const alert = alerts[m.participante_id];
      const age = pData.data_nascimento ? `${calcAge(pData.data_nascimento)} anos` : "—";
      const resp = pData.responsavel1_nome || "—";
      const tel = pData.responsavel1_whatsapp || pData.responsavel2_whatsapp || "—";
      const addr = [pData.endereco_rua, pData.endereco_numero, pData.endereco_bairro].filter(Boolean).join(", ") || "—";
      const lastPres = alert.lastPresent ? format(new Date(alert.lastPresent + "T12:00:00"), "dd/MM/yyyy") : "—";
      const motivo = [];
      if (alert.consecutiveFaults >= 3) motivo.push(`${alert.consecutiveFaults} faltas seguidas`);
      if (alert.adesao < 65) motivo.push(`Adesão: ${alert.adesao}%`);

      return new DocxTableRow({
        children: [m.nome, age, resp, tel, addr, lastPres, motivo.join("; ")].map(text =>
          new DocxTableCell({
            borders,
            width: { size: 1400, type: WidthType.DXA },
            children: [new Paragraph({ children: [new TextRun({ text, size: 18, font: "Arial" })] })],
          })
        ),
      });
    });

    const doc = new Document({
      sections: [{
        children: [
          new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: "RELATÓRIO DE BUSCA ATIVA", bold: true, size: 28, font: "Arial" })] }),
          new Paragraph({ spacing: { after: 100 }, children: [new TextRun({ text: `Turma: ${turma?.nome || ""} — ${format(new Date(), "dd/MM/yyyy")}`, size: 22, font: "Arial" })] }),
          new Paragraph({ spacing: { after: 100 }, children: [
            new TextRun({ text: `Bairro: ${turma?.bairros?.nome || "—"} | Período: ${periodoLabel[turma?.periodo] || "—"} | Educador: ${turma?.profiles?.nome || "—"}`, size: 20, font: "Arial" }),
          ]}),
          new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: `Participantes em alerta: ${alertMembers.length}`, size: 20, font: "Arial", bold: true })] }),
          new DocxTable({
            width: { size: 9800, type: WidthType.DXA },
            rows: [new DocxTableRow({ children: headerCells }), ...dataRows],
          }),
        ],
      }],
    });

    const buf = await Packer.toBlob(doc);
    saveAs(buf, `BuscaAtiva_${turma?.nome || "turma"}_${format(new Date(), "yyyy-MM-dd")}.docx`);
    toast.success("Relatório de Busca Ativa exportado!");
  };

  const memberIds = new Set(members.map((m) => m.participante_id));
  const availableParticipantes = allParticipantes.filter((p) => !memberIds.has(p.id) && p.nome_completo.toLowerCase().includes(addSearch.toLowerCase()));

  if (loading) return <div className="flex justify-center py-12"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;
  if (!turma) return <div className="text-center py-12 text-muted-foreground">Turma não encontrada.</div>;

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Button variant="ghost" size="icon" asChild><Link to="/turmas"><ArrowLeft className="h-4 w-4" /></Link></Button>
          <div>
            <h1 className="text-lg sm:text-xl font-semibold text-foreground">{turma.nome}</h1>
            <div className="flex gap-1.5 mt-0.5 flex-wrap">
              <Badge variant={turma.ativa ? "default" : "secondary"} className="text-[10px]">{turma.ativa ? "Ativa" : "Inativa"}</Badge>
              {turma.periodo && <Badge variant="outline" className="text-[10px]">{periodoLabel[turma.periodo]}</Badge>}
              {turma.faixa_etaria && <Badge variant="outline" className="text-[10px]">{faixaLabel[turma.faixa_etaria]}</Badge>}
              {alertMembers.length > 0 && (
                <Badge variant="destructive" className="text-[10px] gap-1"><AlertTriangle className="h-3 w-3" />{alertMembers.length} alerta(s)</Badge>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {alertMembers.length > 0 && (
            <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={exportBuscaAtiva}>
              <FileText className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Busca Ativa</span>
            </Button>
          )}
          {!editing ? (
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}><Pencil className="h-3.5 w-3.5 mr-1" />Editar</Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditing(false)}>Cancelar</Button>
              <Button size="sm" onClick={handleSave} disabled={saving}><Save className="h-3.5 w-3.5 mr-1" />{saving ? "Salvando..." : "Salvar"}</Button>
            </div>
          )}
        </div>
      </div>

      {editing && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm">Editar Turma</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="col-span-1 sm:col-span-2"><Label className="text-xs">Nome</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} className="h-9 text-sm mt-1" /></div>
            <div><Label className="text-xs">Período</Label>
              <Select value={form.periodo || ""} onValueChange={(v) => setForm({ ...form, periodo: v })}>
                <SelectTrigger className="h-9 text-sm mt-1"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="manha">Manhã</SelectItem><SelectItem value="tarde">Tarde</SelectItem><SelectItem value="integral">Integral</SelectItem></SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Faixa Etária</Label>
              <Select value={form.faixa_etaria || ""} onValueChange={(v) => setForm({ ...form, faixa_etaria: v })}>
                <SelectTrigger className="h-9 text-sm mt-1"><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent><SelectItem value="6-8">6-8</SelectItem><SelectItem value="9-11">9-11</SelectItem><SelectItem value="12-17">12-17</SelectItem><SelectItem value="idosos">Idosos</SelectItem></SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Tipo</Label>
              <Select value={form.tipo || "ordinaria"} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                <SelectTrigger className="h-9 text-sm mt-1"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="ordinaria">Ordinária</SelectItem><SelectItem value="extraordinaria">Extraordinária</SelectItem></SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Bairro</Label>
              <Select value={form.bairro_id || ""} onValueChange={(v) => setForm({ ...form, bairro_id: v })}>
                <SelectTrigger className="h-9 text-sm mt-1"><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>{bairros.filter(b => isBairroSCFV(b.nome)).map((b) => <SelectItem key={b.id} value={b.id}>{b.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="col-span-1 sm:col-span-2"><Label className="text-xs">Educador</Label>
              <Select value={form.educador_id || ""} onValueChange={(v) => setForm({ ...form, educador_id: v })}>
                <SelectTrigger className="h-9 text-sm mt-1"><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>{educadores.map((e) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="col-span-1 sm:col-span-2">
              <Label className="text-xs mb-2 block">Dias da Semana</Label>
              <div className="flex flex-wrap gap-3">
                {diasOptions.map((d) => (
                  <label key={d.value} className="flex items-center gap-1.5 cursor-pointer">
                    <Checkbox checked={form.dias_semana?.includes(d.value)} onCheckedChange={() => toggleDia(d.value)} />
                    <span className="text-sm">{d.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="col-span-1 sm:col-span-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox checked={form.ativa} onCheckedChange={(v) => setForm({ ...form, ativa: !!v })} />
                <span className="text-sm">Turma ativa</span>
              </label>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Info resumida */}
      {!editing && (
        <div className="flex flex-wrap gap-3 sm:gap-4 text-xs sm:text-sm text-muted-foreground">
          {turma.dias_semana?.length > 0 && <span>📅 {turma.dias_semana.map((d: string) => diasLabel[d] || d).join(", ")}</span>}
          {turma.profiles?.nome && <span>👤 {turma.profiles.nome}</span>}
          {turma.bairros?.nome && <span>📍 {turma.bairros.nome}</span>}
          {turma.tipo === "extraordinaria" && <span>⭐ Extraordinária</span>}
        </div>
      )}

      {/* Participantes da turma */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Participantes ({members.length})</CardTitle>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline"><UserPlus className="h-3.5 w-3.5 mr-1" /><span className="hidden sm:inline">Adicionar</span></Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle className="text-base">Adicionar Participante</DialogTitle></DialogHeader>
              <Input placeholder="Buscar por nome..." value={addSearch} onChange={(e) => setAddSearch(e.target.value)} className="h-9 text-sm" />
              <div className="max-h-[300px] overflow-y-auto space-y-1">
                {availableParticipantes.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Nenhum participante disponível</p>
                ) : availableParticipantes.slice(0, 50).map((p) => (
                  <button key={p.id} onClick={() => addParticipante(p.id)} className="w-full flex items-center justify-between p-2 rounded hover:bg-muted text-left">
                    <span className="text-sm">{p.nome_completo}</span>
                    <Badge variant="outline" className="text-[10px]">{periodoLabel[p.periodo || ""] || "—"}</Badge>
                  </button>
                ))}
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {members.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum participante nesta turma.</p>
          ) : (
            <div className="overflow-x-auto -mx-2 px-2">
              <TooltipProvider>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="text-xs">Nome</TableHead>
                      <TableHead className="text-xs hidden sm:table-cell">Período</TableHead>
                      <TableHead className="text-xs w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {members.map((m) => {
                      const alert = alerts[m.participante_id];
                      return (
                        <TableRow key={m.tp_id} className={alert ? "bg-destructive/5" : ""}>
                          <TableCell className="text-xs sm:text-sm">
                            <div className="flex items-center gap-1.5">
                              <Link to={`/participantes/${m.participante_id}`} className="hover:underline text-foreground">{m.nome}</Link>
                              {alert && (
                                <Tooltip>
                                  <TooltipTrigger>
                                    <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />
                                  </TooltipTrigger>
                                  <TooltipContent className="text-xs max-w-[200px]">
                                    {alert.consecutiveFaults >= 3 && <p>{alert.consecutiveFaults} faltas seguidas</p>}
                                    {alert.adesao < 65 && <p>Adesão: {alert.adesao}%</p>}
                                    {alert.lastPresent && <p>Última presença: {format(new Date(alert.lastPresent + "T12:00:00"), "dd/MM/yyyy")}</p>}
                                  </TooltipContent>
                                </Tooltip>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs sm:text-sm text-muted-foreground hidden sm:table-cell">{periodoLabel[m.periodo || ""] || "—"}</TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => removeParticipante(m.tp_id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TooltipProvider>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dashboard */}
      {!editing && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-3 text-center">
              <BarChart3 className="h-4 w-4 mx-auto text-primary mb-1" />
              <p className="text-lg font-bold text-foreground">{dashboard.taxaAdesao}%</p>
              <p className="text-[10px] text-muted-foreground">Taxa de Adesão</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <Users className="h-4 w-4 mx-auto text-primary mb-1" />
              <p className="text-lg font-bold text-foreground">{dashboard.totalPresencas}/{dashboard.totalRegistros}</p>
              <p className="text-[10px] text-muted-foreground">Presenças/Registros</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <TrendingUp className="h-4 w-4 mx-auto text-primary mb-1" />
              <p className="text-lg font-bold text-foreground">{dashboard.medianElo || "—"}</p>
              <p className="text-[10px] text-muted-foreground">ELO Mediana (σ {dashboard.stdElo})</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <AlertTriangle className={`h-4 w-4 mx-auto mb-1 ${alertMembers.length > 0 ? "text-destructive" : "text-muted-foreground"}`} />
              <p className={`text-lg font-bold ${alertMembers.length > 0 ? "text-destructive" : "text-foreground"}`}>{alertMembers.length}</p>
              <p className="text-[10px] text-muted-foreground">Alertas Busca Ativa</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Planejamentos vinculados */}
      {linkedPlans.length > 0 && !editing && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><ClipboardList className="h-4 w-4" />Planejamentos ({linkedPlans.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {linkedPlans.map(p => (
              <Link key={p.id} to={`/planejamentos/${p.id}`} className="flex items-center justify-between p-2 rounded hover:bg-muted text-sm">
                <span className="truncate">{p.titulo}</span>
                {p.data_aplicacao && <span className="text-xs text-muted-foreground shrink-0 ml-2">{format(new Date(p.data_aplicacao + "T12:00:00"), "dd/MM/yyyy")}</span>}
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Relatórios vinculados */}
      {linkedReports.length > 0 && !editing && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><FileText className="h-4 w-4" />Relatórios ({linkedReports.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {linkedReports.map(r => (
              <Link key={r.id} to={`/relatorios/${r.id}`} className="flex items-center justify-between p-2 rounded hover:bg-muted text-sm">
                <span className="truncate">{r.nome_atividade || "Sem nome"}</span>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  {r.score_elo != null && <Badge variant="outline" className="text-[10px]">ELO {r.score_elo.toFixed(2)}</Badge>}
                  <span className="text-xs text-muted-foreground">{format(new Date(r.data + "T12:00:00"), "dd/MM/yyyy")}</span>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default TurmaDetalhePage;
