import { useState, useEffect } from "react";
import { ArrowLeft, UserPlus, Trash2, Pencil, Save, AlertTriangle, FileText, TrendingUp, Users, BarChart3, ClipboardList, Calendar as CalendarIcon, FileSpreadsheet, Download, ExternalLink, Loader2 } from "lucide-react";
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

type EducadorLite = { id: string; user_id: string; nome: string; cargo: string | null; ativo: boolean | null; foto_url: string | null };
import { isBairroSCFV, OFICINAS_TURMA, PERIODO_LABELS, FAIXA_LABELS, calcAge } from "@/lib/constants";
import { calcFaixaFromDate } from "@/lib/constants";
import { useIsDemo, guardDemo } from "@/hooks/useIsDemo";
import { format } from "date-fns";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx-js-style";
import { saveAs } from "file-saver";
import { sysCfvFileName } from "@/lib/fileNaming";
import { exportSingleListaPresenca } from "@/lib/exportListaPresenca";

const periodoLabel = PERIODO_LABELS;
const faixaLabel = FAIXA_LABELS;
const diasLabel: Record<string, string> = { seg: "Seg", ter: "Ter", qua: "Qua", qui: "Qui", sex: "Sex", sab: "Sáb" };
const diasOptions = [
  { value: "seg", label: "Segunda" }, { value: "ter", label: "Terça" }, { value: "qua", label: "Quarta" },
  { value: "qui", label: "Quinta" }, { value: "sex", label: "Sexta" }, { value: "sab", label: "Sábado" },
];

interface MemberRow { tp_id: string; participante_id: string; nome: string; periodo: string | null; status?: string | null; data_desligamento?: string | null; data_saida?: string | null; motivo_saida?: string | null; }
interface AlertInfo { consecutiveFaults: number; adesao: number; lastPresent: string | null; }
interface TurmaDashboard { taxaAdesao: number; totalPresencas: number; totalRegistros: number; medianElo: number; stdElo: number; eloCount: number; }
interface LinkedPlan { id: string; titulo: string; data_aplicacao: string | null; }
interface LinkedReport { id: string; nome_atividade: string | null; data: string; score_elo: number | null; }

// calcAge imported from constants

const TurmaDetalhePage = () => {
  const { id } = useParams();
  const [turma, setTurma] = useState<any>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [allParticipantes, setAllParticipantes] = useState<{ id: string; nome_completo: string; periodo: string | null }[]>([]);
  const [bairros, setBairros] = useState<Tables<"bairros">[]>([]);
  const [educadores, setEducadores] = useState<EducadorLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [addSearch, setAddSearch] = useState("");
  const [form, setForm] = useState<Record<string, any>>({});
  const [alerts, setAlerts] = useState<Record<string, AlertInfo>>({});
  const [memberStats, setMemberStats] = useState<Record<string, { pctFreq: number; lastDate: string | null }>>({});
  const [participantesData, setParticipantesData] = useState<Record<string, any>>({});
  const [listaOpen, setListaOpen] = useState(false);
  const [listaMes, setListaMes] = useState(String(new Date().getMonth() + 1).padStart(2, "0"));
  const [listaAno, setListaAno] = useState(String(new Date().getFullYear()));
  const [gsheetLoading, setGsheetLoading] = useState(false);
  const [dashboard, setDashboard] = useState<TurmaDashboard>({ taxaAdesao: 0, totalPresencas: 0, totalRegistros: 0, medianElo: 0, stdElo: 0, eloCount: 0 });
  const [linkedPlans, setLinkedPlans] = useState<LinkedPlan[]>([]);
  const [linkedReports, setLinkedReports] = useState<LinkedReport[]>([]);

  useEffect(() => { fetchAll(); }, [id]);

  const fetchAll = async () => {
    setLoading(true);
    const [{ data: t }, { data: tp }, { data: ap }, { data: b }, { data: e }, { data: ptData }, { data: rtData }] = await Promise.all([
      supabase.from("turmas").select("*, profiles(nome), bairros(nome)").eq("id", id!).single(),
      supabase.from("turma_participantes").select("id, participante_id, data_saida, motivo_saida, participantes(nome_completo, periodo, status, data_desligamento)").eq("turma_id", id!),
      supabase.from("participantes").select("id, nome_completo, periodo, status").in("status", ["ativo", "busca_ativa"] as any).order("nome_completo"),
      supabase.from("bairros").select("*").order("nome"),
      supabase.from("profiles").select("id, user_id, nome, cargo, ativo, foto_url").order("nome"),
      supabase.from("planejamento_turmas").select("planejamento_id, planejamentos(id, titulo, data_aplicacao)").eq("turma_id", id!),
      supabase.from("relatorio_turmas").select("relatorio_id, relatorios_atividade(id, nome_atividade, data, score_elo)").eq("turma_id", id!),
    ]);
    setTurma(t);
    const membersList = (tp || []).map((r: any) => ({ tp_id: r.id, participante_id: r.participante_id, nome: r.participantes?.nome_completo || "", periodo: r.participantes?.periodo, status: r.participantes?.status, data_desligamento: r.participantes?.data_desligamento, data_saida: r.data_saida, motivo_saida: r.motivo_saida }));
    setMembers(membersList);
    setAllParticipantes(ap || []);
    setBairros(b || []);
    setEducadores(e || []);
    if (t) setForm({ nome: t.nome, periodo: t.periodo, faixa_etaria: t.faixa_etaria || "", faixas_etarias: t.faixas_etarias || [], tipo: t.tipo, bairro_id: t.bairro_id || "", bairro_ids: t.bairro_ids || [], educador_id: t.educador_id || "", dias_semana: t.dias_semana || [], ativa: t.ativa, oficina: t.oficina || "", nome_grupo: t.nome_grupo || "" });

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
      const statsMap: Record<string, { pctFreq: number; lastDate: string | null }> = {};
      pIds.forEach((pid: string) => {
        const records = (presData || []).filter((r: any) => r.participante_id === pid);
        if (records.length === 0) return;

        let consecutiveFaults = 0;
        for (const r of records) {
          if (!r.presente) consecutiveFaults++;
          else break;
        }

        const total = records.length;
        const present = records.filter((r: any) => r.presente).length;
        const adesao = total > 0 ? (present / total) * 100 : 100;
        const lastPresentRecord = records.find((r: any) => r.presente);
        const lastPresent = lastPresentRecord?.data || null;

        statsMap[pid] = { pctFreq: Number(adesao.toFixed(1)), lastDate: lastPresent };

        if (consecutiveFaults >= 3 || adesao < 65) {
          alertMap[pid] = { consecutiveFaults, adesao: Number(adesao.toFixed(1)), lastPresent };
        }
      });
      setAlerts(alertMap);
      setMemberStats(statsMap);
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
    // Ensure arrays are saved
    payload.faixas_etarias = form.faixas_etarias || [];
    payload.bairro_ids = form.bairro_ids || [];
    // Sync single-value fields for compatibility
    if ((form.faixas_etarias || []).length > 0) payload.faixa_etaria = form.faixas_etarias[0];
    if ((form.bairro_ids || []).length > 0) payload.bairro_id = form.bairro_ids[0];
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

  // Membros cuja faixa etária atual NÃO bate com a faixa da turma
  const turmaFaixas: string[] = (turma?.faixas_etarias && turma.faixas_etarias.length > 0)
    ? turma.faixas_etarias
    : (turma?.faixa_etaria ? [turma.faixa_etaria] : []);
  const foraFaixaMap: Record<string, { idade: number; faixaAtual: string }> = {};
  if (turmaFaixas.length > 0) {
    members.forEach(m => {
      const p = participantesData[m.participante_id];
      if (!p?.data_nascimento) return;
      const faixa = calcFaixaFromDate(p.data_nascimento);
      if (!faixa) return;
      if (!turmaFaixas.includes(faixa)) {
        foraFaixaMap[m.participante_id] = { idade: calcAge(p.data_nascimento), faixaAtual: faixa };
      }
    });
  }
  const foraFaixaCount = Object.keys(foraFaixaMap).length;

  const exportBuscaAtiva = () => {
    const doc = new jsPDF({ orientation: "landscape" });
    const now = format(new Date(), "dd/MM/yyyy 'às' HH:mm");
    const fileName = `SysCFV_BuscaAtiva_${format(new Date(), "yyyy-MM-dd_HHmmss")}.pdf`;

    // Header
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("RELATÓRIO DE BUSCA ATIVA — SCFV", 148, 15, { align: "center" });

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Turma: ${turma?.nome || "—"}`, 14, 25);
    doc.text(`Bairro: ${turma?.bairros?.nome || "—"}  |  Período: ${periodoLabel[turma?.periodo] || "—"}  |  Educador: ${turma?.profiles?.nome || "—"}`, 14, 31);
    doc.text(`Data de emissão: ${now}`, 14, 37);
    doc.setFont("helvetica", "bold");
    doc.text(`Participantes em alerta: ${alertMembers.length}`, 14, 44);

    const rows = alertMembers.map((m, i) => {
      const pData = participantesData[m.participante_id] || {};
      const alert = alerts[m.participante_id];
      const age = pData.data_nascimento ? `${calcAge(pData.data_nascimento)}` : "—";
      const addr = [pData.endereco_rua, pData.endereco_numero, pData.endereco_bairro].filter(Boolean).join(", ") || "—";
      const lastPres = alert.lastPresent ? format(new Date(alert.lastPresent + "T12:00:00"), "dd/MM/yyyy") : "—";
      const motivo: string[] = [];
      if (alert.consecutiveFaults >= 3) motivo.push(`${alert.consecutiveFaults} faltas seguidas`);
      if (alert.adesao < 65) motivo.push(`Adesão: ${alert.adesao}%`);
      return [
        String(i + 1), m.nome, age,
        pData.responsavel1_nome || "—", pData.responsavel1_whatsapp || "—",
        pData.responsavel2_nome || "—", pData.responsavel2_whatsapp || "—",
        addr, lastPres, motivo.join("; "),
      ];
    });

    autoTable(doc, {
      startY: 48,
      head: [["Nº", "Nome", "Idade", "Responsável 1", "Tel. 1", "Responsável 2", "Tel. 2", "Endereço", "Últ. Presença", "Motivo"]],
      body: rows,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [80, 80, 80], fontStyle: "bold", fontSize: 8 },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      margin: { left: 14, right: 14 },
    });

    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(7);
      doc.setFont("helvetica", "italic");
      doc.text(`Documento gerado pelo SysCFV — ${now}`, 14, doc.internal.pageSize.height - 8);
      doc.text(`Página ${i}/${pageCount}`, doc.internal.pageSize.width - 14, doc.internal.pageSize.height - 8, { align: "right" });
    }

    doc.save(fileName);
    toast.success("Relatório de Busca Ativa exportado!");
  };

  const exportListaPresencaXlsx = () => {
    if (!turma) return;
    const mesNum = parseInt(listaMes);
    const anoNum = parseInt(listaAno);
    const mems = members.map(m => ({
      nome: m.nome,
      desligado: m.status === "desligado",
      data_desligamento: m.data_desligamento || null,
      transferido: !!m.data_saida && m.status !== "desligado",
      data_transferencia: m.data_saida || null,
      busca_ativa: m.status === "busca_ativa",
    }));
    const turmaInfo = {
      ...turma,
      profiles: turma.profiles || undefined,
      bairros: turma.bairros || undefined,
    };
    const ok = exportSingleListaPresenca(turmaInfo, mems, mesNum, anoNum);
    if (!ok) { toast.error("Nenhuma data de atividade para este mês"); return; }
    toast.success("Lista de chamada exportada!");
    setListaOpen(false);
  };

  const abrirListaNoGoogleSheets = async () => {
    if (!turma) return;
    setGsheetLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-lista-chamada-gsheet", {
        body: { turma_id: turma.id, mes: parseInt(listaMes), ano: parseInt(listaAno) },
      });
      if (error) throw error;
      const url = (data as any)?.url;
      if (!url) throw new Error("URL não retornada");
      window.open(url, "_blank", "noopener,noreferrer");
      toast.success("Lista de chamada gerada no Google Sheets!");
      setListaOpen(false);
    } catch (e: any) {
      toast.error(e?.message || "Falha ao gerar no Google Sheets");
    } finally {
      setGsheetLoading(false);
    }
  };

  const abrirFrequenciaPreenchida = async () => {
    if (!turma) return;
    setGsheetLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-lista-frequencia-gsheet", {
        body: { turma_id: turma.id, mes: parseInt(listaMes), ano: parseInt(listaAno) },
      });
      if (error) throw error;
      const url = (data as any)?.url;
      if (!url) throw new Error("URL não retornada");
      window.open(url, "_blank", "noopener,noreferrer");
      toast.success("Lista de Frequência preenchida gerada no Drive!");
      setListaOpen(false);
    } catch (e: any) {
      toast.error(e?.message || "Falha ao gerar Lista de Frequência");
    } finally {
      setGsheetLoading(false);
    }
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
              {(turma.faixas_etarias && turma.faixas_etarias.length > 0
                ? turma.faixas_etarias
                : turma.faixa_etaria ? [turma.faixa_etaria] : []
              ).map((f: string) => (
                <Badge key={f} variant="outline" className="text-[10px]">{faixaLabel[f] || f}</Badge>
              ))}
              {alertMembers.length > 0 && (
                <Badge variant="destructive" className="text-[10px] gap-1"><AlertTriangle className="h-3 w-3" />{alertMembers.length} alerta(s)</Badge>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" className="gap-1 text-xs" asChild>
            <Link to={`/relatorios/novo?turma=${id}`}>
              <FileText className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Novo Relatório</span>
            </Link>
          </Button>
          {alertMembers.length > 0 && (
            <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={exportBuscaAtiva}>
              <FileText className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Busca Ativa</span>
            </Button>
          )}
          <Dialog open={listaOpen} onOpenChange={setListaOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1 text-xs">
                <FileSpreadsheet className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Lista de Chamada</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-sm">
              <DialogHeader><DialogTitle>Gerar Lista de Chamada</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div><Label className="text-xs">Mês</Label>
                    <Select value={listaMes} onValueChange={setListaMes}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["01","02","03","04","05","06","07","08","09","10","11","12"].map((m,i) => <SelectItem key={m} value={m}>{["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"][i]}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label className="text-xs">Ano</Label>
                    <Input value={listaAno} onChange={e => setListaAno(e.target.value)} />
                  </div>
                </div>
                <Button onClick={abrirListaNoGoogleSheets} disabled={gsheetLoading} className="w-full gap-1">
                  {gsheetLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
                  Chamada em branco (Drive)
                </Button>
                <Button onClick={abrirFrequenciaPreenchida} disabled={gsheetLoading} variant="default" className="w-full gap-1">
                  {gsheetLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
                  Frequência preenchida (Drive)
                </Button>
                <p className="text-[10px] text-muted-foreground text-center">
                  Documentos institucionais salvos em SYSCFV/{`{MÊS} - {ANO}`}/04_Listas_Chamada_Em_Branco (em branco) ou 05_Listas_Frequencia_Preenchidas (preenchidas).
                </p>
                <button type="button" onClick={exportListaPresencaXlsx} className="text-[10px] text-muted-foreground underline w-full text-center hover:text-foreground">
                  Baixar XLSX local (fallback)
                </button>
              </div>
            </DialogContent>
          </Dialog>
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
            <div className="col-span-1 sm:col-span-2"><Label className="text-xs">Nome do Grupo (opcional)</Label><Input value={form.nome_grupo || ""} onChange={(e) => setForm({ ...form, nome_grupo: e.target.value })} className="h-9 text-sm mt-1" placeholder="Ex: Turma Esperança" /></div>
            <div><Label className="text-xs">Período</Label>
              <Select value={form.periodo || ""} onValueChange={(v) => setForm({ ...form, periodo: v })}>
                <SelectTrigger className="h-9 text-sm mt-1"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="manha">Manhã</SelectItem><SelectItem value="tarde">Tarde</SelectItem></SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs mb-2 block">Faixa Etária</Label>
              <div className="flex flex-wrap gap-3">
                {[{ value: "6-8", label: "6-8 anos" }, { value: "9-11", label: "9-11 anos" }, { value: "12-17", label: "12-17 anos" }, { value: "idosos", label: "Idosos" }].map(f => (
                  <label key={f.value} className="flex items-center gap-1.5 cursor-pointer">
                    <Checkbox checked={(form.faixas_etarias || []).includes(f.value)} onCheckedChange={() => {
                      const arr = form.faixas_etarias || [];
                      const next = arr.includes(f.value) ? arr.filter((v: string) => v !== f.value) : [...arr, f.value];
                      setForm({ ...form, faixas_etarias: next, faixa_etaria: next[0] || "" });
                    }} />
                    <span className="text-sm">{f.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div><Label className="text-xs">Tipo</Label>
              <Select value={form.tipo || "ordinaria"} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                <SelectTrigger className="h-9 text-sm mt-1"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="ordinaria">Ordinária</SelectItem><SelectItem value="extraordinaria">Extraordinária</SelectItem></SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs mb-2 block">Bairro</Label>
              <div className="flex flex-wrap gap-3">
                {bairros.filter(b => isBairroSCFV(b.nome)).map(b => (
                  <label key={b.id} className="flex items-center gap-1.5 cursor-pointer">
                    <Checkbox checked={(form.bairro_ids || []).includes(b.id)} onCheckedChange={() => {
                      const arr = form.bairro_ids || [];
                      const next = arr.includes(b.id) ? arr.filter((v: string) => v !== b.id) : [...arr, b.id];
                      setForm({ ...form, bairro_ids: next, bairro_id: next[0] || "" });
                    }} />
                    <span className="text-sm">{b.nome}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="col-span-1 sm:col-span-2"><Label className="text-xs">Educador</Label>
              <Select value={form.educador_id || ""} onValueChange={(v) => setForm({ ...form, educador_id: v })}>
                <SelectTrigger className="h-9 text-sm mt-1"><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>{educadores.map((e) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="col-span-1 sm:col-span-2">
              <Label className="text-xs">Oficina</Label>
              <Select value={form.oficina || ""} onValueChange={(v) => setForm({ ...form, oficina: v === "__none__" ? "" : v })}>
                <SelectTrigger className="h-9 text-sm mt-1"><SelectValue placeholder="Nenhuma" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Nenhuma</SelectItem>
                  {OFICINAS_TURMA.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
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
          <CardTitle className="text-sm">Participantes Ativos ({members.filter(m => m.status !== "desligado" && !m.data_saida).length})</CardTitle>
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
          {members.filter(m => m.status !== "desligado" && !m.data_saida).length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum participante ativo nesta turma.</p>
          ) : (
            <div className="overflow-x-auto -mx-2 px-2">
              <TooltipProvider>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="text-xs">Nome</TableHead>
                      <TableHead className="text-xs hidden sm:table-cell">Período</TableHead>
                      <TableHead className="text-xs hidden sm:table-cell">Frequência</TableHead>
                      <TableHead className="text-xs hidden sm:table-cell">Última Presença</TableHead>
                      <TableHead className="text-xs w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {members.filter(m => m.status !== "desligado" && !m.data_saida).map((m) => {
                      const alert = alerts[m.participante_id];
                      const stats = memberStats[m.participante_id];
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
                          <TableCell className={`text-xs sm:text-sm hidden sm:table-cell font-medium ${stats ? (stats.pctFreq < 65 ? "text-destructive" : stats.pctFreq < 80 ? "text-amber-600" : "text-emerald-600") : "text-muted-foreground"}`}>
                            {stats ? `${stats.pctFreq}%` : "—"}
                          </TableCell>
                          <TableCell className="text-xs sm:text-sm text-muted-foreground hidden sm:table-cell">
                            {stats?.lastDate ? format(new Date(stats.lastDate + "T12:00:00"), "dd/MM/yyyy") : "—"}
                          </TableCell>
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

      {/* Histórico: Transferidos */}
      {(() => {
        const transferidos = members.filter(m => m.data_saida && m.status !== "desligado");
        if (transferidos.length > 0) {
          return (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Users className="h-4 w-4 text-amber-500" />
                  Transferidos ({transferidos.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto -mx-2 px-2">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="text-xs">Nome</TableHead>
                        <TableHead className="text-xs">Data Saída</TableHead>
                        <TableHead className="text-xs">Motivo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transferidos.map(m => (
                        <TableRow key={m.tp_id} className="hover:bg-muted/30 cursor-pointer" onClick={() => window.location.href = `/participantes/${m.participante_id}`}>
                          <TableCell className="text-xs sm:text-sm text-amber-700">{m.nome} (T)</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{m.data_saida ? format(new Date(m.data_saida + "T12:00:00"), "dd/MM/yyyy") : "—"}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{m.motivo_saida || "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          );
        }
        return null;
      })()}

      {/* Histórico: Desligados */}
      {(() => {
        const historicos = members.filter(m => m.status === "desligado");
        return (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                Desligados / Transferidos ({historicos.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto -mx-2 px-2">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="text-xs">Nome</TableHead>
                      <TableHead className="text-xs">Data Deslig.</TableHead>
                      <TableHead className="text-xs">Adesão até Deslig.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historicos.map(m => {
                      const stats = memberStats[m.participante_id];
                      return (
                        <TableRow key={m.tp_id} className="hover:bg-muted/30 cursor-pointer" onClick={() => window.location.href = `/participantes/${m.participante_id}`}>
                          <TableCell className="text-xs sm:text-sm text-muted-foreground line-through">
                            {m.nome}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {m.data_desligamento ? format(new Date(m.data_desligamento + "T12:00:00"), "dd/MM/yyyy") : "—"}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {stats ? `${stats.pctFreq}%` : "—"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        );
      })()}

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
