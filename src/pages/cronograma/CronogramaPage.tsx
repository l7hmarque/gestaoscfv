import React, { useState, useEffect, useCallback, DragEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Plus, Trash2, AlertTriangle, Copy, Settings2, X, FileText, Sparkles, GripVertical, User, Music, Users } from "lucide-react";
import { isBairroSCFV } from "@/lib/constants";

const DIAS = ["Seg", "Ter", "Qua", "Qui", "Sex"] as const;
const PERIODOS = ["manha", "tarde"] as const;
const PERIODO_LABELS: Record<string, string> = { manha: "Manhã", tarde: "Tarde" };

const BAIRRO_COLORS: Record<string, { border: string; bg: string; header: string }> = {
  "JARDIM IRENE": { border: "border-blue-400", bg: "bg-blue-50", header: "bg-blue-100 text-blue-900" },
  "ALVORADA": { border: "border-green-400", bg: "bg-green-50", header: "bg-green-100 text-green-900" },
  "PARQUE INDEPENDENCIA": { border: "border-orange-400", bg: "bg-orange-50", header: "bg-orange-100 text-orange-900" },
};

const RESOURCE_COLORS = {
  educador: { bg: "bg-blue-100", text: "text-blue-800", drag: "bg-blue-200 border-blue-400" },
  oficineiro: { bg: "bg-purple-100", text: "text-purple-800", drag: "bg-purple-200 border-purple-400" },
  turma: { bg: "bg-emerald-100", text: "text-emerald-800", drag: "bg-emerald-200 border-emerald-400" },
};

interface Slot {
  id: string;
  cenario_id: string;
  dia_semana: string;
  periodo: string;
  bairro_id: string | null;
  educador_id: string | null;
  oficineiro_id: string | null;
  tipo_atividade: string | null;
  turma_id: string | null;
  notas: string | null;
}

interface Cenario { id: string; nome: string; ativo: boolean; }
interface Disponibilidade { id: string; profile_id: string; dia_semana: string; periodo: string; disponivel: boolean; }

type DragPayload = {
  type: "educador" | "oficineiro" | "turma";
  id: string;
  nome: string;
};

export default function CronogramaPage() {
  const { user } = useAuth();
  const [cenarios, setCenarios] = useState<Cenario[]>([]);
  const [activeCenarioId, setActiveCenarioId] = useState<string | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [bairros, setBairros] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [turmas, setTurmas] = useState<any[]>([]);
  const [disponibilidades, setDisponibilidades] = useState<Disponibilidade[]>([]);
  const [loading, setLoading] = useState(true);
  const [newCenarioName, setNewCenarioName] = useState("");
  const [newCenarioOpen, setNewCenarioOpen] = useState(false);
  const [conflicts, setConflicts] = useState<string[]>([]);
  const [dragOverCell, setDragOverCell] = useState<string | null>(null);
  const [configOpen, setConfigOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportContent, setReportContent] = useState("");
  const [reportLoading, setReportLoading] = useState(false);

  const scfvBairros = bairros.filter(b => isBairroSCFV(b.nome));

  const educadores = profiles.filter(p => {
    const cargo = (p.cargo || "").toLowerCase();
    return cargo.includes("educador") || cargo.includes("referência") || cargo.includes("referencia");
  });
  const oficineiros = profiles.filter(p => {
    const cargo = (p.cargo || "").toLowerCase();
    return cargo.includes("oficineiro") || cargo.includes("instrutor") || cargo.includes("karate") || cargo.includes("karatê") || cargo.includes("música") || cargo.includes("musica") || cargo.includes("arte") || cargo.includes("futebol") || cargo.includes("esporte");
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    const [{ data: cen }, { data: b }, { data: p }, { data: t }, { data: d }] = await Promise.all([
      supabase.from("cronograma_cenarios").select("*").order("created_at", { ascending: false }),
      supabase.from("bairros").select("*").order("nome"),
      supabase.from("profiles").select("id, nome, cargo, ativo").eq("ativo", true).order("nome"),
      supabase.from("turmas").select("id, nome, educador_id, dias_semana, periodo, oficina, bairro_ids, ativa").eq("ativa", true).order("nome"),
      supabase.from("cronograma_disponibilidade").select("*"),
    ]);
    setCenarios(cen || []);
    setBairros(b || []);
    setProfiles(p || []);
    setTurmas(t || []);
    setDisponibilidades((d || []) as Disponibilidade[]);
    if (cen && cen.length > 0 && !activeCenarioId) {
      setActiveCenarioId(cen[0].id);
    }
    setLoading(false);
  }, [activeCenarioId]);

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    if (!activeCenarioId) return;
    supabase.from("cronograma_slots").select("*").eq("cenario_id", activeCenarioId).then(({ data }) => {
      setSlots(data || []);
    });
  }, [activeCenarioId]);

  // Conflict detection
  useEffect(() => {
    const c: string[] = [];
    const checkDoubleBooking = (key: "educador_id" | "oficineiro_id", label: string) => {
      const map = new Map<string, { dia: string; periodo: string; bairro: string }[]>();
      slots.forEach(s => {
        const id = s[key];
        if (!id) return;
        if (!map.has(id)) map.set(id, []);
        map.get(id)!.push({ dia: s.dia_semana, periodo: s.periodo, bairro: s.bairro_id || "" });
      });
      map.forEach((entries, profId) => {
        const seen = new Map<string, string>();
        entries.forEach(e => {
          const timeKey = `${e.dia}-${e.periodo}`;
          if (seen.has(timeKey) && seen.get(timeKey) !== e.bairro) {
            const prof = profiles.find(p => p.id === profId);
            c.push(`${prof?.nome || label} em 2 locais: ${e.dia} ${PERIODO_LABELS[e.periodo]}`);
          }
          seen.set(timeKey, e.bairro);
        });
      });
    };
    checkDoubleBooking("educador_id", "Educador");
    checkDoubleBooking("oficineiro_id", "Oficineiro");

    // Check availability violations
    slots.forEach(s => {
      ["educador_id", "oficineiro_id"].forEach(key => {
        const profId = s[key as keyof Slot] as string | null;
        if (!profId) return;
        const disp = disponibilidades.find(d => d.profile_id === profId && d.dia_semana === s.dia_semana && d.periodo === s.periodo);
        if (disp && !disp.disponivel) {
          const prof = profiles.find(p => p.id === profId);
          c.push(`⚠ ${prof?.nome || "Profissional"} indisponível: ${s.dia_semana} ${PERIODO_LABELS[s.periodo]}`);
        }
      });
    });

    // Min days per bairro
    scfvBairros.forEach(b => {
      const bSlots = slots.filter(s => s.bairro_id === b.id);
      const days = new Set(bSlots.map(s => s.dia_semana));
      if (days.size > 0 && days.size < 2) {
        c.push(`${b.nome}: apenas ${days.size} dia(s) de atendimento`);
      }
    });
    setConflicts(c);
  }, [slots, profiles, scfvBairros, disponibilidades]);

  const getSlot = (dia: string, periodo: string, bairroId: string) =>
    slots.find(s => s.dia_semana === dia && s.periodo === periodo && s.bairro_id === bairroId);

  const countSlots = (type: "educador" | "oficineiro" | "turma", id: string) => {
    return slots.filter(s => {
      if (type === "educador") return s.educador_id === id;
      if (type === "oficineiro") return s.oficineiro_id === id;
      return s.turma_id === id;
    }).length;
  };

  // Drag & Drop
  const handleDragStart = (e: DragEvent, payload: DragPayload) => {
    e.dataTransfer.setData("application/json", JSON.stringify(payload));
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: DragEvent, cellKey: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverCell(cellKey);
  };

  const handleDragLeave = () => setDragOverCell(null);

  const handleDrop = async (e: DragEvent, dia: string, periodo: string, bairroId: string) => {
    e.preventDefault();
    setDragOverCell(null);
    if (!activeCenarioId) return;

    let payload: DragPayload;
    try {
      payload = JSON.parse(e.dataTransfer.getData("application/json"));
    } catch { return; }

    const existing = getSlot(dia, periodo, bairroId);
    const updateData: Partial<Slot> = {};

    if (payload.type === "educador") updateData.educador_id = payload.id;
    else if (payload.type === "oficineiro") updateData.oficineiro_id = payload.id;
    else if (payload.type === "turma") updateData.turma_id = payload.id;

    if (existing) {
      // Optimistic update
      setSlots(prev => prev.map(s => s.id === existing.id ? { ...s, ...updateData } : s));
      const { error } = await supabase.from("cronograma_slots").update(updateData as any).eq("id", existing.id);
      if (error) {
        toast.error(error.message);
        // revert
        supabase.from("cronograma_slots").select("*").eq("cenario_id", activeCenarioId).then(({ data }) => setSlots(data || []));
      }
    } else {
      const newSlot = {
        cenario_id: activeCenarioId,
        dia_semana: dia,
        periodo,
        bairro_id: bairroId,
        ...updateData,
      };
      const { data, error } = await supabase.from("cronograma_slots").insert(newSlot).select("*").single();
      if (error || !data) { toast.error(error?.message || "Erro"); return; }
      setSlots(prev => [...prev, data]);
    }
    toast.success("Slot atualizado!");
  };

  const removeFromSlot = async (slotId: string, field: "educador_id" | "oficineiro_id" | "turma_id") => {
    const slot = slots.find(s => s.id === slotId);
    if (!slot) return;
    const updated = { ...slot, [field]: null };
    // If all fields empty, delete slot
    if (!updated.educador_id && !updated.oficineiro_id && !updated.turma_id && !updated.tipo_atividade) {
      await supabase.from("cronograma_slots").delete().eq("id", slotId);
      setSlots(prev => prev.filter(s => s.id !== slotId));
    } else {
      setSlots(prev => prev.map(s => s.id === slotId ? updated : s));
      await supabase.from("cronograma_slots").update({ [field]: null } as any).eq("id", slotId);
    }
  };

  // Cenario CRUD
  const createCenario = async () => {
    if (!newCenarioName.trim()) return;
    const { data, error } = await supabase.from("cronograma_cenarios").insert({ nome: newCenarioName.trim() }).select("*").single();
    if (error) { toast.error(error.message); return; }
    setCenarios(prev => [data, ...prev]);
    setActiveCenarioId(data.id);
    setNewCenarioName("");
    setNewCenarioOpen(false);
    toast.success("Cenário criado!");
  };

  const duplicateCenario = async () => {
    if (!activeCenarioId) return;
    const current = cenarios.find(c => c.id === activeCenarioId);
    const { data: newCen, error } = await supabase.from("cronograma_cenarios")
      .insert({ nome: `${current?.nome || "Cenário"} (cópia)` }).select("*").single();
    if (error || !newCen) { toast.error("Erro ao duplicar"); return; }
    const newSlots = slots.map(s => ({
      cenario_id: newCen.id, dia_semana: s.dia_semana, periodo: s.periodo,
      bairro_id: s.bairro_id, educador_id: s.educador_id, oficineiro_id: s.oficineiro_id,
      tipo_atividade: s.tipo_atividade, turma_id: s.turma_id, notas: s.notas,
    }));
    if (newSlots.length > 0) await supabase.from("cronograma_slots").insert(newSlots);
    setCenarios(prev => [newCen, ...prev]);
    setActiveCenarioId(newCen.id);
    toast.success("Cenário duplicado!");
  };

  const deleteCenario = async () => {
    if (!activeCenarioId || !confirm("Excluir este cenário?")) return;
    await supabase.from("cronograma_cenarios").delete().eq("id", activeCenarioId);
    setCenarios(prev => prev.filter(c => c.id !== activeCenarioId));
    setActiveCenarioId(cenarios.find(c => c.id !== activeCenarioId)?.id || null);
    setSlots([]);
    toast.success("Cenário excluído");
  };

  // Disponibilidade management
  const toggleDisponibilidade = async (profileId: string, dia: string, periodo: string) => {
    const existing = disponibilidades.find(d => d.profile_id === profileId && d.dia_semana === dia && d.periodo === periodo);
    if (existing) {
      const newVal = !existing.disponivel;
      setDisponibilidades(prev => prev.map(d => d.id === existing.id ? { ...d, disponivel: newVal } : d));
      await supabase.from("cronograma_disponibilidade").update({ disponivel: newVal } as any).eq("id", existing.id);
    } else {
      const { data } = await supabase.from("cronograma_disponibilidade")
        .insert({ profile_id: profileId, dia_semana: dia, periodo, disponivel: true } as any)
        .select("*").single();
      if (data) setDisponibilidades(prev => [...prev, data as Disponibilidade]);
    }
  };

  const isDisponivel = (profileId: string, dia: string, periodo: string) => {
    const d = disponibilidades.find(x => x.profile_id === profileId && x.dia_semana === dia && x.periodo === periodo);
    return d ? d.disponivel : false;
  };

  // AI report/generation
  const generateReport = async (mode: "report" | "generate") => {
    setReportLoading(true);
    setReportOpen(true);
    setReportContent("Gerando...");
    try {
      const { data, error } = await supabase.functions.invoke("generate-cronograma-report", {
        body: {
          mode,
          slots: slots.map(s => ({
            dia_semana: s.dia_semana, periodo: s.periodo,
            bairro: scfvBairros.find(b => b.id === s.bairro_id)?.nome,
            educador: profiles.find(p => p.id === s.educador_id)?.nome,
            oficineiro: profiles.find(p => p.id === s.oficineiro_id)?.nome,
            turma: turmas.find(t => t.id === s.turma_id)?.nome,
            tipo_atividade: s.tipo_atividade,
          })),
          bairros: scfvBairros.map(b => b.nome),
          profiles: [...educadores, ...oficineiros].map(p => ({ nome: p.nome, cargo: p.cargo })),
          turmas: turmas.map(t => ({ nome: t.nome, periodo: t.periodo, oficina: t.oficina })),
          disponibilidade: disponibilidades.filter(d => d.disponivel).map(d => ({
            profissional: profiles.find(p => p.id === d.profile_id)?.nome,
            dia: d.dia_semana, periodo: d.periodo,
          })),
        },
      });
      if (error) throw error;
      const result = data as any;
      if (result.error) throw new Error(result.error);
      setReportContent(result.content || "Sem conteúdo retornado.");
    } catch (e: any) {
      setReportContent(`Erro: ${e.message}`);
      toast.error(e.message);
    } finally {
      setReportLoading(false);
    }
  };

  const profName = (id: string | null) => profiles.find(p => p.id === id)?.nome || "";

  if (loading) return <div className="p-6 text-muted-foreground text-sm">Carregando...</div>;

  const configProfiles = [...educadores, ...oficineiros].filter((p, i, arr) => arr.findIndex(x => x.id === p.id) === i);

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold text-foreground">Cronograma Semanal</h1>
          <p className="text-xs text-muted-foreground">Arraste educadores, oficineiros e turmas para os slots do cronograma</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={activeCenarioId || ""} onValueChange={setActiveCenarioId}>
            <SelectTrigger className="h-8 text-xs w-48">
              <SelectValue placeholder="Selecione cenário" />
            </SelectTrigger>
            <SelectContent>
              {cenarios.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
            </SelectContent>
          </Select>
          <Dialog open={newCenarioOpen} onOpenChange={setNewCenarioOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="h-8 text-xs gap-1"><Plus className="h-3.5 w-3.5" />Novo</Button>
            </DialogTrigger>
            <DialogContent className="max-w-sm">
              <DialogHeader><DialogTitle>Novo Cenário</DialogTitle><DialogDescription>Crie um novo cenário de cronograma</DialogDescription></DialogHeader>
              <div className="space-y-3">
                <Input value={newCenarioName} onChange={e => setNewCenarioName(e.target.value)} placeholder="Ex: Proposta A" className="h-8 text-sm" />
                <Button onClick={createCenario} className="w-full" size="sm">Criar</Button>
              </div>
            </DialogContent>
          </Dialog>
          {activeCenarioId && (
            <>
              <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={duplicateCenario}><Copy className="h-3.5 w-3.5" />Duplicar</Button>
              <Button size="sm" variant="destructive" className="h-8 text-xs gap-1" onClick={deleteCenario}><Trash2 className="h-3.5 w-3.5" /></Button>
            </>
          )}
          <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={() => setConfigOpen(true)}>
            <Settings2 className="h-3.5 w-3.5" />Disponibilidade
          </Button>
          <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={() => generateReport("report")}>
            <FileText className="h-3.5 w-3.5" />Relatório
          </Button>
          <Button size="sm" className="h-8 text-xs gap-1" onClick={() => generateReport("generate")}>
            <Sparkles className="h-3.5 w-3.5" />Gerar com IA
          </Button>
        </div>
      </div>

      {/* Conflicts */}
      {conflicts.length > 0 && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <span className="text-sm font-medium text-destructive">Conflitos ({conflicts.length})</span>
            </div>
            <ul className="space-y-0.5">
              {conflicts.map((c, i) => <li key={i} className="text-xs text-destructive/80">• {c}</li>)}
            </ul>
          </CardContent>
        </Card>
      )}

      {!activeCenarioId ? (
        <div className="text-sm text-muted-foreground border border-dashed rounded-lg p-12 text-center">
          Crie um cenário para começar.
        </div>
      ) : (
        <div className="flex gap-4">
          {/* Sidebar — draggable resources */}
          <div className="w-56 flex-shrink-0 space-y-3">
            {/* Educadores */}
            <Card className="border-2 border-blue-200">
              <CardHeader className="p-2 pb-1">
                <CardTitle className="text-xs flex items-center gap-1"><User className="h-3.5 w-3.5 text-blue-600" />Educadores</CardTitle>
              </CardHeader>
              <CardContent className="p-2 pt-0 space-y-1">
                {educadores.length === 0 && <p className="text-xs text-muted-foreground">Nenhum</p>}
                {educadores.map(p => (
                  <div
                    key={p.id}
                    draggable
                    onDragStart={e => handleDragStart(e, { type: "educador", id: p.id, nome: p.nome })}
                    className={`flex items-center gap-1.5 px-2 py-1.5 rounded border cursor-grab active:cursor-grabbing transition-all hover:shadow-md ${RESOURCE_COLORS.educador.drag} text-xs`}
                  >
                    <GripVertical className="h-3 w-3 text-blue-400 flex-shrink-0" />
                    <span className="truncate flex-1 font-medium">{p.nome}</span>
                    <Badge variant="secondary" className="text-[9px] px-1 h-4">{countSlots("educador", p.id)}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Oficineiros */}
            <Card className="border-2 border-purple-200">
              <CardHeader className="p-2 pb-1">
                <CardTitle className="text-xs flex items-center gap-1"><Music className="h-3.5 w-3.5 text-purple-600" />Oficineiros</CardTitle>
              </CardHeader>
              <CardContent className="p-2 pt-0 space-y-1">
                {oficineiros.length === 0 && <p className="text-xs text-muted-foreground">Nenhum</p>}
                {oficineiros.map(p => (
                  <div
                    key={p.id}
                    draggable
                    onDragStart={e => handleDragStart(e, { type: "oficineiro", id: p.id, nome: p.nome })}
                    className={`flex items-center gap-1.5 px-2 py-1.5 rounded border cursor-grab active:cursor-grabbing transition-all hover:shadow-md ${RESOURCE_COLORS.oficineiro.drag} text-xs`}
                  >
                    <GripVertical className="h-3 w-3 text-purple-400 flex-shrink-0" />
                    <span className="truncate flex-1 font-medium">{p.nome}</span>
                    <Badge variant="secondary" className="text-[9px] px-1 h-4">{countSlots("oficineiro", p.id)}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Turmas */}
            <Card className="border-2 border-emerald-200">
              <CardHeader className="p-2 pb-1">
                <CardTitle className="text-xs flex items-center gap-1"><Users className="h-3.5 w-3.5 text-emerald-600" />Turmas</CardTitle>
              </CardHeader>
              <CardContent className="p-2 pt-0 space-y-1">
                {turmas.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma</p>}
                {turmas.map(t => (
                  <div
                    key={t.id}
                    draggable
                    onDragStart={e => handleDragStart(e, { type: "turma", id: t.id, nome: t.nome })}
                    className={`flex items-center gap-1.5 px-2 py-1.5 rounded border cursor-grab active:cursor-grabbing transition-all hover:shadow-md ${RESOURCE_COLORS.turma.drag} text-xs`}
                  >
                    <GripVertical className="h-3 w-3 text-emerald-400 flex-shrink-0" />
                    <span className="truncate flex-1 font-medium">{t.nome}</span>
                    <Badge variant="secondary" className="text-[9px] px-1 h-4">{countSlots("turma", t.id)}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Grid */}
          <ScrollArea className="flex-1">
            <div className="min-w-[700px]">
              {/* Day headers */}
              <div className="grid grid-cols-[120px_repeat(5,1fr)] gap-1 mb-1">
                <div className="text-xs font-medium text-muted-foreground p-2">Bairro / Período</div>
                {DIAS.map(dia => (
                  <div key={dia} className="text-xs font-bold text-center p-2 bg-muted rounded-md">{dia}</div>
                ))}
              </div>

              {/* Rows: bairro × período (only SCFV) */}
              {scfvBairros.map(bairro => {
                const colors = BAIRRO_COLORS[bairro.nome] || { border: "border-gray-300", bg: "bg-gray-50", header: "bg-gray-100 text-gray-900" };
                return PERIODOS.map(periodo => (
                  <div key={`${bairro.id}-${periodo}`} className="grid grid-cols-[120px_repeat(5,1fr)] gap-1 mb-1">
                    <div className={`text-xs p-2 rounded-md flex flex-col justify-center border-2 ${colors.border} ${colors.bg}`}>
                      <span className="font-bold text-foreground">{bairro.nome}</span>
                      <span className="text-muted-foreground">{PERIODO_LABELS[periodo]}</span>
                    </div>
                    {DIAS.map(dia => {
                      const slot = getSlot(dia, periodo, bairro.id);
                      const cellKey = `${bairro.id}-${dia}-${periodo}`;
                      const isDragOver = dragOverCell === cellKey;
                      const hasConflict = slot && conflicts.some(c =>
                        c.includes(dia) && c.includes(PERIODO_LABELS[periodo])
                      );

                      return (
                        <div
                          key={dia}
                          onDragOver={e => handleDragOver(e, cellKey)}
                          onDragLeave={handleDragLeave}
                          onDrop={e => handleDrop(e, dia, periodo, bairro.id)}
                          className={`min-h-[72px] rounded-md border-2 p-1.5 transition-all ${
                            isDragOver
                              ? `${colors.border} ring-2 ring-primary/40 scale-[1.02] shadow-lg bg-primary/5`
                              : slot
                                ? hasConflict
                                  ? "bg-destructive/10 border-destructive/40"
                                  : `${colors.bg} ${colors.border}`
                                : "bg-background border-border/50 hover:border-muted-foreground/30"
                          }`}
                        >
                          {slot ? (
                            <div className="space-y-0.5">
                              {slot.educador_id && (
                                <div className={`flex items-center gap-1 px-1 py-0.5 rounded text-[10px] ${RESOURCE_COLORS.educador.bg} ${RESOURCE_COLORS.educador.text}`}>
                                  <User className="h-2.5 w-2.5" />
                                  <span className="truncate flex-1">{profName(slot.educador_id)}</span>
                                  <button onClick={() => removeFromSlot(slot.id, "educador_id")} className="hover:text-destructive">
                                    <X className="h-2.5 w-2.5" />
                                  </button>
                                </div>
                              )}
                              {slot.oficineiro_id && (
                                <div className={`flex items-center gap-1 px-1 py-0.5 rounded text-[10px] ${RESOURCE_COLORS.oficineiro.bg} ${RESOURCE_COLORS.oficineiro.text}`}>
                                  <Music className="h-2.5 w-2.5" />
                                  <span className="truncate flex-1">{profName(slot.oficineiro_id)}</span>
                                  <button onClick={() => removeFromSlot(slot.id, "oficineiro_id")} className="hover:text-destructive">
                                    <X className="h-2.5 w-2.5" />
                                  </button>
                                </div>
                              )}
                              {slot.turma_id && (
                                <div className={`flex items-center gap-1 px-1 py-0.5 rounded text-[10px] ${RESOURCE_COLORS.turma.bg} ${RESOURCE_COLORS.turma.text}`}>
                                  <Users className="h-2.5 w-2.5" />
                                  <span className="truncate flex-1">{turmas.find(t => t.id === slot.turma_id)?.nome || ""}</span>
                                  <button onClick={() => removeFromSlot(slot.id, "turma_id")} className="hover:text-destructive">
                                    <X className="h-2.5 w-2.5" />
                                  </button>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center justify-center h-full opacity-20">
                              <Plus className="h-4 w-4" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ));
              })}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Config Dialog — Disponibilidade */}
      <Dialog open={configOpen} onOpenChange={setConfigOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Settings2 className="h-4 w-4" />Disponibilidade dos Profissionais</DialogTitle>
            <DialogDescription>Marque os dias e períodos em que cada profissional está disponível</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {configProfiles.map(prof => (
              <div key={prof.id} className="border rounded-lg p-3">
                <p className="text-sm font-medium mb-2">{prof.nome} <span className="text-muted-foreground text-xs">({prof.cargo})</span></p>
                <div className="grid grid-cols-6 gap-1 text-xs">
                  <div />
                  {DIAS.map(d => <div key={d} className="text-center font-medium">{d}</div>)}
                  {PERIODOS.map(per => (
                    <React.Fragment key={per}>
                      <div className="text-muted-foreground">{PERIODO_LABELS[per]}</div>
                      {DIAS.map(dia => (
                        <div key={`${dia}-${per}`} className="flex justify-center">
                          <Checkbox
                            checked={isDisponivel(prof.id, dia, per)}
                            onCheckedChange={() => toggleDisponibilidade(prof.id, dia, per)}
                          />
                        </div>
                      ))}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            ))}
            {configProfiles.length === 0 && <p className="text-sm text-muted-foreground">Nenhum educador ou oficineiro ativo encontrado.</p>}
          </div>
        </DialogContent>
      </Dialog>

      {/* Report Dialog */}
      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><FileText className="h-4 w-4" />Relatório do Cronograma</DialogTitle>
            <DialogDescription>Análise técnica da distribuição do cronograma</DialogDescription>
          </DialogHeader>
          <div className="prose prose-sm max-w-none">
            {reportLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                Gerando análise com IA...
              </div>
            ) : (
              <div className="whitespace-pre-wrap text-sm">{reportContent}</div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
