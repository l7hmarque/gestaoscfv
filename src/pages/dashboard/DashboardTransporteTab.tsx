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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useSearchParams } from "react-router-dom";
import { Plus, MapPin, Clock, Power, PowerOff, Pencil, Trash2, Check, X, Bus, CheckCircle2, XCircle, CircleDashed, RefreshCw, ArrowUp, ArrowDown, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { isBairroSCFV } from "@/lib/constants";
import { useAuth } from "@/contexts/AuthContext";
import { gerarRelatorioTransporteDia } from "@/lib/transporteRelatorio";
import { useTransporteOffline } from "@/hooks/useTransporteOffline";
import { salvarSnapshot, carregarSnapshot } from "@/lib/offlineDB";
import { Wifi, WifiOff, CloudUpload, Hourglass } from "lucide-react";

interface Ponto {
  id: string;
  nome: string;
  bairro_id: string | null;
  ativo: boolean | null;
  horario_manha: string | null;
  horario_tarde: string | null;
  ordem?: number | null;
}

interface Bairro { id: string; nome: string; }

export default function DashboardTransporteTab() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const subTab = (searchParams.get("sub") === "pontos" ? "pontos" : "embarques") as "embarques" | "pontos";
  const setSubTab = (v: "embarques" | "pontos") => {
    const next = new URLSearchParams(searchParams);
    next.set("sub", v);
    setSearchParams(next, { replace: true });
  };
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

  const { online, pendentes, pendentesMap, sincronizando, sincronizar, marcarEmbarqueOffline } = useTransporteOffline(() => {
    // após sincronizar, recarrega da rede
    loadCheckinsHoje();
  });

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
    const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
    if (!isOnline) {
      // Modo offline: tenta carregar snapshot salvo
      try {
        const snap = await carregarSnapshot(hojeStr);
        if (snap) {
          const ckMap: Record<string, any> = {};
          (snap.checkins || []).forEach((c: any) => { ckMap[`${c.participante_id}_${c.periodo}`] = c; });
          setCheckinsHoje(ckMap);
          const pMap: Record<string, { id: string; nome: string; periodo: string }[]> = {};
          (snap.participantes || []).forEach((p: any) => {
            if (p.ponto_transporte_id) {
              if (!pMap[p.ponto_transporte_id]) pMap[p.ponto_transporte_id] = [];
              pMap[p.ponto_transporte_id].push({ id: p.id, nome: p.nome_completo, periodo: p.periodo || "manha" });
            }
          });
          setParticipantesPorPontoFull(pMap);
        }
      } catch (e) { console.error(e); }
      setRefreshingCheckins(false);
      return;
    }
    try {
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
      // salva snapshot para uso offline (inclui pontos e bairros já em memória)
      try {
        await salvarSnapshot({
          data: hojeStr,
          salvo_em: new Date().toISOString(),
          pontos,
          bairros,
          participantes: (parts || []) as any,
          checkins: (checkins || []) as any,
        });
      } catch (e) { console.error("[offline] snapshot falhou", e); }
    } catch (e) {
      console.error(e);
    } finally {
      setRefreshingCheckins(false);
    }
  };

  const marcarEmbarque = async (participanteId: string, embarcou: boolean) => {
    const res = await marcarEmbarqueOffline({
      participante_id: participanteId,
      data: hojeStr,
      periodo: periodoAtual,
      embarcou,
    });
    // atualização otimista no estado local
    setCheckinsHoje(prev => ({
      ...prev,
      [`${participanteId}_${periodoAtual}`]: {
        ...(prev[`${participanteId}_${periodoAtual}`] || {}),
        participante_id: participanteId,
        data: hojeStr,
        periodo: periodoAtual,
        embarcou,
        embarcou_em: new Date().toISOString(),
      },
    }));
    if (res.enviado) {
      toast.success(embarcou ? "Embarque registrado" : "Marcado como não embarcou");
      loadCheckinsHoje();
    } else {
      toast.warning(`📴 Sem internet — salvo no celular (${embarcou ? "embarcou" : "não embarcou"}). Será enviado quando voltar o sinal.`);
    }
  };

  const horaBR = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });

  const loadAll = async () => {
    const [bRes, pRes, partRes] = await Promise.all([
      supabase.from("bairros").select("*").order("nome"),
      supabase.from("pontos_transporte").select("*").order("ordem").order("nome") as any,
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
  // Ordena pontos dentro de cada bairro por `ordem` (e nome como fallback)
  Object.keys(grouped).forEach(k => {
    grouped[k].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0) || a.nome.localeCompare(b.nome, "pt-BR"));
  });

  /** Reordena ponto dentro do bairro trocando posição com o vizinho. */
  const moverPonto = async (pt: Ponto, direcao: "up" | "down") => {
    const irmaos = grouped[bairroNome(pt.bairro_id)] || [];
    const idx = irmaos.findIndex(p => p.id === pt.id);
    const alvoIdx = direcao === "up" ? idx - 1 : idx + 1;
    if (alvoIdx < 0 || alvoIdx >= irmaos.length) return;
    const a = irmaos[idx];
    const b = irmaos[alvoIdx];
    const ordemA = a.ordem ?? idx + 1;
    const ordemB = b.ordem ?? alvoIdx + 1;
    await Promise.all([
      supabase.from("pontos_transporte").update({ ordem: ordemB } as any).eq("id", a.id),
      supabase.from("pontos_transporte").update({ ordem: ordemA } as any).eq("id", b.id),
    ]);
    loadAll();
  };

  const exportarRelatorio = async () => {
    try {
      toast.info("Gerando relatório...");
      await gerarRelatorioTransporteDia(hojeStr, periodoAtual);
      toast.success("Relatório gerado");
    } catch (e: any) {
      toast.error(e.message || "Falha ao gerar relatório");
    }
  };

  if (loading) return <p className="text-sm text-muted-foreground p-4">Carregando...</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-semibold text-foreground">Transporte</h2>
        <div className="flex gap-2">
          {subTab === "pontos" && (
            <>
              <Button variant="outline" size="sm" onClick={() => { setBulkMode(!bulkMode); setSelected(new Set()); }}>
                {bulkMode ? "Sair seleção" : "Seleção em massa"}
              </Button>
              <Button size="sm" onClick={() => setOpenNew(true)}><Plus className="h-4 w-4 mr-1" /> Novo Ponto</Button>
            </>
          )}
        </div>
      </div>

      <Tabs value={subTab} onValueChange={(v) => setSubTab(v as any)} className="w-full">
        <TabsList className="grid grid-cols-2 w-full sm:w-auto sm:inline-grid">
          <TabsTrigger value="embarques">Embarques de Hoje</TabsTrigger>
          <TabsTrigger value="pontos">Pontos & Rotas</TabsTrigger>
        </TabsList>

        <TabsContent value="embarques" className="space-y-4 mt-4">
          {!isMotoristaOuCoord && (
            <p className="text-sm text-muted-foreground italic p-4 border rounded-md">
              Somente motoristas e coordenação visualizam os embarques diários.
            </p>
          )}
          {isMotoristaOuCoord && (
        <Card className="border-l-4 border-l-blue-600">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Bus className="h-4 w-4" /> Embarques de hoje
              <Badge variant="outline" className="text-[10px] ml-1">
                {periodoAtual === "manha" ? "🌅 Manhã" : "🌇 Tarde"} · {new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}
              </Badge>
              {online ? (
                <Badge variant="outline" className="text-[10px] gap-1 border-emerald-600 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30">
                  <Wifi className="h-3 w-3" /> Online
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[10px] gap-1 border-orange-600 text-orange-700 bg-orange-50 dark:bg-orange-950/30 animate-pulse">
                  <WifiOff className="h-3 w-3" /> Offline
                </Badge>
              )}
              {pendentes.length > 0 && (
                <Badge variant="outline" className="text-[10px] gap-1 border-amber-600 text-amber-800 bg-amber-50 dark:bg-amber-950/30">
                  <Hourglass className="h-3 w-3" /> {pendentes.length} aguardando envio
                </Badge>
              )}
            </CardTitle>
            <div className="flex gap-1">
              {pendentes.length > 0 && (
                <Button size="sm" variant="outline" onClick={sincronizar} disabled={!online || sincronizando} className="h-7 gap-1 text-xs">
                  <CloudUpload className={`h-3 w-3 ${sincronizando ? "animate-pulse" : ""}`} /> Sincronizar agora
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={exportarRelatorio} className="h-7 gap-1 text-xs">
                <FileSpreadsheet className="h-3 w-3" /> Relatório do dia
              </Button>
              <Button size="sm" variant="ghost" onClick={loadCheckinsHoje} disabled={refreshingCheckins} className="h-7 gap-1 text-xs">
                <RefreshCw className={`h-3 w-3 ${refreshingCheckins ? "animate-spin" : ""}`} /> Atualizar
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {!online && (
              <div className="rounded-md border border-orange-300 bg-orange-50 dark:bg-orange-950/20 px-3 py-2 text-xs text-orange-900 dark:text-orange-200 flex items-start gap-2">
                <WifiOff className="h-4 w-4 mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold">Modo offline ativo</p>
                  <p>Pode marcar embarques normalmente — tudo será enviado automaticamente quando o sinal voltar.</p>
                </div>
              </div>
            )}
            {Object.entries(grouped)
              .sort(([a], [b]) => a.localeCompare(b, "pt-BR"))
              .map(([bairro, pts]) => {
                const pontosAtivos = pts.filter(pt => pt.ativo !== false);
                const blocos = pontosAtivos.map(pt => {
                  const todos = (participantesPorPontoFull[pt.id] || [])
                    .filter(p => p.periodo === periodoAtual || p.periodo === "integral")
                    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
                  return { pt, todos };
                }).filter(b => b.todos.length > 0);
                if (blocos.length === 0) return null;

                const totBairro = blocos.reduce((s, b) => s + b.todos.length, 0);
                const confBairro = blocos.reduce((s, b) => s + b.todos.filter(p => checkinsHoje[`${p.id}_${periodoAtual}`]?.confirmado === true).length, 0);
                const embBairro = blocos.reduce((s, b) => s + b.todos.filter(p => checkinsHoje[`${p.id}_${periodoAtual}`]?.embarcou === true).length, 0);

                return (
                  <div key={bairro} className="rounded-lg border-2 border-blue-200 dark:border-blue-900 overflow-hidden">
                    <div className="bg-blue-50 dark:bg-blue-950/40 px-3 py-2 flex items-center justify-between flex-wrap gap-2">
                      <span className="font-bold text-sm flex items-center gap-1.5 text-blue-900 dark:text-blue-200 uppercase tracking-wide">
                        <MapPin className="h-4 w-4" /> {bairro}
                      </span>
                      <div className="text-[11px] flex gap-3">
                        <span className="text-muted-foreground">{blocos.length} ponto{blocos.length > 1 ? "s" : ""}</span>
                        <span className="text-emerald-700 font-semibold">✅ {embBairro}/{totBairro} embarcaram</span>
                        <span className="text-blue-700 font-semibold">🟢 {confBairro} confirmados</span>
                      </div>
                    </div>
                    <div className="p-3 space-y-3">
                      {blocos.map(({ pt, todos }, blocoIdx) => {
              const confirmados = todos.filter(p => checkinsHoje[`${p.id}_${periodoAtual}`]?.confirmado === true).length;
              const naoVai = todos.filter(p => checkinsHoje[`${p.id}_${periodoAtual}`]?.confirmado === false).length;
              const pendentes = todos.length - confirmados - naoVai;
              const horarioParada = periodoAtual === "manha" ? pt.horario_manha : pt.horario_tarde;

              return (
                <div key={pt.id} className="border rounded-lg p-3 space-y-2 bg-muted/20">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="font-semibold text-sm flex items-center gap-1.5">
                      <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-blue-600 text-white text-[10px] font-bold">{blocoIdx + 1}</span>
                      {pt.nome}
                      {horarioParada && <span className="text-[10px] text-muted-foreground font-normal">⏱ {horarioParada}</span>}
                    </span>
                    <div className="flex gap-2 text-[11px]">
                      <span className="text-emerald-600 font-medium">🟢 {confirmados}</span>
                      <span className="text-red-600 font-medium">🔴 {naoVai}</span>
                      <span className="text-muted-foreground font-medium">⚪ {pendentes}</span>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    {todos.map(p => {
                      const ck = checkinsHoje[`${p.id}_${periodoAtual}`];
                      const confirmado = ck?.confirmado === true;
                      const recusado = ck?.confirmado === false;
                      const embarcou = ck?.embarcou === true;
                      const naoEmbarcou = ck?.embarcou === false;
                      const pend = pendentesMap[`${p.id}_${periodoAtual}`];

                       return (
                         <div key={p.id} className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-2 rounded border-l-4 text-xs ${
                          embarcou ? "bg-emerald-50 dark:bg-emerald-950/20 border-l-emerald-600" :
                          naoEmbarcou ? "bg-red-50 dark:bg-red-950/20 border-l-red-600 opacity-70" :
                          confirmado ? "bg-emerald-50/50 dark:bg-emerald-950/10 border-l-emerald-500" :
                          recusado ? "bg-red-50/50 dark:bg-red-950/10 border-l-red-500" :
                          "bg-background border-l-muted"
                        }`}>
                          <div className="flex-1 min-w-0">
                            <p className={`font-medium break-words leading-snug ${recusado || naoEmbarcou ? "line-through" : ""}`}>
                              {p.nome}
                              {pend && (
                                <Badge variant="outline" className="ml-1 text-[9px] gap-0.5 border-amber-500 text-amber-800 bg-amber-50 dark:bg-amber-950/30">
                                  <Hourglass className="h-2.5 w-2.5" /> aguardando envio
                                </Badge>
                              )}
                            </p>
                            <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                              {embarcou ? <><CheckCircle2 className="h-3 w-3 text-emerald-600" /> Motorista marcou embarque às {horaBR(ck.embarcou_em)}</> :
                               naoEmbarcou ? <><XCircle className="h-3 w-3 text-red-600" /> Motorista marcou ausência — {horaBR(ck.embarcou_em)}</> :
                               confirmado ? <><CheckCircle2 className="h-3 w-3 text-emerald-500" /> Família confirmou {horaBR(ck.confirmado_em)}{ck.confirmado_por ? ` · ${ck.confirmado_por}` : ""}</> :
                               recusado ? <><XCircle className="h-3 w-3 text-red-500" /> Família avisou que não vai{ck.observacao ? ` · "${ck.observacao}"` : ""}</> :
                               <><CircleDashed className="h-3 w-3" /> Sem confirmação até as 06:00</>}
                            </p>
                          </div>
                          {!embarcou && !naoEmbarcou && (
                            <div className="flex gap-1 shrink-0 w-full sm:w-auto">
                              <Button size="sm" variant="outline" className="h-9 sm:h-7 text-xs sm:text-[10px] gap-1 border-emerald-600 text-emerald-700 hover:bg-emerald-50 flex-1 sm:flex-none" onClick={() => marcarEmbarque(p.id, true)}>
                                <CheckCircle2 className="h-3.5 w-3.5 sm:h-3 sm:w-3" /> Embarcou
                              </Button>
                              <Button size="sm" variant="outline" className="h-9 sm:h-7 text-xs sm:text-[10px] gap-1 border-red-600 text-red-700 hover:bg-red-50 flex-1 sm:flex-none" onClick={() => marcarEmbarque(p.id, false)}>
                                <XCircle className="h-3.5 w-3.5 sm:h-3 sm:w-3" /> Não embarcou
                              </Button>
                            </div>
                          )}
                          {(embarcou || naoEmbarcou) && (
                            <Button size="sm" variant="ghost" className="h-7 text-xs self-end sm:self-auto" onClick={async () => {
                              await supabase.from("participante_checkins").update({ embarcou: null, embarcou_em: null } as any).eq("id", ck.id);
                              toast.info("Marcação removida");
                              loadCheckinsHoje();
                            }}>Desfazer</Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
                      })}
                    </div>
                  </div>
                );
              })}
            {pontos.filter(pt => pt.ativo !== false && (participantesPorPontoFull[pt.id] || []).some(p => p.periodo === periodoAtual || p.periodo === "integral")).length === 0 && (
              <p className="text-xs text-muted-foreground italic">Nenhum participante atribuído aos pontos para o período da {periodoAtual === "manha" ? "manhã" : "tarde"}.</p>
            )}
          </CardContent>
        </Card>
      )}

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
            <CardTitle className="text-sm flex items-center gap-2">
              <MapPin className="h-4 w-4" /> {bairro}
              <span className="text-[10px] font-normal text-muted-foreground ml-1">(use ↑↓ para ordenar a sequência do motorista)</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pts.map((pt, ptIdx) => {
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
                      <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-muted text-[11px] font-bold text-muted-foreground">{ptIdx + 1}</span>
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
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => moverPonto(pt, "up")} disabled={ptIdx === 0} title="Subir na ordem">
                            <ArrowUp className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => moverPonto(pt, "down")} disabled={ptIdx === pts.length - 1} title="Descer na ordem">
                            <ArrowDown className="h-3.5 w-3.5" />
                          </Button>
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
