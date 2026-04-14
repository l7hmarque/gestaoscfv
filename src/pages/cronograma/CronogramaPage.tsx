import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Plus, Save, Trash2, AlertTriangle, Copy, Settings2, X, Check } from "lucide-react";

const DIAS = ["Seg", "Ter", "Qua", "Qui", "Sex"] as const;
const PERIODOS = ["manha", "tarde"] as const;
const PERIODO_LABELS: Record<string, string> = { manha: "Manhã", tarde: "Tarde" };

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

interface Cenario {
  id: string;
  nome: string;
  ativo: boolean;
}

export default function CronogramaPage() {
  const { user } = useAuth();
  const [cenarios, setCenarios] = useState<Cenario[]>([]);
  const [activeCenarioId, setActiveCenarioId] = useState<string | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [bairros, setBairros] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [turmas, setTurmas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newCenarioName, setNewCenarioName] = useState("");
  const [newCenarioOpen, setNewCenarioOpen] = useState(false);
  const [editSlot, setEditSlot] = useState<{ dia: string; periodo: string; bairroId: string } | null>(null);
  const [slotForm, setSlotForm] = useState<Partial<Slot>>({});
  const [conflicts, setConflicts] = useState<string[]>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [{ data: cen }, { data: b }, { data: p }, { data: t }] = await Promise.all([
      supabase.from("cronograma_cenarios").select("*").order("created_at", { ascending: false }),
      supabase.from("bairros").select("*").order("nome"),
      supabase.from("profiles").select("id, nome, cargo, ativo").eq("ativo", true).order("nome"),
      supabase.from("turmas").select("id, nome, educador_id, dias_semana, periodo, oficina, bairro_ids, ativa").eq("ativa", true).order("nome"),
    ]);
    setCenarios(cen || []);
    setBairros(b || []);
    setProfiles(p || []);
    setTurmas(t || []);

    if (cen && cen.length > 0 && !activeCenarioId) {
      setActiveCenarioId(cen[0].id);
    }
    setLoading(false);
  }, [activeCenarioId]);

  useEffect(() => { loadData(); }, []);

  // Load slots when cenario changes
  useEffect(() => {
    if (!activeCenarioId) return;
    supabase.from("cronograma_slots").select("*").eq("cenario_id", activeCenarioId).then(({ data }) => {
      setSlots(data || []);
    });
  }, [activeCenarioId]);

  // Detect conflicts whenever slots change
  useEffect(() => {
    const newConflicts: string[] = [];
    // Check educator double-booking
    const educadorSlots = new Map<string, { dia: string; periodo: string; bairro: string }[]>();
    slots.forEach(s => {
      if (!s.educador_id) return;
      const key = s.educador_id;
      if (!educadorSlots.has(key)) educadorSlots.set(key, []);
      educadorSlots.get(key)!.push({ dia: s.dia_semana, periodo: s.periodo, bairro: s.bairro_id || "" });
    });
    educadorSlots.forEach((entries, edId) => {
      const seen = new Map<string, string>();
      entries.forEach(e => {
        const timeKey = `${e.dia}-${e.periodo}`;
        if (seen.has(timeKey) && seen.get(timeKey) !== e.bairro) {
          const prof = profiles.find(p => p.id === edId);
          newConflicts.push(`${prof?.nome || "Educador"} está em 2 locais: ${e.dia} ${PERIODO_LABELS[e.periodo]}`);
        }
        seen.set(timeKey, e.bairro);
      });
    });
    // Same check for oficineiro
    const oficineiroSlots = new Map<string, { dia: string; periodo: string; bairro: string }[]>();
    slots.forEach(s => {
      if (!s.oficineiro_id) return;
      const key = s.oficineiro_id;
      if (!oficineiroSlots.has(key)) oficineiroSlots.set(key, []);
      oficineiroSlots.get(key)!.push({ dia: s.dia_semana, periodo: s.periodo, bairro: s.bairro_id || "" });
    });
    oficineiroSlots.forEach((entries, ofId) => {
      const seen = new Map<string, string>();
      entries.forEach(e => {
        const timeKey = `${e.dia}-${e.periodo}`;
        if (seen.has(timeKey) && seen.get(timeKey) !== e.bairro) {
          const prof = profiles.find(p => p.id === ofId);
          newConflicts.push(`${prof?.nome || "Oficineiro"} está em 2 locais: ${e.dia} ${PERIODO_LABELS[e.periodo]}`);
        }
        seen.set(timeKey, e.bairro);
      });
    });
    // Check minimum days per bairro
    bairros.forEach(b => {
      const bairroSlots = slots.filter(s => s.bairro_id === b.id);
      const uniqueDays = new Set(bairroSlots.map(s => s.dia_semana));
      if (uniqueDays.size < 2 && bairroSlots.length > 0) {
        newConflicts.push(`${b.nome}: apenas ${uniqueDays.size} dia(s) de atendimento`);
      }
    });
    setConflicts(newConflicts);
  }, [slots, profiles, bairros]);

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
    // Copy slots
    const newSlots = slots.map(s => ({
      cenario_id: newCen.id,
      dia_semana: s.dia_semana,
      periodo: s.periodo,
      bairro_id: s.bairro_id,
      educador_id: s.educador_id,
      oficineiro_id: s.oficineiro_id,
      tipo_atividade: s.tipo_atividade,
      turma_id: s.turma_id,
      notas: s.notas,
    }));
    if (newSlots.length > 0) {
      await supabase.from("cronograma_slots").insert(newSlots);
    }
    setCenarios(prev => [newCen, ...prev]);
    setActiveCenarioId(newCen.id);
    toast.success("Cenário duplicado!");
  };

  const deleteCenario = async () => {
    if (!activeCenarioId) return;
    if (!confirm("Excluir este cenário e todos seus slots?")) return;
    await supabase.from("cronograma_cenarios").delete().eq("id", activeCenarioId);
    setCenarios(prev => prev.filter(c => c.id !== activeCenarioId));
    setActiveCenarioId(cenarios.find(c => c.id !== activeCenarioId)?.id || null);
    setSlots([]);
    toast.success("Cenário excluído");
  };

  const getSlot = (dia: string, periodo: string, bairroId: string) => {
    return slots.find(s => s.dia_semana === dia && s.periodo === periodo && s.bairro_id === bairroId);
  };

  const openSlotEditor = (dia: string, periodo: string, bairroId: string) => {
    const existing = getSlot(dia, periodo, bairroId);
    setEditSlot({ dia, periodo, bairroId });
    setSlotForm(existing ? { ...existing } : {
      dia_semana: dia,
      periodo,
      bairro_id: bairroId,
      educador_id: null,
      oficineiro_id: null,
      tipo_atividade: null,
      turma_id: null,
      notas: null,
    });
  };

  const saveSlot = async () => {
    if (!activeCenarioId || !editSlot) return;
    setSaving(true);
    const existing = getSlot(editSlot.dia, editSlot.periodo, editSlot.bairroId);
    if (existing) {
      const { error } = await supabase.from("cronograma_slots").update({
        educador_id: slotForm.educador_id || null,
        oficineiro_id: slotForm.oficineiro_id || null,
        tipo_atividade: slotForm.tipo_atividade || null,
        turma_id: slotForm.turma_id || null,
        notas: slotForm.notas || null,
      } as any).eq("id", existing.id);
      if (error) { toast.error(error.message); setSaving(false); return; }
      setSlots(prev => prev.map(s => s.id === existing.id ? { ...s, ...slotForm } as Slot : s));
    } else {
      const { data, error } = await supabase.from("cronograma_slots").insert({
        cenario_id: activeCenarioId,
        dia_semana: editSlot.dia,
        periodo: editSlot.periodo,
        bairro_id: editSlot.bairroId,
        educador_id: slotForm.educador_id || null,
        oficineiro_id: slotForm.oficineiro_id || null,
        tipo_atividade: slotForm.tipo_atividade || null,
        turma_id: slotForm.turma_id || null,
        notas: slotForm.notas || null,
      }).select("*").single();
      if (error || !data) { toast.error(error?.message || "Erro"); setSaving(false); return; }
      setSlots(prev => [...prev, data]);
    }
    setEditSlot(null);
    setSaving(false);
  };

  const removeSlot = async () => {
    if (!editSlot) return;
    const existing = getSlot(editSlot.dia, editSlot.periodo, editSlot.bairroId);
    if (!existing) { setEditSlot(null); return; }
    await supabase.from("cronograma_slots").delete().eq("id", existing.id);
    setSlots(prev => prev.filter(s => s.id !== existing.id));
    setEditSlot(null);
    toast.success("Slot removido");
  };

  const profName = (id: string | null) => profiles.find(p => p.id === id)?.nome || "";
  const bairroName = (id: string | null) => bairros.find(b => b.id === id)?.nome || "";

  if (loading) return <div className="p-6 text-muted-foreground text-sm">Carregando...</div>;

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold text-foreground">Cronograma Semanal</h1>
          <p className="text-xs text-muted-foreground">Monte o cronograma de atividades por bairro, período e dia</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={activeCenarioId || ""} onValueChange={setActiveCenarioId}>
            <SelectTrigger className="h-8 text-xs w-48">
              <SelectValue placeholder="Selecione cenário" />
            </SelectTrigger>
            <SelectContent>
              {cenarios.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Dialog open={newCenarioOpen} onOpenChange={setNewCenarioOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="h-8 text-xs gap-1"><Plus className="h-3.5 w-3.5" />Novo</Button>
            </DialogTrigger>
            <DialogContent className="max-w-sm">
              <DialogHeader><DialogTitle>Novo Cenário</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs">Nome do cenário</Label>
                  <Input value={newCenarioName} onChange={e => setNewCenarioName(e.target.value)} placeholder="Ex: Proposta A" className="h-8 text-sm" />
                </div>
                <Button onClick={createCenario} className="w-full" size="sm">Criar</Button>
              </div>
            </DialogContent>
          </Dialog>
          {activeCenarioId && (
            <>
              <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={duplicateCenario}>
                <Copy className="h-3.5 w-3.5" />Duplicar
              </Button>
              <Button size="sm" variant="destructive" className="h-8 text-xs gap-1" onClick={deleteCenario}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Conflicts */}
      {conflicts.length > 0 && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <span className="text-sm font-medium text-destructive">Conflitos detectados</span>
            </div>
            <ul className="space-y-0.5">
              {conflicts.map((c, i) => (
                <li key={i} className="text-xs text-destructive/80">• {c}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {!activeCenarioId ? (
        <div className="text-sm text-muted-foreground border border-dashed rounded-lg p-12 text-center">
          Crie um cenário para começar a montar o cronograma.
        </div>
      ) : (
        <ScrollArea className="w-full">
          <div className="min-w-[800px]">
            {/* Header */}
            <div className="grid grid-cols-[140px_repeat(5,1fr)] gap-1 mb-1">
              <div className="text-xs font-medium text-muted-foreground p-2">Bairro / Período</div>
              {DIAS.map(dia => (
                <div key={dia} className="text-xs font-medium text-center p-2 bg-muted rounded">{dia}</div>
              ))}
            </div>

            {/* Rows: bairro × período */}
            {bairros.map(bairro => (
              PERIODOS.map(periodo => (
                <div key={`${bairro.id}-${periodo}`} className="grid grid-cols-[140px_repeat(5,1fr)] gap-1 mb-1">
                  <div className="text-xs p-2 bg-muted/50 rounded flex flex-col justify-center">
                    <span className="font-medium text-foreground">{bairro.nome}</span>
                    <span className="text-muted-foreground">{PERIODO_LABELS[periodo]}</span>
                  </div>
                  {DIAS.map(dia => {
                    const slot = getSlot(dia, periodo, bairro.id);
                    const hasConflict = slot && conflicts.some(c =>
                      c.includes(dia) && c.includes(PERIODO_LABELS[periodo])
                    );
                    return (
                      <div
                        key={dia}
                        onClick={() => openSlotEditor(dia, periodo, bairro.id)}
                        className={`min-h-[60px] rounded border p-1.5 cursor-pointer transition-all hover:ring-2 hover:ring-primary/30 ${
                          slot ? (hasConflict ? "bg-destructive/10 border-destructive/30" : "bg-primary/5 border-primary/20") : "bg-background border-border hover:bg-muted/30"
                        }`}
                      >
                        {slot ? (
                          <div className="space-y-0.5">
                            {slot.tipo_atividade && (
                              <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4">{slot.tipo_atividade}</Badge>
                            )}
                            {slot.educador_id && (
                              <p className="text-[10px] text-foreground truncate">👤 {profName(slot.educador_id)}</p>
                            )}
                            {slot.oficineiro_id && (
                              <p className="text-[10px] text-muted-foreground truncate">🥋 {profName(slot.oficineiro_id)}</p>
                            )}
                            {slot.notas && (
                              <p className="text-[9px] text-muted-foreground italic truncate">{slot.notas}</p>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center justify-center h-full">
                            <Plus className="h-3 w-3 text-muted-foreground/30" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))
            ))}
          </div>
        </ScrollArea>
      )}

      {/* Slot editor dialog */}
      <Dialog open={!!editSlot} onOpenChange={(v) => { if (!v) setEditSlot(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm">
              {editSlot && `${editSlot.dia} · ${PERIODO_LABELS[editSlot.periodo]} · ${bairroName(editSlot.bairroId)}`}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Tipo de atividade</Label>
              <Input
                value={slotForm.tipo_atividade || ""}
                onChange={e => setSlotForm(f => ({ ...f, tipo_atividade: e.target.value }))}
                placeholder="Ex: SCFV, Karatê, Música..."
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Educador</Label>
              <Select value={slotForm.educador_id || "__none"} onValueChange={v => setSlotForm(f => ({ ...f, educador_id: v === "__none" ? null : v }))}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Nenhum" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">Nenhum</SelectItem>
                  {profiles.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.nome} {p.cargo ? `(${p.cargo})` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Oficineiro</Label>
              <Select value={slotForm.oficineiro_id || "__none"} onValueChange={v => setSlotForm(f => ({ ...f, oficineiro_id: v === "__none" ? null : v }))}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Nenhum" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">Nenhum</SelectItem>
                  {profiles.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Turma vinculada</Label>
              <Select value={slotForm.turma_id || "__none"} onValueChange={v => setSlotForm(f => ({ ...f, turma_id: v === "__none" ? null : v }))}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Nenhuma" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">Nenhuma</SelectItem>
                  {turmas.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Notas</Label>
              <Input
                value={slotForm.notas || ""}
                onChange={e => setSlotForm(f => ({ ...f, notas: e.target.value }))}
                placeholder="Observações..."
                className="h-8 text-sm"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={saveSlot} disabled={saving} className="flex-1" size="sm">
                <Check className="h-3.5 w-3.5 mr-1" />Salvar
              </Button>
              {getSlot(editSlot?.dia || "", editSlot?.periodo || "", editSlot?.bairroId || "") && (
                <Button onClick={removeSlot} variant="destructive" size="sm">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
