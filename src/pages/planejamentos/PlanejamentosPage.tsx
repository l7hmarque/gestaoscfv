import { useEffect, useState } from "react";
import { Plus, FileText, Calendar, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAuditLog } from "@/hooks/useAuditLog";
import { toast } from "sonner";

const PlanejamentosPage = () => {
  const { user } = useAuth();
  const { log: auditLog } = useAuditLog();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
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
  const [bulkJustificativa, setBulkJustificativa] = useState("");

  useEffect(() => {
    if (user) {
      supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "coordenacao").then(({ data }) => {
        setIsCoordenacao((data?.length || 0) > 0);
      });
    }
  }, [user]);

  const loadData = async () => {
    const { data } = await supabase
      .from("planejamentos")
      .select("*, planejamento_turmas(turma_id, turmas(nome)), profiles!planejamentos_educador_id_fkey(nome)")
      .order("created_at", { ascending: false });
    setItems(data || []);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const handleBulkSearch = async () => {
    if (!bulkDateFrom || !bulkDateTo) { toast.error("Preencha ambas as datas"); return; }
    setBulkSearching(true);
    const { data } = await supabase
      .from("planejamentos")
      .select("id, titulo, data_aplicacao, profiles!planejamentos_educador_id_fkey(nome)")
      .gte("data_aplicacao", bulkDateFrom)
      .lte("data_aplicacao", bulkDateTo)
      .order("data_aplicacao", { ascending: false });
    setBulkResults(data || []);
    setBulkSelected(new Set());
    setBulkSearching(false);
  };

  const toggleSelect = (id: string) => {
    setBulkSelected(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  };
  const toggleAll = () => {
    setBulkSelected(bulkSelected.size === bulkResults.length ? new Set() : new Set(bulkResults.map((r: any) => r.id)));
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(bulkSelected);
    if (ids.length === 0) return;
    if (!bulkJustificativa.trim()) { toast.error("Informe a justificativa"); return; }
    setBulkDeleting(true);
    try {
      // Log audit
      await auditLog({
        acao: "exclusão em lote",
        tabela: "planejamentos",
        registro_id: ids.join(","),
        detalhes: `${ids.length} planejamento(s) excluído(s)`,
        justificativa: bulkJustificativa.trim(),
      });
      await supabase.from("planejamento_turmas").delete().in("planejamento_id", ids);
      const { error } = await supabase.from("planejamentos").delete().in("id", ids);
      if (error) throw error;
      toast.success(`${ids.length} planejamento(s) excluído(s)`);
      setBulkOpen(false);
      setBulkResults([]);
      setBulkSelected(new Set());
      setConfirmOpen(false);
      setBulkJustificativa("");
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
          <h1 className="text-xl font-semibold text-foreground">Planejamentos</h1>
          <p className="text-sm text-muted-foreground">Planejar atividades educativas</p>
        </div>
        <div className="flex gap-2">
          {isCoordenacao && (
            <Button variant="outline" size="sm" className="gap-1 text-xs text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => setBulkOpen(true)}>
              <Trash2 className="h-4 w-4" />Excluir em Lote
            </Button>
          )}
          <Button size="sm" asChild>
            <Link to="/planejamentos/novo"><Plus className="h-4 w-4 mr-1" />Novo</Link>
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground text-center py-8">Carregando...</div>
      ) : items.length === 0 ? (
        <div className="text-sm text-muted-foreground border border-dashed rounded-lg p-8 text-center">
          Nenhum planejamento cadastrado.
        </div>
      ) : (
        <div className="grid gap-3">
          {items.map(item => (
            <Link key={item.id} to={`/planejamentos/${item.id}`}>
              <Card className="hover:border-primary/40 transition-colors cursor-pointer">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-primary shrink-0" />
                        <span className="font-medium text-sm truncate">{item.titulo}</span>
                      </div>
                      {item.tema && <p className="text-xs text-muted-foreground mt-1 ml-6">Tema: {item.tema}</p>}
                      {item.profiles?.nome && <p className="text-xs text-muted-foreground ml-6">Educador: {item.profiles.nome}</p>}
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {item.data_aplicacao && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(item.data_aplicacao + "T12:00:00"), "dd/MM/yyyy")}
                        </span>
                      )}
                      {item.planejamento_turmas?.length > 0 && (
                        <div className="flex gap-1 flex-wrap justify-end">
                          {item.planejamento_turmas.map((pt: any) => (
                            <Badge key={pt.turma_id} variant="secondary" className="text-[10px] px-1.5 py-0">
                              {pt.turmas?.nome}
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

      {/* Bulk Delete Dialog */}
      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <Trash2 className="h-4 w-4 text-destructive" /> Excluir Planejamentos em Lote
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
                  <span className="text-sm text-muted-foreground">{bulkResults.length} planejamento(s)</span>
                  <Button variant="ghost" size="sm" className="text-xs" onClick={toggleAll}>
                    {bulkSelected.size === bulkResults.length ? "Desmarcar todos" : "Selecionar todos"}
                  </Button>
                </div>
                <div className="border rounded-lg divide-y max-h-60 overflow-y-auto">
                  {bulkResults.map((r: any) => (
                    <label key={r.id} className="flex items-center gap-3 p-2 hover:bg-muted/50 cursor-pointer text-sm">
                      <Checkbox checked={bulkSelected.has(r.id)} onCheckedChange={() => toggleSelect(r.id)} />
                      <div className="flex-1 min-w-0">
                        <p className="truncate font-medium text-xs">{r.titulo}</p>
                        <p className="text-xs text-muted-foreground">
                          {r.data_aplicacao ? format(new Date(r.data_aplicacao + "T12:00:00"), "dd/MM/yyyy") : "Sem data"}
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
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão em lote?</AlertDialogTitle>
            <AlertDialogDescription>
              Serão excluídos {bulkSelected.size} planejamento(s) e vínculos de turma. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label className="text-xs">Justificativa *</Label>
            <Textarea placeholder="Motivo da exclusão..." value={bulkJustificativa} onChange={e => setBulkJustificativa(e.target.value)} className="text-sm" />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete} disabled={bulkDeleting || !bulkJustificativa.trim()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {bulkDeleting ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default PlanejamentosPage;
