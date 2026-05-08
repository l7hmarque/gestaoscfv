import { useEffect, useState } from "react";
import { ArrowLeft, Pencil, Save, X, Printer, Download } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

import { exportPlanejamentoDocx, exportPlanejamentoPdf } from "@/hooks/useDocumentExport";
import { useIsDemo, guardDemo } from "@/hooks/useIsDemo";
import { TIPOS_ATIVIDADE, tipoAtividadeLabels } from "@/lib/constants";
import { DriveSyncBadge } from "@/components/DriveSyncBadge";

const PlanejamentoDetalhePage = () => {
  const { id } = useParams();
  const [item, setItem] = useState<any>(null);
  const [turmaNames, setTurmaNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<any>({});
  const [relatoriosVinculados, setRelatoriosVinculados] = useState<any[]>([]);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("planejamentos")
        .select("*, planejamento_turmas(turma_id, turmas(nome)), profiles!planejamentos_educador_id_fkey(nome)")
        .eq("id", id)
        .single();
      if (data) {
        setItem(data);
        setTurmaNames(data.planejamento_turmas?.map((pt: any) => pt.turmas?.nome).filter(Boolean) || []);
        setForm({
          titulo: data.titulo,
          tema: data.tema || "",
          questao_geradora: data.questao_geradora || "",
          objetivos: data.objetivos || "",
          roteiro: data.roteiro || "",
          materiais: data.materiais || "",
          apoio_tecnico: data.apoio_tecnico || "",
          tipo_atividade: data.tipo_atividade || [],
          tipo_atividade_detalhe: data.tipo_atividade_detalhe || "",
        });
      }
      const { data: rels } = await supabase
        .from("relatorios_atividade")
        .select("id, nome_atividade, data")
        .eq("planejamento_id", id)
        .order("data", { ascending: false });
      setRelatoriosVinculados(rels || []);
      setLoading(false);
    };
    fetch();
  }, [id]);

  const isDemo = useIsDemo();

  const toggleTipoAtividade = (v: string) => {
    setForm((f: any) => ({ ...f, tipo_atividade: f.tipo_atividade.includes(v) ? f.tipo_atividade.filter((x: string) => x !== v) : [...f.tipo_atividade, v] }));
  };

  const needsDetail = (form.tipo_atividade || []).some((v: string) => TIPOS_ATIVIDADE.find(t => t.value === v && 'hasDetail' in t && t.hasDetail));

  const handleSave = async () => {
    if (guardDemo(isDemo)) return;
    const { error } = await supabase.from("planejamentos").update({
      titulo: form.titulo,
      tema: form.tema || null,
      questao_geradora: form.questao_geradora || null,
      objetivos: form.objetivos || null,
      roteiro: form.roteiro || null,
      materiais: form.materiais || null,
      apoio_tecnico: form.apoio_tecnico || null,
      tipo_atividade: form.tipo_atividade || [],
      tipo_atividade_detalhe: form.tipo_atividade_detalhe || null,
    } as any).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Salvo!");
    setEditing(false);
    setItem((prev: any) => ({ ...prev, ...form }));
  };

  if (loading) return <div className="text-sm text-muted-foreground py-8 text-center">Carregando...</div>;
  if (!item) return <div className="text-sm text-muted-foreground py-8 text-center">Não encontrado</div>;

  const Field = ({ label, value }: { label: string; value: string | null }) => value ? (
    <div><span className="text-xs font-medium text-muted-foreground">{label}</span><p className="text-sm whitespace-pre-wrap">{value}</p></div>
  ) : null;

  return (
    <div className="space-y-4 max-w-3xl print:max-w-none">
      <div className="flex items-center justify-between print:hidden">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" asChild><Link to="/planejamentos"><ArrowLeft className="h-4 w-4" /></Link></Button>
          {editing ? (
            <Input value={form.titulo} onChange={e => setForm((f: any) => ({ ...f, titulo: e.target.value }))} className="text-lg font-semibold h-8" />
          ) : (
            <h1 className="text-xl font-semibold text-foreground">{item.titulo}</h1>
          )}
        </div>
        <div className="flex gap-1">
          {editing ? (
            <>
              <Button size="sm" onClick={handleSave} className="gap-1"><Save className="h-3.5 w-3.5" />Salvar</Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}><X className="h-3.5 w-3.5" /></Button>
            </>
          ) : (
            <>
              <Button size="sm" variant="outline" onClick={() => setEditing(true)} className="gap-1"><Pencil className="h-3.5 w-3.5" />Editar</Button>
              <Button variant="outline" size="sm" className="gap-1" onClick={() => window.print()}>
                <Printer className="h-3.5 w-3.5" />Imprimir
              </Button>
              <Button variant="outline" size="sm" className="gap-1" onClick={async () => {
                toast.info("Gerando DOCX + PDF...");
                try {
                  await Promise.all([
                    exportPlanejamentoDocx(item, turmaNames),
                    exportPlanejamentoPdf(item, turmaNames).catch((err) => console.error("PDF falhou:", err)),
                  ]);
                  toast.success("Downloads concluídos!");
                } catch (e) {
                  console.error("Erro ao gerar planejamento:", e);
                  const msg = e instanceof Error ? e.message : String(e);
                  toast.error(`Erro ao gerar DOCX: ${msg.slice(0, 200)}`);
                }
              }}>
                <Download className="h-3.5 w-3.5" />Exportar Tudo
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="flex gap-2 flex-wrap text-xs text-muted-foreground">
        {item.data_aplicacao && <span>📅 {format(new Date(item.data_aplicacao + "T12:00:00"), "dd/MM/yyyy")}</span>}
        {item.profiles?.nome && <span>👤 {item.profiles.nome}</span>}
        {turmaNames.map(n => <Badge key={n} variant="secondary" className="text-[10px]">{n}</Badge>)}
        <div className="ml-auto"><DriveSyncBadge tipo="planejamento" origemId={item.id} driveUrl={item.drive_url} /></div>
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          {editing ? (
            <>
              <div className="space-y-1"><Label className="text-xs">Tema</Label><Input value={form.tema} onChange={e => setForm((f: any) => ({ ...f, tema: e.target.value }))} /></div>
              <div className="space-y-1">
                <Label className="text-xs">Tipo de Atividade</Label>
                <div className="grid grid-cols-2 gap-2">
                  {TIPOS_ATIVIDADE.map(ta => (
                    <label key={ta.value} className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox checked={(form.tipo_atividade || []).includes(ta.value)} onCheckedChange={() => toggleTipoAtividade(ta.value)} />
                      {ta.label}
                    </label>
                  ))}
                </div>
                {needsDetail && (
                  <Input value={form.tipo_atividade_detalhe} onChange={e => setForm((f: any) => ({ ...f, tipo_atividade_detalhe: e.target.value }))} placeholder="Especifique o nome do evento ou oficina" className="mt-2 text-sm" />
                )}
              </div>
              <div className="space-y-1"><Label className="text-xs">Questão Geradora</Label><Textarea value={form.questao_geradora} onChange={e => setForm((f: any) => ({ ...f, questao_geradora: e.target.value }))} rows={2} /></div>
              <div className="space-y-1"><Label className="text-xs">Objetivos</Label><Textarea value={form.objetivos} onChange={e => setForm((f: any) => ({ ...f, objetivos: e.target.value }))} rows={2} /></div>
              <div className="space-y-1"><Label className="text-xs">Roteiro</Label><Textarea value={form.roteiro} onChange={e => setForm((f: any) => ({ ...f, roteiro: e.target.value }))} rows={4} /></div>
              <div className="space-y-1"><Label className="text-xs">Materiais</Label><Textarea value={form.materiais} onChange={e => setForm((f: any) => ({ ...f, materiais: e.target.value }))} rows={2} /></div>
              <div className="space-y-1"><Label className="text-xs">Apoio Técnico</Label><Input value={form.apoio_tecnico} onChange={e => setForm((f: any) => ({ ...f, apoio_tecnico: e.target.value }))} /></div>
            </>
          ) : (
            <>
              <Field label="Tema / Demanda" value={item.tema} />
              {(item.tipo_atividade?.length > 0) && (
                <div>
                  <span className="text-xs font-medium text-muted-foreground">Tipo de Atividade</span>
                  <div className="flex gap-1 flex-wrap mt-1">
                    {tipoAtividadeLabels(item.tipo_atividade, item.tipo_atividade_detalhe).split(", ").map((l: string) => (
                      <Badge key={l} variant="outline" className="text-xs">{l}</Badge>
                    ))}
                  </div>
                </div>
              )}
              <Field label="Questão Geradora" value={item.questao_geradora} />
              <Field label="Objetivos Foco" value={item.objetivos} />
              <Field label="Roteiro da Atividade" value={item.roteiro} />
              <Field label="Materiais Necessários" value={item.materiais} />
              <Field label="Apoio Técnico" value={item.apoio_tecnico} />
              {item.forma_avaliacao?.length > 0 && (
                <div>
                  <span className="text-xs font-medium text-muted-foreground">Formas de Avaliação</span>
                  <div className="flex gap-1 flex-wrap mt-1">
                    {item.forma_avaliacao.map((fa: string) => <Badge key={fa} variant="outline" className="text-xs">{fa}</Badge>)}
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {relatoriosVinculados.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <span className="text-xs font-medium text-muted-foreground">Relatórios vinculados</span>
            <div className="space-y-1 mt-2">
              {relatoriosVinculados.map((r: any) => (
                <Link key={r.id} to={`/relatorios/${r.id}`} className="flex items-center justify-between text-sm py-1.5 px-2 rounded hover:bg-accent/50 transition-colors">
                  <span className="font-medium text-primary">{r.nome_atividade || "Relatório"}</span>
                  <span className="text-xs text-muted-foreground">{format(new Date(r.data + "T12:00:00"), "dd/MM/yyyy")}</span>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default PlanejamentoDetalhePage;
