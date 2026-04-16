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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAuditLog } from "@/hooks/useAuditLog";
import { useIsDemo, guardDemo } from "@/hooks/useIsDemo";
import { toast } from "sonner";
import { format, subDays, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { Plus, AlertTriangle, Users, FileText, ClipboardList, Activity, Download, FileSpreadsheet, Trash2, Phone, MapPin, Search, Eye, UserCheck, UserX, Mail, ChevronDown, ChevronUp, Check, X as XIcon, FileImage, Network, ShieldAlert, Target, Link2 } from "lucide-react";
import { calcFaixaFromDate, displayAge, PERIODO_LABELS } from "@/lib/constants";
import { RecadosEquipeCards } from "@/components/RecadosEquipeCards";
import * as XLSX from "xlsx-js-style";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { sysCfvFileName } from "@/lib/fileNaming";
import { autoFitColumns } from "@/lib/xlsxAutoFit";

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

const TIPOS_CONTATO_BA = [
  { value: "whatsapp", label: "Contato WhatsApp" },
  { value: "telefone", label: "Contato Telefônico" },
  { value: "visita_domiciliar", label: "Visita Domiciliar" },
  { value: "contato_rede", label: "Contato com a Rede" },
];

const STATUS_BA = [
  { value: "em_andamento", label: "Busca Ativa em Andamento" },
  { value: "vai_retornar", label: "Vai Retornar / Já Retornou" },
  { value: "encaminhar_desligamento", label: "Encaminhar p/ Desligamento" },
];

const PIE_COLORS = ["hsl(var(--primary))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))", "#6366f1", "#f59e0b", "#ef4444"];

const EquipeTecnicaPage = () => {
  const { user } = useAuth();
  const isDemo = useIsDemo();
  const [atendimentos, setAtendimentos] = useState<any[]>([]);
  const [pendenteDocs, setPendenteDocs] = useState<Record<string, any[]>>({});
  const [expandedPendente, setExpandedPendente] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [participantes, setParticipantes] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [presenca, setPresenca] = useState<any[]>([]);
  const [turmas, setTurmas] = useState<any[]>([]);
  const [turmaParticipantesMap, setTurmaParticipantesMap] = useState<Record<string, string[]>>({});
  const [bairros, setBairros] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [filterTipo, setFilterTipo] = useState("");
  const [filterProf, setFilterProf] = useState("");
  const [relDataInicio, setRelDataInicio] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [relDataFim, setRelDataFim] = useState(format(endOfMonth(new Date()), "yyyy-MM-dd"));
  const [form, setForm] = useState<{ participante_id: string; data_atendimento: string; tipo: string; descricao: string; encaminhamento: string; recado_origem_id?: string | null; relato_origem_id?: string | null; busca_ativa_origem_id?: string | null; criar_enc_externo?: boolean; enc_tipo?: string; enc_orgao?: string; enc_contato?: string; enc_status?: string; enc_data_retorno?: string }>({ participante_id: "", data_atendimento: format(new Date(), "yyyy-MM-dd"), tipo: "atendimento_individual", descricao: "", encaminhamento: "", recado_origem_id: null, relato_origem_id: null, busca_ativa_origem_id: null, criar_enc_externo: false, enc_tipo: "cras", enc_orgao: "", enc_contato: "", enc_status: "aberto", enc_data_retorno: "" });
  const [myProfileId, setMyProfileId] = useState("");
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const { log: auditLog } = useAuditLog();

  // Recados (para vinculação)
  const [recados, setRecados] = useState<any[]>([]);
  const [recadoOrigem, setRecadoOrigem] = useState<any | null>(null);

  // Encaminhamentos externos
  const [encExternos, setEncExternos] = useState<any[]>([]);
  const [encDialogOpen, setEncDialogOpen] = useState(false);
  const [encForm, setEncForm] = useState({ participante_id: "", orgao: "", tipo: "cras", motivo: "", data_encaminhamento: format(new Date(), "yyyy-MM-dd"), data_retorno: "", status: "aberto", observacoes_retorno: "", contato: "" });
  const [encEdit, setEncEdit] = useState<any | null>(null);

  // Relatos da equipe técnica (vínculo B)
  const [relatosEquipe, setRelatosEquipe] = useState<any[]>([]);
  const [relatoParticipantes, setRelatoParticipantes] = useState<any[]>([]);

  // Planejamentos (vínculo J)
  const [planejamentos, setPlanejamentos] = useState<any[]>([]);
  const [planejamentoTurmas, setPlanejamentoTurmas] = useState<any[]>([]);
  const [relatorios, setRelatorios] = useState<any[]>([]);
  const [relatorioTurmas, setRelatorioTurmas] = useState<any[]>([]);

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [deleteJustificativa, setDeleteJustificativa] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Busca Ativa state
  const [buscaAtivaRegistros, setBuscaAtivaRegistros] = useState<any[]>([]);
  const [baSelectedParticipante, setBaSelectedParticipante] = useState<any | null>(null);
  const [baSheetOpen, setBaSheetOpen] = useState(false);
  const [baDialogOpen, setBaDialogOpen] = useState(false);
  const [baFilterStatus, setBaFilterStatus] = useState("todos");
  const [baFilterBairro, setBaFilterBairro] = useState("");
  const [baFilterPeriodo, setBaFilterPeriodo] = useState("");
  const [baFilterFaixa, setBaFilterFaixa] = useState("");
  const [baFilterTurma, setBaFilterTurma] = useState("");
  const [baFilterMinFaltas, setBaFilterMinFaltas] = useState("");
  const [baFilterContato, setBaFilterContato] = useState("");
  const [baFilterNome, setBaFilterNome] = useState("");
  const [baForm, setBaForm] = useState({ tipo_contato: [] as string[], descricao: "", resultado: "em_andamento" });
  const [baSaving, setBaSaving] = useState(false);
  const [recadosPendentes, setRecadosPendentes] = useState(0);
  const [recalculando, setRecalculando] = useState(false);

  const [activeTab, setActiveTab] = useState("dashboard");

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    const [
      { data: atd }, { data: part }, { data: prof }, { data: pres }, { data: turm }, { data: tp },
      { data: roles }, { data: bairrosData }, { data: baRegs }, { data: pDocs },
      { data: recs }, { data: enc }, { data: relatos }, { data: relatoParts },
      { data: plans }, { data: planTurmas }, { data: rels }, { data: relTurmas },
    ] = await Promise.all([
      supabase.from("atendimentos").select("*").order("data_atendimento", { ascending: false }),
      supabase.from("participantes").select("id, nome_completo, status, data_nascimento, bairro_id, periodo, laudo, categoria_vulnerabilidade, foto_url, responsavel1_nome, responsavel1_whatsapp, responsavel2_nome, responsavel2_whatsapp, endereco_rua, endereco_numero, endereco_bairro, escola, data_desligamento, motivo_desligamento, restricao_alimentar, serie, genero, cor_raca, created_at").order("nome_completo"),
      supabase.from("profiles").select("id, nome, cargo, user_id"),
      supabase.from("presenca").select("participante_id, data, presente").gte("data", format(subDays(new Date(), 90), "yyyy-MM-dd")),
      supabase.from("turmas").select("id, nome, dias_semana, bairro_id, faixa_etaria, periodo").eq("ativa", true),
      supabase.from("turma_participantes").select("turma_id, participante_id"),
      supabase.from("user_roles").select("role"),
      supabase.from("bairros").select("id, nome"),
      (supabase.from as any)("busca_ativa_registros").select("*").order("created_at", { ascending: false }),
      supabase.from("participante_documentos" as any).select("*"),
      supabase.from("recados").select("*").eq("tipo_recado", "tecnico").order("created_at", { ascending: false }),
      (supabase.from as any)("encaminhamentos_externos").select("*").order("data_encaminhamento", { ascending: false }),
      (supabase.from as any)("relato_equipe_tecnica").select("*").order("created_at", { ascending: false }),
      (supabase.from as any)("relato_equipe_participantes").select("*"),
      supabase.from("planejamentos").select("id, titulo, data_aplicacao, educador_id, tema").gte("data_aplicacao", format(subDays(new Date(), 90), "yyyy-MM-dd")),
      supabase.from("planejamento_turmas").select("planejamento_id, turma_id"),
      supabase.from("relatorios_atividade").select("id, data, educador_id, planejamento_id, num_participantes, num_matriculados, pct_adesao, score_elo, objetivo_alcancado").gte("data", format(subDays(new Date(), 90), "yyyy-MM-dd")),
      supabase.from("relatorio_turmas").select("relatorio_id, turma_id"),
    ]);
    setAtendimentos(atd || []);
    setParticipantes(part || []);
    setProfiles(prof || []);
    setPresenca(pres || []);
    setTurmas(turm || []);
    setUserRoles((roles || []).map((r: any) => r.role));
    setBairros(bairrosData || []);
    setBuscaAtivaRegistros(baRegs || []);
    setRecados(recs || []);
    setEncExternos(enc || []);
    setRelatosEquipe(relatos || []);
    setRelatoParticipantes(relatoParts || []);
    setPlanejamentos(plans || []);
    setPlanejamentoTurmas(planTurmas || []);
    setRelatorios(rels || []);
    setRelatorioTurmas(relTurmas || []);

    // Group docs by participante_id
    const docsMap: Record<string, any[]> = {};
    (pDocs || []).forEach((d: any) => {
      if (!docsMap[d.participante_id]) docsMap[d.participante_id] = [];
      docsMap[d.participante_id].push(d);
    });
    setPendenteDocs(docsMap);

    const tpMap: Record<string, string[]> = {};
    (tp || []).forEach((row: any) => {
      if (!tpMap[row.turma_id]) tpMap[row.turma_id] = [];
      tpMap[row.turma_id].push(row.participante_id);
    });
    setTurmaParticipantesMap(tpMap);

    if (user) {
      const me = (prof || []).find((p: any) => p.user_id === user.id);
      if (me) setMyProfileId(me.id);
    }
    setLoading(false);
  };

  const isCoordenacao = userRoles.includes("coordenacao");

  // Approval handler
  const handleAprovarPendente = async (p: any) => {
    if (guardDemo(isDemo)) return;
    setApprovingId(p.id);
    const { error } = await supabase.from("participantes").update({ status: "ativo" } as any).eq("id", p.id);
    if (error) { toast.error("Erro: " + error.message); setApprovingId(null); return; }
    const faixa = calcFaixaFromDate(p.data_nascimento);
    if (p.bairro_id && p.periodo && faixa) {
      let query = supabase.from("turmas").select("id").eq("ativa", true).eq("bairro_id", p.bairro_id).eq("faixa_etaria", faixa as any);
      if (p.periodo !== "integral") query = query.eq("periodo", p.periodo as any);
      const { data: turmasCompativeis } = await query;
      if (turmasCompativeis && turmasCompativeis.length > 0) {
        const links = turmasCompativeis.map(t => ({ turma_id: t.id, participante_id: p.id }));
        await supabase.from("turma_participantes").upsert(links, { onConflict: "turma_id,participante_id", ignoreDuplicates: true });
        toast.info(`Vinculado a ${turmasCompativeis.length} turma(s)`);
      }
    }
    toast.success(`${p.nome_completo} aprovado!`);
    setApprovingId(null);
    loadAll();
  };

  const handleRejeitarPendente = async (p: any) => {
    if (guardDemo(isDemo)) return;
    setApprovingId(p.id);
    const { error } = await supabase.from("participantes").delete().eq("id", p.id);
    if (error) { toast.error("Erro: " + error.message); setApprovingId(null); return; }
    toast.success(`Matrícula de ${p.nome_completo} rejeitada`);
    setApprovingId(null);
    loadAll();
  };

  const handleViewDocEquipe = async (doc: any) => {
    const { data } = await supabase.storage.from("documentos").createSignedUrl(doc.arquivo_url, 3600);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
    else toast.error("Erro ao gerar link");
  };

  const handleDeleteAtendimento = async () => {
    if (!deleteTarget) return;
    if (!isCoordenacao && !deleteJustificativa.trim()) {
      toast.error("Justificativa obrigatória para exclusão");
      return;
    }
    setDeleteLoading(true);
    await auditLog({
      acao: "exclusao_atendimento",
      tabela: "atendimentos",
      registro_id: deleteTarget.id,
      detalhes: `${partName(deleteTarget.participante_id)} — ${tipoLabel(deleteTarget.tipo)} — ${deleteTarget.data_atendimento}`,
      justificativa: isCoordenacao ? (deleteJustificativa.trim() || "Exclusão pela coordenação") : deleteJustificativa.trim(),
    });
    const { error } = await supabase.from("atendimentos").delete().eq("id", deleteTarget.id);
    setDeleteLoading(false);
    if (error) { toast.error("Erro ao excluir: " + error.message); return; }
    toast.success("Atendimento excluído com registro de auditoria");
    setDeleteTarget(null);
    setDeleteJustificativa("");
    setDeleteDialogOpen(false);
    loadAll();
  };

  const handleCreate = async () => {
    if (guardDemo(isDemo)) return;
    if (!form.participante_id || !form.descricao.trim()) { toast.error("Preencha participante e descrição"); return; }
    const insertPayload: any = {
      participante_id: form.participante_id,
      profissional_id: myProfileId,
      data_atendimento: form.data_atendimento,
      tipo: form.tipo,
      descricao: form.descricao,
      encaminhamento: form.encaminhamento || null,
    };
    if (form.recado_origem_id) insertPayload.recado_origem_id = form.recado_origem_id;
    if (form.relato_origem_id) insertPayload.relato_origem_id = form.relato_origem_id;
    if (form.busca_ativa_origem_id) insertPayload.busca_ativa_origem_id = form.busca_ativa_origem_id;

    const { data: novoAtd, error } = await supabase.from("atendimentos").insert(insertPayload).select().single();
    if (error) { toast.error("Erro: " + error.message); return; }

    // Vínculo: recado → resolvido + atendimento_id NÃO existe em recados, mas mudamos status
    if (form.recado_origem_id) {
      await supabase.from("recados").update({ status: "resolvido" } as any).eq("id", form.recado_origem_id);
    }

    // Vínculo: busca_ativa_registros → atendimento_id
    if (form.busca_ativa_origem_id) {
      await (supabase.from as any)("busca_ativa_registros").update({ atendimento_id: novoAtd?.id }).eq("id", form.busca_ativa_origem_id);
    }

    // Mirror busca_ativa/visita_domiciliar atendimentos into busca_ativa_registros
    if ((form.tipo === "busca_ativa" || form.tipo === "visita_domiciliar") && !form.busca_ativa_origem_id) {
      try {
        await (supabase.from as any)("busca_ativa_registros").insert({
          participante_id: form.participante_id,
          profissional_id: myProfileId,
          tipo_contato: form.tipo,
          descricao: form.descricao,
          resultado: "em_andamento",
          data_registro: form.data_atendimento,
          atendimento_id: novoAtd?.id,
        });
      } catch (e) { console.warn(e); }
    }

    // Vínculo: criar encaminhamento externo se solicitado
    let encMsg = "";
    if (form.criar_enc_externo && form.enc_orgao?.trim()) {
      const { error: encErr } = await (supabase.from as any)("encaminhamentos_externos").insert({
        participante_id: form.participante_id,
        profissional_id: myProfileId,
        atendimento_id: novoAtd?.id,
        tipo: form.enc_tipo || "cras",
        orgao: form.enc_orgao,
        motivo: form.descricao,
        contato: form.enc_contato || null,
        data_encaminhamento: form.data_atendimento,
        data_retorno: form.enc_data_retorno || null,
        status: form.enc_status || "aberto",
      });
      if (encErr) { toast.error("Atendimento salvo, mas erro no encaminhamento: " + encErr.message); }
      else { encMsg = " Encaminhamento à rede registrado."; }
    }

    toast.success("Atendimento registrado!" + (form.recado_origem_id ? " Recado marcado como resolvido." : "") + encMsg);
    setDialogOpen(false);
    setRecadoOrigem(null);
    setForm({ participante_id: "", data_atendimento: format(new Date(), "yyyy-MM-dd"), tipo: "atendimento_individual", descricao: "", encaminhamento: "", recado_origem_id: null, relato_origem_id: null, busca_ativa_origem_id: null, criar_enc_externo: false, enc_tipo: "cras", enc_orgao: "", enc_contato: "", enc_status: "aberto", enc_data_retorno: "" });
    loadAll();
  };

  // Abre o diálogo de novo atendimento já vinculado a um recado técnico
  const handleRegistrarFromRecado = (recado: any) => {
    setRecadoOrigem(recado);
    setForm({
      participante_id: recado.participante_id || "",
      data_atendimento: format(new Date(), "yyyy-MM-dd"),
      tipo: "atendimento_individual",
      descricao: `[Originado do chamado #${recado.numero}]\n\n${recado.conteudo}\n\n— Atendimento realizado: `,
      encaminhamento: "",
      recado_origem_id: recado.id,
      relato_origem_id: null,
      busca_ativa_origem_id: null,
    });
    setDialogOpen(true);
  };

  // Encaminhamentos externos handlers
  const handleSaveEnc = async () => {
    if (guardDemo(isDemo)) return;
    if (!encForm.participante_id || !encForm.orgao.trim() || !encForm.motivo.trim()) {
      toast.error("Preencha participante, órgão e motivo");
      return;
    }
    const payload: any = {
      ...encForm,
      profissional_id: myProfileId,
      data_retorno: encForm.data_retorno || null,
    };
    if (encEdit) {
      const { error } = await (supabase.from as any)("encaminhamentos_externos").update(payload).eq("id", encEdit.id);
      if (error) { toast.error("Erro: " + error.message); return; }
      toast.success("Encaminhamento atualizado");
    } else {
      const { error } = await (supabase.from as any)("encaminhamentos_externos").insert(payload);
      if (error) { toast.error("Erro: " + error.message); return; }
      toast.success("Encaminhamento registrado");
    }
    setEncDialogOpen(false);
    setEncEdit(null);
    setEncForm({ participante_id: "", orgao: "", tipo: "cras", motivo: "", data_encaminhamento: format(new Date(), "yyyy-MM-dd"), data_retorno: "", status: "aberto", observacoes_retorno: "", contato: "" });
    loadAll();
  };

  const handleDeleteEnc = async (id: string) => {
    if (guardDemo(isDemo)) return;
    if (!confirm("Excluir este encaminhamento?")) return;
    const { error } = await (supabase.from as any)("encaminhamentos_externos").delete().eq("id", id);
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success("Encaminhamento excluído");
    loadAll();
  };

  const openEncEdit = (e: any) => {
    setEncEdit(e);
    setEncForm({
      participante_id: e.participante_id,
      orgao: e.orgao,
      tipo: e.tipo,
      motivo: e.motivo,
      data_encaminhamento: e.data_encaminhamento,
      data_retorno: e.data_retorno || "",
      status: e.status,
      observacoes_retorno: e.observacoes_retorno || "",
      contato: e.contato || "",
    });
    setEncDialogOpen(true);
  };

  // Dashboard calculations
  const now = new Date();
  const mesAtual = startOfMonth(now);
  const fimMes = endOfMonth(now);

  const atdMes = useMemo(() => atendimentos.filter(a => a.data_atendimento >= format(mesAtual, "yyyy-MM-dd") && a.data_atendimento <= format(fimMes, "yyyy-MM-dd")), [atendimentos]);
  const participantesAtivos = useMemo(() => participantes.filter(p => p.status === "ativo" || p.status === "busca_ativa"), [participantes]);
  const pendentes = useMemo(() => participantes.filter(p => p.status === "pendente"), [participantes]);
  const comLaudo = useMemo(() => participantesAtivos.filter(p => p.laudo && p.laudo.trim()).length, [participantesAtivos]);

  const porTipo = useMemo(() => {
    const map: Record<string, number> = {};
    atdMes.forEach(a => { map[a.tipo] = (map[a.tipo] || 0) + 1; });
    return Object.entries(map).map(([tipo, count]) => ({ name: TIPOS_ATENDIMENTO.find(t => t.value === tipo)?.label || tipo, value: count }));
  }, [atdMes]);

  const porMes = useMemo(() => {
    const map: Record<string, number> = {};
    atendimentos.forEach(a => { const k = a.data_atendimento.slice(0, 7); map[k] = (map[k] || 0) + 1; });
    return Object.entries(map).sort().slice(-6).map(([mes, count]) => ({ mes, count }));
  }, [atendimentos]);

  const porVulnerabilidade = useMemo(() => {
    const map: Record<string, number> = {};
    participantesAtivos.forEach(p => { const cat = p.categoria_vulnerabilidade || "Não informado"; map[cat] = (map[cat] || 0) + 1; });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [participantesAtivos]);

  const encPorOrgao = useMemo(() => {
    const map: Record<string, number> = {};
    encExternos.forEach(e => { const k = (e.tipo || "outro").toUpperCase(); map[k] = (map[k] || 0) + 1; });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [encExternos]);

  const encPorStatus = useMemo(() => {
    const labels: Record<string, string> = { aberto: "Aberto", em_andamento: "Em andamento", concluido: "Concluído", sem_retorno: "Sem retorno" };
    const map: Record<string, number> = {};
    encExternos.forEach(e => { const k = labels[e.status] || e.status || "—"; map[k] = (map[k] || 0) + 1; });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [encExternos]);

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

  const mapaCalor = useMemo(() => {
    const diasSets: Record<string, Set<string>> = { seg: new Set(), ter: new Set(), qua: new Set(), qui: new Set(), sex: new Set() };
    turmas.forEach(t => {
      const pIds = turmaParticipantesMap[t.id] || [];
      (t.dias_semana || []).forEach((d: string) => {
        const key = d.toLowerCase().slice(0, 3);
        if (diasSets[key]) pIds.forEach(id => diasSets[key].add(id));
      });
    });
    const diasMap = Object.fromEntries(Object.entries(diasSets).map(([k, s]) => [k, s.size]));
    const max = Math.max(...Object.values(diasMap), 1);
    return Object.entries(diasMap).map(([dia, count]) => ({
      dia: dia === "seg" ? "Segunda" : dia === "ter" ? "Terça" : dia === "qua" ? "Quarta" : dia === "qui" ? "Quinta" : "Sexta",
      count,
      intensity: count / max,
    }));
  }, [turmas, turmaParticipantesMap]);

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
  const bairroName = (id: string | null) => bairros.find(b => b.id === id)?.nome || "—";

  const relAtendimentos = useMemo(() => {
    return atendimentos.filter(a => a.data_atendimento >= relDataInicio && a.data_atendimento <= relDataFim);
  }, [atendimentos, relDataInicio, relDataFim]);

  // Recados técnicos no período do relatório
  const relRecados = useMemo(() => {
    const ini = new Date(relDataInicio + "T00:00:00").getTime();
    const fim = new Date(relDataFim + "T23:59:59").getTime();
    return recados.filter(r => {
      const t = new Date(r.created_at).getTime();
      return t >= ini && t <= fim;
    });
  }, [recados, relDataInicio, relDataFim]);

  // Mapa recado → atendimento vinculado (por recado_origem_id)
  const atendimentosPorRecado = useMemo(() => {
    const m: Record<string, any> = {};
    atendimentos.forEach(a => { if ((a as any).recado_origem_id) m[(a as any).recado_origem_id] = a; });
    return m;
  }, [atendimentos]);

  const relEncaminhamentos = useMemo(() => {
    return encExternos.filter(e => e.data_encaminhamento >= relDataInicio && e.data_encaminhamento <= relDataFim);
  }, [encExternos, relDataInicio, relDataFim]);

  const generateRelatorioEquipe = (formato: "xlsx" | "pdf") => {
    if (relAtendimentos.length === 0 && relRecados.length === 0 && relEncaminhamentos.length === 0) {
      toast.error("Nenhum dado no período"); return;
    }
    const periodoLabel = `${format(new Date(relDataInicio + "T12:00:00"), "dd/MM/yyyy")} a ${format(new Date(relDataFim + "T12:00:00"), "dd/MM/yyyy")}`;

    // Métricas dos chamados
    const totalChamados = relRecados.length;
    const chamadosResolvidos = relRecados.filter(r => ["concluido", "resolvido"].includes(r.status)).length;
    const chamadosComAtd = relRecados.filter(r => atendimentosPorRecado[r.id]).length;
    const pctResolvidos = totalChamados > 0 ? Math.round((chamadosResolvidos / totalChamados) * 100) : 0;
    const pctComAtd = totalChamados > 0 ? Math.round((chamadosComAtd / totalChamados) * 100) : 0;

    if (formato === "xlsx") {
      // Paleta P&B (grayscale)
      const border = { style: "thin" as const, color: { rgb: "000000" } };
      const hdr = { font: { bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "1F1F1F" } }, border: { top: border, bottom: border, left: border, right: border }, alignment: { wrapText: true, vertical: "center" as const } };
      const subHdr = { font: { bold: true, color: { rgb: "000000" } }, fill: { fgColor: { rgb: "D9D9D9" } }, border: { top: border, bottom: border, left: border, right: border } };
      const cell = { border: { top: border, bottom: border, left: border, right: border }, alignment: { wrapText: true, vertical: "top" as const } };
      const wb = XLSX.utils.book_new();

      // === Aba 1: Atendimentos ===
      const rows: any[][] = [
        ["Sociedade Civil Nossa Senhora Aparecida"],
        ["Centro de Atenção Integral ao Adolescente - Medianeira"],
        ["RELATÓRIO DE ATIVIDADES DA EQUIPE TÉCNICA"],
        [],
        ["Período: " + periodoLabel],
        ["Gerado em: " + new Date().toLocaleString("pt-BR")],
        [],
        ["Data", "Profissional", "Participante", "Tipo", "Origem", "Descrição", "Encaminhamento"],
      ];
      relAtendimentos.forEach(a => {
        const origem = (a as any).recado_origem_id ? "Chamado técnico" : (a as any).relato_origem_id ? "Relato pedagógico" : (a as any).busca_ativa_origem_id ? "Busca ativa" : "Direto";
        rows.push([
          format(new Date(a.data_atendimento + "T12:00:00"), "dd/MM/yyyy"),
          profName(a.profissional_id),
          partName(a.participante_id),
          tipoLabel(a.tipo),
          origem,
          a.descricao || "",
          a.encaminhamento || "",
        ]);
      });
      const ws = XLSX.utils.aoa_to_sheet(rows);
      ws["!cols"] = [{ wch: 12 }, { wch: 22 }, { wch: 28 }, { wch: 20 }, { wch: 18 }, { wch: 50 }, { wch: 30 }];
      autoFitColumns(ws, { min: 10 });
      for (let c = 0; c < 7; c++) {
        const addr = XLSX.utils.encode_cell({ r: 7, c });
        if (ws[addr]) ws[addr].s = hdr;
      }
      for (let r = 8; r < rows.length; r++) {
        for (let c = 0; c < 7; c++) {
          const addr = XLSX.utils.encode_cell({ r, c });
          if (ws[addr]) ws[addr].s = cell;
        }
      }
      XLSX.utils.book_append_sheet(wb, ws, "Atendimentos");

      // === Aba 2: Chamados Técnicos ===
      const recadoRows: any[][] = [
        ["CHAMADOS TÉCNICOS — " + periodoLabel],
        [],
        ["Total de chamados", totalChamados],
        ["Resolvidos", `${chamadosResolvidos} (${pctResolvidos}%)`],
        ["Geraram atendimento formal", `${chamadosComAtd} (${pctComAtd}%)`],
        ["Pendentes", totalChamados - chamadosResolvidos],
        [],
        ["Data envio", "Remetente", "Destinatário", "Participante", "Conteúdo", "Status", "Atendimento vinculado"],
      ];
      relRecados.forEach(r => {
        const atd = atendimentosPorRecado[r.id];
        recadoRows.push([
          format(new Date(r.created_at), "dd/MM/yyyy HH:mm"),
          profName(r.remetente_id),
          profName(r.destinatario_id),
          r.participante_id ? partName(r.participante_id) : "—",
          r.conteudo,
          r.status === "resolvido" || r.status === "concluido" ? "Resolvido" : r.status === "em_andamento" ? "Em andamento" : "Pendente",
          atd ? `Sim — ${format(new Date(atd.data_atendimento + "T12:00:00"), "dd/MM/yyyy")} — ${tipoLabel(atd.tipo)}` : "Não",
        ]);
      });
      const wsRec = XLSX.utils.aoa_to_sheet(recadoRows);
      wsRec["!cols"] = [{ wch: 16 }, { wch: 22 }, { wch: 22 }, { wch: 26 }, { wch: 50 }, { wch: 14 }, { wch: 35 }];
      autoFitColumns(wsRec, { min: 10 });
      // header row 8 (index 7)
      for (let c = 0; c < 7; c++) {
        const a = XLSX.utils.encode_cell({ r: 7, c });
        if (wsRec[a]) wsRec[a].s = hdr;
      }
      for (let r = 8; r < recadoRows.length; r++) {
        for (let c = 0; c < 7; c++) {
          const a = XLSX.utils.encode_cell({ r, c });
          if (wsRec[a]) wsRec[a].s = cell;
        }
      }
      XLSX.utils.book_append_sheet(wb, wsRec, "Chamados Técnicos");

      // === Aba 3: Encaminhamentos Externos ===
      if (relEncaminhamentos.length > 0) {
        const encRows: any[][] = [
          ["ENCAMINHAMENTOS À REDE EXTERNA — " + periodoLabel],
          [],
          ["Data", "Participante", "Órgão", "Tipo", "Motivo", "Status", "Data Retorno", "Observações"],
        ];
        relEncaminhamentos.forEach(e => {
          encRows.push([
            format(new Date(e.data_encaminhamento + "T12:00:00"), "dd/MM/yyyy"),
            partName(e.participante_id),
            e.orgao,
            (e.tipo || "").toUpperCase(),
            e.motivo,
            e.status,
            e.data_retorno ? format(new Date(e.data_retorno + "T12:00:00"), "dd/MM/yyyy") : "—",
            e.observacoes_retorno || "—",
          ]);
        });
        const wsEnc = XLSX.utils.aoa_to_sheet(encRows);
        wsEnc["!cols"] = [{ wch: 12 }, { wch: 28 }, { wch: 22 }, { wch: 10 }, { wch: 40 }, { wch: 14 }, { wch: 14 }, { wch: 35 }];
        autoFitColumns(wsEnc, { min: 10 });
        for (let c = 0; c < 8; c++) {
          const a = XLSX.utils.encode_cell({ r: 2, c });
          if (wsEnc[a]) wsEnc[a].s = hdr;
        }
        for (let r = 3; r < encRows.length; r++) {
          for (let c = 0; c < 8; c++) {
            const a = XLSX.utils.encode_cell({ r, c });
            if (wsEnc[a]) wsEnc[a].s = cell;
          }
        }
        XLSX.utils.book_append_sheet(wb, wsEnc, "Encaminhamentos Externos");
      }

      // === Aba 4: Resumo ===
      const tipoMap: Record<string, number> = {};
      relAtendimentos.forEach(a => { tipoMap[tipoLabel(a.tipo)] = (tipoMap[tipoLabel(a.tipo)] || 0) + 1; });
      const resumoRows: any[][] = [
        ["RESUMO POR TIPO DE ATENDIMENTO"],
        [],
        ["Tipo", "Quantidade"],
      ];
      Object.entries(tipoMap).forEach(([tipo, qt]) => resumoRows.push([tipo, qt]));
      resumoRows.push(["TOTAL", relAtendimentos.length]);
      const wsR = XLSX.utils.aoa_to_sheet(resumoRows);
      wsR["!cols"] = [{ wch: 30 }, { wch: 14 }];
      for (let c = 0; c < 2; c++) {
        const a = XLSX.utils.encode_cell({ r: 2, c });
        if (wsR[a]) wsR[a].s = hdr;
      }
      for (let r = 3; r < resumoRows.length; r++) {
        for (let c = 0; c < 2; c++) {
          const a = XLSX.utils.encode_cell({ r, c });
          if (wsR[a]) wsR[a].s = r === resumoRows.length - 1 ? subHdr : cell;
        }
      }
      XLSX.utils.book_append_sheet(wb, wsR, "Resumo");

      const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      saveAs(new Blob([buf]), sysCfvFileName("RelEquipeTecnica", "xlsx"));
      toast.success("Relatório XLSX gerado!");
    } else {
      // PDF P&B
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const GRAY_DARK: [number, number, number] = [31, 31, 31];
      const GRAY_LIGHT: [number, number, number] = [240, 240, 240];

      doc.setFontSize(13);
      doc.setTextColor(0, 0, 0);
      doc.text("RELATÓRIO DE ATIVIDADES DA EQUIPE TÉCNICA", 14, 15);
      doc.setFontSize(8);
      doc.text("Período: " + periodoLabel, 14, 21);
      doc.text("Gerado em: " + new Date().toLocaleString("pt-BR"), 14, 26);

      // Tabela atendimentos
      autoTable(doc, {
        startY: 32,
        head: [["Data", "Profissional", "Participante", "Tipo", "Origem", "Descrição", "Encaminhamento"]],
        body: relAtendimentos.map(a => {
          const origem = (a as any).recado_origem_id ? "Chamado" : (a as any).relato_origem_id ? "Relato" : (a as any).busca_ativa_origem_id ? "Busca ativa" : "Direto";
          return [
            format(new Date(a.data_atendimento + "T12:00:00"), "dd/MM/yyyy"),
            profName(a.profissional_id),
            partName(a.participante_id),
            tipoLabel(a.tipo),
            origem,
            a.descricao || "—",
            a.encaminhamento || "—",
          ];
        }),
        styles: { fontSize: 7, cellPadding: 1.5, textColor: [0, 0, 0], lineColor: [120, 120, 120] },
        headStyles: { fillColor: GRAY_DARK, textColor: 255, fontSize: 7 },
        alternateRowStyles: { fillColor: GRAY_LIGHT },
        columnStyles: { 5: { cellWidth: 70 }, 6: { cellWidth: 40 } },
      });

      // Seção Chamados Técnicos
      let lastY = (doc as any).lastAutoTable?.finalY || 100;
      if (lastY > 170) { doc.addPage(); lastY = 15; }
      doc.setFontSize(11);
      doc.setFont(undefined, "bold");
      doc.text("CHAMADOS TÉCNICOS", 14, lastY + 10);
      doc.setFont(undefined, "normal");
      doc.setFontSize(8);
      doc.text(`Total: ${totalChamados} | Resolvidos: ${chamadosResolvidos} (${pctResolvidos}%) | Geraram atendimento formal: ${chamadosComAtd} (${pctComAtd}%) | Pendentes: ${totalChamados - chamadosResolvidos}`, 14, lastY + 16);

      autoTable(doc, {
        startY: lastY + 20,
        head: [["Data", "Remetente", "Participante", "Conteúdo", "Status", "Atendimento"]],
        body: relRecados.map(r => {
          const atd = atendimentosPorRecado[r.id];
          return [
            format(new Date(r.created_at), "dd/MM/yyyy"),
            profName(r.remetente_id),
            r.participante_id ? partName(r.participante_id) : "—",
            r.conteudo,
            r.status === "resolvido" || r.status === "concluido" ? "Resolvido" : r.status === "em_andamento" ? "Em andamento" : "Pendente",
            atd ? `${format(new Date(atd.data_atendimento + "T12:00:00"), "dd/MM/yyyy")} — ${tipoLabel(atd.tipo)}` : "—",
          ];
        }),
        styles: { fontSize: 7, cellPadding: 1.5, textColor: [0, 0, 0], lineColor: [120, 120, 120] },
        headStyles: { fillColor: GRAY_DARK, textColor: 255, fontSize: 7 },
        alternateRowStyles: { fillColor: GRAY_LIGHT },
        columnStyles: { 3: { cellWidth: 80 }, 5: { cellWidth: 45 } },
      });

      // Seção Encaminhamentos Externos
      if (relEncaminhamentos.length > 0) {
        lastY = (doc as any).lastAutoTable?.finalY || 100;
        if (lastY > 170) { doc.addPage(); lastY = 15; }
        doc.setFontSize(11);
        doc.setFont(undefined, "bold");
        doc.text("ENCAMINHAMENTOS À REDE EXTERNA", 14, lastY + 10);
        doc.setFont(undefined, "normal");
        autoTable(doc, {
          startY: lastY + 14,
          head: [["Data", "Participante", "Órgão", "Tipo", "Motivo", "Status", "Retorno"]],
          body: relEncaminhamentos.map(e => [
            format(new Date(e.data_encaminhamento + "T12:00:00"), "dd/MM/yyyy"),
            partName(e.participante_id),
            e.orgao,
            (e.tipo || "").toUpperCase(),
            e.motivo,
            e.status,
            e.data_retorno ? format(new Date(e.data_retorno + "T12:00:00"), "dd/MM/yyyy") : "—",
          ]),
          styles: { fontSize: 7, cellPadding: 1.5, textColor: [0, 0, 0], lineColor: [120, 120, 120] },
          headStyles: { fillColor: GRAY_DARK, textColor: 255, fontSize: 7 },
          alternateRowStyles: { fillColor: GRAY_LIGHT },
          columnStyles: { 4: { cellWidth: 70 } },
        });
      }

      // Resumo por tipo
      lastY = (doc as any).lastAutoTable?.finalY || 100;
      if (lastY > 180) { doc.addPage(); lastY = 15; }
      doc.setFontSize(11);
      doc.setFont(undefined, "bold");
      doc.text("RESUMO POR TIPO", 14, lastY + 10);
      doc.setFont(undefined, "normal");
      const tipoMap2: Record<string, number> = {};
      relAtendimentos.forEach(a => { tipoMap2[tipoLabel(a.tipo)] = (tipoMap2[tipoLabel(a.tipo)] || 0) + 1; });
      autoTable(doc, {
        startY: lastY + 14,
        head: [["Tipo", "Quantidade"]],
        body: [...Object.entries(tipoMap2).map(([t, q]) => [t, String(q)]), ["TOTAL", String(relAtendimentos.length)]],
        styles: { fontSize: 8, textColor: [0, 0, 0], lineColor: [120, 120, 120] },
        headStyles: { fillColor: GRAY_DARK, textColor: 255 },
        alternateRowStyles: { fillColor: GRAY_LIGHT },
      });

      doc.save(sysCfvFileName("RelEquipeTecnica", "pdf"));
      toast.success("Relatório PDF gerado!");
    }
  };

  // ========== BUSCA ATIVA LOGIC ==========

  // Detect participants needing active search
  const buscaAtivaParticipantes = useMemo(() => {
    const results: any[] = [];
    const sixtyDaysAgo = format(subDays(now, 60), "yyyy-MM-dd");
    const thirtyDaysAgo = format(subDays(now, 30), "yyyy-MM-dd");

    // 1. Participants with busca_ativa status
    participantes
      .filter(p => p.status === "busca_ativa")
      .forEach(p => {
        results.push({ ...p, motivo_alerta: "Em busca ativa", faltas_consecutivas: 0 });
      });

    // 2. Recently discontinued (last 60 days)
    participantes
      .filter(p => p.status === "desligado" && p.data_desligamento && p.data_desligamento >= sixtyDaysAgo)
      .forEach(p => {
        if (!results.find(r => r.id === p.id)) {
          results.push({ ...p, motivo_alerta: "Desligado recente", faltas_consecutivas: 0 });
        }
      });

    // 2. Active participants with 2+ consecutive absences
    const presencaRecente = presenca.filter(p => p.data >= thirtyDaysAgo);
    const porPart: Record<string, { data: string; presente: boolean }[]> = {};
    presencaRecente.forEach(p => {
      if (!porPart[p.participante_id]) porPart[p.participante_id] = [];
      porPart[p.participante_id].push({ data: p.data, presente: p.presente });
    });

    participantes.filter(p => p.status === "ativo").forEach(p => {
      const registros = (porPart[p.id] || []).sort((a, b) => b.data.localeCompare(a.data));
      let consecutivas = 0;
      for (const r of registros) {
        if (!r.presente) consecutivas++;
        else break;
      }
      if (consecutivas >= 2 && !results.find(r => r.id === p.id)) {
        results.push({ ...p, motivo_alerta: `${consecutivas} faltas consecutivas`, faltas_consecutivas: consecutivas });
      }
    });

    return results;
  }, [participantes, presenca]);

  // Helper: get turma IDs for a participant
  const getParticipanteTurmas = (pid: string) => {
    const turmaIds: string[] = [];
    Object.entries(turmaParticipantesMap).forEach(([tid, pids]) => {
      if (pids.includes(pid)) turmaIds.push(tid);
    });
    return turmaIds;
  };

  // Filtered busca ativa
  const filteredBA = useMemo(() => {
    return buscaAtivaParticipantes.filter(p => {
      if (baFilterStatus === "busca_ativa" && p.status !== "busca_ativa") return false;
      if (baFilterStatus === "desligados" && p.status !== "desligado") return false;
      if (baFilterStatus === "faltas" && p.faltas_consecutivas < 2) return false;
      if (baFilterBairro && baFilterBairro !== "__all__" && p.bairro_id !== baFilterBairro) return false;
      if (baFilterPeriodo && baFilterPeriodo !== "__all__" && p.periodo !== baFilterPeriodo) return false;
      if (baFilterFaixa && baFilterFaixa !== "__all__") {
        const faixa = calcFaixaFromDate(p.data_nascimento);
        if (faixa !== baFilterFaixa) return false;
      }
      if (baFilterTurma && baFilterTurma !== "__all__") {
        const pTurmas = getParticipanteTurmas(p.id);
        if (!pTurmas.includes(baFilterTurma)) return false;
      }
      if (baFilterMinFaltas && baFilterMinFaltas !== "__all__") {
        const min = parseInt(baFilterMinFaltas);
        if (p.faltas_consecutivas < min) return false;
      }
      if (baFilterContato && baFilterContato !== "__all__") {
        const regs = getBARegistros(p.id);
        if (baFilterContato === "sem_contato" && regs.length > 0) return false;
        if (baFilterContato === "com_contato" && regs.length === 0) return false;
      }
      if (baFilterNome) {
        if (!p.nome_completo?.toLowerCase().includes(baFilterNome.toLowerCase())) return false;
      }
      return true;
    });
  }, [buscaAtivaParticipantes, baFilterStatus, baFilterBairro, baFilterPeriodo, baFilterFaixa, baFilterTurma, baFilterMinFaltas, baFilterContato, baFilterNome, turmaParticipantesMap, buscaAtivaRegistros]);

  // Get busca ativa registros for a participant — merge from busca_ativa_registros + atendimentos
  const getBARegistros = (pid: string) => {
    const direct = buscaAtivaRegistros.filter(r => r.participante_id === pid);
    const fromAtd = atendimentos
      .filter(a => a.participante_id === pid && (a.tipo === "busca_ativa" || a.tipo === "visita_domiciliar"))
      .map(a => ({
        id: `atd_${a.id}`,
        participante_id: a.participante_id,
        profissional_id: a.profissional_id,
        tipo_contato: a.tipo,
        descricao: a.descricao,
        resultado: a.encaminhamento || null,
        created_at: a.created_at || a.data_atendimento,
        data_registro: a.data_atendimento,
      }));
    // Dedupe by descricao+date proximity
    const all = [...direct, ...fromAtd];
    const seen = new Set<string>();
    const out: any[] = [];
    for (const r of all) {
      const key = `${r.descricao?.slice(0, 60)}_${(r.data_registro || r.created_at || "").slice(0, 10)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(r);
    }
    return out.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
  };
  const getBAAtendimentos = (pid: string) => atendimentos.filter(a => a.participante_id === pid && (a.tipo === "busca_ativa" || a.tipo === "visita_domiciliar"));

  // Presenca history for selected participant (last 30 days)
  const selectedPresencaHistory = useMemo(() => {
    if (!baSelectedParticipante) return [];
    const thirtyDaysAgo = format(subDays(now, 30), "yyyy-MM-dd");
    return presenca
      .filter(p => p.participante_id === baSelectedParticipante.id && p.data >= thirtyDaysAgo)
      .sort((a, b) => b.data.localeCompare(a.data));
  }, [baSelectedParticipante, presenca]);

  const handleRegistrarBuscaAtiva = async () => {
    if (!baSelectedParticipante || !myProfileId) return;
    if (!baForm.descricao.trim()) { toast.error("Descrição é obrigatória"); return; }
    if (baForm.tipo_contato.length === 0) { toast.error("Selecione ao menos uma ação realizada"); return; }
    setBaSaving(true);

    // Insert into busca_ativa_registros
    const { error } = await (supabase.from as any)("busca_ativa_registros").insert({
      participante_id: baSelectedParticipante.id,
      profissional_id: myProfileId,
      tipo_contato: baForm.tipo_contato.join(", "),
      descricao: baForm.descricao,
      resultado: baForm.resultado,
    });

    if (error) { toast.error("Erro: " + error.message); setBaSaving(false); return; }

    // Also create an atendimento of type busca_ativa
    await supabase.from("atendimentos").insert({
      participante_id: baSelectedParticipante.id,
      profissional_id: myProfileId,
      tipo: "busca_ativa",
      descricao: `[Busca Ativa] ${baForm.tipo_contato.map(t => TIPOS_CONTATO_BA.find(x => x.value === t)?.label || t).join(", ")} — ${baForm.descricao}`,
      encaminhamento: STATUS_BA.find(s => s.value === baForm.resultado)?.label || null,
    } as any);

    // Auto-update status: vai_retornar → ativo, encaminhar_desligamento → desligado
    if (baForm.resultado === "vai_retornar" && baSelectedParticipante.status !== "ativo") {
      await supabase.from("participantes").update({ status: "ativo" } as any).eq("id", baSelectedParticipante.id);
      toast.success("Participante reativado automaticamente");
    } else if (baForm.resultado === "encaminhar_desligamento" && baSelectedParticipante.status !== "desligado") {
      await supabase.from("participantes").update({ status: "busca_ativa" } as any).eq("id", baSelectedParticipante.id);
    } else if (baSelectedParticipante.status === "ativo") {
      // Manter como busca_ativa se for primeira busca em ativo (em andamento)
      if (baForm.resultado === "em_andamento") {
        await supabase.from("participantes").update({ status: "busca_ativa" } as any).eq("id", baSelectedParticipante.id);
      }
    }

    toast.success("Busca ativa registrada!");
    setBaSaving(false);
    setBaDialogOpen(false);
    setBaForm({ tipo_contato: [], descricao: "", resultado: "em_andamento" });
    loadAll();
  };

  const handleRecalcularBA = async () => {
    if (guardDemo(isDemo)) return;
    setRecalculando(true);
    try {
      const { data, error } = await (supabase as any).rpc("recalcular_busca_ativa", { _participante_ids: null });
      if (error) throw error;
      const r = data?.resultado || data || {};
      const para_ba = r.movidos_para_busca_ativa ?? 0;
      const para_ativo = r.retornados_para_ativo ?? 0;
      toast.success(`Recálculo concluído: ${para_ba} para Busca Ativa, ${para_ativo} retornaram para Ativo`);
      await loadAll();
    } catch (e: any) {
      toast.error("Erro no recálculo: " + (e.message || e));
    } finally {
      setRecalculando(false);
    }
  };

  const exportRelatorioBuscaAtiva = () => {
    if (filteredBA.length === 0) { toast.error("Nenhum participante para exportar"); return; }

    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    doc.setFontSize(14);
    doc.text("RELATÓRIO DE BUSCA ATIVA", 14, 15);
    doc.setFontSize(9);
    doc.text(`Gerado em: ${new Date().toLocaleString("pt-BR")} — Total: ${filteredBA.length} participante(s)`, 14, 22);

    autoTable(doc, {
      startY: 28,
      head: [["Nome", "Status", "Motivo", "Bairro", "Responsável", "Telefone", "Última Busca", "Status Busca"]],
      body: filteredBA.map(p => {
        const regs = getBARegistros(p.id);
        const lastReg = regs[0];
        return [
          p.nome_completo,
          p.status,
          p.motivo_alerta,
          bairroName(p.bairro_id),
          p.responsavel1_nome || "—",
          p.responsavel1_whatsapp || "—",
          lastReg ? format(new Date(lastReg.created_at), "dd/MM/yyyy") : "Nunca",
          lastReg ? (STATUS_BA.find(s => s.value === lastReg.resultado)?.label || lastReg.resultado || "—") : "—",
        ];
      }),
      styles: { fontSize: 7, cellPadding: 1.5 },
      headStyles: { fillColor: [21, 101, 192], fontSize: 7 },
      alternateRowStyles: { fillColor: [245, 245, 245] },
    });

    doc.save(sysCfvFileName("RelatorioBuscaAtiva", "pdf"));
    toast.success("Relatório de Busca Ativa exportado!");
  };

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
                    {participantesAtivos.map(p => <SelectItem key={p.id} value={p.id}>{p.nome_completo}{p.status === "busca_ativa" ? " (BA)" : ""}</SelectItem>)}
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
                <Label className="text-xs">Encaminhamento interno (opcional)</Label>
                <Textarea value={form.encaminhamento} onChange={e => setForm(f => ({ ...f, encaminhamento: e.target.value }))} className="mt-1 min-h-[60px]" placeholder="Orientação/encaminhamento interno..." />
              </div>

              {/* Toggle: Encaminhamento à rede de proteção */}
              <div className="rounded-lg border p-3 space-y-3 bg-muted/30">
                <label className="flex items-start gap-2 cursor-pointer">
                  <Checkbox checked={!!form.criar_enc_externo} onCheckedChange={v => setForm(f => ({ ...f, criar_enc_externo: !!v }))} />
                  <div className="flex-1">
                    <span className="text-xs font-medium flex items-center gap-1"><Network className="h-3.5 w-3.5" />Encaminhar à rede de proteção</span>
                    <span className="block text-[11px] text-muted-foreground">Cria registro vinculado em CRAS, CAPS, UBS, Conselho Tutelar etc.</span>
                  </div>
                </label>
                {form.criar_enc_externo && (
                  <div className="space-y-2 pl-6">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">Tipo de Órgão</Label>
                        <Select value={form.enc_tipo} onValueChange={v => setForm(f => ({ ...f, enc_tipo: v }))}>
                          <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="cras">CRAS</SelectItem>
                            <SelectItem value="creas">CREAS</SelectItem>
                            <SelectItem value="caps">CAPS</SelectItem>
                            <SelectItem value="ubs">UBS / Saúde</SelectItem>
                            <SelectItem value="conselho_tutelar">Conselho Tutelar</SelectItem>
                            <SelectItem value="escola">Escola</SelectItem>
                            <SelectItem value="ministerio_publico">Ministério Público</SelectItem>
                            <SelectItem value="outro">Outro</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Nome do Órgão</Label>
                        <Input value={form.enc_orgao} onChange={e => setForm(f => ({ ...f, enc_orgao: e.target.value }))} placeholder="Ex: CRAS Jd. Irene" className="mt-1 h-8 text-xs" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">Contato</Label>
                        <Input value={form.enc_contato} onChange={e => setForm(f => ({ ...f, enc_contato: e.target.value }))} placeholder="Telefone/responsável" className="mt-1 h-8 text-xs" />
                      </div>
                      <div>
                        <Label className="text-xs">Status inicial</Label>
                        <Select value={form.enc_status} onValueChange={v => setForm(f => ({ ...f, enc_status: v }))}>
                          <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="aberto">Aberto</SelectItem>
                            <SelectItem value="em_andamento">Em andamento</SelectItem>
                            <SelectItem value="concluido">Concluído</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs">Previsão de retorno (opcional)</Label>
                      <Input type="date" value={form.enc_data_retorno} onChange={e => setForm(f => ({ ...f, enc_data_retorno: e.target.value }))} className="mt-1 h-8 text-xs" />
                    </div>
                  </div>
                )}
              </div>

              <Button onClick={handleCreate} className="w-full">Registrar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="atendimentos">Atendimentos</TabsTrigger>
          <TabsTrigger value="busca-ativa" className="gap-1"><Search className="h-3.5 w-3.5" />Busca Ativa</TabsTrigger>
          <TabsTrigger value="recados" className="gap-1">
            <Mail className="h-3.5 w-3.5" />Recados
            {recadosPendentes > 0 && (
              <Badge variant="destructive" className="ml-1 h-5 min-w-[20px] px-1 text-[10px]">{recadosPendentes}</Badge>
            )}
          </TabsTrigger>
          
          <TabsTrigger value="relatorios">Relatórios</TabsTrigger>
          <TabsTrigger value="alertas" className="gap-1">
            Alertas
            {pendentes.length > 0 && (
              <Badge variant="destructive" className="ml-1 h-5 min-w-[20px] px-1 text-[10px]">{pendentes.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* DASHBOARD */}
        <TabsContent value="dashboard" className="space-y-4">
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
                <Button variant="outline" size="sm" onClick={() => setActiveTab("alertas")}>Aprovar agora</Button>
              </CardContent>
            </Card>
          )}

          

          <div className="grid md:grid-cols-2 gap-4">
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

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Participantes Estimados por Dia</CardTitle></CardHeader>
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

          {/* Rede de Proteção (Encaminhamentos Externos) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold flex items-center gap-2"><Network className="h-4 w-4" />Rede de Proteção</h3>
              <span className="text-xs text-muted-foreground">{encExternos.length} encaminhamento(s) registrado(s)</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card><CardContent className="pt-4 text-center">
                <p className="text-2xl font-bold">{encExternos.length}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </CardContent></Card>
              <Card><CardContent className="pt-4 text-center">
                <p className="text-2xl font-bold text-amber-600">{encExternos.filter(e => e.status === "aberto").length}</p>
                <p className="text-xs text-muted-foreground">Em aberto</p>
              </CardContent></Card>
              <Card><CardContent className="pt-4 text-center">
                <p className="text-2xl font-bold text-blue-600">{encExternos.filter(e => e.status === "em_andamento").length}</p>
                <p className="text-xs text-muted-foreground">Em andamento</p>
              </CardContent></Card>
              <Card><CardContent className="pt-4 text-center">
                <p className="text-2xl font-bold text-emerald-600">{encExternos.filter(e => e.status === "concluido").length}</p>
                <p className="text-xs text-muted-foreground">Concluídos</p>
              </CardContent></Card>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Encaminhamentos por Órgão</CardTitle></CardHeader>
                <CardContent>
                  {encPorOrgao.length > 0 ? (
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie data={encPorOrgao} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} label={({ name, value }) => `${name}: ${value}`} labelLine={false}>
                          {encPorOrgao.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : <p className="text-sm text-muted-foreground text-center py-8">Nenhum encaminhamento</p>}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2 flex-row items-center justify-between">
                  <CardTitle className="text-sm">Últimos Encaminhamentos</CardTitle>
                </CardHeader>
                <CardContent>
                  {encExternos.length > 0 ? (
                    <div className="space-y-1.5 max-h-[220px] overflow-auto">
                      {encExternos.slice(0, 8).map(e => {
                        const part = participantes.find(p => p.id === e.participante_id);
                        const statusColor = e.status === "concluido" ? "default" : e.status === "em_andamento" ? "secondary" : "outline";
                        return (
                          <div key={e.id} className="flex items-center justify-between gap-2 text-xs border-b pb-1.5 last:border-0">
                            <div className="flex-1 min-w-0">
                              <div className="font-medium truncate">{part?.nome_completo || "—"}</div>
                              <div className="text-muted-foreground truncate">{e.orgao} · {format(new Date(e.data_encaminhamento + "T12:00:00"), "dd/MM/yyyy")}</div>
                            </div>
                            <Badge variant={statusColor as any} className="text-[10px] shrink-0">{e.status}</Badge>
                          </div>
                        );
                      })}
                    </div>
                  ) : <p className="text-sm text-muted-foreground text-center py-8">Sem registros</p>}
                </CardContent>
              </Card>
            </div>
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
                   <TableHead className="text-xs w-10"></TableHead>
                 </TableRow>
               </TableHeader>
               <TableBody>
                 {filteredAtd.length === 0 ? (
                   <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhum atendimento registrado</TableCell></TableRow>
                 ) : filteredAtd.map(a => (
                   <TableRow key={a.id}>
                     <TableCell className="text-xs">{a.data_atendimento}</TableCell>
                     <TableCell className="text-xs font-medium">
                       <Link to={`/participantes/${a.participante_id}`} className="text-primary hover:underline">{partName(a.participante_id)}</Link>
                     </TableCell>
                     <TableCell><Badge variant="secondary" className="text-[10px]">{tipoLabel(a.tipo)}</Badge></TableCell>
                     <TableCell className="text-xs">{profName(a.profissional_id)}</TableCell>
                     <TableCell className="text-xs max-w-[200px] truncate">{a.descricao}</TableCell>
                     <TableCell>
                       <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => { setDeleteTarget(a); setDeleteDialogOpen(true); }}>
                         <Trash2 className="h-3.5 w-3.5" />
                       </Button>
                     </TableCell>
                   </TableRow>
                 ))}
               </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* BUSCA ATIVA */}
        <TabsContent value="busca-ativa" className="space-y-4">
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2 items-end">
              <div className="flex-1 min-w-[180px] max-w-xs">
                <Input
                  placeholder="Buscar por nome..."
                  value={baFilterNome}
                  onChange={e => setBaFilterNome(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
              <Select value={baFilterStatus} onValueChange={setBaFilterStatus}>
                <SelectTrigger className="w-44 h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="busca_ativa">Só Busca Ativa</SelectItem>
                  <SelectItem value="desligados">Só Desligados</SelectItem>
                  <SelectItem value="faltas">Só com Faltas</SelectItem>
                </SelectContent>
              </Select>
              <Select value={baFilterBairro} onValueChange={setBaFilterBairro}>
                <SelectTrigger className="w-40 h-9"><SelectValue placeholder="Bairro" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todos os Bairros</SelectItem>
                  {bairros.map(b => <SelectItem key={b.id} value={b.id}>{b.nome}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={baFilterPeriodo} onValueChange={setBaFilterPeriodo}>
                <SelectTrigger className="w-36 h-9"><SelectValue placeholder="Período" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todos Períodos</SelectItem>
                  <SelectItem value="manha">Manhã</SelectItem>
                  <SelectItem value="tarde">Tarde</SelectItem>
                  <SelectItem value="integral">Integral</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-wrap gap-2 items-end justify-between">
              <div className="flex flex-wrap gap-2">
                <Select value={baFilterFaixa} onValueChange={setBaFilterFaixa}>
                  <SelectTrigger className="w-36 h-9"><SelectValue placeholder="Faixa etária" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Todas Faixas</SelectItem>
                    <SelectItem value="6-8">6-8 anos</SelectItem>
                    <SelectItem value="9-11">9-11 anos</SelectItem>
                    <SelectItem value="12-17">12-17 anos</SelectItem>
                    <SelectItem value="idosos">Idosos</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={baFilterTurma} onValueChange={setBaFilterTurma}>
                  <SelectTrigger className="w-48 h-9"><SelectValue placeholder="Turma" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Todas as Turmas</SelectItem>
                    {turmas.map(t => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={baFilterMinFaltas} onValueChange={setBaFilterMinFaltas}>
                  <SelectTrigger className="w-40 h-9"><SelectValue placeholder="Mín. faltas" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Qualquer faltas</SelectItem>
                    <SelectItem value="2">2+ faltas</SelectItem>
                    <SelectItem value="3">3+ faltas</SelectItem>
                    <SelectItem value="5">5+ faltas</SelectItem>
                    <SelectItem value="10">10+ faltas</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={baFilterContato} onValueChange={setBaFilterContato}>
                  <SelectTrigger className="w-40 h-9"><SelectValue placeholder="Contato" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Todos</SelectItem>
                    <SelectItem value="sem_contato">Sem contato</SelectItem>
                    <SelectItem value="com_contato">Com contato</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button variant="default" size="sm" onClick={handleRecalcularBA} disabled={recalculando} className="gap-1">
                <Activity className="h-3.5 w-3.5" />{recalculando ? "Recalculando..." : "Recalcular Busca Ativa"}
              </Button>
              <Button variant="outline" size="sm" onClick={exportRelatorioBuscaAtiva} disabled={filteredBA.length === 0} className="gap-1">
                <Download className="h-3.5 w-3.5" />Exportar Relatório
              </Button>
            </div>
          </div>

          <Badge variant="secondary" className="text-xs">{filteredBA.length} participante(s) detectado(s)</Badge>

          {filteredBA.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <UserCheck className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Nenhum participante necessitando de busca ativa no momento</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {filteredBA.map(p => {
                const regs = getBARegistros(p.id);
                const lastReg = regs[0];
                return (
                  <Card
                    key={p.id}
                    className="cursor-pointer hover:shadow-md transition-shadow border-l-4"
                    style={{ borderLeftColor: p.status === "busca_ativa" ? "#f97316" : p.status === "desligado" ? "hsl(var(--destructive))" : "hsl(var(--chart-4))" }}
                    onClick={() => { setBaSelectedParticipante(p); setBaSheetOpen(true); }}
                  >
                    <CardContent className="pt-4 space-y-2">
                      <div className="flex items-start gap-3">
                        {p.foto_url ? (
                          <img src={p.foto_url} alt="" className="w-10 h-10 rounded-full object-cover" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground text-sm font-bold">
                            {p.nome_completo?.charAt(0)}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{p.nome_completo}</p>
                          <div className="flex items-center gap-1 mt-0.5">
                            <Badge
                              variant={p.status === "desligado" ? "destructive" : "secondary"}
                              className={`text-[10px] ${p.status === "busca_ativa" ? "bg-orange-100 text-orange-800 border-orange-300" : ""}`}
                            >
                              {p.status === "busca_ativa" ? "Busca Ativa" : p.status === "desligado" ? "Desligado" : p.status === "ativo" ? "Ativo" : p.status}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3 text-amber-500" />
                        {p.motivo_alerta}
                      </p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {bairroName(p.bairro_id)}
                      </p>
                      {p.responsavel1_nome && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {p.responsavel1_nome}{p.responsavel1_whatsapp ? ` — ${p.responsavel1_whatsapp}` : ""}
                        </p>
                      )}
                      {lastReg && (
                        <Badge variant="outline" className="text-[10px]">
                          Última busca: {format(new Date(lastReg.created_at), "dd/MM/yyyy")}
                        </Badge>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* RECADOS */}
        <TabsContent value="recados" className="space-y-4">
          <RecadosEquipeCards
            onPendingCount={setRecadosPendentes}
            onRegistrarAtendimento={handleRegistrarFromRecado}
            atendimentosVinculados={atendimentosPorRecado}
          />
        </TabsContent>


        {/* RELATÓRIOS */}
        <TabsContent value="relatorios" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Relatório de Atividades da Equipe Técnica</CardTitle>
              <p className="text-xs text-muted-foreground">Selecione o intervalo de datas para gerar o relatório com todos os atendimentos realizados.</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-3 items-end">
                <div>
                  <Label className="text-xs">Data Início</Label>
                  <Input type="date" value={relDataInicio} onChange={e => setRelDataInicio(e.target.value)} className="h-9 text-sm mt-1 w-44" />
                </div>
                <div>
                  <Label className="text-xs">Data Fim</Label>
                  <Input type="date" value={relDataFim} onChange={e => setRelDataFim(e.target.value)} className="h-9 text-sm mt-1 w-44" />
                </div>
                <Badge variant="secondary" className="text-xs h-9 px-3">{relAtendimentos.length} atendimento(s)</Badge>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => { generateRelatorioEquipe("xlsx"); generateRelatorioEquipe("pdf"); }} disabled={relAtendimentos.length === 0} className="gap-1">
                  <Download className="h-3.5 w-3.5" />Exportar Tudo
                </Button>
              </div>

              {relAtendimentos.length > 0 && (
                <div className="border rounded-lg overflow-auto max-h-60">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Data</TableHead>
                        <TableHead className="text-xs">Profissional</TableHead>
                        <TableHead className="text-xs">Participante</TableHead>
                        <TableHead className="text-xs">Tipo</TableHead>
                        <TableHead className="text-xs">Encaminhamento</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {relAtendimentos.slice(0, 20).map(a => (
                        <TableRow key={a.id}>
                          <TableCell className="text-xs">{a.data_atendimento}</TableCell>
                          <TableCell className="text-xs">{profName(a.profissional_id)}</TableCell>
                          <TableCell className="text-xs">{partName(a.participante_id)}</TableCell>
                          <TableCell><Badge variant="secondary" className="text-[10px]">{tipoLabel(a.tipo)}</Badge></TableCell>
                          <TableCell className="text-xs max-w-[150px] truncate">{a.encaminhamento || "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {relAtendimentos.length > 20 && <p className="text-[10px] text-muted-foreground text-center py-1">Mostrando 20 de {relAtendimentos.length}</p>}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ALERTAS */}
        <TabsContent value="alertas" className="space-y-4">
          {pendentes.length > 0 && (
            <Card className="border-amber-500/50">
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-500" />Matrículas Pendentes ({pendentes.length})</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {pendentes.map(p => {
                  const isExpanded = expandedPendente === p.id;
                  const pDocs = pendenteDocs[p.id] || [];
                  const isApproving = approvingId === p.id;
                  return (
                    <div key={p.id} className="border rounded-lg overflow-hidden">
                      {/* Header row */}
                      <div
                        className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => setExpandedPendente(isExpanded ? null : p.id)}
                      >
                        {p.foto_url ? (
                          <img src={p.foto_url} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-sm font-bold text-muted-foreground shrink-0">
                            {p.nome_completo?.charAt(0)}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{p.nome_completo}</p>
                          <p className="text-xs text-muted-foreground">
                            {displayAge(p.data_nascimento)} · {p.periodo ? PERIODO_LABELS[p.periodo] || p.periodo : "—"} · {bairroName(p.bairro_id)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {pDocs.length > 0 && (
                            <Badge variant="secondary" className="text-[10px] gap-1"><FileImage className="h-3 w-3" />{pDocs.length}</Badge>
                          )}
                          <Button
                            variant="default"
                            size="sm"
                            className="h-7 text-xs gap-1"
                            disabled={isApproving}
                            onClick={(e) => { e.stopPropagation(); handleAprovarPendente(p); }}
                          >
                            <Check className="h-3 w-3" />{isApproving ? "..." : "Aprovar"}
                          </Button>
                          {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                        </div>
                      </div>

                      {/* Expanded details */}
                      {isExpanded && (
                        <div className="border-t bg-muted/20 p-4 space-y-4">
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                            <div><span className="text-muted-foreground">Nome:</span><p className="font-medium">{p.nome_completo}</p></div>
                            <div><span className="text-muted-foreground">Nascimento:</span><p className="font-medium">{p.data_nascimento || "—"}</p></div>
                            <div><span className="text-muted-foreground">Gênero:</span><p className="font-medium">{p.genero || "—"}</p></div>
                            <div><span className="text-muted-foreground">Cor/Raça:</span><p className="font-medium">{p.cor_raca || "—"}</p></div>
                            <div><span className="text-muted-foreground">Período:</span><p className="font-medium">{p.periodo ? PERIODO_LABELS[p.periodo] || p.periodo : "—"}</p></div>
                            <div><span className="text-muted-foreground">Bairro CAIA:</span><p className="font-medium">{bairroName(p.bairro_id)}</p></div>
                            <div><span className="text-muted-foreground">Escola:</span><p className="font-medium">{p.escola || "—"}</p></div>
                            <div><span className="text-muted-foreground">Série:</span><p className="font-medium">{p.serie || "—"}</p></div>
                            <div><span className="text-muted-foreground">Endereço:</span><p className="font-medium">{p.endereco_rua ? `${p.endereco_rua}, ${p.endereco_numero || "s/n"} — ${p.endereco_bairro || ""}` : "—"}</p></div>
                            <div><span className="text-muted-foreground">Restrição Alimentar:</span><p className="font-medium">{p.restricao_alimentar || "—"}</p></div>
                            <div><span className="text-muted-foreground">Laudo:</span><p className="font-medium">{p.laudo || "—"}</p></div>
                            <div><span className="text-muted-foreground">Vulnerabilidade:</span><p className="font-medium">{p.categoria_vulnerabilidade || "—"}</p></div>
                          </div>

                          {/* Responsáveis */}
                          <div className="space-y-1">
                            <p className="text-xs font-semibold text-muted-foreground">Responsáveis</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                              {p.responsavel1_nome && (
                                <div className="border rounded p-2 bg-background">
                                  <p className="font-medium">{p.responsavel1_nome}</p>
                                  <p className="text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" />{p.responsavel1_whatsapp || "Sem telefone"}</p>
                                </div>
                              )}
                              {p.responsavel2_nome && (
                                <div className="border rounded p-2 bg-background">
                                  <p className="font-medium">{p.responsavel2_nome}</p>
                                  <p className="text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" />{p.responsavel2_whatsapp || "Sem telefone"}</p>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Documentos da matrícula */}
                          {pDocs.length > 0 && (
                            <div className="space-y-1">
                              <p className="text-xs font-semibold text-muted-foreground">Documentos Enviados na Matrícula</p>
                              <div className="flex flex-wrap gap-2">
                                {pDocs.map((doc: any) => (
                                  <button
                                    key={doc.id}
                                    onClick={() => handleViewDocEquipe(doc)}
                                    className="flex items-center gap-1.5 border rounded px-2 py-1.5 text-xs hover:bg-muted/50 transition-colors bg-background"
                                  >
                                    <FileText className="h-3.5 w-3.5 text-primary shrink-0" />
                                    <span className="truncate max-w-[150px]">{doc.categoria}</span>
                                    <Eye className="h-3 w-3 text-muted-foreground" />
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Action buttons */}
                          <div className="flex gap-2 pt-1">
                            <Button
                              size="sm"
                              className="gap-1"
                              disabled={isApproving}
                              onClick={() => handleAprovarPendente(p)}
                            >
                              <Check className="h-3.5 w-3.5" />{isApproving ? "Aprovando..." : "Aprovar Matrícula"}
                            </Button>
                            {isCoordenacao && (
                              <Button
                                variant="destructive"
                                size="sm"
                                className="gap-1"
                                disabled={isApproving}
                                onClick={() => handleRejeitarPendente(p)}
                              >
                                <XIcon className="h-3.5 w-3.5" />Rejeitar
                              </Button>
                            )}
                            <Button variant="outline" size="sm" className="gap-1" asChild>
                              <Link to={`/participantes/${p.id}`}><Eye className="h-3.5 w-3.5" />Perfil Completo</Link>
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
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

      {/* Delete Atendimento Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Atendimento</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget && `${partName(deleteTarget.participante_id)} — ${tipoLabel(deleteTarget.tipo)} — ${deleteTarget.data_atendimento}`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {!isCoordenacao && (
            <div className="space-y-2">
              <Label className="text-xs">Justificativa (obrigatória)</Label>
              <Textarea value={deleteJustificativa} onChange={e => setDeleteJustificativa(e.target.value)} placeholder="Motivo da exclusão..." className="min-h-[80px]" />
            </div>
          )}
          {isCoordenacao && (
            <div className="space-y-2">
              <Label className="text-xs">Justificativa (opcional)</Label>
              <Textarea value={deleteJustificativa} onChange={e => setDeleteJustificativa(e.target.value)} placeholder="Motivo da exclusão (opcional)..." className="min-h-[60px]" />
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setDeleteTarget(null); setDeleteJustificativa(""); }}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAtendimento} disabled={deleteLoading} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleteLoading ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Busca Ativa - Sheet de Perfil */}
      <Sheet open={baSheetOpen} onOpenChange={setBaSheetOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Busca Ativa — Perfil
            </SheetTitle>
          </SheetHeader>
          {baSelectedParticipante && (
            <div className="space-y-4 mt-4">
              {/* Basic Info */}
              <div className="flex items-start gap-3">
                {baSelectedParticipante.foto_url ? (
                  <img src={baSelectedParticipante.foto_url} alt="" className="w-14 h-14 rounded-full object-cover" />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center text-lg font-bold text-muted-foreground">
                    {baSelectedParticipante.nome_completo?.charAt(0)}
                  </div>
                )}
                <div>
                  <p className="font-medium">{baSelectedParticipante.nome_completo}</p>
                  <Badge variant={baSelectedParticipante.status === "ativo" ? "secondary" : "destructive"} className="text-xs mt-1">{baSelectedParticipante.status}</Badge>
                  <p className="text-xs text-muted-foreground mt-1">{baSelectedParticipante.motivo_alerta}</p>
                </div>
              </div>

              {/* Details */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 border rounded bg-muted/30">
                  <p className="text-muted-foreground">Nascimento</p>
                  <p className="font-medium">{baSelectedParticipante.data_nascimento || "—"}</p>
                </div>
                <div className="p-2 border rounded bg-muted/30">
                  <p className="text-muted-foreground">Escola</p>
                  <p className="font-medium">{baSelectedParticipante.escola || "—"}</p>
                </div>
                <div className="p-2 border rounded bg-muted/30">
                  <p className="text-muted-foreground">Bairro</p>
                  <p className="font-medium">{bairroName(baSelectedParticipante.bairro_id)}</p>
                </div>
                <div className="p-2 border rounded bg-muted/30">
                  <p className="text-muted-foreground">Endereço</p>
                  <p className="font-medium">{baSelectedParticipante.endereco_rua ? `${baSelectedParticipante.endereco_rua}, ${baSelectedParticipante.endereco_numero || "s/n"}` : "—"}</p>
                </div>
              </div>

              {/* Responsáveis */}
              <div className="space-y-2">
                <p className="text-sm font-medium">Responsáveis</p>
                {baSelectedParticipante.responsavel1_nome ? (
                  <div className="p-2 border rounded bg-muted/30 text-xs space-y-0.5">
                    <p className="font-medium">{baSelectedParticipante.responsavel1_nome}</p>
                    <p className="text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" />{baSelectedParticipante.responsavel1_whatsapp || "Sem telefone"}</p>
                  </div>
                ) : <p className="text-xs text-muted-foreground">Nenhum responsável cadastrado</p>}
                {baSelectedParticipante.responsavel2_nome && (
                  <div className="p-2 border rounded bg-muted/30 text-xs space-y-0.5">
                    <p className="font-medium">{baSelectedParticipante.responsavel2_nome}</p>
                    <p className="text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" />{baSelectedParticipante.responsavel2_whatsapp || "Sem telefone"}</p>
                  </div>
                )}
              </div>

              {/* Presença recente */}
              <div className="space-y-2">
                <p className="text-sm font-medium">Presença (últimos 30 dias)</p>
                {selectedPresencaHistory.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhum registro</p>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {selectedPresencaHistory.slice(0, 20).map((p, i) => (
                      <div
                        key={i}
                        className={`w-7 h-7 rounded text-[10px] flex items-center justify-center font-medium ${p.presente ? "bg-emerald-500/20 text-emerald-700" : "bg-destructive/20 text-destructive"}`}
                        title={`${p.data} — ${p.presente ? "Presente" : "Faltou"}`}
                      >
                        {p.data.slice(8, 10)}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Atendimentos anteriores de busca ativa */}
              <div className="space-y-2">
                <p className="text-sm font-medium">Histórico de Busca Ativa</p>
                {getBARegistros(baSelectedParticipante.id).length === 0 && getBAAtendimentos(baSelectedParticipante.id).length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhum registro anterior</p>
                ) : (
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {getBARegistros(baSelectedParticipante.id).map((r: any) => (
                      <div key={r.id} className="p-2 border rounded text-xs">
                        <div className="flex justify-between">
                          <span className="font-medium">{r.tipo_contato}</span>
                          <span className="text-muted-foreground">{format(new Date(r.created_at), "dd/MM/yyyy")}</span>
                        </div>
                        <p className="text-muted-foreground mt-0.5">{r.descricao}</p>
                        {r.resultado && <Badge variant="outline" className="text-[10px] mt-1">{STATUS_BA.find(s => s.value === r.resultado)?.label || r.resultado}</Badge>}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Action button */}
              <Button className="w-full gap-2" onClick={() => setBaDialogOpen(true)}>
                <Search className="h-4 w-4" />
                Registrar Busca Ativa
              </Button>

              <Button variant="outline" size="sm" className="w-full" asChild>
                <Link to={`/participantes/${baSelectedParticipante.id}`}>
                  <Eye className="h-3.5 w-3.5 mr-1" />Ver Perfil Completo
                </Link>
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Dialog Registrar Busca Ativa */}
      <Dialog open={baDialogOpen} onOpenChange={setBaDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar Busca Ativa</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Participante: <strong>{baSelectedParticipante?.nome_completo}</strong></p>

            <div>
              <Label className="text-xs mb-2 block">Ações Realizadas</Label>
              <div className="space-y-2">
                {TIPOS_CONTATO_BA.map(tc => (
                  <label key={tc.value} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={baForm.tipo_contato.includes(tc.value)}
                      onCheckedChange={checked => {
                        if (checked) setBaForm(f => ({ ...f, tipo_contato: [...f.tipo_contato, tc.value] }));
                        else setBaForm(f => ({ ...f, tipo_contato: f.tipo_contato.filter(t => t !== tc.value) }));
                      }}
                    />
                    {tc.label}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-xs">Descrição / Detalhes</Label>
              <Textarea
                value={baForm.descricao}
                onChange={e => setBaForm(f => ({ ...f, descricao: e.target.value }))}
                placeholder="Descreva o que foi realizado, quem atendeu, observações..."
                className="mt-1 min-h-[80px]"
              />
            </div>

            <div>
              <Label className="text-xs">Status</Label>
              <Select value={baForm.resultado} onValueChange={v => setBaForm(f => ({ ...f, resultado: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_BA.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <Button onClick={handleRegistrarBuscaAtiva} disabled={baSaving} className="w-full">
              {baSaving ? "Salvando..." : "Registrar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EquipeTecnicaPage;
