import { useState, useEffect } from "react";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useIsDemo, guardDemo } from "@/hooks/useIsDemo";
import { TIPOS_ATIVIDADE } from "@/lib/constants";
import { useFormTimer } from "@/hooks/useFormTimer";

const FORMAS_AVALIACAO = [
  "Ficha de Observação", "Escala Likert", "Portfólio", "Autoavaliação",
  "Registro Fotográfico", "Roda de Conversa", "Relatório Descritivo",
];

const PlanejamentoNovoPage = () => {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [turmas, setTurmas] = useState<any[]>([]);
  const [educadores, setEducadores] = useState<any[]>([]);

  const [form, setForm] = useState({
    titulo: "",
    tema: "",
    questao_geradora: "",
    objetivos: "",
    roteiro: "",
    materiais: "",
    apoio_tecnico: "",
    forma_avaliacao: [] as string[],
    tipo_atividade: [] as string[],
    tipo_atividade_detalhe: "",
    data_aplicacao: null as Date | null,
    educador_id: "",
    turma_ids: [] as string[],
  });

  useEffect(() => {
    const fetchData = async () => {
      const [t, e] = await Promise.all([
        supabase.from("turmas").select("id, nome").eq("ativa", true).order("nome"),
        supabase.from("profiles").select("id, nome"),
      ]);
      if (t.data) setTurmas(t.data);
      if (e.data) setEducadores(e.data);
    };
    fetchData();
  }, []);

  const toggleAvaliacao = (v: string) => {
    setForm(f => ({ ...f, forma_avaliacao: f.forma_avaliacao.includes(v) ? f.forma_avaliacao.filter(x => x !== v) : [...f.forma_avaliacao, v] }));
  };

  const toggleTurma = (id: string) => {
    setForm(f => ({ ...f, turma_ids: f.turma_ids.includes(id) ? f.turma_ids.filter(x => x !== id) : [...f.turma_ids, id] }));
  };

  const toggleTipoAtividade = (v: string) => {
    setForm(f => ({ ...f, tipo_atividade: f.tipo_atividade.includes(v) ? f.tipo_atividade.filter(x => x !== v) : [...f.tipo_atividade, v] }));
  };

  const needsDetail = form.tipo_atividade.some(v => TIPOS_ATIVIDADE.find(t => t.value === v && 'hasDetail' in t && t.hasDetail));

  const isDemo = useIsDemo();
  const { stop: stopTimer } = useFormTimer("planejamento");

  const handleSave = async () => {
    if (guardDemo(isDemo)) return;
    if (!form.titulo.trim()) { toast.error("Título é obrigatório"); return; }
    setSaving(true);
    try {
      const { data, error } = await supabase.from("planejamentos").insert({
        titulo: form.titulo,
        tema: form.tema || null,
        questao_geradora: form.questao_geradora || null,
        objetivos: form.objetivos || null,
        roteiro: form.roteiro || null,
        materiais: form.materiais || null,
        apoio_tecnico: form.apoio_tecnico || null,
        forma_avaliacao: form.forma_avaliacao,
        tipo_atividade: form.tipo_atividade,
        tipo_atividade_detalhe: form.tipo_atividade_detalhe || null,
        data_aplicacao: form.data_aplicacao ? format(form.data_aplicacao, "yyyy-MM-dd") : null,
        educador_id: form.educador_id || null,
      } as any).select("id").single();

      if (error) throw error;

      if (form.turma_ids.length > 0 && data) {
        const rows = form.turma_ids.map(turma_id => ({ planejamento_id: data.id, turma_id }));
        await supabase.from("planejamento_turmas").insert(rows);
      }

      toast.success("Planejamento salvo!");
      await stopTimer(data?.id);
      navigate("/planejamentos");
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/planejamentos"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <h1 className="text-xl font-semibold text-foreground">Novo Planejamento</h1>
      </div>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Informações Gerais</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Título *</Label>
              <Input value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} placeholder="Título do planejamento" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Tema / Demanda</Label>
              <Input value={form.tema} onChange={e => setForm(f => ({ ...f, tema: e.target.value }))} placeholder="Ex: Meio ambiente" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Data de Aplicação</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal text-sm", !form.data_aplicacao && "text-muted-foreground")}>
                    {form.data_aplicacao ? format(form.data_aplicacao, "dd/MM/yyyy") : "Selecionar data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={form.data_aplicacao || undefined} onSelect={d => setForm(f => ({ ...f, data_aplicacao: d || null }))} defaultMonth={new Date()} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Educador Responsável</Label>
              <Select value={form.educador_id} onValueChange={v => setForm(f => ({ ...f, educador_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>
                  {educadores.map(e => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tipo de Atividade */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Tipo de Atividade</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {TIPOS_ATIVIDADE.map(ta => (
              <label key={ta.value} className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox checked={form.tipo_atividade.includes(ta.value)} onCheckedChange={() => toggleTipoAtividade(ta.value)} />
                {ta.label}
              </label>
            ))}
          </div>
          {needsDetail && (
            <Input
              value={form.tipo_atividade_detalhe}
              onChange={e => setForm(f => ({ ...f, tipo_atividade_detalhe: e.target.value }))}
              placeholder="Especifique o nome do evento ou oficina"
              className="text-sm"
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Conteúdo</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Questão Geradora</Label>
            <Textarea value={form.questao_geradora} onChange={e => setForm(f => ({ ...f, questao_geradora: e.target.value }))} rows={2} placeholder="Pergunta que orienta a atividade" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Objetivos Foco</Label>
            <Textarea value={form.objetivos} onChange={e => setForm(f => ({ ...f, objetivos: e.target.value }))} rows={2} placeholder="Objetivos a serem alcançados" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Roteiro da Atividade</Label>
            <Textarea value={form.roteiro} onChange={e => setForm(f => ({ ...f, roteiro: e.target.value }))} rows={4} placeholder="Passo a passo da atividade" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Materiais Necessários</Label>
            <Textarea value={form.materiais} onChange={e => setForm(f => ({ ...f, materiais: e.target.value }))} rows={2} placeholder="Lista de materiais" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Apoio Técnico</Label>
            <Input value={form.apoio_tecnico} onChange={e => setForm(f => ({ ...f, apoio_tecnico: e.target.value }))} placeholder="Ex: Psicóloga, Assistente Social" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Avaliação e Turmas</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Formas de Avaliação</Label>
            <div className="grid grid-cols-2 gap-2">
              {FORMAS_AVALIACAO.map(fa => (
                <label key={fa} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={form.forma_avaliacao.includes(fa)} onCheckedChange={() => toggleAvaliacao(fa)} />
                  {fa}
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Turmas Vinculadas</Label>
            {turmas.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhuma turma ativa</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {turmas.map(t => (
                  <label key={t.id} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox checked={form.turma_ids.includes(t.id)} onCheckedChange={() => toggleTurma(t.id)} />
                    {t.nome}
                  </label>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-2 pb-4">
        <Button onClick={handleSave} disabled={saving} className="gap-1">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar Planejamento
        </Button>
        <Button variant="outline" asChild><Link to="/planejamentos">Cancelar</Link></Button>
      </div>
    </div>
  );
};

export default PlanejamentoNovoPage;
