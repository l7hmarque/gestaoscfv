import { useState, useEffect } from "react";
import { Plus, Users, Download, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
    const { data } = await supabase.from("turmas").select("*, profiles(nome), bairros(nome)").order("nome");
    if (data) {
      const counts = await Promise.all(data.map((t) =>
        supabase.from("turma_participantes").select("id", { count: "exact", head: true }).eq("turma_id", t.id)
      ));
      setTurmas(data.map((t, i) => ({ ...t, participante_count: counts[i].count || 0 } as TurmaRow)));
    }
    setLoading(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    if (guardDemo(isDemo)) return;
    if (!isCoordenacao && !deleteJustificativa.trim()) { toast.error("Justificativa é obrigatória"); return; }
    setDeleting(true);

    // Remove only participant links (turma_participantes) to allow deletion
    // Preserve presenca, relatorios, planejamentos and chamadas for historical records
    await supabase.from("turma_participantes").delete().eq("turma_id", deleteTarget.id);

    const { error } = await supabase.from("turmas").delete().eq("id", deleteTarget.id);
    if (error) { toast.error("Erro ao excluir: " + error.message); setDeleting(false); return; }

    // Audit log
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
        justificativa: deleteJustificativa.trim(),
      });
    }

    toast.success(`Turma "${deleteTarget.nome}" excluída`);
    setDeleteTarget(null);
    setDeleteJustificativa("");
    setDeleting(false);
    fetchTurmas();
  };

  const exportAllListas = async () => {
    setExporting(true);
    try {
      const mesNum = parseInt(exportMes);
      const anoNum = parseInt(exportAno);
      const ativas = turmas.filter(t => t.ativa);
      if (!ativas.length) { toast.error("Nenhuma turma ativa"); return; }

      const { data: allTp } = await supabase.from("turma_participantes").select("turma_id, participante_id, participantes(nome_completo, status)");
      const membersByTurma: Record<string, { nome: string }[]> = {};
      (allTp || []).forEach((tp: any) => {
        if (tp.participantes?.status === "desligado") return;
        if (!membersByTurma[tp.turma_id]) membersByTurma[tp.turma_id] = [];
        membersByTurma[tp.turma_id].push({ nome: tp.participantes?.nome_completo || "" });
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Turmas</h1>
          <p className="text-sm text-muted-foreground">{turmas.length} turma{turmas.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setExportOpen(true)}>
            <Download className="h-4 w-4 mr-1" />Listas de Presença
          </Button>
          <Button size="sm" asChild>
            <Link to="/turmas/nova"><Plus className="h-4 w-4 mr-1" />Nova Turma</Link>
          </Button>
        </div>
      </div>

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

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) { setDeleteTarget(null); setDeleteJustificativa(""); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir turma "{deleteTarget?.nome}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é irreversível. Os vínculos de participantes serão removidos, mas registros de presença, relatórios e planejamentos serão preservados como histórico.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {!isCoordenacao && (
            <div>
              <Label className="text-xs font-medium">Justificativa *</Label>
              <Input value={deleteJustificativa} onChange={e => setDeleteJustificativa(e.target.value)} placeholder="Motivo da exclusão..." className="mt-1 h-9 text-sm" />
            </div>
          )}
          {isCoordenacao && (
            <div>
              <Label className="text-xs font-medium">Justificativa (opcional)</Label>
              <Input value={deleteJustificativa} onChange={e => setDeleteJustificativa(e.target.value)} placeholder="Motivo da exclusão..." className="mt-1 h-9 text-sm" />
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting || (!isCoordenacao && !deleteJustificativa.trim())} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {loading ? (
        <div className="flex justify-center py-12"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
      ) : turmas.length === 0 ? (
        <div className="text-sm text-muted-foreground border border-dashed rounded-lg p-8 text-center">Nenhuma turma cadastrada.</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {turmas.map((t) => (
            <Card key={t.id} className="hover:shadow-md transition-shadow h-full relative group">
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
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default TurmasPage;
