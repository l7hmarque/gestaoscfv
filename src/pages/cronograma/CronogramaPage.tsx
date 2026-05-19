import React, { useState, useEffect, useCallback, useMemo, DragEvent } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Plus, Trash2, AlertTriangle, Copy, Settings2, X, FileText, Sparkles, GripVertical, User, Music, Users, ChevronDown, Ruler, Coffee, Bus, Bell } from "lucide-react";
import { isBairroSCFV } from "@/lib/constants";
import { IntervencaoDialog } from "@/components/cronograma/IntervencaoDialog";

const DIAS = ["Seg", "Ter", "Qua", "Qui", "Sex"] as const;
const PERIODOS = ["manha", "tarde"] as const;
const PERIODO_LABELS: Record<string, string> = { manha: "Manhã", tarde: "Tarde" };

const BAIRRO_COLORS: Record<string, { border: string; bg: string; header: string; stripe: string }> = {
  "JARDIM IRENE": { border: "border-blue-400", bg: "bg-blue-50/60", header: "bg-blue-100 text-blue-900", stripe: "bg-blue-400" },
  "ALVORADA": { border: "border-green-400", bg: "bg-green-50/60", header: "bg-green-100 text-green-900", stripe: "bg-green-400" },
  "PARQUE INDEPENDENCIA": { border: "border-orange-400", bg: "bg-orange-50/60", header: "bg-orange-100 text-orange-900", stripe: "bg-orange-400" },
};

const ATIV_PRESETS = [
  { titulo: "Lanche", icone: "coffee", cor: "amber" },
  { titulo: "Embarque transporte", icone: "bus", cor: "sky" },
  { titulo: "Acolhida", icone: "users", cor: "emerald" },
  { titulo: "Reunião", icone: "users", cor: "violet" },
  { titulo: "Almoço", icone: "coffee", cor: "orange" },
  { titulo: "Saída pedagógica", icone: "bus", cor: "rose" },
];

const PRIO_RING: Record<string, string> = {
  urgente: "ring-red-500",
  alta: "ring-amber-500",
  normal: "ring-blue-400",
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
interface SlotProf { id: string; slot_id: string; profile_id: string; papel: string; }
interface AtividadeManual {
  id: string; cenario_id: string; bairro_id: string | null;
  dia_semana: string; periodo: string; titulo: string;
  horario_inicio: string | null; horario_fim: string | null;
  cor: string | null; icone: string | null; notas: string | null;
}
interface Intervencao {
  id: string; cenario_id: string | null; titulo: string; descricao: string | null;
  cor: string | null; data_inicio: string; data_fim: string | null;
  dias_semana: string[] | null; periodos: string[] | null;
  bairros: string[] | null; profissionais: string[] | null;
  prioridade: string; created_at: string;
}
interface FreqRule { turma_prefix: string; min_dias: number; }
interface Cenario { id: string; nome: string; ativo: boolean; regras_frequencia?: FreqRule[] | null; }
interface Disponibilidade { id: string; profile_id: string; dia_semana: string; periodo: string; disponivel: boolean; }
type DragPayload = { type: "educador" | "oficineiro" | "turma"; id: string; nome: string; };

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
  const [slotProfs, setSlotProfs] = useState<SlotProf[]>([]);
  const [atividades, setAtividades] = useState<AtividadeManual[]>([]);
  const [intervencoes, setIntervencoes] = useState<Intervencao[]>([]);
  const [bairros, setBairros] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [turmas, setTurmas] = useState<any[]>([]);
  const [disponibilidades, setDisponibilidades] = useState<Disponibilidade[]>([]);
  const [loading, setLoading] = useState(true);
  const [newCenarioName, setNewCenarioName] = useState("");
  const [newCenarioOpen, setNewCenarioOpen] = useState(false);
  const [activeBairroId, setActiveBairroId] = useState<string>("");
  const [dragOverCell, setDragOverCell] = useState<string | null>(null);
  const [configOpen, setConfigOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportContent, setReportContent] = useState("");
  const [reportLoading, setReportLoading] = useState(false);
  const [sidebarSections, setSidebarSections] = useState({ educadores: true, oficineiros: true });
  const [atvModal, setAtvModal] = useState<{ dia: string; periodo: string; bairroId: string } | null>(null);
  const [intervDetail, setIntervDetail] = useState<Intervencao | null>(null);

  const scfvBairros = useMemo(() => bairros.filter(b => isBairroSCFV(b.nome)), [bairros]);

  useEffect(() => {
    if (scfvBairros.length && !activeBairroId) setActiveBairroId(scfvBairros[0].id);
  }, [scfvBairros, activeBairroId]);

  const educadores = profiles.filter(p => {
    const c = (p.cargo || "").toLowerCase();
    return c.includes("educador") || c.includes("referência") || c.includes("referencia");
  });
  const oficineiros = profiles.filter(p => {
    const c = (p.cargo || "").toLowerCase();
    return c.includes("oficineiro") || c.includes("instrutor") || c.includes("karate") || c.includes("karatê") || c.includes("música") || c.includes("musica") || c.includes("arte") || c.includes("futebol") || c.includes("esporte");
  });

  const activeCenario = cenarios.find(c => c.id === activeCenarioId);
  const freqRules: FreqRule[] = (activeCenario?.regras_frequencia as FreqRule[] | null) || [];

  const loadStatic = useCallback(async () => {
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
    if (cen && cen.length > 0 && !activeCenarioId) setActiveCenarioId(cen[0].id);
    setLoading(false);
  }, [activeCenarioId]);

  useEffect(() => { loadStatic(); }, []);

  const loadCenarioData = useCallback(async (cenId: string) => {
    const [sl, sp, atv, iv] = await Promise.all([
      supabase.from("cronograma_slots").select("*").eq("cenario_id", cenId),
      supabase.from("cronograma_slot_profissionais").select("*"),
      supabase.from("cronograma_atividades_manuais").select("*").eq("cenario_id", cenId),
      supabase.from("cronograma_intervencoes").select("*").or(`cenario_id.eq.${cenId},cenario_id.is.null`),
    ]);
    setSlots(sl.data || []);
    setSlotProfs(sp.data || []);
    setAtividades(atv.data || []);
    setIntervencoes(iv.data || []);
  }, []);

  useEffect(() => {
    if (!activeCenarioId) return;
    loadCenarioData(activeCenarioId);
  }, [activeCenarioId, loadCenarioData]);

  // Índices pré-calculados — evita .filter() por célula (era O(células × N)).
  const slotsByCell = useMemo(() => {
    const m = new Map<string, Slot[]>();
    slots.forEach(s => {
      if (!s.bairro_id) return;
      const k = `${s.bairro_id}|${s.dia_semana}|${s.periodo}`;
      const arr = m.get(k); if (arr) arr.push(s); else m.set(k, [s]);
    });
    return m;
  }, [slots]);
  const slotProfsBySlot = useMemo(() => {
    const m = new Map<string, SlotProf[]>();
    slotProfs.forEach(sp => {
      const arr = m.get(sp.slot_id); if (arr) arr.push(sp); else m.set(sp.slot_id, [sp]);
    });
    return m;
  }, [slotProfs]);
  const atividadesByCell = useMemo(() => {
    const m = new Map<string, AtividadeManual[]>();
    atividades.forEach(a => {
      if (!a.bairro_id) return;
      const k = `${a.bairro_id}|${a.dia_semana}|${a.periodo}`;
      const arr = m.get(k); if (arr) arr.push(a); else m.set(k, [a]);
    });
    return m;
  }, [atividades]);
  const hojeIso = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const intervencoesAtivas = useMemo(
    () => intervencoes.filter(iv => !(iv.data_fim && iv.data_fim < hojeIso)),
    [intervencoes, hojeIso]
  );
  const profileById = useMemo(() => new Map(profiles.map(p => [p.id, p])), [profiles]);
  const turmaById = useMemo(() => new Map(turmas.map(t => [t.id, t])), [turmas]);
  const bairroById = useMemo(() => new Map(bairros.map(b => [b.id, b])), [bairros]);

  const getSlots = useCallback(
    (dia: string, periodo: string, bairroId: string) => slotsByCell.get(`${bairroId}|${dia}|${periodo}`) || [],
    [slotsByCell]
  );
  const getSlotProfs = useCallback(
    (slotId: string) => slotProfsBySlot.get(slotId) || [],
    [slotProfsBySlot]
  );
  const getAtividades = useCallback(
    (dia: string, periodo: string, bairroId: string) => atividadesByCell.get(`${bairroId}|${dia}|${periodo}`) || [],
    [atividadesByCell]
  );
  const getIntervencoesAtivas = useCallback(
    (dia: string, periodo: string, bairroId: string) =>
      intervencoesAtivas.filter(iv => {
        if (iv.dias_semana?.length && !iv.dias_semana.includes(dia)) return false;
        if (iv.periodos?.length && !iv.periodos.includes(periodo)) return false;
        if (iv.bairros?.length && !iv.bairros.includes(bairroId)) return false;
        return true;
      }),
    [intervencoesAtivas]
  );

  const slotCounts = useMemo(() => {
    const map = new Map<string, number>();
    slotProfs.forEach(sp => {
      const key = `prof-${sp.profile_id}`;
      map.set(key, (map.get(key) || 0) + 1);
    });
    slots.forEach(s => {
      if (s.turma_id) map.set(`turma-${s.turma_id}`, (map.get(`turma-${s.turma_id}`) || 0) + 1);
    });
    return map;
  }, [slots, slotProfs]);

  const countProf = (id: string) => slotCounts.get(`prof-${id}`) || 0;
  const countTurma = (id: string) => slotCounts.get(`turma-${id}`) || 0;

  const turmaFreqMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    slots.forEach(s => {
      if (!s.turma_id) return;
      if (!map.has(s.turma_id)) map.set(s.turma_id, new Set());
      map.get(s.turma_id)!.add(s.dia_semana);
    });
    return map;
  }, [slots]);

  const getTurmaFreq = (turma: any): { current: number; rule: FreqRule | undefined } => {
    const upper = (turma.nome || "").toUpperCase();
    const rule = freqRules.find(r => upper.startsWith(r.turma_prefix.toUpperCase()));
    const current = turmaFreqMap.get(turma.id)?.size || 0;
    return { current, rule };
  };

  const conflicts = useMemo(() => {
    const c: string[] = [];
    // Mesmo profissional em locais diferentes no mesmo dia+período
    const grouped = new Map<string, Map<string, Set<string>>>(); // profId -> dia-per -> Set<bairroId>
    slotProfs.forEach(sp => {
      const slot = slots.find(s => s.id === sp.slot_id);
      if (!slot || !slot.bairro_id) return;
      if (!grouped.has(sp.profile_id)) grouped.set(sp.profile_id, new Map());
      const m = grouped.get(sp.profile_id)!;
      const k = `${slot.dia_semana}-${slot.periodo}`;
      if (!m.has(k)) m.set(k, new Set());
      m.get(k)!.add(slot.bairro_id);
    });
    grouped.forEach((m, profId) => {
      m.forEach((bset, k) => {
        if (bset.size > 1) {
          const prof = profiles.find(p => p.id === profId);
          const [dia, per] = k.split("-");
          c.push(`${prof?.nome || "Profissional"} em ${bset.size} locais: ${dia} ${PERIODO_LABELS[per]}`);
        }
      });
    });
    // Indisponibilidade
    slotProfs.forEach(sp => {
      const slot = slots.find(s => s.id === sp.slot_id);
      if (!slot) return;
      const disp = disponibilidades.find(d => d.profile_id === sp.profile_id && d.dia_semana === slot.dia_semana && d.periodo === slot.periodo);
      if (disp && !disp.disponivel) {
        const prof = profiles.find(p => p.id === sp.profile_id);
        c.push(`⚠ ${prof?.nome || "Profissional"} indisponível: ${slot.dia_semana} ${PERIODO_LABELS[slot.periodo]}`);
      }
    });
    turmas.forEach(t => {
      const { current, rule } = getTurmaFreq(t);
      if (rule && current < rule.min_dias && current > 0) {
        c.push(`📅 ${t.nome}: ${current}/${rule.min_dias} dias`);
      }
    });
    return c;
  }, [slots, slotProfs, profiles, disponibilidades, freqRules, turmas, turmaFreqMap]);

  /* DRAG/DROP */
  const handleDragStart = (e: DragEvent, payload: DragPayload) => {
    e.dataTransfer.setData("application/json", JSON.stringify(payload));
    e.dataTransfer.effectAllowed = "move";
  };
  const handleDragOver = (e: DragEvent, cellKey: string) => {
    e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOverCell(cellKey);
  };
  const handleDragLeave = () => setDragOverCell(null);

  const ensureSlot = async (dia: string, periodo: string, bairroId: string, turmaId?: string | null): Promise<Slot | null> => {
    if (!activeCenarioId) return null;
    const existing = getSlots(dia, periodo, bairroId);
    if (turmaId) {
      // Always create new slot for new turma
      const newSlot: any = { cenario_id: activeCenarioId, dia_semana: dia, periodo, bairro_id: bairroId, turma_id: turmaId };
      const { data, error } = await supabase.from("cronograma_slots").insert(newSlot).select("*").single();
      if (error || !data) { toast.error(error?.message || "Erro"); return null; }
      setSlots(p => [...p, data]); return data;
    }
    if (existing.length > 0) return existing[0];
    const newSlot: any = { cenario_id: activeCenarioId, dia_semana: dia, periodo, bairro_id: bairroId };
    const { data, error } = await supabase.from("cronograma_slots").insert(newSlot).select("*").single();
    if (error || !data) { toast.error(error?.message || "Erro"); return null; }
    setSlots(p => [...p, data]); return data;
  };

  const handleDrop = async (e: DragEvent, dia: string, periodo: string, bairroId: string) => {
    e.preventDefault(); setDragOverCell(null);
    let payload: DragPayload;
    try { payload = JSON.parse(e.dataTransfer.getData("application/json")); } catch { return; }

    if (payload.type === "turma") {
      await ensureSlot(dia, periodo, bairroId, payload.id);
      toast.success("Turma adicionada!");
    } else {
      // Profissional → vincula ao 1º slot da célula (ou cria um)
      const slot = await ensureSlot(dia, periodo, bairroId);
      if (!slot) return;
      // Já vinculado?
      const already = getSlotProfs(slot.id).some(sp => sp.profile_id === payload.id);
      if (already) { toast.info("Já vinculado nesta célula"); return; }
      const { data, error } = await supabase.from("cronograma_slot_profissionais")
        .insert({ slot_id: slot.id, profile_id: payload.id, papel: payload.type })
        .select("*").single();
      if (error) { toast.error(error.message); return; }
      setSlotProfs(p => [...p, data as SlotProf]);
      toast.success("Profissional adicionado!");
    }
  };

  const removeProf = async (spId: string) => {
    await supabase.from("cronograma_slot_profissionais").delete().eq("id", spId);
    setSlotProfs(p => p.filter(x => x.id !== spId));
  };

  const removeSlot = async (slotId: string) => {
    await supabase.from("cronograma_slots").delete().eq("id", slotId);
    setSlots(p => p.filter(s => s.id !== slotId));
    setSlotProfs(p => p.filter(sp => sp.slot_id !== slotId));
  };

  const removeAtividade = async (id: string) => {
    await supabase.from("cronograma_atividades_manuais").delete().eq("id", id);
    setAtividades(p => p.filter(a => a.id !== id));
  };

  /* Cenário CRUD */
  const createCenario = async () => {
    if (!newCenarioName.trim()) return;
    const { data, error } = await supabase.from("cronograma_cenarios").insert({ nome: newCenarioName.trim() }).select("*").single();
    if (error) { toast.error(error.message); return; }
    setCenarios(p => [data as unknown as Cenario, ...p]);
    setActiveCenarioId(data.id);
    setNewCenarioName(""); setNewCenarioOpen(false); toast.success("Cenário criado!");
  };
  const deleteCenario = async () => {
    if (!activeCenarioId || !confirm("Excluir este cenário?")) return;
    await supabase.from("cronograma_cenarios").delete().eq("id", activeCenarioId);
    setCenarios(p => p.filter(c => c.id !== activeCenarioId));
    setActiveCenarioId(cenarios.find(c => c.id !== activeCenarioId)?.id || null);
    setSlots([]); setSlotProfs([]); setAtividades([]);
    toast.success("Cenário excluído");
  };

  const toggleDisponibilidade = async (profileId: string, dia: string, periodo: string) => {
    const existing = disponibilidades.find(d => d.profile_id === profileId && d.dia_semana === dia && d.periodo === periodo);
    if (existing) {
      const newVal = !existing.disponivel;
      setDisponibilidades(p => p.map(d => d.id === existing.id ? { ...d, disponivel: newVal } : d));
      await supabase.from("cronograma_disponibilidade").update({ disponivel: newVal } as any).eq("id", existing.id);
    } else {
      const { data } = await supabase.from("cronograma_disponibilidade")
        .insert({ profile_id: profileId, dia_semana: dia, periodo, disponivel: true } as any).select("*").single();
      if (data) setDisponibilidades(p => [...p, data as Disponibilidade]);
    }
  };
  const isDisponivel = (profileId: string, dia: string, periodo: string) => {
    const d = disponibilidades.find(x => x.profile_id === profileId && x.dia_semana === dia && x.periodo === periodo);
    return d ? d.disponivel : false;
  };

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
    const { error } = await supabase.from("cronograma_cenarios").update({ regras_frequencia: editRules } as any).eq("id", activeCenarioId);
    if (error) { toast.error(error.message); return; }
    setCenarios(p => p.map(c => c.id === activeCenarioId ? { ...c, regras_frequencia: editRules } : c));
    setRulesOpen(false); toast.success("Regras salvas!");
  };

  const generateReport = async (mode: "report" | "generate") => {
    setReportLoading(true); setReportOpen(true); setReportContent("Gerando...");
    try {
      const { data, error } = await supabase.functions.invoke("generate-cronograma-report", {
        body: {
          mode,
          slots: slots.map(s => ({
            dia_semana: s.dia_semana, periodo: s.periodo,
            bairro: scfvBairros.find(b => b.id === s.bairro_id)?.nome,
            profissionais: getSlotProfs(s.id).map(sp => profiles.find(p => p.id === sp.profile_id)?.nome).filter(Boolean),
            turma: turmas.find(t => t.id === s.turma_id)?.nome,
          })),
          atividades_manuais: atividades.map(a => ({ titulo: a.titulo, dia: a.dia_semana, periodo: a.periodo, bairro: scfvBairros.find(b => b.id === a.bairro_id)?.nome })),
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
      setReportContent(`Erro: ${e.message}`); toast.error(e.message);
    } finally { setReportLoading(false); }
  };

  const profName = (id: string | null) => (id ? profileById.get(id)?.nome || "" : "");
  const configProfiles = [...educadores, ...oficineiros].filter((p, i, arr) => arr.findIndex(x => x.id === p.id) === i);

  if (loading) return <div className="p-4 text-muted-foreground text-sm">Carregando...</div>;

  const renderCell = (dia: string, periodo: string, bairroId: string) => {
    const cellSlots = getSlots(dia, periodo, bairroId);
    const cellAtv = getAtividades(dia, periodo, bairroId);
    const cellIv = getIntervencoesAtivas(dia, periodo, bairroId);
    const cellKey = `${bairroId}-${dia}-${periodo}`;
    const isDragOver = dragOverCell === cellKey;
    const hasConflict = conflicts.some(c => c.includes(dia) && c.includes(PERIODO_LABELS[periodo]));
    const colors = BAIRRO_COLORS[scfvBairros.find(b => b.id === bairroId)?.nome || ""] || { border: "border-gray-300", bg: "bg-gray-50", header: "", stripe: "" };

    return (
      <div
        key={cellKey}
        onDragOver={e => handleDragOver(e, cellKey)}
        onDragLeave={handleDragLeave}
        onDrop={e => handleDrop(e, dia, periodo, bairroId)}
        className={`group relative min-h-[80px] rounded-sm border p-1 transition-all ${
          isDragOver ? `border-2 ${colors.border} ring-1 ring-primary/30 bg-primary/5`
            : (cellSlots.length > 0 || cellAtv.length > 0)
              ? hasConflict ? "bg-destructive/10 border-destructive/40" : `${colors.bg} ${colors.border}`
              : "bg-background border-border/40 hover:border-muted-foreground/30"
        }`}
      >
        {/* Intervenção overlay */}
        {cellIv.length > 0 && (
          <div className="absolute top-0 right-0 z-10 flex flex-col gap-0.5 p-0.5">
            {cellIv.slice(0,3).map(iv => (
              <Tooltip key={iv.id}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setIntervDetail(iv)}
                    className={`h-3 w-3 rounded-full ring-2 ring-offset-1 ${PRIO_RING[iv.prioridade] || PRIO_RING.alta} ${iv.prioridade==="urgente"?"bg-red-500":iv.prioridade==="alta"?"bg-amber-500":"bg-blue-400"} animate-pulse`}
                  />
                </TooltipTrigger>
                <TooltipContent side="left"><span className="text-xs font-medium">{iv.titulo}</span></TooltipContent>
              </Tooltip>
            ))}
          </div>
        )}
        {/* Diagonal stripe quando há intervenção */}
        {cellIv.length > 0 && (
          <div className="absolute inset-0 pointer-events-none rounded-sm opacity-10"
            style={{ background: "repeating-linear-gradient(45deg, transparent, transparent 6px, currentColor 6px, currentColor 7px)" }}
          />
        )}

        <div className="space-y-1 relative">
          {cellSlots.map(slot => {
            const turma = turmas.find(t => t.id === slot.turma_id);
            const sps = getSlotProfs(slot.id);
            return (
              <div key={slot.id} className="rounded p-0.5 space-y-0.5 bg-background/60 border border-border/30">
                {turma && (
                  <div className="flex items-center gap-0.5 px-1 py-px rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                    <Users className="h-2.5 w-2.5 flex-shrink-0" />
                    <span className="truncate flex-1 leading-tight">{turma.nome}</span>
                    <button onClick={() => removeSlot(slot.id)} className="hover:text-destructive opacity-0 group-hover:opacity-100 flex-shrink-0">
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </div>
                )}
                {sps.map(sp => {
                  const isEdu = sp.papel === "educador";
                  return (
                    <div key={sp.id} className={`flex items-center gap-0.5 px-1 py-px rounded text-[10px] ${isEdu ? "bg-blue-100 text-blue-800" : "bg-purple-100 text-purple-800"}`}>
                      {isEdu ? <User className="h-2.5 w-2.5 flex-shrink-0" /> : <Music className="h-2.5 w-2.5 flex-shrink-0" />}
                      <span className="truncate flex-1 leading-tight">{abbreviateName(profName(sp.profile_id))}</span>
                      <button onClick={() => removeProf(sp.id)} className="hover:text-destructive opacity-0 group-hover:opacity-100 flex-shrink-0">
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </div>
                  );
                })}
                {!turma && sps.length === 0 && (
                  <div className="text-[9px] text-muted-foreground italic px-1 flex items-center justify-between">
                    <span>vazio</span>
                    <button onClick={() => removeSlot(slot.id)} className="hover:text-destructive"><X className="h-2.5 w-2.5"/></button>
                  </div>
                )}
              </div>
            );
          })}
          {cellAtv.map(a => (
            <div key={a.id} className="flex items-center gap-0.5 px-1 py-px rounded text-[10px] bg-amber-100 text-amber-900 border border-amber-200">
              {a.icone === "bus" ? <Bus className="h-2.5 w-2.5"/> : <Coffee className="h-2.5 w-2.5"/>}
              <span className="truncate flex-1 leading-tight">{a.titulo}</span>
              {a.horario_inicio && <span className="text-[9px] opacity-70">{a.horario_inicio}</span>}
              <button onClick={() => removeAtividade(a.id)} className="hover:text-destructive opacity-0 group-hover:opacity-100"><X className="h-2.5 w-2.5"/></button>
            </div>
          ))}
          <button
            onClick={() => setAtvModal({ dia, periodo, bairroId })}
            className="w-full text-[9px] text-muted-foreground/60 hover:text-foreground hover:bg-muted/50 rounded px-1 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-0.5"
          >
            <Plus className="h-2.5 w-2.5"/>atividade
          </button>
        </div>
      </div>
    );
  };

  return (
    <TooltipProvider delayDuration={200}>
      <div className="p-2 md:p-3 flex flex-col h-[calc(100vh-64px)] overflow-hidden">
        <div className="flex items-center justify-between gap-2 mb-2 flex-shrink-0 flex-wrap">
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
          <div className="flex items-center gap-1.5 flex-wrap">
            <Select value={activeCenarioId || ""} onValueChange={setActiveCenarioId}>
              <SelectTrigger className="h-7 text-xs w-40"><SelectValue placeholder="Cenário" /></SelectTrigger>
              <SelectContent>
                {cenarios.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
              </SelectContent>
            </Select>
            <Dialog open={newCenarioOpen} onOpenChange={setNewCenarioOpen}>
              <DialogTrigger asChild><Button size="sm" variant="outline" className="h-7 text-xs px-2"><Plus className="h-3 w-3" /></Button></DialogTrigger>
              <DialogContent className="max-w-sm">
                <DialogHeader><DialogTitle>Novo Cenário</DialogTitle><DialogDescription>Crie um novo cenário</DialogDescription></DialogHeader>
                <Input value={newCenarioName} onChange={e => setNewCenarioName(e.target.value)} placeholder="Ex: Proposta A" className="h-8 text-sm" />
                <Button onClick={createCenario} className="w-full" size="sm">Criar</Button>
              </DialogContent>
            </Dialog>
            {activeCenarioId && (
              <Tooltip><TooltipTrigger asChild>
                <Button size="sm" variant="destructive" className="h-7 text-xs px-2" onClick={deleteCenario}><Trash2 className="h-3 w-3" /></Button>
              </TooltipTrigger><TooltipContent>Excluir cenário</TooltipContent></Tooltip>
            )}
            <div className="w-px h-5 bg-border" />
            {activeCenarioId && (
              <IntervencaoDialog
                cenarioId={activeCenarioId}
                bairros={scfvBairros}
                profiles={configProfiles}
                onCreated={() => loadCenarioData(activeCenarioId)}
              />
            )}
            <Tooltip><TooltipTrigger asChild>
              <Button size="sm" variant="outline" className="h-7 text-xs px-2" onClick={() => setConfigOpen(true)}><Settings2 className="h-3 w-3" /></Button>
            </TooltipTrigger><TooltipContent>Disponibilidade</TooltipContent></Tooltip>
            <Tooltip><TooltipTrigger asChild>
              <Button size="sm" variant="outline" className="h-7 text-xs px-2" onClick={openRules}><Ruler className="h-3 w-3" /></Button>
            </TooltipTrigger><TooltipContent>Regras de Frequência</TooltipContent></Tooltip>
            <Tooltip><TooltipTrigger asChild>
              <Button size="sm" variant="outline" className="h-7 text-xs px-2" onClick={() => generateReport("report")}><FileText className="h-3 w-3" /></Button>
            </TooltipTrigger><TooltipContent>Relatório IA</TooltipContent></Tooltip>
          </div>
        </div>

        {!activeCenarioId ? (
          <div className="text-sm text-muted-foreground border border-dashed rounded-lg p-12 text-center flex-1">Crie um cenário para começar.</div>
        ) : (
          <div className="flex flex-col flex-1 min-h-0">
            <div className="flex gap-2 flex-1 min-h-0">
              {/* Sidebar profissionais e turmas */}
              <div className="w-44 flex-shrink-0 overflow-y-auto space-y-1.5 pr-1" style={{ maxHeight: "calc(100vh - 180px)" }}>
                <Collapsible open={sidebarSections.educadores} onOpenChange={v => setSidebarSections(p => ({ ...p, educadores: v }))}>
                  <CollapsibleTrigger className="flex items-center gap-1 w-full px-1.5 py-1 rounded hover:bg-muted text-xs font-semibold text-blue-700">
                    <User className="h-3 w-3" /><span className="flex-1 text-left">Educadores</span>
                    <Badge variant="secondary" className="text-[9px] px-1 h-4">{educadores.length}</Badge>
                    <ChevronDown className={`h-3 w-3 transition-transform ${sidebarSections.educadores ? "rotate-180" : ""}`} />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-0.5 mt-0.5">
                    {educadores.map(p => (
                      <div key={p.id} draggable onDragStart={e => handleDragStart(e, { type: "educador", id: p.id, nome: p.nome })}
                        className="flex items-center gap-1 px-1.5 py-1 rounded border cursor-grab active:cursor-grabbing hover:shadow-sm bg-blue-100 border-blue-300 text-[10px]">
                        <GripVertical className="h-2.5 w-2.5 text-blue-400 flex-shrink-0" />
                        <span className="truncate flex-1 font-medium">{abbreviateName(p.nome)}</span>
                        <span className="text-blue-600 font-mono text-[9px]">{countProf(p.id)}</span>
                      </div>
                    ))}
                  </CollapsibleContent>
                </Collapsible>
                <Collapsible open={sidebarSections.oficineiros} onOpenChange={v => setSidebarSections(p => ({ ...p, oficineiros: v }))}>
                  <CollapsibleTrigger className="flex items-center gap-1 w-full px-1.5 py-1 rounded hover:bg-muted text-xs font-semibold text-purple-700">
                    <Music className="h-3 w-3" /><span className="flex-1 text-left">Oficineiros</span>
                    <Badge variant="secondary" className="text-[9px] px-1 h-4">{oficineiros.length}</Badge>
                    <ChevronDown className={`h-3 w-3 transition-transform ${sidebarSections.oficineiros ? "rotate-180" : ""}`} />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-0.5 mt-0.5">
                    {oficineiros.map(p => (
                      <div key={p.id} draggable onDragStart={e => handleDragStart(e, { type: "oficineiro", id: p.id, nome: p.nome })}
                        className="flex items-center gap-1 px-1.5 py-1 rounded border cursor-grab active:cursor-grabbing hover:shadow-sm bg-purple-100 border-purple-300 text-[10px]">
                        <GripVertical className="h-2.5 w-2.5 text-purple-400 flex-shrink-0" />
                        <span className="truncate flex-1 font-medium">{abbreviateName(p.nome)}</span>
                        <span className="text-purple-600 font-mono text-[9px]">{countProf(p.id)}</span>
                      </div>
                    ))}
                  </CollapsibleContent>
                </Collapsible>
              </div>

              {/* Tabs por bairro com grade */}
              <div className="flex-1 overflow-auto min-w-0">
                <Tabs value={activeBairroId} onValueChange={setActiveBairroId} className="w-full">
                  <TabsList className="mb-2 h-8">
                    {scfvBairros.map(b => {
                      const c = BAIRRO_COLORS[b.nome];
                      return (
                        <TabsTrigger key={b.id} value={b.id} className="text-xs gap-1.5 data-[state=active]:font-bold">
                          <span className={`inline-block h-2 w-2 rounded-full ${c?.stripe || "bg-gray-400"}`} />
                          {b.nome}
                        </TabsTrigger>
                      );
                    })}
                  </TabsList>
                  {scfvBairros.map(b => (
                    <TabsContent key={b.id} value={b.id} className="mt-0">
                      <div className="min-w-[600px]">
                        <div className="grid grid-cols-[90px_repeat(5,1fr)] gap-px mb-px">
                          <div />
                          {DIAS.map(d => <div key={d} className="text-[11px] font-bold text-center py-1 bg-muted/60 rounded-sm">{d}</div>)}
                        </div>
                        {PERIODOS.map(per => (
                          <div key={per} className="grid grid-cols-[90px_repeat(5,1fr)] gap-px mb-px">
                            <div className="text-[11px] font-medium px-1.5 py-1 rounded-sm flex items-center bg-muted/40">{PERIODO_LABELS[per]}</div>
                            {DIAS.map(dia => renderCell(dia, per, b.id))}
                          </div>
                        ))}
                      </div>
                    </TabsContent>
                  ))}
                </Tabs>
              </div>
            </div>

            {/* Strip de turmas */}
            <div className="flex-shrink-0 mt-2 border-t pt-2">
              <div className="flex items-center gap-2 mb-1.5">
                <Users className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Turmas — arraste para a grade</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {turmas.map(t => {
                  const { current, rule } = getTurmaFreq(t);
                  const belowMin = rule && current < rule.min_dias;
                  return (
                    <div key={t.id} draggable onDragStart={e => handleDragStart(e, { type: "turma", id: t.id, nome: t.nome })}
                      className="flex items-center gap-1.5 px-2 py-1 rounded border cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow bg-emerald-50 border-emerald-300 text-emerald-800 text-[11px]">
                      <GripVertical className="h-3 w-3 opacity-50 flex-shrink-0" />
                      <span className="font-medium truncate max-w-[160px]">{t.nome}</span>
                      <span className="font-mono text-[10px] opacity-60">{countTurma(t.id)}</span>
                      {rule && <span className={`text-[9px] font-bold ${belowMin ? "text-red-600" : "text-green-700"}`}>{current}/{rule.min_dias}</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Modal atividade manual */}
        {atvModal && (
          <AtividadeManualModal
            cenarioId={activeCenarioId!}
            dia={atvModal.dia} periodo={atvModal.periodo} bairroId={atvModal.bairroId}
            onClose={() => setAtvModal(null)}
            onCreated={(a) => { setAtividades(p => [...p, a]); setAtvModal(null); }}
          />
        )}

        {/* Detalhe intervenção */}
        <Dialog open={!!intervDetail} onOpenChange={() => setIntervDetail(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-amber-500"/>{intervDetail?.titulo}</DialogTitle>
              <DialogDescription>Intervenção da equipe técnica/coordenação</DialogDescription>
            </DialogHeader>
            {intervDetail && (
              <div className="space-y-2 text-sm">
                {intervDetail.descricao && <p className="whitespace-pre-wrap">{intervDetail.descricao}</p>}
                <div className="flex flex-wrap gap-1">
                  <Badge variant="outline" className="text-xs">{intervDetail.prioridade}</Badge>
                  <Badge variant="outline" className="text-xs">
                    {new Date(intervDetail.data_inicio).toLocaleDateString("pt-BR")}
                    {intervDetail.data_fim ? ` — ${new Date(intervDetail.data_fim).toLocaleDateString("pt-BR")}` : ""}
                  </Badge>
                </div>
                <Button size="sm" variant="destructive" onClick={async () => {
                  if (!confirm("Excluir intervenção?")) return;
                  await supabase.from("cronograma_intervencoes").delete().eq("id", intervDetail.id);
                  setIntervencoes(p => p.filter(x => x.id !== intervDetail.id));
                  setIntervDetail(null);
                }}>Excluir</Button>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Disponibilidade */}
        <Dialog open={configOpen} onOpenChange={setConfigOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><Settings2 className="h-4 w-4" />Disponibilidade</DialogTitle>
              <DialogDescription>Marque os dias/períodos disponíveis</DialogDescription>
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
                            <Checkbox checked={isDisponivel(prof.id, dia, per)} onCheckedChange={() => toggleDisponibilidade(prof.id, dia, per)} />
                          </div>
                        ))}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>

        {/* Regras */}
        <Dialog open={rulesOpen} onOpenChange={setRulesOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><Ruler className="h-4 w-4" />Regras de Frequência</DialogTitle>
              <DialogDescription>Mínimo de dias por semana por grupo</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              {editRules.map((rule, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input value={rule.turma_prefix} onChange={e => { const nr = [...editRules]; nr[i] = { ...nr[i], turma_prefix: e.target.value.toUpperCase() }; setEditRules(nr); }} placeholder="Prefixo" className="h-8 text-sm flex-1" />
                  <Input type="number" min={1} max={5} value={rule.min_dias} onChange={e => { const nr = [...editRules]; nr[i] = { ...nr[i], min_dias: parseInt(e.target.value) || 1 }; setEditRules(nr); }} className="h-8 text-sm w-16" />
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setEditRules(editRules.filter((_, j) => j !== i))}><X className="h-3 w-3" /></Button>
                </div>
              ))}
              <Button size="sm" variant="outline" className="text-xs" onClick={() => setEditRules([...editRules, { turma_prefix: "", min_dias: 2 }])}><Plus className="h-3 w-3 mr-1" /> Adicionar</Button>
            </div>
            <DialogFooter><Button size="sm" onClick={saveRules}>Salvar</Button></DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Report */}
        <Dialog open={reportOpen} onOpenChange={setReportOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><FileText className="h-4 w-4" />Relatório do Cronograma</DialogTitle>
              <DialogDescription>Análise técnica</DialogDescription>
            </DialogHeader>
            {reportLoading ? <div className="flex items-center gap-2 text-muted-foreground"><div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />Gerando análise...</div>
              : <div className="whitespace-pre-wrap text-sm">{reportContent}</div>}
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}

/* ---- Inline modal: nova atividade manual ---- */
function AtividadeManualModal({ cenarioId, dia, periodo, bairroId, onClose, onCreated }: {
  cenarioId: string; dia: string; periodo: string; bairroId: string;
  onClose: () => void; onCreated: (a: AtividadeManual) => void;
}) {
  const [titulo, setTitulo] = useState("");
  const [horaIni, setHoraIni] = useState("");
  const [horaFim, setHoraFim] = useState("");
  const [notas, setNotas] = useState("");
  const [icone, setIcone] = useState("coffee");

  const save = async (t?: string, ic?: string) => {
    const finalTitulo = t || titulo;
    if (!finalTitulo.trim()) { toast.error("Título obrigatório"); return; }
    const { data, error } = await supabase.from("cronograma_atividades_manuais").insert({
      cenario_id: cenarioId, bairro_id: bairroId, dia_semana: dia, periodo,
      titulo: finalTitulo, horario_inicio: horaIni || null, horario_fim: horaFim || null,
      notas: notas || null, icone: ic || icone,
    }).select("*").single();
    if (error) { toast.error(error.message); return; }
    toast.success("Atividade adicionada!");
    onCreated(data as AtividadeManual);
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-sm">Nova atividade manual</DialogTitle>
          <DialogDescription className="text-xs">{dia} · {PERIODO_LABELS[periodo]}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <div>
            <Label className="text-xs">Pré-definida</Label>
            <div className="flex flex-wrap gap-1 mt-1">
              {ATIV_PRESETS.map(p => (
                <Button key={p.titulo} size="sm" variant="outline" className="h-7 text-xs" onClick={() => save(p.titulo, p.icone)}>
                  {p.icone === "bus" ? <Bus className="h-3 w-3 mr-1"/> : <Coffee className="h-3 w-3 mr-1"/>}
                  {p.titulo}
                </Button>
              ))}
            </div>
          </div>
          <div className="border-t pt-2">
            <Label className="text-xs">Ou personalizado</Label>
            <Input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Título" className="h-8 text-sm mt-1" />
            <div className="grid grid-cols-2 gap-1 mt-1">
              <Input type="time" value={horaIni} onChange={e => setHoraIni(e.target.value)} className="h-8 text-xs" />
              <Input type="time" value={horaFim} onChange={e => setHoraFim(e.target.value)} className="h-8 text-xs" />
            </div>
            <Textarea value={notas} onChange={e => setNotas(e.target.value)} placeholder="Notas (opcional)" rows={2} className="text-xs mt-1" />
          </div>
        </div>
        <DialogFooter>
          <Button size="sm" onClick={() => save()}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
