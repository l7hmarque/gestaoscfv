import { useEffect, useState } from "react";
import { ArrowLeft, Printer, FileText, FileSpreadsheet, Instagram, Copy, Share2, Download, X, Trash2 } from "lucide-react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { exportRelatorioDocx, exportRelatorioPdf } from "@/hooks/useDocumentExport";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

const LIKERT_LABELS = ["", "Muito Baixo", "Baixo", "Moderado", "Alto", "Excepcional"];
const OBJ_LABELS: Record<string, string> = { alcancado: "Alcançado", parcial: "Parcial", nao_alcancado: "Não Alcançado" };

function LikertDisplay({ label, value }: { label: string; value: number | null }) {
  const v = value || 0;
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <div className="flex gap-0.5">
          {[1, 2, 3, 4, 5].map(n => (
            <div key={n} className={cn("w-5 h-5 rounded text-[10px] flex items-center justify-center font-medium", n <= v ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>{n}</div>
          ))}
        </div>
        <span className="text-xs text-muted-foreground w-20 text-right">{LIKERT_LABELS[v]}</span>
      </div>
    </div>
  );
}

const RelatorioDetalhePage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [item, setItem] = useState<any>(null);
  const [turmaNames, setTurmaNames] = useState<string[]>([]);
  const [fotos, setFotos] = useState<any[]>([]);
  const [presenca, setPresenca] = useState<any[]>([]);
  const [planejamentoLink, setPlanejamentoLink] = useState<{ id: string; titulo: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const [instaOpen, setInstaOpen] = useState(false);
  const [instaText, setInstaText] = useState("");
  const [instaLoading, setInstaLoading] = useState(false);
  const [isCoordenacao, setIsCoordenacao] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (user) {
      supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "coordenacao").then(({ data }) => {
        setIsCoordenacao((data?.length || 0) > 0);
      });
    }
  }, [user]);

  useEffect(() => {
    const fetch = async () => {
      const [r, f, p] = await Promise.all([
        supabase.from("relatorios_atividade")
          .select("*, relatorio_turmas(turma_id, turmas(nome)), profiles!relatorios_atividade_educador_id_fkey(nome)")
          .eq("id", id).single(),
        supabase.from("relatorio_fotos").select("*").eq("relatorio_id", id).order("ordem"),
        supabase.from("relatorio_presenca").select("*, participantes(nome_completo)").eq("relatorio_id", id),
      ]);
      if (r.data) {
        setItem(r.data);
        setTurmaNames(r.data.relatorio_turmas?.map((rt: any) => rt.turmas?.nome).filter(Boolean) || []);
        // Fetch linked planejamento title
        if (r.data.planejamento_id) {
          const { data: plan } = await supabase.from("planejamentos").select("id, titulo").eq("id", r.data.planejamento_id).single();
          if (plan) setPlanejamentoLink(plan);
        }
      }
      if (f.data) setFotos(f.data);
      if (p.data) setPresenca(p.data.sort((a: any, b: any) => (a.participantes?.nome_completo || "").localeCompare(b.participantes?.nome_completo || "")));
      setLoading(false);
    };
    fetch();
  }, [id]);

  const generateInstagramPost = async () => {
    if (!item) return;
    setInstaLoading(true);
    setInstaOpen(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-instagram-post", {
        body: {
          relatorio: {
            nome_atividade: item.nome_atividade,
            data: item.data,
            turmas: turmaNames.join(", "),
            educador: item.profiles?.nome,
            tipo_atividade: item.tipo_atividade,
            num_participantes: item.num_participantes,
            observacoes: item.observacoes,
            intervencoes: item.intervencoes,
            engajamento: item.engajamento,
            situacoes_relevantes: item.situacoes_relevantes,
            objetivo_alcancado: item.objetivo_alcancado,
          },
        },
      });
      if (error) throw error;
      setInstaText(data.text || "Erro ao gerar texto.");
    } catch (e: any) {
      toast.error(e.message || "Erro ao gerar texto para Instagram");
      setInstaText("");
    } finally {
      setInstaLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(instaText);
    toast.success("Texto copiado!");
  };

  const shareWhatsApp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(instaText)}`, "_blank");
  };

  const downloadPhoto = async (url: string, idx: number) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `foto_relatorio_${idx + 1}.jpg`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      toast.error("Erro ao baixar foto");
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    setDeleting(true);
    try {
      await Promise.all([
        supabase.from("relatorio_presenca").delete().eq("relatorio_id", id),
        supabase.from("relatorio_fotos").delete().eq("relatorio_id", id),
        supabase.from("relatorio_turmas").delete().eq("relatorio_id", id),
      ]);
      const { error } = await supabase.from("relatorios_atividade").delete().eq("id", id);
      if (error) throw error;
      toast.success("Relatório excluído com sucesso");
      navigate("/relatorios");
    } catch (e: any) {
      toast.error(e.message || "Erro ao excluir relatório");
    } finally {
      setDeleting(false);
    }
  };


  if (!item) return <div className="text-sm text-muted-foreground py-8 text-center">Não encontrado</div>;

  return (
    <div className="space-y-4 max-w-3xl print:max-w-none">
      <div className="flex items-center justify-between print:hidden flex-wrap gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Button variant="ghost" size="icon" asChild><Link to="/relatorios"><ArrowLeft className="h-4 w-4" /></Link></Button>
          <h1 className="text-lg sm:text-xl font-semibold text-foreground truncate">{item.nome_atividade || "Relatório"}</h1>
        </div>
        <div className="flex gap-1 flex-wrap">
          {isCoordenacao && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" className="gap-1 text-xs" disabled={deleting}>
                  <Trash2 className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Excluir</span>
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Excluir relatório?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta ação não pode ser desfeita. Todos os dados vinculados (presença, fotos, turmas) serão removidos.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Excluir
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          {fotos.length > 0 && (
            <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={generateInstagramPost}>
              <Instagram className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Gerar Post</span>
            </Button>
          )}
          <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={() => window.print()}>
            <Printer className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Imprimir</span>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1 text-xs"><FileText className="h-3.5 w-3.5" />Exportar</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => exportRelatorioDocx(item, turmaNames, presenca, fotos)} className="text-xs gap-2">
                <FileSpreadsheet className="h-3.5 w-3.5" /> DOCX
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportRelatorioPdf(item, turmaNames, presenca).catch(() => {})} className="text-xs gap-2">
                <FileText className="h-3.5 w-3.5" /> PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap text-xs text-muted-foreground">
        <span>📅 {format(new Date(item.data + "T12:00:00"), "dd/MM/yyyy")}</span>
        {item.dia_semana && <span>({item.dia_semana})</span>}
        {item.profiles?.nome && <span>👤 {item.profiles.nome}</span>}
        {item.tipo_atividade && <span>📋 {item.tipo_atividade}</span>}
        {turmaNames.map(n => <Badge key={n} variant="secondary" className="text-[10px]">{n}</Badge>)}
        {planejamentoLink && (
          <Link to={`/planejamentos/${planejamentoLink.id}`} className="text-primary hover:underline text-xs">
            📋 {planejamentoLink.titulo}
          </Link>
        )}
      </div>

      {/* Score ELO */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Competências</CardTitle>
            <span className="text-lg font-bold text-primary">ELO: {item.score_elo?.toFixed(2) || "—"}</span>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <LikertDisplay label="Iniciativa" value={item.iniciativa} />
          <LikertDisplay label="Autonomia" value={item.autonomia} />
          <LikertDisplay label="Colaboração" value={item.colaboracao} />
          <LikertDisplay label="Comunicação" value={item.comunicacao} />
          <LikertDisplay label="Respeito Mútuo" value={item.respeito_mutuo} />
        </CardContent>
      </Card>

      {/* Resumo */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Resumo</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div><div className="text-lg font-bold text-foreground">{item.num_participantes ?? 0}</div><div className="text-xs text-muted-foreground">Presentes</div></div>
            <div><div className="text-lg font-bold text-foreground">{item.num_ausentes ?? 0}</div><div className="text-xs text-muted-foreground">Ausentes</div></div>
            <div><div className="text-lg font-bold text-foreground">{item.pct_adesao?.toFixed(0) ?? 0}%</div><div className="text-xs text-muted-foreground">Adesão</div></div>
          </div>
          {item.objetivo_alcancado && (
            <div className="flex items-center gap-2"><span className="text-muted-foreground">Objetivo:</span><Badge variant={item.objetivo_alcancado === "alcancado" ? "default" : item.objetivo_alcancado === "parcial" ? "secondary" : "destructive"}>{OBJ_LABELS[item.objetivo_alcancado]}</Badge></div>
          )}
          {item.engajamento?.length > 0 && (
            <div><span className="text-xs text-muted-foreground">Engajamento:</span><div className="flex gap-1 flex-wrap mt-1">{item.engajamento.map((e: string) => <Badge key={e} variant="outline" className="text-xs">{e}</Badge>)}</div></div>
          )}
          {item.situacoes_relevantes?.length > 0 && (
            <div><span className="text-xs text-muted-foreground">Situações:</span><div className="flex gap-1 flex-wrap mt-1">{item.situacoes_relevantes.map((s: string) => <Badge key={s} variant="outline" className="text-xs">{s}</Badge>)}</div></div>
          )}
          {item.intervencoes && <div><span className="text-xs text-muted-foreground">Intervenções:</span><p className="whitespace-pre-wrap">{item.intervencoes}</p></div>}
          {item.observacoes && <div><span className="text-xs text-muted-foreground">Observações:</span><p className="whitespace-pre-wrap">{item.observacoes}</p></div>}
        </CardContent>
      </Card>

      {/* Presença */}
      {presenca.length > 0 && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Presença</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-1 max-h-60 overflow-y-auto print:max-h-none">
              {presenca.map((p: any) => (
                <div key={p.id} className="flex items-center justify-between text-sm py-1 border-b border-border/50 last:border-0">
                  <span className="text-xs sm:text-sm">{p.participantes?.nome_completo}</span>
                  <Badge variant={p.presente ? "default" : "secondary"} className="text-[10px]">{p.presente ? "Presente" : "Ausente"}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Fotos */}
      {fotos.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Fotos ({fotos.length})</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {fotos.map((f: any, i: number) => (
                <img
                  key={f.id}
                  src={f.foto_url}
                  alt={`Foto ${i + 1}`}
                  className="rounded border w-full h-40 sm:h-32 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                  onClick={() => setLightboxIdx(i)}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lightbox */}
      {lightboxIdx !== null && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center" onClick={() => setLightboxIdx(null)}>
          <button className="absolute top-4 right-4 text-white" onClick={() => setLightboxIdx(null)}>
            <X className="h-6 w-6" />
          </button>
          <div className="flex items-center gap-4 max-w-[90vw] max-h-[90vh]" onClick={e => e.stopPropagation()}>
            {lightboxIdx > 0 && (
              <button className="text-white text-3xl px-2" onClick={() => setLightboxIdx(lightboxIdx - 1)}>‹</button>
            )}
            <img src={fotos[lightboxIdx].foto_url} alt="" className="max-w-[80vw] max-h-[85vh] object-contain rounded" />
            {lightboxIdx < fotos.length - 1 && (
              <button className="text-white text-3xl px-2" onClick={() => setLightboxIdx(lightboxIdx + 1)}>›</button>
            )}
          </div>
          <button className="absolute bottom-4 text-white flex items-center gap-1 text-sm bg-white/20 rounded px-3 py-1.5" onClick={() => downloadPhoto(fotos[lightboxIdx].foto_url, lightboxIdx)}>
            <Download className="h-4 w-4" /> Baixar
          </button>
        </div>
      )}

      {/* Instagram Post Dialog */}
      <Dialog open={instaOpen} onOpenChange={setInstaOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="text-base flex items-center gap-2"><Instagram className="h-4 w-4" /> Publicação Instagram</DialogTitle></DialogHeader>
          {instaLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <span className="ml-2 text-sm text-muted-foreground">Gerando texto...</span>
            </div>
          ) : (
            <div className="space-y-3">
              <Textarea
                value={instaText}
                onChange={e => setInstaText(e.target.value)}
                rows={10}
                className="text-sm"
                placeholder="Texto da publicação..."
              />
              <div className="flex gap-2 flex-wrap">
                <Button size="sm" variant="outline" onClick={copyToClipboard} className="gap-1 text-xs">
                  <Copy className="h-3.5 w-3.5" /> Copiar Texto
                </Button>
                <Button size="sm" variant="outline" onClick={shareWhatsApp} className="gap-1 text-xs">
                  <Share2 className="h-3.5 w-3.5" /> WhatsApp
                </Button>
              </div>
              {fotos.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Fotos do relatório — baixe e envie junto com o texto:</p>
                  <div className="grid grid-cols-3 gap-2">
                    {fotos.map((f: any, i: number) => (
                      <div key={f.id} className="relative group">
                        <img src={f.foto_url} alt="" className="rounded border w-full h-20 object-cover" />
                        <button
                          className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded"
                          onClick={() => downloadPhoto(f.foto_url, i)}
                        >
                          <Download className="h-4 w-4 text-white" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RelatorioDetalhePage;
