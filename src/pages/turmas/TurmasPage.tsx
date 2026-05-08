import { useState, useEffect, useMemo } from "react";
import { Plus, Users, Download, Trash2, CheckSquare, RefreshCw, Search, X } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { exportAllListasPresenca } from "@/lib/exportListaPresenca";
import { useIsDemo, guardDemo } from "@/hooks/useIsDemo";

const periodoLabel: Record<string, string> = { manha: "Manhã", tarde: "Tarde", integral: "Integral" };
const faixaLabel: Record<string, string> = { "6-8": "6-8 anos", "9-11": "9-11 anos", "12-17": "12-17 anos", idosos: "Idosos" };
const diasLabel: Record<string, string> = { seg: "Seg", ter: "Ter", qua: "Qua", qui: "Qui", sex: "Sex", sab: "Sáb" };
const MESES_NOMES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

interface TurmaRow {
  id: string; nome: string; periodo: string | null; faixa_etaria: string | null;
  tipo: string | null; ativa: boolean | null; dias_semana: string[] | null;
  educador_id: string | null; bairro_id: string | null;
  faixas_etarias?: string[] | null; bairro_ids?: string[] | null;
  profiles?: { nome: string } | null; bairros?: { nome: string } | null;
  participante_count: number;
  participante_nomes?: string[];
}

const TurmasPage = () => {
  const [turmas, setTurmas] = useState<TurmaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportMes, setExportMes] = useState(String(new Date().getMonth() + 1));
  const [exportAno, setExportAno] = useState(String(new Date().getFullYear()));
  const [exporting, setExporting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TurmaRow | null>(null);
  const [deleteJustificativa, setDeleteJustificativa] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [isCoordenacao, setIsCoordenacao] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [filtroPeriodo, setFiltroPeriodo] = useState<string>("todos");
  const [filtroFaixa, setFiltroFaixa] = useState<string>("todas");
  const [filtroAtiva, setFiltroAtiva] = useState<string>("todas");

  // Batch selection
  const [batchMode, setBatchMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchDeleteOpen, setBatchDeleteOpen] = useState(false);
  const [batchJustificativa, setBatchJustificativa] = useState("");
  const [recalcOpen, setRecalcOpen] = useState(false);
  const [recalculando, setRecalculando] = useState(false);
  const [recalcResult, setRecalcResult] = useState<any>(null);

  const isDemo = useIsDemo();

  useEffect(() => { fetchTurmas(); }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "coordenacao").then(({ data }) => {
          setIsCoordenacao((data?.length || 0) > 0);
        });
      }
    });
  }, []);

  const fetchTurmas = async () => {
    setLoading(true);
    const [{ data }, { data: tpData }] = await Promise.all([
      supabase.from("turmas").select("*, profiles(nome), bairros(nome)").order("nome"),
      supabase.from("turma_participantes").select("turma_id, participantes(nome_completo)"),
    ]);
    if (data) {
      const countMap: Record<string, number> = {};
      const nomesMap: Record<string, string[]> = {};
      (tpData || []).forEach((tp: any) => {
        countMap[tp.turma_id] = (countMap[tp.turma_id] || 0) + 1;
        const nome = tp.participantes?.nome_completo;
        if (nome) {
          if (!nomesMap[tp.turma_id]) nomesMap[tp.turma_id] = [];
          nomesMap[tp.turma_id].push(nome);
        }
      });
      setTurmas(data.map((t) => ({
        ...t,
        participante_count: countMap[t.id] || 0,
        participante_nomes: nomesMap[t.id] || [],
      } as TurmaRow)));
    }
    setLoading(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    if (guardDemo(isDemo)) return;
    if (!isCoordenacao && !deleteJustificativa.trim()) { toast.error("Justificativa é obrigatória"); return; }
    setDeleting(true);

    await supabase.from("turma_participantes").delete().eq("turma_id", deleteTarget.id);

    const { error } = await supabase.from("turmas").delete().eq("id", deleteTarget.id);
    if (error) { toast.error("Erro ao excluir: " + error.message); setDeleting(false); return; }

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: prof } = await supabase.from("profiles").select("nome, user_id").eq("user_id", user.id).single();
      await supabase.from("audit_log").insert({
        user_id: user.id,
        user_nome: prof?.nome || user.email,
        tabela: "turmas",
        acao: "exclusao",
        registro_id: deleteTarget.id,
        detalhes: `Turma "${deleteTarget.nome}" excluída`,
        justificativa: deleteJustificativa.trim() || null,
      });
    }

    toast.success(`Turma "${deleteTarget.nome}" excluída`);
    setDeleteTarget(null);
    setDeleteJustificativa("");
    setDeleting(false);
    fetchTurmas();
  };

  const handleBatchDelete = async () => {
    if (guardDemo(isDemo)) return;
    if (!isCoordenacao && !batchJustificativa.trim()) { toast.error("Justificativa é obrigatória"); return; }
    setDeleting(true);

    const ids = Array.from(selectedIds);
    const names = turmas.filter(t => selectedIds.has(t.id)).map(t => t.nome);

    // Remove participant links for all selected
    await supabase.from("turma_participantes").delete().in("turma_id", ids);

    const { error } = await supabase.from("turmas").delete().in("id", ids);
    if (error) { toast.error("Erro ao excluir: " + error.message); setDeleting(false); return; }

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: prof } = await supabase.from("profiles").select("nome, user_id").eq("user_id", user.id).single();
      await supabase.from("audit_log").insert(ids.map((id, i) => ({
        user_id: user.id,
        user_nome: prof?.nome || user.email,
        tabela: "turmas",
        acao: "exclusao_lote",
        registro_id: id,
        detalhes: `Turma "${names[i]}" excluída em lote (${ids.length} turmas)`,
        justificativa: batchJustificativa.trim() || null,
      })));
    }

    toast.success(`${ids.length} turma(s) excluída(s)`);
    setBatchDeleteOpen(false);
    setBatchJustificativa("");
    setSelectedIds(new Set());
    setBatchMode(false);
    setDeleting(false);
    fetchTurmas();
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === turmas.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(turmas.map(t => t.id)));
    }
  };

  const exitBatchMode = () => {
    setBatchMode(false);
    setSelectedIds(new Set());
  };

  const normalize = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  const filteredTurmas = useMemo(() => {
    const q = normalize(search.trim());
    return turmas.filter((t) => {
      if (filtroPeriodo !== "todos" && t.periodo !== filtroPeriodo) return false;
      if (filtroFaixa !== "todas") {
        const faixas = t.faixas_etarias && t.faixas_etarias.length > 0
          ? t.faixas_etarias
          : t.faixa_etaria ? [t.faixa_etaria] : [];
        if (!faixas.includes(filtroFaixa)) return false;
      }
      if (filtroAtiva === "ativas" && !t.ativa) return false;
      if (filtroAtiva === "inativas" && t.ativa) return false;
      if (q) {
        const nomeMatch = normalize(t.nome).includes(q);
        const participanteMatch = (t.participante_nomes || []).some(n => normalize(n).includes(q));
        if (!nomeMatch && !participanteMatch) return false;
      }
      return true;
    });
  }, [turmas, search, filtroPeriodo, filtroFaixa, filtroAtiva]);

  const matchedParticipants = useMemo(() => {
    const q = normalize(search.trim());
    if (!q) return {} as Record<string, string[]>;
    const map: Record<string, string[]> = {};
    filteredTurmas.forEach(t => {
      const matches = (t.participante_nomes || []).filter(n => normalize(n).includes(q));
      if (matches.length) map[t.id] = matches.slice(0, 3);
    });
    return map;
  }, [filteredTurmas, search]);

  const hasFilters = search.trim() !== "" || filtroPeriodo !== "todos" || filtroFaixa !== "todas" || filtroAtiva !== "todas";
  const clearFilters = () => { setSearch(""); setFiltroPeriodo("todos"); setFiltroFaixa("todas"); setFiltroAtiva("todas"); };

  const exportAllListas = async () => {
    setExporting(true);
    try {
      const mesNum = parseInt(exportMes);
      const anoNum = parseInt(exportAno);
      const ativas = turmas.filter(t => t.ativa);
      if (!ativas.length) { toast.error("Nenhuma turma ativa"); return; }

      const { data: allTp } = await supabase.from("turma_participantes").select("turma_id, participante_id, participantes(nome_completo, status)");
      const membersByTurma: Record<string, { nome: string; busca_ativa?: boolean }[]> = {};
      (allTp || []).forEach((tp: any) => {
        if (tp.participantes?.status === "desligado") return;
        if (!membersByTurma[tp.turma_id]) membersByTurma[tp.turma_id] = [];
        membersByTurma[tp.turma_id].push({
          nome: tp.participantes?.nome_completo || "",
          busca_ativa: tp.participantes?.status === "busca_ativa",
        });
      });

      const turmasWithProfiles = ativas.map(t => ({
        ...t,
        profiles: t.profiles || undefined,
        bairros: t.bairros || undefined,
      }));

      const result = exportAllListasPresenca(turmasWithProfiles, membersByTurma, mesNum, anoNum);
      if (!result.success) { toast.error("Nenhuma turma com dias de atividade neste mês"); return; }
      toast.success(`${result.sheetsAdded} lista(s) exportada(s)!`);
      setExportOpen(false);
    } catch (e: any) {
      toast.error("Erro ao exportar: " + e.message);
    } finally {
      setExporting(false);
    }
  };

  const handleRecalcular = async () => {
    if (guardDemo(isDemo)) return;
    setRecalculando(true);
    setRecalcResult(null);
    const { data, error } = await supabase.rpc("recalcular_vinculos_turmas" as any);
    setRecalculando(false);
    if (error) { toast.error("Erro ao recalcular: " + error.message); return; }
    setRecalcResult(data);
    toast.success(`Recálculo concluído: +${(data as any)?.vinculos_adicionados || 0} / −${(data as any)?.vinculos_removidos || 0}`);
    fetchTurmas();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Turmas</h1>
          <p className="text-sm text-muted-foreground">
            {hasFilters ? `${filteredTurmas.length} de ${turmas.length}` : turmas.length} turma{turmas.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex gap-2">
          {batchMode ? (
            <>
              <Button size="sm" variant="outline" onClick={toggleSelectAll} className="text-xs">
                {selectedIds.size === turmas.length ? "Desmarcar todas" : "Selecionar todas"}
              </Button>
              <Button
                size="sm"
                variant="destructive"
                disabled={selectedIds.size === 0}
                onClick={() => setBatchDeleteOpen(true)}
                className="text-xs"
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" />Excluir {selectedIds.size > 0 ? `(${selectedIds.size})` : ""}
              </Button>
              <Button size="sm" variant="ghost" onClick={exitBatchMode} className="text-xs">
                Cancelar
              </Button>
            </>
          ) : (
            <>
              {isCoordenacao && (
                <>
                  <Button size="sm" variant="outline" onClick={() => setRecalcOpen(true)} className="text-xs">
                    <RefreshCw className="h-3.5 w-3.5 mr-1" />Recalcular vínculos
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setBatchMode(true)} className="text-xs">
                    <CheckSquare className="h-3.5 w-3.5 mr-1" />Excluir em lote
                  </Button>
                </>
              )}
              <Button size="sm" variant="outline" onClick={() => setExportOpen(true)}>
                <Download className="h-4 w-4 mr-1" />Listas de Presença
              </Button>
              <Button size="sm" asChild>
                <Link to="/turmas/nova"><Plus className="h-4 w-4 mr-1" />Nova Turma</Link>
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Search + filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por turma ou participante..."
            className="h-9 pl-7 pr-7 text-sm"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <Select value={filtroPeriodo} onValueChange={setFiltroPeriodo}>
          <SelectTrigger className="w-32 h-9 text-xs"><SelectValue placeholder="Período" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos períodos</SelectItem>
            <SelectItem value="manha">Manhã</SelectItem>
            <SelectItem value="tarde">Tarde</SelectItem>
            <SelectItem value="integral">Integral</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filtroFaixa} onValueChange={setFiltroFaixa}>
          <SelectTrigger className="w-36 h-9 text-xs"><SelectValue placeholder="Faixa etária" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas faixas</SelectItem>
            <SelectItem value="6-8">6-8 anos</SelectItem>
            <SelectItem value="9-11">9-11 anos</SelectItem>
            <SelectItem value="12-17">12-17 anos</SelectItem>
            <SelectItem value="idosos">Idosos</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filtroAtiva} onValueChange={setFiltroAtiva}>
          <SelectTrigger className="w-32 h-9 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas</SelectItem>
            <SelectItem value="ativas">Ativas</SelectItem>
            <SelectItem value="inativas">Inativas</SelectItem>
          </SelectContent>
        </Select>
        {hasFilters && (
          <Button size="sm" variant="ghost" onClick={clearFilters} className="h-9 text-xs">
            <X className="h-3.5 w-3.5 mr-1" />Limpar
          </Button>
        )}
      </div>

      {/* Recalcular vínculos dialog */}
      <Dialog open={recalcOpen} onOpenChange={(open) => { setRecalcOpen(open); if (!open) setRecalcResult(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Recalcular vínculos das turmas</DialogTitle>
            <DialogDescription>
              Reorganiza participantes ativos e em busca ativa nas turmas existentes com base em <strong>período</strong>, <strong>bairro</strong> e <strong>faixa etária</strong> do cadastro. Apenas divergências são corrigidas — vínculos corretos são preservados.
            </DialogDescription>
          </DialogHeader>
          {recalcResult ? (
            <div className="text-sm space-y-2 border rounded p-3 bg-muted/30">
              <div className="flex justify-between"><span>Vínculos adicionados:</span><strong className="text-green-700">+{recalcResult.vinculos_adicionados}</strong></div>
              <div className="flex justify-between"><span>Vínculos removidos:</span><strong className="text-destructive">−{recalcResult.vinculos_removidos}</strong></div>
              <div className="flex justify-between"><span>Sem turma compatível:</span><strong>{recalcResult.sem_turma_compativel}</strong></div>
              {recalcResult.sem_turma_compativel > 0 && (
                <details className="mt-2">
                  <summary className="text-xs text-muted-foreground cursor-pointer">Ver lista de participantes sem turma compatível</summary>
                  <div className="mt-1 max-h-40 overflow-y-auto text-xs space-y-0.5">
                    {(recalcResult.sem_turma_lista || []).map((p: any) => (
                      <div key={p.id}>• {p.nome} <span className="text-muted-foreground">({p.periodo || "?"} / {p.faixa || "sem faixa"})</span></div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          ) : (
            <div className="text-xs text-muted-foreground border-l-2 border-amber-500 pl-2 py-1">
              ⚠️ Esta ação modifica vínculos em massa. Garanta que os cadastros (período, bairro e data de nascimento) estão corretos antes de prosseguir.
            </div>
          )}
          <Button onClick={handleRecalcular} disabled={recalculando} className="w-full gap-1">
            <RefreshCw className={`h-4 w-4 ${recalculando ? "animate-spin" : ""}`} />
            {recalculando ? "Recalculando..." : recalcResult ? "Executar novamente" : "Executar recálculo"}
          </Button>
        </DialogContent>
      </Dialog>

      {/* Export dialog */}
      <Dialog open={exportOpen} onOpenChange={setExportOpen}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>Exportar Listas de Presença</DialogTitle>
            <DialogDescription>Gera um XLSX com uma aba por turma ativa, em branco para impressão.</DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Select value={exportMes} onValueChange={setExportMes}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{MESES_NOMES.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={exportAno} onValueChange={setExportAno}>
              <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
              <SelectContent>{[2025, 2026, 2027].map(a => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Button onClick={exportAllListas} disabled={exporting} className="w-full gap-1">
            <Download className="h-4 w-4" />{exporting ? "Gerando..." : "Gerar XLSX"}
          </Button>
        </DialogContent>
      </Dialog>

      {/* Single delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) { setDeleteTarget(null); setDeleteJustificativa(""); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir turma "{deleteTarget?.nome}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é irreversível. Os vínculos de participantes serão removidos, mas registros de presença, relatórios e planejamentos serão preservados como histórico.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div>
            <Label className="text-xs font-medium">Justificativa {isCoordenacao ? "(opcional)" : "*"}</Label>
            <Input value={deleteJustificativa} onChange={e => setDeleteJustificativa(e.target.value)} placeholder="Motivo da exclusão..." className="mt-1 h-9 text-sm" />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting || (!isCoordenacao && !deleteJustificativa.trim())} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Batch delete confirmation */}
      <AlertDialog open={batchDeleteOpen} onOpenChange={(open) => { if (!open) { setBatchDeleteOpen(false); setBatchJustificativa(""); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {selectedIds.size} turma(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é irreversível. Os vínculos de participantes serão removidos, mas registros de presença, relatórios e planejamentos serão preservados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="max-h-32 overflow-y-auto text-xs text-muted-foreground space-y-0.5 border rounded p-2">
            {turmas.filter(t => selectedIds.has(t.id)).map(t => (
              <div key={t.id}>• {t.nome}</div>
            ))}
          </div>
          <div>
            <Label className="text-xs font-medium">Justificativa {isCoordenacao ? "(opcional)" : "*"}</Label>
            <Input value={batchJustificativa} onChange={e => setBatchJustificativa(e.target.value)} placeholder="Motivo da exclusão em lote..." className="mt-1 h-9 text-sm" />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleBatchDelete} disabled={deleting || (!isCoordenacao && !batchJustificativa.trim())} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? "Excluindo..." : `Excluir ${selectedIds.size} turma(s)`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {loading ? (
        <div className="flex justify-center py-12"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
      ) : turmas.length === 0 ? (
        <div className="text-sm text-muted-foreground border border-dashed rounded-lg p-8 text-center">Nenhuma turma cadastrada.</div>
      ) : filteredTurmas.length === 0 ? (
        <div className="text-sm text-muted-foreground border border-dashed rounded-lg p-8 text-center">Nenhuma turma encontrada com os filtros aplicados.</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredTurmas.map((t) => (
            <Card key={t.id} className={`hover:shadow-md transition-shadow h-full relative group ${batchMode && selectedIds.has(t.id) ? "ring-2 ring-destructive/50" : ""}`}>
              {batchMode ? (
                <div className="cursor-pointer" onClick={() => toggleSelect(t.id)}>
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <Checkbox checked={selectedIds.has(t.id)} onCheckedChange={() => toggleSelect(t.id)} />
                        <h3 className="text-sm font-semibold text-foreground">{t.nome}</h3>
                      </div>
                      <Badge variant={t.ativa ? "default" : "secondary"} className="text-[10px]">{t.ativa ? "Ativa" : "Inativa"}</Badge>
                    </div>
                    <div className="flex flex-wrap gap-1.5 pl-6">
                      {t.periodo && <Badge variant="outline" className="text-[10px]">{periodoLabel[t.periodo]}</Badge>}
                      {(t.faixas_etarias && t.faixas_etarias.length > 0
                        ? t.faixas_etarias
                        : t.faixa_etaria ? [t.faixa_etaria] : []
                      ).map(f => (
                        <Badge key={f} variant="outline" className="text-[10px]">{faixaLabel[f] || f}</Badge>
                      ))}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground pl-6">
                      <Users className="h-3 w-3" />{t.participante_count} participante{t.participante_count !== 1 ? "s" : ""}
                    </div>
                  </CardContent>
                </div>
              ) : (
                <>
                  <Link to={`/turmas/${t.id}`}>
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-start justify-between">
                        <h3 className="text-sm font-semibold text-foreground pr-6">{t.nome}</h3>
                        <Badge variant={t.ativa ? "default" : "secondary"} className="text-[10px]">{t.ativa ? "Ativa" : "Inativa"}</Badge>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {t.periodo && <Badge variant="outline" className="text-[10px]">{periodoLabel[t.periodo]}</Badge>}
                        {(t.faixas_etarias && t.faixas_etarias.length > 0
                          ? t.faixas_etarias
                          : t.faixa_etaria ? [t.faixa_etaria] : []
                        ).map(f => (
                          <Badge key={f} variant="outline" className="text-[10px]">{faixaLabel[f] || f}</Badge>
                        ))}
                        {t.tipo === "extraordinaria" && <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">Extra</Badge>}
                      </div>
                      {t.dias_semana && t.dias_semana.length > 0 && (
                        <p className="text-xs text-muted-foreground">{t.dias_semana.map((d) => diasLabel[d] || d).join(", ")}</p>
                      )}
                      <div className="flex items-center justify-between pt-1">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Users className="h-3 w-3" />{t.participante_count} participante{t.participante_count !== 1 ? "s" : ""}
                        </div>
                        {t.profiles?.nome && <span className="text-xs text-muted-foreground truncate max-w-[120px]">{t.profiles.nome}</span>}
                      </div>
                    {matchedParticipants[t.id] && (
                      <div className="text-[10px] text-primary border-t pt-1.5 mt-1.5">
                        Match: {matchedParticipants[t.id].join(", ")}
                      </div>
                    )}
                    </CardContent>
                  </Link>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDeleteTarget(t); }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default TurmasPage;
