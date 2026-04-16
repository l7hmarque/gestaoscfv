import { useEffect, useState, useCallback, useMemo } from "react";
import { AlertTriangle } from "lucide-react";
import { ArrowLeft, Printer, Instagram, Copy, Share2, Download, X, Trash2, Plus, Search, Link2, Pencil, Check, Users, ChevronsUpDown, FileText } from "lucide-react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Calendar } from "@/components/ui/calendar";
import { exportRelatorioDocx, exportRelatorioPdf } from "@/hooks/useDocumentExport";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { TIPOS_ATIVIDADE } from "@/lib/constants";

const LIKERT_LABELS = ["", "Muito Baixo", "Baixo", "Moderado", "Alto", "Excepcional"];
const OBJ_LABELS: Record<string, string> = { alcancado: "Alcançado", parcial: "Parcial", nao_alcancado: "Não Alcançado" };
const ENGAJAMENTO_OPT = ["Grupo participativo", "Grupo disperso", "Boa interação entre participantes", "Necessitou intervenção do educador"];
const SITUACOES_OPT = ["Nenhuma ocorrência", "Conflito entre participantes", "Situação de vulnerabilidade identificada", "Encaminhamento necessário", "Comunicação com família/responsável"];
const DIAS_SEMANA_MAP = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

function LikertDisplay({ label, value }: { label: string; value: number | null }) {
  const v = value || 0;
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <div className="flex gap-0.5">
          {[1, 2, 3, 4, 5].map(n => (
            <div key={n} className={cn("w-5 h-5 rounded text-[10px] flex items-center justify-center font-medium", n <= v ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>{n}</div>
          ))}
        </div>
        <span className="text-xs text-muted-foreground w-20 text-right">{LIKERT_LABELS[v]}</span>
      </div>
    </div>
  );
}

function LikertFieldEdit({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map(n => (
          <button key={n} type="button" onClick={() => onChange(n)} className={cn(
            "flex-1 py-1.5 rounded text-xs font-medium transition-colors border",
            value === n ? "bg-primary text-primary-foreground border-primary" : "bg-muted/50 text-muted-foreground border-border hover:bg-muted"
          )}>{n}</button>
        ))}
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground px-1">
        <span>{LIKERT_LABELS[1]}</span><span>{LIKERT_LABELS[5]}</span>
      </div>
    </div>
  );
}

function RelatosEquipeTecnica({ relatorioId, isCoordenacao }: { relatorioId: string; isCoordenacao: boolean }) {
  const [relatos, setRelatos] = useState<any[]>([]);
  const [isTecnico, setIsTecnico] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      supabase.from("user_roles").select("role").eq("user_id", user.id).in("role", ["tecnico", "coordenacao"]).then(({ data }) => {
        setIsTecnico((data?.length || 0) > 0);
      });
    }
  }, [user]);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from("relato_equipe_tecnica").select("*, relato_equipe_participantes(participante_id, participantes(nome_completo)), profiles!relato_equipe_tecnica_criado_por_fkey(nome)").eq("relatorio_id", relatorioId) as any;
      setRelatos(data || []);
    };
    fetch();
  }, [relatorioId]);

  if (relatos.length === 0 || (!isTecnico && !isCoordenacao)) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500" /> Relatos para Equipe Técnica ({relatos.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {relatos.map((r: any) => (
          <div key={r.id} className="border rounded-md p-3 bg-amber-50 dark:bg-amber-950/20 space-y-1">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">{r.motivo}</Badge>
              {r.profiles?.nome && <span className="text-xs text-muted-foreground">por {r.profiles.nome}</span>}
              <span className="text-xs text-muted-foreground">{format(new Date(r.created_at), "dd/MM/yyyy")}</span>
            </div>
            <p className="text-sm">{r.descricao}</p>
            <div className="flex gap-1 flex-wrap">
              {r.relato_equipe_participantes?.map((rp: any) => (
                <Badge key={rp.participante_id} variant="secondary" className="text-xs">
                  {rp.participantes?.nome_completo || "—"}
                </Badge>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

const RelatorioDetalhePage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [item, setItem] = useState<any>(null);
  const [turmaNames, setTurmaNames] = useState<string[]>([]);
  const [turmaIds, setTurmaIds] = useState<string[]>([]);
  const [fotos, setFotos] = useState<any[]>([]);
  const [presenca, setPresenca] = useState<any[]>([]);
  const [planejamentoLink, setPlanejamentoLink] = useState<{ id: string; titulo: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const [instaOpen, setInstaOpen] = useState(false);
  const [instaText, setInstaText] = useState("");
  const [instaLoading, setInstaLoading] = useState(false);
  const [isCoordenacao, setIsCoordenacao] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Add participant dialog state
  const [addOpen, setAddOpen] = useState(false);
  const [addTab, setAddTab] = useState<string>("buscar");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [nomeAvulso, setNomeAvulso] = useState("");
  const [adding, setAdding] = useState(false);

  // Link avulso dialog state
  const [linkTarget, setLinkTarget] = useState<any>(null);
  const [linkSearch, setLinkSearch] = useState("");
  const [linkResults, setLinkResults] = useState<any[]>([]);
  const [linking, setLinking] = useState(false);

  // Edit mode state (coordenação only)
  const [editMode, setEditMode] = useState(false);
  const [allTurmas, setAllTurmas] = useState<any[]>([]);
  const [selectedTurmaIds, setSelectedTurmaIds] = useState<string[]>([]);
  const [editParticipants, setEditParticipants] = useState<any[]>([]);
  const [editPresencaMap, setEditPresencaMap] = useState<Record<string, boolean>>({});
  const [savingEdit, setSavingEdit] = useState(false);
  const [loadingEditParticipants, setLoadingEditParticipants] = useState(false);

  // Full edit form state
  const [editForm, setEditForm] = useState({
    nome_atividade: "",
    data: null as Date | null,
    dia_semana: "",
    educador_id: "",
    tipo_atividade: [] as string[],
    tipo_atividade_detalhe: "",
    iniciativa: 3,
    autonomia: 3,
    colaboracao: 3,
    comunicacao: 3,
    respeito_mutuo: 3,
    engajamento: [] as string[],
    situacoes_relevantes: [] as string[],
    objetivo_alcancado: "",
    intervencoes: "",
    observacoes: "",
  });
  const [allEducadores, setAllEducadores] = useState<any[]>([]);
  const [educadorOpen, setEducadorOpen] = useState(false);

  const editScoreElo = useMemo(() => {
    const s = (editForm.iniciativa + editForm.autonomia + editForm.colaboracao + editForm.comunicacao + editForm.respeito_mutuo) / 5;
    return s.toFixed(2);
  }, [editForm.iniciativa, editForm.autonomia, editForm.colaboracao, editForm.comunicacao, editForm.respeito_mutuo]);

  const editNeedsDetail = editForm.tipo_atividade.some(v => {
    const t = TIPOS_ATIVIDADE.find(ta => ta.value === v);
    return t && "hasDetail" in t && t.hasDetail;
  });

  useEffect(() => {
    if (user) {
      supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "coordenacao").then(({ data }) => {
        setIsCoordenacao((data?.length || 0) > 0);
      });
    }
  }, [user]);

  const fetchPresenca = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase.from("relatorio_presenca").select("*, participantes(nome_completo)").eq("relatorio_id", id);
    if (data) {
      setPresenca(data.sort((a: any, b: any) => {
        const nA = a.participantes?.nome_completo || a.nome_avulso || "";
        const nB = b.participantes?.nome_completo || b.nome_avulso || "";
        return nA.localeCompare(nB);
      }));
    }
  }, [id]);

  useEffect(() => {
    const fetch = async () => {
      const [r, f] = await Promise.all([
        supabase.from("relatorios_atividade")
          .select("*, relatorio_turmas(turma_id, turmas(nome)), profiles!relatorios_atividade_educador_id_fkey(nome)")
          .eq("id", id).single(),
        supabase.from("relatorio_fotos").select("*").eq("relatorio_id", id).order("ordem"),
      ]);
      if (r.data) {
        setItem(r.data);
        const tIds = r.data.relatorio_turmas?.map((rt: any) => rt.turma_id).filter(Boolean) || [];
        setTurmaIds(tIds);
        setTurmaNames(r.data.relatorio_turmas?.map((rt: any) => rt.turmas?.nome).filter(Boolean) || []);
        if (r.data.planejamento_id) {
          const { data: plan } = await supabase.from("planejamentos").select("id, titulo").eq("id", r.data.planejamento_id).single();
          if (plan) setPlanejamentoLink(plan);
        }
      }
      if (f.data) setFotos(f.data);
      await fetchPresenca();
      setLoading(false);
    };
    fetch();
  }, [id, fetchPresenca]);

  // Search participants for add dialog
  useEffect(() => {
    if (addTab !== "buscar" || searchQuery.length < 2) { setSearchResults([]); return; }
    const timer = setTimeout(async () => {
      const { data } = await supabase.from("participantes").select("id, nome_completo, status").ilike("nome_completo", `%${searchQuery}%`).limit(10);
      setSearchResults(data || []);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, addTab]);

  // Search participants for link dialog
  useEffect(() => {
    if (!linkTarget || linkSearch.length < 2) { setLinkResults([]); return; }
    const timer = setTimeout(async () => {
      const { data } = await supabase.from("participantes").select("id, nome_completo, status").ilike("nome_completo", `%${linkSearch}%`).limit(10);
      setLinkResults(data || []);
    }, 300);
    return () => clearTimeout(timer);
  }, [linkSearch, linkTarget]);

  const recalcCounters = async () => {
    if (!id) return;
    const { data: allP } = await supabase.from("relatorio_presenca").select("presente").eq("relatorio_id", id);
    if (!allP) return;
    const total = allP.length;
    const presentes = allP.filter(p => p.presente).length;
    const ausentes = total - presentes;
    const pct = total > 0 ? (presentes / total) * 100 : 0;
    await supabase.from("relatorios_atividade").update({
      num_participantes: presentes,
      num_ausentes: ausentes,
      num_matriculados: total,
      pct_adesao: parseFloat(pct.toFixed(1)),
    }).eq("id", id);
    const { data: updated } = await supabase.from("relatorios_atividade").select("num_participantes, num_ausentes, num_matriculados, pct_adesao").eq("id", id).single();
    if (updated) setItem((prev: any) => ({ ...prev, ...updated }));
  };

  const handleAddFromCadastro = async (participanteId: string) => {
    if (!id) return;
    const existing = presenca.find(p => p.participante_id === participanteId);
    if (existing) { toast.error("Participante já está na lista"); return; }
    setAdding(true);
    const { error } = await supabase.from("relatorio_presenca").insert({
      relatorio_id: id,
      participante_id: participanteId,
      presente: true,
    } as any);
    if (error) { toast.error(error.message); setAdding(false); return; }
    await fetchPresenca();
    await recalcCounters();
    setAdding(false);
    setSearchQuery("");
    toast.success("Participante adicionado!");
  };

  const handleAddAvulso = async () => {
    if (!id || !nomeAvulso.trim()) return;
    setAdding(true);
    const { error } = await supabase.from("relatorio_presenca").insert({
      relatorio_id: id,
      participante_id: null,
      nome_avulso: nomeAvulso.trim(),
      presente: true,
    } as any);
    if (error) { toast.error(error.message); setAdding(false); return; }
    await fetchPresenca();
    await recalcCounters();
    setAdding(false);
    setNomeAvulso("");
    toast.success("Nome avulso adicionado!");
  };

  const handleLinkAvulso = async (participanteId: string) => {
    if (!linkTarget) return;
    setLinking(true);
    const { error } = await supabase.from("relatorio_presenca").update({
      participante_id: participanteId,
      nome_avulso: null,
    } as any).eq("id", linkTarget.id);
    if (error) { toast.error(error.message); setLinking(false); return; }
    await fetchPresenca();
    setLinkTarget(null);
    setLinkSearch("");
    setLinking(false);
    toast.success("Participante vinculado com sucesso!");
  };

  // ---- EDIT MODE FUNCTIONS ----
  const enterEditMode = async () => {
    const [{ data: turmas }, { data: educadores }, { data: roles }] = await Promise.all([
      supabase.from("turmas").select("id, nome, ativa").eq("ativa", true).order("nome"),
      supabase.from("profiles").select("id, nome, user_id"),
      supabase.from("user_roles").select("user_id, role"),
    ]);
    setAllTurmas(turmas || []);
    // Filter educadores by role
    const eduUserIds = new Set((roles || []).filter((r: any) => r.role === "educador" || r.role === "coordenacao").map((r: any) => r.user_id));
    setAllEducadores((educadores || []).filter((p: any) => eduUserIds.has(p.user_id)));
    setSelectedTurmaIds([...turmaIds]);
    // Populate edit form from item
    setEditForm({
      nome_atividade: item?.nome_atividade || "",
      data: item?.data ? new Date(item.data + "T12:00:00") : null,
      dia_semana: item?.dia_semana || "",
      educador_id: item?.educador_id || "",
      tipo_atividade: Array.isArray(item?.tipo_atividade) ? item.tipo_atividade : [],
      tipo_atividade_detalhe: item?.tipo_atividade_detalhe || "",
      iniciativa: item?.iniciativa || 3,
      autonomia: item?.autonomia || 3,
      colaboracao: item?.colaboracao || 3,
      comunicacao: item?.comunicacao || 3,
      respeito_mutuo: item?.respeito_mutuo || 3,
      engajamento: Array.isArray(item?.engajamento) ? item.engajamento : [],
      situacoes_relevantes: Array.isArray(item?.situacoes_relevantes) ? item.situacoes_relevantes : [],
      objetivo_alcancado: item?.objetivo_alcancado || "",
      intervencoes: item?.intervencoes || "",
      observacoes: item?.observacoes || "",
    });
    setEditMode(true);
    await loadParticipantsForTurmas([...turmaIds]);
  };

  const loadParticipantsForTurmas = async (tIds: string[]) => {
    setLoadingEditParticipants(true);
    if (tIds.length === 0) {
      setEditParticipants([]);
      setEditPresencaMap({});
      setLoadingEditParticipants(false);
      return;
    }
    // Get all participants linked to selected turmas
    const { data: tp } = await supabase.from("turma_participantes").select("participante_id, participantes(id, nome_completo, status)").in("turma_id", tIds).is("data_saida" as any, null);
    // Deduplicate and filter by status
    const ALLOWED_STATUS = new Set(["ativo", "busca_ativa"]);
    const uniqueMap = new Map<string, any>();
    (tp || []).forEach((row: any) => {
      if (row.participantes && !uniqueMap.has(row.participantes.id) && ALLOWED_STATUS.has(row.participantes.status || "ativo")) {
        uniqueMap.set(row.participantes.id, row.participantes);
      }
    });
    const participants = Array.from(uniqueMap.values()).sort((a, b) => a.nome_completo.localeCompare(b.nome_completo));
    setEditParticipants(participants);

    // Build presenca map from existing relatorio_presenca
    const map: Record<string, boolean> = {};
    presenca.forEach(p => {
      if (p.participante_id) map[p.participante_id] = !!p.presente;
    });
    // For new participants not in presenca, default to false
    participants.forEach(p => {
      if (!(p.id in map)) map[p.id] = false;
    });
    setEditPresencaMap(map);
    setLoadingEditParticipants(false);
  };

  const handleTurmaToggle = async (turmaId: string) => {
    const newIds = selectedTurmaIds.includes(turmaId)
      ? selectedTurmaIds.filter(t => t !== turmaId)
      : [...selectedTurmaIds, turmaId];
    setSelectedTurmaIds(newIds);
    await loadParticipantsForTurmas(newIds);
  };

  const handlePresencaToggle = (participanteId: string) => {
    setEditPresencaMap(prev => ({ ...prev, [participanteId]: !prev[participanteId] }));
  };

  const handleSaveEdit = async () => {
    if (!id) return;
    setSavingEdit(true);
    try {
      // 0. Update main report fields
      const scoreElo = (editForm.iniciativa + editForm.autonomia + editForm.colaboracao + editForm.comunicacao + editForm.respeito_mutuo) / 5;
      const { error: updateErr } = await supabase.from("relatorios_atividade").update({
        nome_atividade: editForm.nome_atividade,
        data: editForm.data ? format(editForm.data, "yyyy-MM-dd") : item.data,
        dia_semana: editForm.dia_semana,
        educador_id: editForm.educador_id || null,
        tipo_atividade: editForm.tipo_atividade,
        tipo_atividade_detalhe: editForm.tipo_atividade_detalhe || null,
        iniciativa: editForm.iniciativa,
        autonomia: editForm.autonomia,
        colaboracao: editForm.colaboracao,
        comunicacao: editForm.comunicacao,
        respeito_mutuo: editForm.respeito_mutuo,
        score_elo: parseFloat(scoreElo.toFixed(2)),
        engajamento: editForm.engajamento,
        situacoes_relevantes: editForm.situacoes_relevantes,
        objetivo_alcancado: editForm.objetivo_alcancado || null,
        intervencoes: editForm.intervencoes || null,
        observacoes: editForm.observacoes || null,
      } as any).eq("id", id);
      if (updateErr) throw updateErr;

      // 1. Update relatorio_turmas: delete old, insert new
      await supabase.from("relatorio_turmas").delete().eq("relatorio_id", id);
      if (selectedTurmaIds.length > 0) {
        await supabase.from("relatorio_turmas").insert(
          selectedTurmaIds.map(turma_id => ({ relatorio_id: id, turma_id }))
        );
      }

      // 2. Update presença
      const nonAvulsoIds = presenca.filter(p => p.participante_id).map(p => p.id);
      if (nonAvulsoIds.length > 0) {
        await supabase.from("relatorio_presenca").delete().in("id", nonAvulsoIds);
      }
      const inserts = Object.entries(editPresencaMap).map(([participante_id, presente]) => ({
        relatorio_id: id,
        participante_id,
        presente,
      }));
      if (inserts.length > 0) {
        await supabase.from("relatorio_presenca").insert(inserts as any);
      }

      // 3. Recalc counters
      await recalcCounters();

      // 4. Refresh data
      const [{ data: updatedReport }, { data: newTurmaData }] = await Promise.all([
        supabase.from("relatorios_atividade")
          .select("*, relatorio_turmas(turma_id, turmas(nome)), profiles!relatorios_atividade_educador_id_fkey(nome)")
          .eq("id", id).single(),
        supabase.from("relatorio_turmas").select("turma_id, turmas(nome)").eq("relatorio_id", id),
      ]);
      if (updatedReport) setItem(updatedReport);
      const newNames = (newTurmaData || []).map((rt: any) => rt.turmas?.nome).filter(Boolean);
      setTurmaNames(newNames);
      setTurmaIds(selectedTurmaIds);

      await fetchPresenca();
      setEditMode(false);
      toast.success("Relatório atualizado com sucesso!");
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar edições");
    } finally {
      setSavingEdit(false);
    }
  };

  const generateInstagramPost = async () => {
    if (!item) return;
    setInstaLoading(true);
    setInstaOpen(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-instagram-post", {
        body: {
          relatorio: {
            nome_atividade: item.nome_atividade,
            data: item.data,
            turmas: turmaNames.join(", "),
            educador: item.profiles?.nome,
            tipo_atividade: item.tipo_atividade,
            num_participantes: item.num_participantes,
            observacoes: item.observacoes,
            intervencoes: item.intervencoes,
            engajamento: item.engajamento,
            situacoes_relevantes: item.situacoes_relevantes,
            objetivo_alcancado: item.objetivo_alcancado,
          },
        },
      });
      if (error) throw error;
      setInstaText(data.text || "Erro ao gerar texto.");
    } catch (e: any) {
      toast.error(e.message || "Erro ao gerar texto para Instagram");
      setInstaText("");
    } finally {
      setInstaLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(instaText);
    toast.success("Texto copiado!");
  };

  const shareWhatsApp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(instaText)}`, "_blank");
  };

  const downloadPhoto = async (url: string, idx: number) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `foto_relatorio_${idx + 1}.jpg`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      toast.error("Erro ao baixar foto");
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    setDeleting(true);
    try {
      await Promise.all([
        supabase.from("relatorio_presenca").delete().eq("relatorio_id", id),
        supabase.from("relatorio_fotos").delete().eq("relatorio_id", id),
        supabase.from("relatorio_turmas").delete().eq("relatorio_id", id),
      ]);
      const { error } = await supabase.from("relatorios_atividade").delete().eq("id", id);
      if (error) throw error;
      toast.success("Relatório excluído com sucesso");
      navigate("/relatorios");
    } catch (e: any) {
      toast.error(e.message || "Erro ao excluir relatório");
    } finally {
      setDeleting(false);
    }
  };


  if (!item) return <div className="text-sm text-muted-foreground py-8 text-center">Não encontrado</div>;

  return (
    <div className="space-y-4 max-w-3xl print:max-w-none">
      <div className="flex items-center justify-between print:hidden flex-wrap gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Button variant="ghost" size="icon" asChild><Link to="/relatorios"><ArrowLeft className="h-4 w-4" /></Link></Button>
          <h1 className="text-lg sm:text-xl font-semibold text-foreground truncate">{item.nome_atividade || "Relatório"}</h1>
        </div>
        <div className="flex gap-1 flex-wrap">
          {isCoordenacao && !editMode && (
            <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={enterEditMode}>
              <Pencil className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Editar</span>
            </Button>
          )}
          {isCoordenacao && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" className="gap-1 text-xs" disabled={deleting}>
                  <Trash2 className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Excluir</span>
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Excluir relatório?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta ação não pode ser desfeita. Todos os dados vinculados (presença, fotos, turmas) serão removidos.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Excluir
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          {fotos.length > 0 && (
            <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={generateInstagramPost}>
              <Instagram className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Gerar Post</span>
            </Button>
          )}
          <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={() => window.print()}>
            <Printer className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Imprimir</span>
          </Button>
          <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={async () => {
            try {
              toast.info("Gerando DOCX...");
              await exportRelatorioDocx(item, turmaNames, presenca, fotos);
              toast.success("DOCX gerado!");
            } catch (e) {
              console.error("Erro ao gerar DOCX:", e);
              toast.error("Erro ao gerar DOCX. Tente novamente.");
            }
          }}>
            <Download className="h-3.5 w-3.5" />Exportar DOCX
          </Button>
          <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={async () => {
            try {
              toast.info("Gerando PDF...");
              await exportRelatorioPdf(item, turmaNames, presenca);
              toast.success("PDF gerado!");
            } catch (e) {
              console.error("Erro ao gerar PDF:", e);
              toast.error("Erro ao gerar PDF. Tente novamente.");
            }
          }}>
            <FileText className="h-3.5 w-3.5" />Exportar PDF
          </Button>
        </div>
      </div>

      {/* EDIT MODE */}
      {editMode && (
        <Card className="border-primary/50 bg-primary/5">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2"><Pencil className="h-4 w-4" /> Modo Edição</CardTitle>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" className="text-xs" onClick={() => setEditMode(false)} disabled={savingEdit}>Cancelar</Button>
                <Button size="sm" className="text-xs gap-1" onClick={handleSaveEdit} disabled={savingEdit}>
                  <Check className="h-3.5 w-3.5" /> {savingEdit ? "Salvando..." : "Salvar"}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Info Geral */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Data</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal text-sm", !editForm.data && "text-muted-foreground")}>
                      {editForm.data ? format(editForm.data, "dd/MM/yyyy") : "Selecionar"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={editForm.data || undefined} onSelect={d => {
                      if (d) setEditForm(f => ({ ...f, data: d, dia_semana: DIAS_SEMANA_MAP[d.getDay()] }));
                    }} className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Dia da Semana</Label>
                <Input value={editForm.dia_semana} readOnly className="bg-muted/50 text-sm" />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Nome da Atividade</Label>
              <Input value={editForm.nome_atividade} onChange={e => setEditForm(f => ({ ...f, nome_atividade: e.target.value }))} />
            </div>

            {/* Educador combobox */}
            <div className="space-y-1">
              <Label className="text-xs">Educador</Label>
              <Popover open={educadorOpen} onOpenChange={setEducadorOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" aria-expanded={educadorOpen} className="w-full justify-between text-sm font-normal">
                    {editForm.educador_id ? allEducadores.find(e => e.id === editForm.educador_id)?.nome || "Selecionar" : "Selecionar educador..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Buscar educador..." />
                    <CommandList>
                      <CommandEmpty>Nenhum educador encontrado.</CommandEmpty>
                      <CommandGroup>
                        {allEducadores.map(e => (
                          <CommandItem key={e.id} value={e.nome} onSelect={() => { setEditForm(f => ({ ...f, educador_id: e.id })); setEducadorOpen(false); }}>
                            <Check className={cn("mr-2 h-4 w-4", editForm.educador_id === e.id ? "opacity-100" : "opacity-0")} />
                            {e.nome}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Tipo de Atividade */}
            <div className="space-y-1">
              <Label className="text-xs">Tipo de Atividade</Label>
              <div className="grid grid-cols-2 gap-2">
                {TIPOS_ATIVIDADE.map(ta => (
                  <label key={ta.value} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox checked={editForm.tipo_atividade.includes(ta.value)} onCheckedChange={() => setEditForm(f => ({
                      ...f, tipo_atividade: f.tipo_atividade.includes(ta.value)
                        ? f.tipo_atividade.filter(v => v !== ta.value)
                        : [...f.tipo_atividade, ta.value]
                    }))} />
                    {ta.label}
                  </label>
                ))}
              </div>
              {editNeedsDetail && (
                <Input value={editForm.tipo_atividade_detalhe} onChange={e => setEditForm(f => ({ ...f, tipo_atividade_detalhe: e.target.value }))} placeholder="Especifique" className="mt-2 text-sm" />
              )}
            </div>

            {/* Competências */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium">Competências (Likert 1-5)</Label>
                <span className="text-sm font-semibold text-primary">ELO: {editScoreElo}</span>
              </div>
              <LikertFieldEdit label="Iniciativa" value={editForm.iniciativa} onChange={v => setEditForm(f => ({ ...f, iniciativa: v }))} />
              <LikertFieldEdit label="Autonomia" value={editForm.autonomia} onChange={v => setEditForm(f => ({ ...f, autonomia: v }))} />
              <LikertFieldEdit label="Colaboração" value={editForm.colaboracao} onChange={v => setEditForm(f => ({ ...f, colaboracao: v }))} />
              <LikertFieldEdit label="Comunicação" value={editForm.comunicacao} onChange={v => setEditForm(f => ({ ...f, comunicacao: v }))} />
              <LikertFieldEdit label="Respeito Mútuo" value={editForm.respeito_mutuo} onChange={v => setEditForm(f => ({ ...f, respeito_mutuo: v }))} />
            </div>

            {/* Engajamento */}
            <div className="space-y-1">
              <Label className="text-xs">Engajamento</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                {ENGAJAMENTO_OPT.map(opt => (
                  <label key={opt} className="flex items-center gap-2 text-xs cursor-pointer">
                    <Checkbox checked={editForm.engajamento.includes(opt)} onCheckedChange={() => setEditForm(f => ({
                      ...f, engajamento: f.engajamento.includes(opt) ? f.engajamento.filter(v => v !== opt) : [...f.engajamento, opt]
                    }))} />
                    {opt}
                  </label>
                ))}
              </div>
            </div>

            {/* Situações Relevantes */}
            <div className="space-y-1">
              <Label className="text-xs">Situações Relevantes</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                {SITUACOES_OPT.map(opt => (
                  <label key={opt} className="flex items-center gap-2 text-xs cursor-pointer">
                    <Checkbox checked={editForm.situacoes_relevantes.includes(opt)} onCheckedChange={() => setEditForm(f => ({
                      ...f, situacoes_relevantes: f.situacoes_relevantes.includes(opt) ? f.situacoes_relevantes.filter(v => v !== opt) : [...f.situacoes_relevantes, opt]
                    }))} />
                    {opt}
                  </label>
                ))}
              </div>
            </div>

            {/* Objetivo */}
            <div className="space-y-1">
              <Label className="text-xs">Objetivo Alcançado</Label>
              <Select value={editForm.objetivo_alcancado} onValueChange={v => setEditForm(f => ({ ...f, objetivo_alcancado: v }))}>
                <SelectTrigger className="text-sm"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="alcancado">Alcançado</SelectItem>
                  <SelectItem value="parcial">Parcial</SelectItem>
                  <SelectItem value="nao_alcancado">Não Alcançado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Intervenções e Observações */}
            <div className="space-y-1">
              <Label className="text-xs">Atividades Realizadas</Label>
              <Textarea value={editForm.intervencoes} onChange={e => setEditForm(f => ({ ...f, intervencoes: e.target.value }))} rows={2} className="text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Observações</Label>
              <Textarea value={editForm.observacoes} onChange={e => setEditForm(f => ({ ...f, observacoes: e.target.value }))} rows={2} className="text-sm" />
            </div>

            {/* Turma Selection */}
            <div>
              <h3 className="text-sm font-medium text-foreground mb-2 flex items-center gap-1.5"><Users className="h-3.5 w-3.5" /> Turmas vinculadas</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-40 overflow-y-auto border rounded-md p-2">
                {allTurmas.map(t => (
                  <label key={t.id} className="flex items-center gap-2 text-sm py-1 px-1 rounded hover:bg-accent/50 cursor-pointer">
                    <Checkbox checked={selectedTurmaIds.includes(t.id)} onCheckedChange={() => handleTurmaToggle(t.id)} />
                    <span className="truncate">{t.nome}</span>
                  </label>
                ))}
              </div>
              {selectedTurmaIds.length === 0 && <p className="text-xs text-muted-foreground mt-1">Selecione ao menos uma turma</p>}
            </div>

            {/* Participant Attendance */}
            <div>
              <h3 className="text-sm font-medium text-foreground mb-2">Presença dos participantes ({editParticipants.length})</h3>
              {loadingEditParticipants ? (
                <div className="flex items-center justify-center py-4">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  <span className="ml-2 text-xs text-muted-foreground">Carregando...</span>
                </div>
              ) : editParticipants.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">Nenhum participante nas turmas selecionadas</p>
              ) : (
                <>
                  <div className="flex gap-2 mb-2">
                    <Button variant="outline" size="sm" className="text-[10px] h-6" onClick={() => {
                      const all: Record<string, boolean> = {};
                      editParticipants.forEach(p => all[p.id] = true);
                      setEditPresencaMap(prev => ({ ...prev, ...all }));
                    }}>Marcar todos</Button>
                    <Button variant="outline" size="sm" className="text-[10px] h-6" onClick={() => {
                      const all: Record<string, boolean> = {};
                      editParticipants.forEach(p => all[p.id] = false);
                      setEditPresencaMap(prev => ({ ...prev, ...all }));
                    }}>Desmarcar todos</Button>
                  </div>
                  <div className="space-y-0.5 max-h-60 overflow-y-auto border rounded-md p-2">
                    {editParticipants.map(p => (
                      <label key={p.id} className="flex items-center justify-between gap-2 text-sm py-1 px-1 rounded hover:bg-accent/50 cursor-pointer">
                        <div className="flex items-center gap-2 min-w-0">
                          <Checkbox checked={!!editPresencaMap[p.id]} onCheckedChange={() => handlePresencaToggle(p.id)} />
                          <span className="truncate text-xs sm:text-sm">{p.nome_completo}</span>
                        </div>
                        <Badge variant={editPresencaMap[p.id] ? "default" : "secondary"} className="text-[9px] shrink-0">
                          {editPresencaMap[p.id] ? "Presente" : "Ausente"}
                        </Badge>
                      </label>
                    ))}
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-2 flex-wrap text-xs text-muted-foreground">
        <span>📅 {format(new Date(item.data + "T12:00:00"), "dd/MM/yyyy")}</span>
        {item.dia_semana && <span>({item.dia_semana})</span>}
        {(item as any).periodo_atividade && (
          <Badge variant="outline" className="text-[10px]">
            {(item as any).periodo_atividade === "manha" ? "Manhã" : (item as any).periodo_atividade === "tarde" ? "Tarde" : "Integral"}
          </Badge>
        )}
        {item.dia_semana && <span>({item.dia_semana})</span>}
        {item.profiles?.nome && <span>👤 {item.profiles.nome}</span>}
        {Array.isArray(item.tipo_atividade) && item.tipo_atividade.length > 0 ? (
          item.tipo_atividade.map((v: string) => {
            const tipos = [
              { value: "momento_educando", label: "Momento Educando" },
              { value: "evento", label: "Evento ou Data Comemorativa" },
              { value: "socioeducativa_idosos", label: "Atividade Socioeducativa (Idosos)" },
              { value: "colonia_ferias", label: "Colônia de Férias" },
              { value: "arte_cultura", label: "Oficina de Arte e Cultura" },
              { value: "futebol_esportes", label: "Oficina de Futebol/Esportes" },
              { value: "karate", label: "Oficina de Karatê" },
              { value: "outra_oficina", label: "Outra Oficina" },
            ];
            const found = tipos.find(t => t.value === v);
            let label = found?.label || v;
            if ((v === "evento" || v === "outra_oficina") && item.tipo_atividade_detalhe) label += `: ${item.tipo_atividade_detalhe}`;
            return <Badge key={v} variant="outline" className="text-[10px]">{label}</Badge>;
          })
        ) : item.tipo_atividade && typeof item.tipo_atividade === "string" ? (
          <span>📋 {item.tipo_atividade}</span>
        ) : null}
        {turmaNames.map(n => <Badge key={n} variant="secondary" className="text-[10px]">{n}</Badge>)}
        {planejamentoLink && (
          <Link to={`/planejamentos/${planejamentoLink.id}`} className="text-primary hover:underline text-xs">
            📋 {planejamentoLink.titulo}
          </Link>
        )}
      </div>

      {/* Score ELO */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Competências</CardTitle>
            <span className="text-lg font-bold text-primary">ELO: {item.score_elo?.toFixed(2) || "—"}</span>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <LikertDisplay label="Iniciativa" value={item.iniciativa} />
          <LikertDisplay label="Autonomia" value={item.autonomia} />
          <LikertDisplay label="Colaboração" value={item.colaboracao} />
          <LikertDisplay label="Comunicação" value={item.comunicacao} />
          <LikertDisplay label="Respeito Mútuo" value={item.respeito_mutuo} />
        </CardContent>
      </Card>

      {/* Resumo */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Resumo</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div><div className="text-lg font-bold text-foreground">{item.num_participantes ?? 0}</div><div className="text-xs text-muted-foreground">Presentes</div></div>
            <div><div className="text-lg font-bold text-foreground">{item.num_ausentes ?? 0}</div><div className="text-xs text-muted-foreground">Ausentes</div></div>
            <div><div className="text-lg font-bold text-foreground">{item.pct_adesao?.toFixed(0) ?? 0}%</div><div className="text-xs text-muted-foreground">Adesão</div></div>
          </div>
          {item.objetivo_alcancado && (
            <div className="flex items-center gap-2"><span className="text-muted-foreground">Objetivo:</span><Badge variant={item.objetivo_alcancado === "alcancado" ? "default" : item.objetivo_alcancado === "parcial" ? "secondary" : "destructive"}>{OBJ_LABELS[item.objetivo_alcancado]}</Badge></div>
          )}
          {item.engajamento?.length > 0 && (
            <div><span className="text-xs text-muted-foreground">Engajamento:</span><div className="flex gap-1 flex-wrap mt-1">{item.engajamento.map((e: string) => <Badge key={e} variant="outline" className="text-xs">{e}</Badge>)}</div></div>
          )}
          {item.situacoes_relevantes?.length > 0 && (
            <div><span className="text-xs text-muted-foreground">Situações:</span><div className="flex gap-1 flex-wrap mt-1">{item.situacoes_relevantes.map((s: string) => <Badge key={s} variant="outline" className="text-xs">{s}</Badge>)}</div></div>
          )}
          {item.intervencoes && <div><span className="text-xs text-muted-foreground">Atividades Realizadas:</span><p className="whitespace-pre-wrap">{item.intervencoes}</p></div>}
          {item.observacoes && <div><span className="text-xs text-muted-foreground">Observações:</span><p className="whitespace-pre-wrap">{item.observacoes}</p></div>}
        </CardContent>
      </Card>

      {/* Relatos Equipe Técnica */}
      <RelatosEquipeTecnica relatorioId={id!} isCoordenacao={isCoordenacao} />

      {/* Resultados Alcançados (IA) */}
      {item.analise_ia && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Resultados Alcançados</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-foreground">{item.analise_ia}</p>
          </CardContent>
        </Card>
      )}

      {/* Presença */}
      {!editMode && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Presença ({presenca.length})</CardTitle>
              <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => { setAddOpen(true); setAddTab("buscar"); setSearchQuery(""); setNomeAvulso(""); }}>
                <Plus className="h-3.5 w-3.5" /> Adicionar
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {presenca.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum participante registrado</p>
            ) : (
              <div className="space-y-1 max-h-60 overflow-y-auto print:max-h-none">
                {presenca.map((p: any) => {
                  const nome = p.participantes?.nome_completo || p.nome_avulso || "—";
                  const isAvulso = !p.participante_id && p.nome_avulso;
                  return (
                    <div key={p.id} className="flex items-center justify-between text-sm py-1 border-b border-border/50 last:border-0 gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-xs sm:text-sm truncate">{nome}</span>
                        {isAvulso && <Badge variant="outline" className="text-[9px] shrink-0 border-amber-500 text-amber-600">Avulso</Badge>}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {isAvulso && (
                          <Button variant="ghost" size="sm" className="h-6 px-1.5 text-[10px] gap-0.5 text-primary" onClick={() => { setLinkTarget(p); setLinkSearch(""); setLinkResults([]); }}>
                            <Link2 className="h-3 w-3" /> Vincular
                          </Button>
                        )}
                        <Badge variant={p.presente ? "default" : "secondary"} className="text-[10px]">{p.presente ? "Presente" : "Ausente"}</Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Fotos */}
      {fotos.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Fotos ({fotos.length})</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {fotos.map((f: any, i: number) => (
                <img
                  key={f.id}
                  src={f.foto_url}
                  alt={`Foto ${i + 1}`}
                  className="rounded border w-full h-40 sm:h-32 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                  onClick={() => setLightboxIdx(i)}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lightbox */}
      {lightboxIdx !== null && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center" onClick={() => setLightboxIdx(null)}>
          <button className="absolute top-4 right-4 text-white" onClick={() => setLightboxIdx(null)}>
            <X className="h-6 w-6" />
          </button>
          <div className="flex items-center gap-4 max-w-[90vw] max-h-[90vh]" onClick={e => e.stopPropagation()}>
            {lightboxIdx > 0 && (
              <button className="text-white text-3xl px-2" onClick={() => setLightboxIdx(lightboxIdx - 1)}>‹</button>
            )}
            <img src={fotos[lightboxIdx].foto_url} alt="" className="max-w-[80vw] max-h-[85vh] object-contain rounded" />
            {lightboxIdx < fotos.length - 1 && (
              <button className="text-white text-3xl px-2" onClick={() => setLightboxIdx(lightboxIdx + 1)}>›</button>
            )}
          </div>
          <button className="absolute bottom-4 text-white flex items-center gap-1 text-sm bg-white/20 rounded px-3 py-1.5" onClick={() => downloadPhoto(fotos[lightboxIdx].foto_url, lightboxIdx)}>
            <Download className="h-4 w-4" /> Baixar
          </button>
        </div>
      )}

      {/* Add Participant Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="text-base">Adicionar Participante</DialogTitle></DialogHeader>
          <Tabs value={addTab} onValueChange={setAddTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="buscar" className="text-xs gap-1"><Search className="h-3 w-3" /> Buscar no cadastro</TabsTrigger>
              <TabsTrigger value="avulso" className="text-xs gap-1"><Plus className="h-3 w-3" /> Nome avulso</TabsTrigger>
            </TabsList>
            <TabsContent value="buscar" className="space-y-3 mt-3">
              <Input placeholder="Buscar por nome..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} autoFocus />
              {searchResults.length > 0 && (
                <div className="border rounded-md max-h-48 overflow-y-auto">
                  {searchResults.map(p => (
                    <button key={p.id} className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors flex items-center justify-between border-b last:border-0" disabled={adding} onClick={() => handleAddFromCadastro(p.id)}>
                      <span>{p.nome_completo}</span>
                      <Badge variant={p.status === "ativo" ? "default" : "secondary"} className="text-[9px]">{p.status}</Badge>
                    </button>
                  ))}
                </div>
              )}
              {searchQuery.length >= 2 && searchResults.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-2">Nenhum participante encontrado</p>
              )}
            </TabsContent>
            <TabsContent value="avulso" className="space-y-3 mt-3">
              <Input placeholder="Nome completo..." value={nomeAvulso} onChange={e => setNomeAvulso(e.target.value)} autoFocus />
              <p className="text-xs text-muted-foreground">O nome será adicionado como avulso. Você poderá vincular a um cadastro depois.</p>
              <Button size="sm" className="w-full" disabled={!nomeAvulso.trim() || adding} onClick={handleAddAvulso}>
                {adding ? "Adicionando..." : "Adicionar Nome Avulso"}
              </Button>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Link Avulso Dialog */}
      <Dialog open={!!linkTarget} onOpenChange={open => { if (!open) setLinkTarget(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="text-base">Vincular "{linkTarget?.nome_avulso}" ao cadastro</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Buscar participante cadastrado..." value={linkSearch} onChange={e => setLinkSearch(e.target.value)} autoFocus />
            {linkResults.length > 0 && (
              <div className="border rounded-md max-h-48 overflow-y-auto">
                {linkResults.map(p => (
                  <button key={p.id} className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors flex items-center justify-between border-b last:border-0" disabled={linking} onClick={() => handleLinkAvulso(p.id)}>
                    <span>{p.nome_completo}</span>
                    <Badge variant={p.status === "ativo" ? "default" : "secondary"} className="text-[9px]">{p.status}</Badge>
                  </button>
                ))}
              </div>
            )}
            {linkSearch.length >= 2 && linkResults.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-2">Nenhum participante encontrado</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Instagram Post Dialog */}
      <Dialog open={instaOpen} onOpenChange={setInstaOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="text-base flex items-center gap-2"><Instagram className="h-4 w-4" /> Publicação Instagram</DialogTitle></DialogHeader>
          {instaLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <span className="ml-2 text-sm text-muted-foreground">Gerando texto...</span>
            </div>
          ) : (
            <div className="space-y-3">
              <Textarea
                value={instaText}
                onChange={e => setInstaText(e.target.value)}
                rows={10}
                className="text-sm"
                placeholder="Texto da publicação..."
              />
              <div className="flex gap-2 flex-wrap">
                <Button size="sm" variant="outline" onClick={copyToClipboard} className="gap-1 text-xs">
                  <Copy className="h-3.5 w-3.5" /> Copiar Texto
                </Button>
                <Button size="sm" variant="outline" onClick={shareWhatsApp} className="gap-1 text-xs">
                  <Share2 className="h-3.5 w-3.5" /> WhatsApp
                </Button>
              </div>
              {fotos.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Fotos do relatório — baixe e envie junto com o texto:</p>
                  <div className="grid grid-cols-3 gap-2">
                    {fotos.map((f: any, i: number) => (
                      <div key={f.id} className="relative group">
                        <img src={f.foto_url} alt="" className="rounded border w-full h-20 object-cover" />
                        <button
                          className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded"
                          onClick={() => downloadPhoto(f.foto_url, i)}
                        >
                          <Download className="h-4 w-4 text-white" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RelatorioDetalhePage;
