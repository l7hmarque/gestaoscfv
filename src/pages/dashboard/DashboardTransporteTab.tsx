import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, MapPin, Clock, Power, PowerOff } from "lucide-react";
import { toast } from "sonner";

interface Ponto {
  id: string;
  nome: string;
  bairro_id: string | null;
  ativo: boolean | null;
  horario_manha: string | null;
  horario_tarde: string | null;
}

interface Bairro { id: string; nome: string; }

export default function DashboardTransporteTab() {
  const [pontos, setPontos] = useState<Ponto[]>([]);
  const [bairros, setBairros] = useState<Bairro[]>([]);
  const [participantesPorPonto, setParticipantesPorPonto] = useState<Record<string, { nome: string; periodo: string }[]>>({});
  const [loading, setLoading] = useState(true);
  const [openNew, setOpenNew] = useState(false);
  const [newForm, setNewForm] = useState({ nome: "", bairro_id: "", horario_manha: "", horario_tarde: "" });
  const [editingHorario, setEditingHorario] = useState<string | null>(null);
  const [horarioForm, setHorarioForm] = useState({ horario_manha: "", horario_tarde: "" });

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    const [bRes, pRes, partRes] = await Promise.all([
      supabase.from("bairros").select("*").order("nome"),
      supabase.from("pontos_transporte").select("*").order("nome") as any,
      supabase.from("participantes").select("id, nome_completo, periodo, ponto_transporte_id").eq("status", "ativo"),
    ]);
    setBairros(bRes.data || []);
    setPontos(pRes.data || []);
    
    const map: Record<string, { nome: string; periodo: string }[]> = {};
    (partRes.data || []).forEach((p: any) => {
      if (p.ponto_transporte_id) {
        if (!map[p.ponto_transporte_id]) map[p.ponto_transporte_id] = [];
        map[p.ponto_transporte_id].push({ nome: p.nome_completo, periodo: p.periodo || "manha" });
      }
    });
    setParticipantesPorPonto(map);
    setLoading(false);
  };

  const handleAddPonto = async () => {
    if (!newForm.nome.trim()) { toast.error("Nome obrigatório"); return; }
    const { error } = await supabase.from("pontos_transporte").insert({
      nome: newForm.nome, bairro_id: newForm.bairro_id || null,
      horario_manha: newForm.horario_manha || null, horario_tarde: newForm.horario_tarde || null,
    } as any);
    if (error) { toast.error(error.message); return; }
    toast.success("Ponto adicionado");
    setOpenNew(false);
    setNewForm({ nome: "", bairro_id: "", horario_manha: "", horario_tarde: "" });
    loadAll();
  };

  const toggleAtivo = async (ponto: Ponto) => {
    await supabase.from("pontos_transporte").update({ ativo: !ponto.ativo } as any).eq("id", ponto.id);
    toast.success(ponto.ativo ? "Ponto desligado" : "Ponto reativado");
    loadAll();
  };

  const saveHorario = async (pontoId: string) => {
    await supabase.from("pontos_transporte").update({
      horario_manha: horarioForm.horario_manha || null,
      horario_tarde: horarioForm.horario_tarde || null,
    } as any).eq("id", pontoId);
    toast.success("Horários atualizados");
    setEditingHorario(null);
    loadAll();
  };

  const bairroNome = (id: string | null) => bairros.find(b => b.id === id)?.nome || "Sem bairro";

  // Group pontos by bairro
  const grouped: Record<string, Ponto[]> = {};
  pontos.forEach(p => {
    const key = bairroNome(p.bairro_id);
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(p);
  });

  if (loading) return <p className="text-sm text-muted-foreground p-4">Carregando...</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Transporte — Pontos</h2>
        <Button size="sm" onClick={() => setOpenNew(true)}><Plus className="h-4 w-4 mr-1" /> Novo Ponto</Button>
      </div>

      {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([bairro, pts]) => (
        <Card key={bairro}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><MapPin className="h-4 w-4" /> {bairro}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pts.map(pt => {
              const parts = participantesPorPonto[pt.id] || [];
              const manha = parts.filter(p => p.periodo === "manha" || p.periodo === "integral");
              const tarde = parts.filter(p => p.periodo === "tarde" || p.periodo === "integral");
              const isEditing = editingHorario === pt.id;
              return (
                <div key={pt.id} className={`border rounded-lg p-3 space-y-2 ${pt.ativo === false ? "opacity-50" : ""}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{pt.nome}</span>
                      {pt.ativo === false && <Badge variant="secondary" className="text-[10px]">Desligado</Badge>}
                    </div>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => {
                        if (isEditing) { saveHorario(pt.id); } else {
                          setEditingHorario(pt.id);
                          setHorarioForm({ horario_manha: pt.horario_manha || "", horario_tarde: pt.horario_tarde || "" });
                        }
                      }}>
                        <Clock className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => toggleAtivo(pt)}>
                        {pt.ativo !== false ? <PowerOff className="h-3.5 w-3.5" /> : <Power className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                  </div>

                  {isEditing && (
                    <div className="grid grid-cols-2 gap-2">
                      <div><Label className="text-[10px]">Horário Manhã</Label>
                        <Input className="h-8 text-xs" type="time" value={horarioForm.horario_manha} onChange={e => setHorarioForm({ ...horarioForm, horario_manha: e.target.value })} />
                      </div>
                      <div><Label className="text-[10px]">Horário Tarde</Label>
                        <Input className="h-8 text-xs" type="time" value={horarioForm.horario_tarde} onChange={e => setHorarioForm({ ...horarioForm, horario_tarde: e.target.value })} />
                      </div>
                    </div>
                  )}

                  {!isEditing && (pt.horario_manha || pt.horario_tarde) && (
                    <div className="flex gap-3 text-[10px] text-muted-foreground">
                      {pt.horario_manha && <span>🌅 Manhã: {pt.horario_manha}</span>}
                      {pt.horario_tarde && <span>🌇 Tarde: {pt.horario_tarde}</span>}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <p className="font-medium text-muted-foreground mb-1">Manhã ({manha.length})</p>
                      {manha.length ? manha.map((p, i) => <p key={i} className="text-foreground">{p.nome}</p>) : <p className="text-muted-foreground italic">—</p>}
                    </div>
                    <div>
                      <p className="font-medium text-muted-foreground mb-1">Tarde ({tarde.length})</p>
                      {tarde.length ? tarde.map((p, i) => <p key={i} className="text-foreground">{p.nome}</p>) : <p className="text-muted-foreground italic">—</p>}
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}

      <Dialog open={openNew} onOpenChange={setOpenNew}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo Ponto de Transporte</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div><Label>Nome *</Label><Input value={newForm.nome} onChange={e => setNewForm({ ...newForm, nome: e.target.value })} /></div>
            <div>
              <Label>Bairro</Label>
              <Select value={newForm.bairro_id} onValueChange={v => setNewForm({ ...newForm, bairro_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{bairros.map(b => <SelectItem key={b.id} value={b.id}>{b.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Horário Manhã</Label><Input type="time" value={newForm.horario_manha} onChange={e => setNewForm({ ...newForm, horario_manha: e.target.value })} /></div>
              <div><Label>Horário Tarde</Label><Input type="time" value={newForm.horario_tarde} onChange={e => setNewForm({ ...newForm, horario_tarde: e.target.value })} /></div>
            </div>
            <Button onClick={handleAddPonto}>Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
