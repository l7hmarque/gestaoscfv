import { useEffect, useState, useCallback } from "react";
import { ArrowLeft, Printer, Instagram, Copy, Share2, Download, X, Trash2, Plus, Search, Link2, Pencil, Check, Users } from "lucide-react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { exportRelatorioDocx, exportRelatorioPdf } from "@/hooks/useDocumentExport";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

const LIKERT_LABELS = ["", "Muito Baixo", "Baixo", "Moderado", "Alto", "Excepcional"];
const OBJ_LABELS: Record<string, string> = { alcancado: "Alcançado", parcial: "Parcial", nao_alcancado: "Não Alcançado" };

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
    // Load all turmas for selection
    const { data: turmas } = await supabase.from("turmas").select("id, nome, ativa").eq("ativa", true).order("nome");
    setAllTurmas(turmas || []);
    setSelectedTurmaIds([...turmaIds]);
    setEditMode(true);
    // Load participants for current turmas
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
    const { data: tp } = await supabase.from("turma_participantes").select("participante_id, participantes(id, nome_completo, status)").in("turma_id", tIds);
    // Deduplicate
    const uniqueMap = new Map<string, any>();
    (tp || []).forEach((row: any) => {
      if (row.participantes && !uniqueMap.has(row.participantes.id)) {
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
      // 1. Update relatorio_turmas: delete old, insert new
      await supabase.from("relatorio_turmas").delete().eq("relatorio_id", id);
      if (selectedTurmaIds.length > 0) {
        await supabase.from("relatorio_turmas").insert(
          selectedTurmaIds.map(turma_id => ({ relatorio_id: id, turma_id }))
        );
      }

      // 2. Update presença: upsert for all participants in editPresencaMap
      // Keep existing avulso entries untouched
      const existingAvulsos = presenca.filter(p => !p.participante_id && p.nome_avulso);
      
      // Delete only non-avulso presença entries
      const nonAvulsoIds = presenca.filter(p => p.participante_id).map(p => p.id);
      if (nonAvulsoIds.length > 0) {
        await supabase.from("relatorio_presenca").delete().in("id", nonAvulsoIds);
      }

      // Insert new presença entries for all participants in the map
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

      // 4. Refresh turma names
      const { data: newTurmaData } = await supabase.from("relatorio_turmas").select("turma_id, turmas(nome)").eq("relatorio_id", id);
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
            toast.info("Gerando DOCX + PDF...");
            await Promise.all([
              exportRelatorioDocx(item, turmaNames, presenca, fotos),
              exportRelatorioPdf(item, turmaNames, presenca).catch(() => {}),
            ]);
            toast.success("Downloads concluídos!");
          }}>
            <Download className="h-3.5 w-3.5" />Exportar Tudo
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
            {/* Turma Selection */}
            <div>
              <h3 className="text-sm font-medium text-foreground mb-2 flex items-center gap-1.5"><Users className="h-3.5 w-3.5" /> Turmas vinculadas</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-40 overflow-y-auto border rounded-md p-2">
                {allTurmas.map(t => (
                  <label key={t.id} className="flex items-center gap-2 text-sm py-1 px-1 rounded hover:bg-accent/50 cursor-pointer">
                    <Checkbox
                      checked={selectedTurmaIds.includes(t.id)}
                      onCheckedChange={() => handleTurmaToggle(t.id)}
                    />
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
                          <Checkbox
                            checked={!!editPresencaMap[p.id]}
                            onCheckedChange={() => handlePresencaToggle(p.id)}
                          />
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
          {item.intervencoes && <div><span className="text-xs text-muted-foreground">Intervenções:</span><p className="whitespace-pre-wrap">{item.intervencoes}</p></div>}
          {item.observacoes && <div><span className="text-xs text-muted-foreground">Observações:</span><p className="whitespace-pre-wrap">{item.observacoes}</p></div>}
        </CardContent>
      </Card>

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
