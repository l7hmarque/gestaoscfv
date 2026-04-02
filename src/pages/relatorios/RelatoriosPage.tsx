import { useEffect, useState } from "react";
import { Plus, ClipboardList, Calendar, Trophy, TrendingUp, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/fetchAllRows";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const OBJ_LABELS: Record<string, string> = { alcancado: "Alcançado", parcial: "Parcial", nao_alcancado: "Não Alcançado" };
const OBJ_VARIANT: Record<string, "default" | "secondary" | "destructive"> = { alcancado: "default", parcial: "secondary", nao_alcancado: "destructive" };

interface RankedActivity {
  planejamento_id: string;
  titulo: string;
  avgElo: number;
  totalParticipantes: number;
  count: number;
  objetivo: string;
}

const RelatoriosPage = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [ranking, setRanking] = useState<RankedActivity[]>([]);
  const [isCoordenacao, setIsCoordenacao] = useState(false);

  // Bulk delete state
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkDateFrom, setBulkDateFrom] = useState("");
  const [bulkDateTo, setBulkDateTo] = useState("");
  const [bulkResults, setBulkResults] = useState<any[]>([]);
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());
  const [bulkSearching, setBulkSearching] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (user) {
      supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "coordenacao").then(({ data }) => {
        setIsCoordenacao((data?.length || 0) > 0);
      });
    }
  }, [user]);

  const loadData = async () => {
    const [{ data }, { data: relElo }] = await Promise.all([
      supabase
        .from("relatorios_atividade")
        .select("*, relatorio_turmas(turma_id, turmas(nome)), profiles!relatorios_atividade_educador_id_fkey(nome), planejamentos!relatorios_atividade_planejamento_id_fkey(titulo)")
        .order("data", { ascending: false }),
      supabase
        .from("relatorios_atividade")
        .select("planejamento_id, score_elo, num_participantes, objetivo_alcancado, planejamentos!relatorios_atividade_planejamento_id_fkey(titulo)")
        .not("score_elo", "is", null)
        .not("planejamento_id", "is", null),
    ]);
    setItems(data || []);

    const groups: Record<string, { titulo: string; totalWeightedElo: number; totalWeight: number; totalPart: number; count: number; objs: Record<string, number> }> = {};
    (relElo || []).forEach((r: any) => {
      const pid = r.planejamento_id;
      const np = r.num_participantes || 0;
      if (np < 5) return;
      if (!groups[pid]) groups[pid] = { titulo: r.planejamentos?.titulo || "—", totalWeightedElo: 0, totalWeight: 0, totalPart: 0, count: 0, objs: {} };
      groups[pid].totalWeightedElo += (r.score_elo || 0) * np;
      groups[pid].totalWeight += np;
      groups[pid].totalPart += np;
      groups[pid].count += 1;
      if (r.objetivo_alcancado) groups[pid].objs[r.objetivo_alcancado] = (groups[pid].objs[r.objetivo_alcancado] || 0) + 1;
    });

    const ranked = Object.entries(groups)
      .map(([pid, g]) => ({
        planejamento_id: pid,
        titulo: g.titulo,
        avgElo: g.totalWeight > 0 ? g.totalWeightedElo / g.totalWeight : 0,
        totalParticipantes: g.totalPart,
        count: g.count,
        objetivo: Object.entries(g.objs).sort((a, b) => b[1] - a[1])[0]?.[0] || "",
      }))
      .sort((a, b) => b.avgElo - a.avgElo);
    setRanking(ranked);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const handleBulkSearch = async () => {
    if (!bulkDateFrom || !bulkDateTo) { toast.error("Preencha ambas as datas"); return; }
    setBulkSearching(true);
    const { data } = await supabase
      .from("relatorios_atividade")
      .select("id, nome_atividade, data, profiles!relatorios_atividade_educador_id_fkey(nome)")
      .gte("data", bulkDateFrom)
      .lte("data", bulkDateTo)
      .order("data", { ascending: false });
    setBulkResults(data || []);
    setBulkSelected(new Set());
    setBulkSearching(false);
  };

  const toggleSelect = (id: string) => {
    setBulkSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (bulkSelected.size === bulkResults.length) {
      setBulkSelected(new Set());
    } else {
      setBulkSelected(new Set(bulkResults.map((r: any) => r.id)));
    }
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(bulkSelected);
    if (ids.length === 0) return;
    setBulkDeleting(true);
    try {
      await Promise.all([
        supabase.from("relatorio_presenca").delete().in("relatorio_id", ids),
        supabase.from("relatorio_fotos").delete().in("relatorio_id", ids),
        supabase.from("relatorio_turmas").delete().in("relatorio_id", ids),
      ]);
      const { error } = await supabase.from("relatorios_atividade").delete().in("id", ids);
      if (error) throw error;
      toast.success(`${ids.length} relatório(s) excluído(s)`);
      setBulkOpen(false);
      setBulkResults([]);
      setBulkSelected(new Set());
      setConfirmOpen(false);
      loadData();
    } catch (e: any) {
      toast.error(e.message || "Erro ao excluir");
    } finally {
      setBulkDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Relatórios de Atividade</h1>
          <p className="text-sm text-muted-foreground">Registrar e acompanhar atividades realizadas</p>
        </div>
        <div className="flex gap-2">
          {isCoordenacao && (
            <Button variant="outline" size="sm" className="gap-1 text-xs text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => setBulkOpen(true)}>
              <Trash2 className="h-4 w-4" />Excluir em Lote
            </Button>
          )}
          <Button size="sm" asChild>
            <Link to="/relatorios/novo"><Plus className="h-4 w-4 mr-1" />Novo</Link>
          </Button>
        </div>
      </div>

      <Tabs defaultValue="lista">
        <TabsList>
          <TabsTrigger value="lista" className="text-xs">Lista</TabsTrigger>
          <TabsTrigger value="ranking" className="text-xs">Ranking ELO</TabsTrigger>
        </TabsList>

        <TabsContent value="lista">
          {loading ? (
            <div className="text-sm text-muted-foreground text-center py-8">Carregando...</div>
          ) : items.length === 0 ? (
            <div className="text-sm text-muted-foreground border border-dashed rounded-lg p-8 text-center">
              Nenhum relatório cadastrado.
            </div>
          ) : (
            <div className="grid gap-3">
              {items.map(item => (
                <Link key={item.id} to={`/relatorios/${item.id}`}>
                  <Card className="hover:border-primary/40 transition-colors cursor-pointer">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <ClipboardList className="h-4 w-4 text-primary shrink-0" />
                            <span className="font-medium text-sm truncate">{item.nome_atividade || "Sem nome"}</span>
                          </div>
                          {item.profiles?.nome && <p className="text-xs text-muted-foreground mt-1 ml-6">Educador: {item.profiles.nome}</p>}
                          <p className="text-xs text-muted-foreground ml-6">
                            ELO: {item.score_elo?.toFixed(2) || "—"} · {item.num_participantes ?? 0}/{item.num_matriculados ?? 0} presentes
                          </p>
                          {item.planejamentos?.titulo && (
                            <p className="text-xs text-muted-foreground ml-6 mt-0.5">📋 {item.planejamentos.titulo}</p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(item.data + "T12:00:00"), "dd/MM/yyyy")}
                          </span>
                          {item.objetivo_alcancado && (
                            <Badge variant={OBJ_VARIANT[item.objetivo_alcancado] || "secondary"} className="text-[10px] px-1.5 py-0">
                              {OBJ_LABELS[item.objetivo_alcancado] || item.objetivo_alcancado}
                            </Badge>
                          )}
                          {item.relatorio_turmas?.length > 0 && (
                            <div className="flex gap-1 flex-wrap justify-end">
                              {item.relatorio_turmas.map((rt: any) => (
                                <Badge key={rt.turma_id} variant="secondary" className="text-[10px] px-1.5 py-0">
                                  {rt.turmas?.nome}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="ranking">
          {ranking.length === 0 ? (
            <div className="text-sm text-muted-foreground border border-dashed rounded-lg p-8 text-center">
              Nenhuma atividade com dados suficientes (mínimo 5 participantes e planejamento vinculado).
            </div>
          ) : (
            <div className="grid gap-3">
              {ranking.map((r, idx) => (
                <Link key={r.planejamento_id} to={`/planejamentos/${r.planejamento_id}`}>
                  <Card className="hover:border-primary/40 transition-colors cursor-pointer">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`flex items-center justify-center w-8 h-8 rounded-full shrink-0 text-sm font-bold ${idx === 0 ? "bg-yellow-100 text-yellow-700" : idx === 1 ? "bg-gray-100 text-gray-600" : idx === 2 ? "bg-orange-100 text-orange-700" : "bg-muted text-muted-foreground"}`}>
                            {idx + 1}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">{r.titulo}</p>
                            <p className="text-xs text-muted-foreground">{r.count} relatório(s) · {r.totalParticipantes} participantes total</p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <div className="flex items-center gap-1">
                            <TrendingUp className="h-3.5 w-3.5 text-primary" />
                            <span className="font-bold text-sm text-primary">{r.avgElo.toFixed(2)}</span>
                          </div>
                          {r.objetivo && (
                            <Badge variant={OBJ_VARIANT[r.objetivo] || "secondary"} className="text-[10px] px-1.5 py-0">
                              {OBJ_LABELS[r.objetivo] || r.objetivo}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Bulk Delete Dialog */}
      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <Trash2 className="h-4 w-4 text-destructive" /> Excluir Relatórios em Lote
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">De</Label>
                <Input type="date" value={bulkDateFrom} onChange={e => setBulkDateFrom(e.target.value)} className="text-sm" />
              </div>
              <div>
                <Label className="text-xs">Até</Label>
                <Input type="date" value={bulkDateTo} onChange={e => setBulkDateTo(e.target.value)} className="text-sm" />
              </div>
            </div>
            <Button size="sm" onClick={handleBulkSearch} disabled={bulkSearching}>
              {bulkSearching ? "Buscando..." : "Buscar"}
            </Button>

            {bulkResults.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{bulkResults.length} relatório(s) encontrado(s)</span>
                  <Button variant="ghost" size="sm" className="text-xs" onClick={toggleAll}>
                    {bulkSelected.size === bulkResults.length ? "Desmarcar todos" : "Selecionar todos"}
                  </Button>
                </div>
                <div className="border rounded-lg divide-y max-h-60 overflow-y-auto">
                  {bulkResults.map((r: any) => (
                    <label key={r.id} className="flex items-center gap-3 p-2 hover:bg-muted/50 cursor-pointer text-sm">
                      <Checkbox checked={bulkSelected.has(r.id)} onCheckedChange={() => toggleSelect(r.id)} />
                      <div className="flex-1 min-w-0">
                        <p className="truncate font-medium text-xs">{r.nome_atividade || "Sem nome"}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(r.data + "T12:00:00"), "dd/MM/yyyy")}
                          {r.profiles?.nome && ` · ${r.profiles.nome}`}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
                {bulkSelected.size > 0 && (
                  <Button variant="destructive" size="sm" className="w-full" onClick={() => setConfirmOpen(true)}>
                    Excluir {bulkSelected.size} selecionado(s)
                  </Button>
                )}
              </div>
            )}
            {bulkResults.length === 0 && bulkDateFrom && bulkDateTo && !bulkSearching && (
              <p className="text-sm text-muted-foreground text-center py-2">Nenhum relatório encontrado no período.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm bulk delete */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão em lote?</AlertDialogTitle>
            <AlertDialogDescription>
              Serão excluídos {bulkSelected.size} relatório(s) e todos os dados vinculados (presença, fotos, turmas). Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete} disabled={bulkDeleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {bulkDeleting ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default RelatoriosPage;
