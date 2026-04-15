import React, { useState, useEffect, useCallback, useMemo, DragEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Plus, Trash2, AlertTriangle, Copy, Settings2, X, FileText, Sparkles, GripVertical, User, Music, Users, ChevronDown, Ruler } from "lucide-react";
import { isBairroSCFV } from "@/lib/constants";

const DIAS = ["Seg", "Ter", "Qua", "Qui", "Sex"] as const;
const PERIODOS = ["manha", "tarde"] as const;
const PERIODO_LABELS: Record<string, string> = { manha: "Manhã", tarde: "Tarde" };
const PERIODO_SHORT: Record<string, string> = { manha: "M", tarde: "T" };

const BAIRRO_SHORT: Record<string, string> = {
  "JARDIM IRENE": "JD IRENE",
  "ALVORADA": "ALVORADA",
  "PARQUE INDEPENDENCIA": "PQ INDEP.",
};

const BAIRRO_COLORS: Record<string, { border: string; bg: string; header: string; stripe: string }> = {
  "JARDIM IRENE": { border: "border-blue-400", bg: "bg-blue-50/60", header: "bg-blue-100 text-blue-900", stripe: "bg-blue-400" },
  "ALVORADA": { border: "border-green-400", bg: "bg-green-50/60", header: "bg-green-100 text-green-900", stripe: "bg-green-400" },
  "PARQUE INDEPENDENCIA": { border: "border-orange-400", bg: "bg-orange-50/60", header: "bg-orange-100 text-orange-900", stripe: "bg-orange-400" },
};

const RESOURCE_COLORS = {
  educador: { bg: "bg-blue-100", text: "text-blue-800", drag: "bg-blue-200 border-blue-400" },
  oficineiro: { bg: "bg-purple-100", text: "text-purple-800", drag: "bg-purple-200 border-purple-400" },
  turma: { bg: "bg-emerald-100", text: "text-emerald-800", drag: "bg-emerald-200 border-emerald-400" },
};

/* ---- Turma color by neighborhood prefix ---- */
const TURMA_COLOR_MAP: { prefix: string; light: string; dark: string; border: string; text: string }[] = [
  { prefix: "ALVORADA", light: "bg-orange-100", dark: "bg-orange-200", border: "border-orange-400", text: "text-orange-800" },
  { prefix: "JARDIM IRENE", light: "bg-blue-100", dark: "bg-blue-200", border: "border-blue-400", text: "text-blue-800" },
  { prefix: "PARQUE", light: "bg-green-100", dark: "bg-green-200", border: "border-green-400", text: "text-green-800" },
];

function getTurmaColor(nome: string, periodo?: string | null) {
  const upper = nome.toUpperCase();
  const match = TURMA_COLOR_MAP.find(c => upper.startsWith(c.prefix));
  if (!match) return { bg: "bg-muted", border: "border-muted-foreground/30", text: "text-foreground" };
  const bg = periodo === "tarde" ? match.dark : match.light;
  return { bg, border: match.border, text: match.text };
}

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

interface FreqRule { turma_prefix: string; min_dias: number; }
interface Cenario { id: string; nome: string; ativo: boolean; regras_frequencia?: FreqRule[] | null; }
interface Disponibilidade { id: string; profile_id: string; dia_semana: string; periodo: string; disponivel: boolean; }

type DragPayload = {
  type: "educador" | "oficineiro" | "turma";
  id: string;
  nome: string;
};

const abbreviateName = (name: string) => {
  const parts = name.trim().split(/\s+/);
  if (parts.length <= 1) return name;
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
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
  
  const [dragOverCell, setDragOverCell] = useState<string | null>(null);
  const [configOpen, setConfigOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportContent, setReportContent] = useState("");
  const [reportLoading, setReportLoading] = useState(false);
  const [sidebarSections, setSidebarSections] = useState({ educadores: true, oficineiros: true });
  // For professional picker when dropping on multi-slot cell
  const [slotPicker, setSlotPicker] = useState<{ slotIds: string[]; payload: DragPayload; cellKey: string } | null>(null);

  const scfvBairros = bairros.filter(b => isBairroSCFV(b.nome));

  const educadores = profiles.filter(p => {
    const cargo = (p.cargo || "").toLowerCase();
    return cargo.includes("educador") || cargo.includes("referência") || cargo.includes("referencia");
  });
  const oficineiros = profiles.filter(p => {
    const cargo = (p.cargo || "").toLowerCase();
    return cargo.includes("oficineiro") || cargo.includes("instrutor") || cargo.includes("karate") || cargo.includes("karatê") || cargo.includes("música") || cargo.includes("musica") || cargo.includes("arte") || cargo.includes("futebol") || cargo.includes("esporte");
  });

  const activeCenario = cenarios.find(c => c.id === activeCenarioId);
  const freqRules: FreqRule[] = (activeCenario?.regras_frequencia as FreqRule[] | null) || [];

  const loadData = useCallback(async () => {
    setLoading(true);
    const [{ data: cen }, { data: b }, { data: p }, { data: t }, { data: d }] = await Promise.all([
      supabase.from("cronograma_cenarios").select("*").order("created_at", { ascending: false }),
      supabase.from("bairros").select("*").order("nome"),
      supabase.from("profiles").select("id, nome, cargo, ativo").eq("ativo", true).order("nome"),
      supabase.from("turmas").select("id, nome, educador_id, dias_semana, periodo, oficina, bairro_ids, ativa").eq("ativa", true).order("nome"),
      supabase.from("cronograma_disponibilidade").select("*"),
    ]);
    setCenarios((cen || []) as unknown as Cenario[]);
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

  /* ---- Multi-slot helpers ---- */
  const getSlots = (dia: string, periodo: string, bairroId: string): Slot[] =>
    slots.filter(s => s.dia_semana === dia && s.periodo === periodo && s.bairro_id === bairroId);

  const slotCounts = useMemo(() => {
    const map = new Map<string, number>();
    slots.forEach(s => {
      if (s.educador_id) map.set(`educador-${s.educador_id}`, (map.get(`educador-${s.educador_id}`) || 0) + 1);
      if (s.oficineiro_id) map.set(`oficineiro-${s.oficineiro_id}`, (map.get(`oficineiro-${s.oficineiro_id}`) || 0) + 1);
      if (s.turma_id) map.set(`turma-${s.turma_id}`, (map.get(`turma-${s.turma_id}`) || 0) + 1);
    });
    return map;
  }, [slots]);

  const countSlots = (type: "educador" | "oficineiro" | "turma", id: string) =>
    slotCounts.get(`${type}-${id}`) || 0;

  /* ---- Frequency rule helpers ---- */
  const turmaFreqMap = useMemo(() => {
    const daysPerTurma = new Map<string, Set<string>>();
    slots.forEach(s => {
      if (!s.turma_id) return;
      if (!daysPerTurma.has(s.turma_id)) daysPerTurma.set(s.turma_id, new Set());
      daysPerTurma.get(s.turma_id)!.add(s.dia_semana);
    });
    return daysPerTurma;
  }, [slots]);

  const getTurmaFreq = (turma: any): { current: number; rule: FreqRule | undefined } => {
    const upper = (turma.nome || "").toUpperCase();
    const rule = freqRules.find(r => upper.startsWith(r.turma_prefix.toUpperCase()));
    const current = turmaFreqMap.get(turma.id)?.size || 0;
    return { current, rule };
  };

  // Conflict detection (memoized)
  const conflicts = useMemo(() => {
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

    // Frequency rule violations
    turmas.forEach(t => {
      const { current, rule } = getTurmaFreq(t);
      if (rule && current < rule.min_dias && current > 0) {
        c.push(`📅 ${t.nome}: ${current}/${rule.min_dias} dias (mínimo não atingido)`);
      }
    });

    return c;
  }, [slots, profiles, disponibilidades, freqRules, turmas, turmaFreqMap]);

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

    const cellSlots = getSlots(dia, periodo, bairroId);

    if (payload.type === "turma") {
      // Always create a new slot for each turma drop
      const newSlot = {
        cenario_id: activeCenarioId,
        dia_semana: dia,
        periodo,
        bairro_id: bairroId,
        turma_id: payload.id,
      };
      const { data, error } = await supabase.from("cronograma_slots").insert(newSlot).select("*").single();
      if (error || !data) { toast.error(error?.message || "Erro"); return; }
      setSlots(prev => [...prev, data]);
      toast.success("Turma adicionada!");
    } else {
      // Professional drop — if multiple slots exist, show picker
      if (cellSlots.length > 1) {
        setSlotPicker({ slotIds: cellSlots.map(s => s.id), payload, cellKey: `${bairroId}-${dia}-${periodo}` });
      } else if (cellSlots.length === 1) {
        await assignProfToSlot(cellSlots[0].id, payload);
      } else {
        // No slots yet — create one
        const field = payload.type === "educador" ? "educador_id" : "oficineiro_id";
        const newSlot = {
          cenario_id: activeCenarioId,
          dia_semana: dia,
          periodo,
          bairro_id: bairroId,
          [field]: payload.id,
        };
        const { data, error } = await supabase.from("cronograma_slots").insert(newSlot).select("*").single();
        if (error || !data) { toast.error(error?.message || "Erro"); return; }
        setSlots(prev => [...prev, data]);
        toast.success("Slot criado!");
      }
    }
  };

  const assignProfToSlot = async (slotId: string, payload: DragPayload) => {
    const field = payload.type === "educador" ? "educador_id" : "oficineiro_id";
    setSlots(prev => prev.map(s => s.id === slotId ? { ...s, [field]: payload.id } : s));
    const { error } = await supabase.from("cronograma_slots").update({ [field]: payload.id } as any).eq("id", slotId);
    if (error) { toast.error(error.message); return; }
    toast.success("Profissional vinculado!");
    setSlotPicker(null);
  };

  const removeFromSlot = async (slotId: string, field: "educador_id" | "oficineiro_id" | "turma_id") => {
    const slot = slots.find(s => s.id === slotId);
    if (!slot) return;

    if (field === "turma_id") {
      // When removing a turma, delete the entire slot
      await supabase.from("cronograma_slots").delete().eq("id", slotId);
      setSlots(prev => prev.filter(s => s.id !== slotId));
    } else {
      const updated = { ...slot, [field]: null };
      if (!updated.educador_id && !updated.oficineiro_id && !updated.turma_id && !updated.tipo_atividade) {
        await supabase.from("cronograma_slots").delete().eq("id", slotId);
        setSlots(prev => prev.filter(s => s.id !== slotId));
      } else {
        setSlots(prev => prev.map(s => s.id === slotId ? updated : s));
        await supabase.from("cronograma_slots").update({ [field]: null } as any).eq("id", slotId);
      }
    }
  };

  // Cenario CRUD
  const createCenario = async () => {
    if (!newCenarioName.trim()) return;
    const { data, error } = await supabase.from("cronograma_cenarios").insert({ nome: newCenarioName.trim() }).select("*").single();
    if (error) { toast.error(error.message); return; }
    setCenarios(prev => [data as unknown as Cenario, ...prev]);
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
    setCenarios(prev => [newCen as unknown as Cenario, ...prev]);
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

  /* ---- Frequency rules management ---- */
  const [editRules, setEditRules] = useState<FreqRule[]>([]);
  const openRules = () => {
    setEditRules(freqRules.length > 0 ? [...freqRules] : [
      { turma_prefix: "ALVORADA", min_dias: 2 },
      { turma_prefix: "JARDIM IRENE", min_dias: 3 },
      { turma_prefix: "PARQUE", min_dias: 2 },
    ]);
    setRulesOpen(true);
  };

  const saveRules = async () => {
    if (!activeCenarioId) return;
    const { error } = await supabase.from("cronograma_cenarios")
      .update({ regras_frequencia: editRules } as any)
      .eq("id", activeCenarioId);
    if (error) { toast.error(error.message); return; }
    setCenarios(prev => prev.map(c => c.id === activeCenarioId ? { ...c, regras_frequencia: editRules } : c));
    setRulesOpen(false);
    toast.success("Regras salvas!");
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

  if (loading) return <div className="p-4 text-muted-foreground text-sm">Carregando...</div>;

  const configProfiles = [...educadores, ...oficineiros].filter((p, i, arr) => arr.findIndex(x => x.id === p.id) === i);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="p-2 md:p-3 flex flex-col h-[calc(100vh-64px)] overflow-hidden">
        {/* Header — single compact row */}
        <div className="flex items-center justify-between gap-2 mb-2 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <h1 className="text-base font-bold text-foreground whitespace-nowrap">Cronograma Semanal</h1>
            {conflicts.length > 0 && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-destructive gap-1 hover:bg-destructive/10">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    <span className="text-xs font-medium">{conflicts.length}</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-3" align="start">
                  <p className="text-xs font-semibold text-destructive mb-2">Conflitos detectados</p>
                  <ul className="space-y-1">
                    {conflicts.map((c, i) => <li key={i} className="text-xs text-destructive/80">• {c}</li>)}
                  </ul>
                </PopoverContent>
              </Popover>
            )}
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <Select value={activeCenarioId || ""} onValueChange={setActiveCenarioId}>
              <SelectTrigger className="h-7 text-xs w-40">
                <SelectValue placeholder="Cenário" />
              </SelectTrigger>
              <SelectContent>
                {cenarios.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
              </SelectContent>
            </Select>
            <Dialog open={newCenarioOpen} onOpenChange={setNewCenarioOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="h-7 text-xs px-2"><Plus className="h-3 w-3" /></Button>
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
                <Tooltip><TooltipTrigger asChild>
                  <Button size="sm" variant="outline" className="h-7 text-xs px-2" onClick={duplicateCenario}><Copy className="h-3 w-3" /></Button>
                </TooltipTrigger><TooltipContent>Duplicar cenário</TooltipContent></Tooltip>
                <Tooltip><TooltipTrigger asChild>
                  <Button size="sm" variant="destructive" className="h-7 text-xs px-2" onClick={deleteCenario}><Trash2 className="h-3 w-3" /></Button>
                </TooltipTrigger><TooltipContent>Excluir cenário</TooltipContent></Tooltip>
              </>
            )}
            <div className="w-px h-5 bg-border" />
            <Tooltip><TooltipTrigger asChild>
              <Button size="sm" variant="outline" className="h-7 text-xs px-2" onClick={() => setConfigOpen(true)}><Settings2 className="h-3 w-3" /></Button>
            </TooltipTrigger><TooltipContent>Disponibilidade</TooltipContent></Tooltip>
            <Tooltip><TooltipTrigger asChild>
              <Button size="sm" variant="outline" className="h-7 text-xs px-2" onClick={openRules}><Ruler className="h-3 w-3" /></Button>
            </TooltipTrigger><TooltipContent>Regras de Frequência</TooltipContent></Tooltip>
            <Tooltip><TooltipTrigger asChild>
              <Button size="sm" variant="outline" className="h-7 text-xs px-2" onClick={() => generateReport("report")}><FileText className="h-3 w-3" /></Button>
            </TooltipTrigger><TooltipContent>Relatório</TooltipContent></Tooltip>
            <Button size="sm" className="h-7 text-xs gap-1 px-2.5" onClick={() => generateReport("generate")}>
              <Sparkles className="h-3 w-3" />IA
            </Button>
          </div>
        </div>

        {!activeCenarioId ? (
          <div className="text-sm text-muted-foreground border border-dashed rounded-lg p-12 text-center flex-1">
            Crie um cenário para começar.
          </div>
        ) : (
          <div className="flex flex-col flex-1 min-h-0">
            <div className="flex gap-2 flex-1 min-h-0">
              {/* Sidebar — only professionals now */}
              <div className="w-44 flex-shrink-0 overflow-y-auto space-y-1.5 pr-1" style={{ maxHeight: "calc(100vh - 180px)" }}>
                {/* Educadores */}
                <Collapsible open={sidebarSections.educadores} onOpenChange={v => setSidebarSections(p => ({ ...p, educadores: v }))}>
                  <CollapsibleTrigger className="flex items-center gap-1 w-full px-1.5 py-1 rounded hover:bg-muted text-xs font-semibold text-blue-700">
                    <User className="h-3 w-3" />
                    <span className="flex-1 text-left">Educadores</span>
                    <Badge variant="secondary" className="text-[9px] px-1 h-4">{educadores.length}</Badge>
                    <ChevronDown className={`h-3 w-3 transition-transform ${sidebarSections.educadores ? "rotate-180" : ""}`} />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-0.5 mt-0.5">
                    {educadores.map(p => (
                      <div
                        key={p.id}
                        draggable
                        onDragStart={e => handleDragStart(e, { type: "educador", id: p.id, nome: p.nome })}
                        className={`flex items-center gap-1 px-1.5 py-1 rounded border cursor-grab active:cursor-grabbing hover:shadow-sm ${RESOURCE_COLORS.educador.drag} text-[10px]`}
                      >
                        <GripVertical className="h-2.5 w-2.5 text-blue-400 flex-shrink-0" />
                        <span className="truncate flex-1 font-medium">{abbreviateName(p.nome)}</span>
                        <span className="text-blue-500 font-mono text-[9px]">{countSlots("educador", p.id)}</span>
                      </div>
                    ))}
                  </CollapsibleContent>
                </Collapsible>

                {/* Oficineiros */}
                <Collapsible open={sidebarSections.oficineiros} onOpenChange={v => setSidebarSections(p => ({ ...p, oficineiros: v }))}>
                  <CollapsibleTrigger className="flex items-center gap-1 w-full px-1.5 py-1 rounded hover:bg-muted text-xs font-semibold text-purple-700">
                    <Music className="h-3 w-3" />
                    <span className="flex-1 text-left">Oficineiros</span>
                    <Badge variant="secondary" className="text-[9px] px-1 h-4">{oficineiros.length}</Badge>
                    <ChevronDown className={`h-3 w-3 transition-transform ${sidebarSections.oficineiros ? "rotate-180" : ""}`} />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-0.5 mt-0.5">
                    {oficineiros.map(p => (
                      <div
                        key={p.id}
                        draggable
                        onDragStart={e => handleDragStart(e, { type: "oficineiro", id: p.id, nome: p.nome })}
                        className={`flex items-center gap-1 px-1.5 py-1 rounded border cursor-grab active:cursor-grabbing hover:shadow-sm ${RESOURCE_COLORS.oficineiro.drag} text-[10px]`}
                      >
                        <GripVertical className="h-2.5 w-2.5 text-purple-400 flex-shrink-0" />
                        <span className="truncate flex-1 font-medium">{abbreviateName(p.nome)}</span>
                        <span className="text-purple-500 font-mono text-[9px]">{countSlots("oficineiro", p.id)}</span>
                      </div>
                    ))}
                  </CollapsibleContent>
                </Collapsible>
              </div>

              {/* Grid */}
              <div className="flex-1 overflow-auto min-w-0">
                <div className="min-w-[600px]">
                  {/* Day headers */}
                  <div className="grid grid-cols-[90px_repeat(5,1fr)] gap-px mb-px">
                    <div className="text-[10px] font-medium text-muted-foreground px-1 py-1">
                      <Tooltip><TooltipTrigger className="cursor-help underline decoration-dotted">Local</TooltipTrigger>
                        <TooltipContent>Local de atendimento (território físico)</TooltipContent>
                      </Tooltip>
                    </div>
                    {DIAS.map(dia => (
                      <div key={dia} className="text-[11px] font-bold text-center py-1 bg-muted/60 rounded-sm">{dia}</div>
                    ))}
                  </div>

                  {/* Rows grouped by bairro */}
                  {scfvBairros.map(bairro => {
                    const colors = BAIRRO_COLORS[bairro.nome] || { border: "border-gray-300", bg: "bg-gray-50", header: "bg-gray-100 text-gray-900", stripe: "bg-gray-400" };
                    const shortName = BAIRRO_SHORT[bairro.nome] || bairro.nome;

                    return (
                      <div key={bairro.id} className="mb-1">
                        <div className={`h-1 rounded-t ${colors.stripe}`} />
                        {PERIODOS.map(periodo => (
                          <div key={`${bairro.id}-${periodo}`} className="grid grid-cols-[90px_repeat(5,1fr)] gap-px mb-px">
                            <div className={`text-[10px] px-1.5 py-1 rounded-sm flex items-center gap-1 border ${colors.border} ${colors.bg}`}>
                              <span className="font-bold text-foreground leading-tight">{shortName}</span>
                              <span className="text-muted-foreground">·</span>
                              <span className="text-muted-foreground">{PERIODO_SHORT[periodo]}</span>
                            </div>
                            {DIAS.map(dia => {
                              const cellSlots = getSlots(dia, periodo, bairro.id);
                              const cellKey = `${bairro.id}-${dia}-${periodo}`;
                              const isDragOver = dragOverCell === cellKey;
                              const hasConflict = cellSlots.length > 0 && conflicts.some(c =>
                                c.includes(dia) && c.includes(PERIODO_LABELS[periodo])
                              );

                              return (
                                <div
                                  key={dia}
                                  onDragOver={e => handleDragOver(e, cellKey)}
                                  onDragLeave={handleDragLeave}
                                  onDrop={e => handleDrop(e, dia, periodo, bairro.id)}
                                  className={`group min-h-[52px] rounded-sm border p-1 transition-all ${
                                    isDragOver
                                      ? `border-2 ${colors.border} ring-1 ring-primary/30 bg-primary/5`
                                      : cellSlots.length > 0
                                        ? hasConflict
                                          ? "bg-destructive/10 border-destructive/40"
                                          : `${colors.bg} ${colors.border}`
                                        : "bg-background border-border/40 hover:border-muted-foreground/30"
                                  }`}
                                >
                                  {cellSlots.length > 0 ? (
                                    <div className="space-y-1">
                                      {cellSlots.map(slot => {
                                        const turma = turmas.find(t => t.id === slot.turma_id);
                                        const turmaColor = turma ? getTurmaColor(turma.nome, turma.periodo) : null;
                                        return (
                                          <div key={slot.id} className={`rounded p-0.5 space-y-0.5 ${turmaColor ? `${turmaColor.bg} border ${turmaColor.border}` : ""}`}>
                                            {slot.turma_id && turma && (
                                              <div className={`flex items-center gap-0.5 px-1 py-px rounded text-[10px] font-semibold ${turmaColor?.text || "text-foreground"}`}>
                                                <Users className="h-2.5 w-2.5 flex-shrink-0" />
                                                <span className="truncate flex-1 leading-tight">{turma.nome}</span>
                                                <button
                                                  onClick={() => removeFromSlot(slot.id, "turma_id")}
                                                  className="hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                                                >
                                                  <X className="h-2.5 w-2.5" />
                                                </button>
                                              </div>
                                            )}
                                            {slot.educador_id && (
                                              <div className={`flex items-center gap-0.5 px-1 py-px rounded text-[10px] ${RESOURCE_COLORS.educador.bg} ${RESOURCE_COLORS.educador.text}`}>
                                                <User className="h-2.5 w-2.5 flex-shrink-0" />
                                                <span className="truncate flex-1 leading-tight">{abbreviateName(profName(slot.educador_id))}</span>
                                                <button
                                                  onClick={() => removeFromSlot(slot.id, "educador_id")}
                                                  className="hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                                                >
                                                  <X className="h-2.5 w-2.5" />
                                                </button>
                                              </div>
                                            )}
                                            {slot.oficineiro_id && (
                                              <div className={`flex items-center gap-0.5 px-1 py-px rounded text-[10px] ${RESOURCE_COLORS.oficineiro.bg} ${RESOURCE_COLORS.oficineiro.text}`}>
                                                <Music className="h-2.5 w-2.5 flex-shrink-0" />
                                                <span className="truncate flex-1 leading-tight">{abbreviateName(profName(slot.oficineiro_id))}</span>
                                                <button
                                                  onClick={() => removeFromSlot(slot.id, "oficineiro_id")}
                                                  className="hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                                                >
                                                  <X className="h-2.5 w-2.5" />
                                                </button>
                                              </div>
                                            )}
                                            {!slot.turma_id && !slot.educador_id && !slot.oficineiro_id && (
                                              <div className="text-[9px] text-muted-foreground italic px-1">vazio</div>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  ) : (
                                    <div className="flex items-center justify-center h-full opacity-15">
                                      <Plus className="h-3 w-3" />
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Horizontal turma strip below the grid */}
            <div className="flex-shrink-0 mt-2 border-t pt-2">
              <div className="flex items-center gap-2 mb-1.5">
                <Users className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Turmas — arraste para a grade</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {turmas.map(t => {
                  const tColor = getTurmaColor(t.nome, t.periodo);
                  const { current, rule } = getTurmaFreq(t);
                  const belowMin = rule && current < rule.min_dias;
                  return (
                    <div
                      key={t.id}
                      draggable
                      onDragStart={e => handleDragStart(e, { type: "turma", id: t.id, nome: t.nome })}
                      className={`flex items-center gap-1.5 px-2 py-1 rounded border cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow ${tColor.bg} ${tColor.border} ${tColor.text} text-[11px]`}
                    >
                      <GripVertical className="h-3 w-3 opacity-50 flex-shrink-0" />
                      <span className="font-medium truncate max-w-[160px]">{t.nome}</span>
                      {t.periodo && (
                        <span className="text-[9px] opacity-70 uppercase">{t.periodo === "manha" ? "M" : t.periodo === "tarde" ? "T" : "I"}</span>
                      )}
                      <span className="font-mono text-[10px] opacity-60">{countSlots("turma", t.id)}</span>
                      {rule && (
                        <span className={`text-[9px] font-bold ${belowMin ? "text-red-600" : "text-green-700"}`}>
                          {current}/{rule.min_dias}
                        </span>
                      )}
                    </div>
                  );
                })}
                {turmas.length === 0 && <span className="text-xs text-muted-foreground">Nenhuma turma ativa</span>}
              </div>
            </div>
          </div>
        )}

        {/* Slot picker dialog — when dropping prof on multi-slot cell */}
        {slotPicker && (
          <Dialog open={!!slotPicker} onOpenChange={() => setSlotPicker(null)}>
            <DialogContent className="max-w-xs">
              <DialogHeader>
                <DialogTitle className="text-sm">Vincular a qual turma?</DialogTitle>
                <DialogDescription className="text-xs">Existem múltiplas turmas nesta célula. Escolha a qual vincular o profissional.</DialogDescription>
              </DialogHeader>
              <div className="space-y-1.5">
                {slotPicker.slotIds.map(sid => {
                  const s = slots.find(x => x.id === sid);
                  const t = turmas.find(x => x.id === s?.turma_id);
                  return (
                    <Button
                      key={sid}
                      variant="outline"
                      size="sm"
                      className="w-full justify-start text-xs"
                      onClick={() => assignProfToSlot(sid, slotPicker.payload)}
                    >
                      <Users className="h-3 w-3 mr-2" />
                      {t?.nome || "Slot sem turma"}
                    </Button>
                  );
                })}
              </div>
            </DialogContent>
          </Dialog>
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

        {/* Frequency Rules Dialog */}
        <Dialog open={rulesOpen} onOpenChange={setRulesOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><Ruler className="h-4 w-4" />Regras de Frequência Semanal</DialogTitle>
              <DialogDescription>Defina o mínimo de dias por semana para cada grupo de turmas</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              {editRules.map((rule, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    value={rule.turma_prefix}
                    onChange={e => {
                      const nr = [...editRules];
                      nr[i] = { ...nr[i], turma_prefix: e.target.value.toUpperCase() };
                      setEditRules(nr);
                    }}
                    placeholder="Prefixo (ex: ALVORADA)"
                    className="h-8 text-sm flex-1"
                  />
                  <span className="text-xs text-muted-foreground whitespace-nowrap">mín.</span>
                  <Input
                    type="number"
                    min={1}
                    max={5}
                    value={rule.min_dias}
                    onChange={e => {
                      const nr = [...editRules];
                      nr[i] = { ...nr[i], min_dias: parseInt(e.target.value) || 1 };
                      setEditRules(nr);
                    }}
                    className="h-8 text-sm w-16"
                  />
                  <span className="text-xs text-muted-foreground">dias</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0"
                    onClick={() => setEditRules(editRules.filter((_, j) => j !== i))}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
              <Button
                size="sm"
                variant="outline"
                className="text-xs"
                onClick={() => setEditRules([...editRules, { turma_prefix: "", min_dias: 2 }])}
              >
                <Plus className="h-3 w-3 mr-1" /> Adicionar regra
              </Button>
            </div>
            <DialogFooter>
              <Button size="sm" onClick={saveRules}>Salvar regras</Button>
            </DialogFooter>
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
    </TooltipProvider>
  );
}
