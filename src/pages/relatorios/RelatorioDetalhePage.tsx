import { useEffect, useState } from "react";
import { ArrowLeft, Printer, FileText, FileSpreadsheet } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { exportRelatorioDocx, exportRelatorioPdf } from "@/hooks/useDocumentExport";

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
  const [item, setItem] = useState<any>(null);
  const [turmaNames, setTurmaNames] = useState<string[]>([]);
  const [fotos, setFotos] = useState<any[]>([]);
  const [presenca, setPresenca] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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
      }
      if (f.data) setFotos(f.data);
      if (p.data) setPresenca(p.data.sort((a: any, b: any) => (a.participantes?.nome_completo || "").localeCompare(b.participantes?.nome_completo || "")));
      setLoading(false);
    };
    fetch();
  }, [id]);

  if (loading) return <div className="text-sm text-muted-foreground py-8 text-center">Carregando...</div>;
  if (!item) return <div className="text-sm text-muted-foreground py-8 text-center">Não encontrado</div>;

  return (
    <div className="space-y-4 max-w-3xl print:max-w-none">
      <div className="flex items-center justify-between print:hidden">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" asChild><Link to="/relatorios"><ArrowLeft className="h-4 w-4" /></Link></Button>
          <h1 className="text-xl font-semibold text-foreground">{item.nome_atividade || "Relatório"}</h1>
        </div>
        <div className="flex gap-1">
          <Button variant="outline" size="sm" className="gap-1" onClick={() => window.print()}>
            <Printer className="h-3.5 w-3.5" />Imprimir
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1"><FileText className="h-3.5 w-3.5" />Exportar</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => exportRelatorioDocx(item, turmaNames, presenca, fotos)} className="text-xs gap-2">
                <FileSpreadsheet className="h-3.5 w-3.5" /> DOCX
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportRelatorioPdf(item, turmaNames, presenca)} className="text-xs gap-2">
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
                  <span>{p.participantes?.nome_completo}</span>
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
          <CardHeader className="pb-3"><CardTitle className="text-base">Fotos</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {fotos.map((f: any) => (
                <img key={f.id} src={f.foto_url} alt="" className="rounded border w-full h-32 object-cover" />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default RelatorioDetalhePage;
