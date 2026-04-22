import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, MapPin, Clock, Power, PowerOff, Pencil, Trash2, Check, X, Bus, CheckCircle2, XCircle, CircleDashed, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { isBairroSCFV } from "@/lib/constants";
import { useAuth } from "@/contexts/AuthContext";

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
  const { user } = useAuth();
  const [isMotoristaOuCoord, setIsMotoristaOuCoord] = useState(false);
  const [pontos, setPontos] = useState<Ponto[]>([]);
  const [bairros, setBairros] = useState<Bairro[]>([]);
  const [participantesPorPonto, setParticipantesPorPonto] = useState<Record<string, { nome: string; periodo: string }[]>>({});
  const [loading, setLoading] = useState(true);
  const [openNew, setOpenNew] = useState(false);
  const [newForm, setNewForm] = useState({ nome: "", bairro_id: "", horario_manha: "", horario_tarde: "" });

  // Inline editing
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ nome: "", bairro_id: "", horario_manha: "", horario_tarde: "" });

  // Bulk selection
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkDialog, setBulkDialog] = useState<"horario" | "bairro" | null>(null);
  const [bulkValues, setBulkValues] = useState({ horario_manha: "", horario_tarde: "", bairro_id: "" });

  // Check-ins de hoje (visão motorista/coordenação)
  const [checkinsHoje, setCheckinsHoje] = useState<Record<string, any>>({});
  const [participantesPorPontoFull, setParticipantesPorPontoFull] = useState<Record<string, { id: string; nome: string; periodo: string }[]>>({});
  const [refreshingCheckins, setRefreshingCheckins] = useState(false);

  const hojeStr = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  const horaSP = parseInt(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo", hour: "numeric", hour12: false }), 10);
  const periodoAtual: "manha" | "tarde" = horaSP < 12 ? "manha" : "tarde";

  useEffect(() => { loadAll(); }, []);

  // Detect role
  useEffect(() => {
    (async () => {
      if (!user) return;
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      const roles = (data || []).map((r: any) => r.role);
      setIsMotoristaOuCoord(roles.includes("motorista") || roles.includes("coordenacao"));
    })();
  }, [user]);

  // Load today's checkins + auto-refresh 60s + realtime
  useEffect(() => {
    if (!isMotoristaOuCoord) return;
    loadCheckinsHoje();
    const interval = setInterval(loadCheckinsHoje, 60000);
    const channel = supabase
      .channel("checkins-hoje")
      .on("postgres_changes", { event: "*", schema: "public", table: "participante_checkins" }, () => loadCheckinsHoje())
      .subscribe();
    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [isMotoristaOuCoord, hojeStr]);

  const loadCheckinsHoje = async () => {
    setRefreshingCheckins(true);
    const [{ data: checkins }, { data: parts }] = await Promise.all([
      supabase.from("participante_checkins").select("*").eq("data", hojeStr),
      supabase.from("participantes").select("id, nome_completo, periodo, ponto_transporte_id").in("status", ["ativo", "busca_ativa"] as any),
    ]);
    const ckMap: Record<string, any> = {};
    (checkins || []).forEach((c: any) => {
      ckMap[`${c.participante_id}_${c.periodo}`] = c;
    });
    setCheckinsHoje(ckMap);
    const pMap: Record<string, { id: string; nome: string; periodo: string }[]> = {};
    (parts || []).forEach((p: any) => {
      if (p.ponto_transporte_id) {
        if (!pMap[p.ponto_transporte_id]) pMap[p.ponto_transporte_id] = [];
        pMap[p.ponto_transporte_id].push({ id: p.id, nome: p.nome_completo, periodo: p.periodo || "manha" });
      }
    });
    setParticipantesPorPontoFull(pMap);
    setRefreshingCheckins(false);
  };

  const marcarEmbarque = async (participanteId: string, embarcou: boolean) => {
    const key = `${participanteId}_${periodoAtual}`;
    const existing = checkinsHoje[key];
    if (existing) {
      await supabase.from("participante_checkins").update({
        embarcou,
        embarcou_em: new Date().toISOString(),
        embarcou_por: null, // será preenchido por trigger ou manualmente; mantém nulo p/ simplicidade
      } as any).eq("id", existing.id);
    } else {
      await supabase.from("participante_checkins").insert({
        participante_id: participanteId,
        data: hojeStr,
        periodo: periodoAtual,
        confirmado: embarcou,
        embarcou,
        embarcou_em: new Date().toISOString(),
      } as any);
    }
    toast.success(embarcou ? "Embarque registrado" : "Marcado como não embarcou");
    loadCheckinsHoje();
  };

  const horaBR = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });

  const loadAll = async () => {
    const [bRes, pRes, partRes] = await Promise.all([
      supabase.from("bairros").select("*").order("nome"),
      supabase.from("pontos_transporte").select("*").order("nome") as any,
      supabase.from("participantes").select("id, nome_completo, periodo, ponto_transporte_id").in("status", ["ativo", "busca_ativa"] as any),
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

  const bairrosSCFV = bairros.filter(b => isBairroSCFV(b.nome));

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

  const startEdit = (pt: Ponto) => {
    setEditingId(pt.id);
    setEditForm({ nome: pt.nome, bairro_id: pt.bairro_id || "", horario_manha: pt.horario_manha || "", horario_tarde: pt.horario_tarde || "" });
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const { error } = await supabase.from("pontos_transporte").update({
      nome: editForm.nome,
      bairro_id: editForm.bairro_id || null,
      horario_manha: editForm.horario_manha || null,
      horario_tarde: editForm.horario_tarde || null,
    } as any).eq("id", editingId);
    if (error) { toast.error(error.message); return; }
    toast.success("Ponto atualizado");
    setEditingId(null);
    loadAll();
  };

  const deletePonto = async (id: string) => {
    const { error } = await supabase.from("pontos_transporte").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Ponto excluído");
    loadAll();
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const bulkToggleAtivo = async (ativo: boolean) => {
    const ids = Array.from(selected);
    for (const id of ids) {
      await supabase.from("pontos_transporte").update({ ativo } as any).eq("id", id);
    }
    toast.success(`${ids.length} pontos ${ativo ? "ativados" : "desligados"}`);
    setSelected(new Set());
    loadAll();
  };

  const bulkUpdateHorario = async () => {
    const ids = Array.from(selected);
    const payload: any = {};
    if (bulkValues.horario_manha) payload.horario_manha = bulkValues.horario_manha;
    if (bulkValues.horario_tarde) payload.horario_tarde = bulkValues.horario_tarde;
    if (!Object.keys(payload).length) { toast.error("Preencha ao menos um horário"); return; }
    for (const id of ids) {
      await supabase.from("pontos_transporte").update(payload).eq("id", id);
    }
    toast.success(`Horários atualizados em ${ids.length} pontos`);
    setBulkDialog(null);
    setBulkValues({ horario_manha: "", horario_tarde: "", bairro_id: "" });
    setSelected(new Set());
    loadAll();
  };

  const bulkUpdateBairro = async () => {
    if (!bulkValues.bairro_id) { toast.error("Selecione um bairro"); return; }
    const ids = Array.from(selected);
    for (const id of ids) {
      await supabase.from("pontos_transporte").update({ bairro_id: bulkValues.bairro_id } as any).eq("id", id);
    }
    toast.success(`Bairro atualizado em ${ids.length} pontos`);
    setBulkDialog(null);
    setBulkValues({ horario_manha: "", horario_tarde: "", bairro_id: "" });
    setSelected(new Set());
    loadAll();
  };

  const bairroNome = (id: string | null) => bairros.find(b => b.id === id)?.nome || "Sem bairro";

  const grouped: Record<string, Ponto[]> = {};
  pontos.forEach(p => {
    const key = bairroNome(p.bairro_id);
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(p);
  });

  if (loading) return <p className="text-sm text-muted-foreground p-4">Carregando...</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-semibold text-foreground">Transporte — Pontos</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => { setBulkMode(!bulkMode); setSelected(new Set()); }}>
            {bulkMode ? "Sair seleção" : "Seleção em massa"}
          </Button>
          <Button size="sm" onClick={() => setOpenNew(true)}><Plus className="h-4 w-4 mr-1" /> Novo Ponto</Button>
        </div>
      </div>

      {/* Bulk action bar */}
      {bulkMode && selected.size > 0 && (
        <Card className="border-primary/50">
          <CardContent className="flex flex-wrap items-center gap-2 py-3">
            <Badge variant="secondary">{selected.size} selecionado(s)</Badge>
            <Button size="sm" variant="outline" onClick={() => setBulkDialog("horario")}><Clock className="h-3.5 w-3.5 mr-1" />Alterar Horários</Button>
            <Button size="sm" variant="outline" onClick={() => setBulkDialog("bairro")}><MapPin className="h-3.5 w-3.5 mr-1" />Alterar Bairro</Button>
            <Button size="sm" variant="outline" onClick={() => bulkToggleAtivo(true)}><Power className="h-3.5 w-3.5 mr-1" />Ativar</Button>
            <Button size="sm" variant="outline" onClick={() => bulkToggleAtivo(false)}><PowerOff className="h-3.5 w-3.5 mr-1" />Desligar</Button>
          </CardContent>
        </Card>
      )}

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
              const isEditing = editingId === pt.id;

              return (
                <div key={pt.id} className={`border rounded-lg p-3 space-y-2 ${pt.ativo === false ? "opacity-50" : ""}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {bulkMode && (
                        <Checkbox checked={selected.has(pt.id)} onCheckedChange={() => toggleSelect(pt.id)} />
                      )}
                      {isEditing ? (
                        <Input className="h-7 text-sm w-40" value={editForm.nome} onChange={e => setEditForm({ ...editForm, nome: e.target.value })} />
                      ) : (
                        <span className="font-medium text-sm">{pt.nome}</span>
                      )}
                      {pt.ativo === false && <Badge variant="secondary" className="text-[10px]">Desligado</Badge>}
                    </div>
                    <div className="flex gap-1">
                      {isEditing ? (
                        <>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={saveEdit}><Check className="h-3.5 w-3.5 text-green-600" /></Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingId(null)}><X className="h-3.5 w-3.5" /></Button>
                        </>
                      ) : (
                        <>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(pt)}><Pencil className="h-3.5 w-3.5" /></Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => toggleAtivo(pt)}>
                            {pt.ativo !== false ? <PowerOff className="h-3.5 w-3.5" /> : <Power className="h-3.5 w-3.5" />}
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Excluir ponto?</AlertDialogTitle>
                                <AlertDialogDescription>Tem certeza que deseja excluir "{pt.nome}"? Esta ação não pode ser desfeita.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deletePonto(pt.id)}>Excluir</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </>
                      )}
                    </div>
                  </div>

                  {isEditing && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      <div>
                        <Label className="text-[10px]">Bairro</Label>
                        <Select value={editForm.bairro_id} onValueChange={v => setEditForm({ ...editForm, bairro_id: v })}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
                          <SelectContent>{bairrosSCFV.map(b => <SelectItem key={b.id} value={b.id}>{b.nome}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div><Label className="text-[10px]">Horário Manhã</Label>
                        <Input className="h-8 text-xs" type="time" value={editForm.horario_manha} onChange={e => setEditForm({ ...editForm, horario_manha: e.target.value })} />
                      </div>
                      <div><Label className="text-[10px]">Horário Tarde</Label>
                        <Input className="h-8 text-xs" type="time" value={editForm.horario_tarde} onChange={e => setEditForm({ ...editForm, horario_tarde: e.target.value })} />
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

      {/* New point dialog */}
      <Dialog open={openNew} onOpenChange={setOpenNew}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo Ponto de Transporte</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div><Label>Nome *</Label><Input value={newForm.nome} onChange={e => setNewForm({ ...newForm, nome: e.target.value })} /></div>
            <div>
              <Label>Bairro</Label>
              <Select value={newForm.bairro_id} onValueChange={v => setNewForm({ ...newForm, bairro_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{bairrosSCFV.map(b => <SelectItem key={b.id} value={b.id}>{b.nome}</SelectItem>)}</SelectContent>
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

      {/* Bulk horario dialog */}
      <Dialog open={bulkDialog === "horario"} onOpenChange={() => setBulkDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Alterar Horários em Massa</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">{selected.size} pontos selecionados. Preencha os horários que deseja alterar (campos vazios não serão alterados).</p>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Horário Manhã</Label><Input type="time" value={bulkValues.horario_manha} onChange={e => setBulkValues({ ...bulkValues, horario_manha: e.target.value })} /></div>
            <div><Label>Horário Tarde</Label><Input type="time" value={bulkValues.horario_tarde} onChange={e => setBulkValues({ ...bulkValues, horario_tarde: e.target.value })} /></div>
          </div>
          <Button onClick={bulkUpdateHorario}>Aplicar</Button>
        </DialogContent>
      </Dialog>

      {/* Bulk bairro dialog */}
      <Dialog open={bulkDialog === "bairro"} onOpenChange={() => setBulkDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Alterar Bairro em Massa</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">{selected.size} pontos selecionados.</p>
          <Select value={bulkValues.bairro_id} onValueChange={v => setBulkValues({ ...bulkValues, bairro_id: v })}>
            <SelectTrigger><SelectValue placeholder="Selecione o bairro" /></SelectTrigger>
            <SelectContent>{bairrosSCFV.map(b => <SelectItem key={b.id} value={b.id}>{b.nome}</SelectItem>)}</SelectContent>
          </Select>
          <Button onClick={bulkUpdateBairro}>Aplicar</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
