import { useState, useEffect, useMemo } from "react";
import { ArrowLeft, Save, Loader2, Upload, X } from "lucide-react";
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
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useIsDemo, guardDemo } from "@/hooks/useIsDemo";

const LIKERT_LABELS = ["Muito Baixo", "Baixo", "Moderado", "Alto", "Excepcional"];
const ENGAJAMENTO_OPT = ["Alta participação", "Participação parcial", "Pouca interação", "Dispersão", "Resistência"];
const SITUACOES_OPT = ["Conflito entre participantes", "Dificuldade de compreensão", "Participante em crise", "Destaque positivo", "Necessidade de encaminhamento"];
const DIAS_SEMANA = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

function LikertField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map(n => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={cn(
              "flex-1 py-1.5 rounded text-xs font-medium transition-colors border",
              value === n
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-muted/50 text-muted-foreground border-border hover:bg-muted"
            )}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground px-1">
        <span>{LIKERT_LABELS[0]}</span>
        <span>{LIKERT_LABELS[4]}</span>
      </div>
    </div>
  );
}

const RelatorioNovoPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [turmas, setTurmas] = useState<any[]>([]);
  const [educadores, setEducadores] = useState<any[]>([]);
  const [planejamentos, setPlanejamentos] = useState<any[]>([]);
  const [participantesTurma, setParticipantesTurma] = useState<any[]>([]);
  const [fotos, setFotos] = useState<File[]>([]);

  const [form, setForm] = useState({
    data: null as Date | null,
    dia_semana: "",
    nome_atividade: "",
    tipo_atividade: "",
    educador_id: "",
    planejamento_id: "",
    turma_ids: [] as string[],
    iniciativa: 3,
    autonomia: 3,
    colaboracao: 3,
    comunicacao: 3,
    respeito_mutuo: 3,
    engajamento: [] as string[],
    situacoes_relevantes: [] as string[],
    objetivo_alcancado: "" as string,
    intervencoes: "",
    observacoes: "",
    presenca: {} as Record<string, boolean>,
    justificativas: {} as Record<string, string>,
  });

  const scoreElo = useMemo(() => {
    const s = (form.iniciativa + form.autonomia + form.colaboracao + form.comunicacao + form.respeito_mutuo) / 5;
    return s.toFixed(2);
  }, [form.iniciativa, form.autonomia, form.colaboracao, form.comunicacao, form.respeito_mutuo]);

  useEffect(() => {
    const fetch = async () => {
      const [t, e, p] = await Promise.all([
        supabase.from("turmas").select("id, nome").eq("ativa", true).order("nome"),
        supabase.from("profiles").select("id, nome"),
        supabase.from("planejamentos").select("id, titulo").order("created_at", { ascending: false }).limit(50),
      ]);
      if (t.data) setTurmas(t.data);
      if (e.data) setEducadores(e.data);
      if (p.data) setPlanejamentos(p.data);
    };
    fetch();
  }, []);

  useEffect(() => {
    if (form.turma_ids.length === 0) { setParticipantesTurma([]); return; }
    const fetchParts = async () => {
      const { data } = await supabase
        .from("turma_participantes")
        .select("participante_id, participantes(id, nome_completo)")
        .in("turma_id", form.turma_ids);
      if (data) {
        const unique = new Map<string, string>();
        data.forEach((d: any) => { if (d.participantes) unique.set(d.participantes.id, d.participantes.nome_completo); });
        const list = Array.from(unique, ([id, nome]) => ({ id, nome })).sort((a, b) => a.nome.localeCompare(b.nome));
        setParticipantesTurma(list);
        setForm(f => {
          const pres = { ...f.presenca };
          list.forEach(p => { if (!(p.id in pres)) pres[p.id] = true; });
          return { ...f, presenca: pres };
        });
      }
    };
    fetchParts();
  }, [form.turma_ids]);

  const toggleTurma = (id: string) => setForm(f => ({ ...f, turma_ids: f.turma_ids.includes(id) ? f.turma_ids.filter(x => x !== id) : [...f.turma_ids, id] }));
  const toggleEng = (v: string) => setForm(f => ({ ...f, engajamento: f.engajamento.includes(v) ? f.engajamento.filter(x => x !== v) : [...f.engajamento, v] }));
  const toggleSit = (v: string) => setForm(f => ({ ...f, situacoes_relevantes: f.situacoes_relevantes.includes(v) ? f.situacoes_relevantes.filter(x => x !== v) : [...f.situacoes_relevantes, v] }));

  const handleFotos = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (fotos.length + files.length > 5) { toast.error("Máximo 5 fotos"); return; }
    setFotos(prev => [...prev, ...files]);
  };

  const numParticipantes = Object.values(form.presenca).filter(Boolean).length;
  const numAusentes = participantesTurma.length - numParticipantes;
  const pctAdesao = participantesTurma.length > 0 ? ((numParticipantes / participantesTurma.length) * 100) : 0;

  const isDemo = useIsDemo();

  const handleSave = async () => {
    if (guardDemo(isDemo)) return;
    if (!form.data) { toast.error("Data é obrigatória"); return; }
    if (!form.nome_atividade.trim()) { toast.error("Nome da atividade é obrigatório"); return; }
    setSaving(true);
    try {
      const { data: rel, error } = await supabase.from("relatorios_atividade").insert({
        data: format(form.data, "yyyy-MM-dd"),
        dia_semana: form.dia_semana || null,
        nome_atividade: form.nome_atividade,
        tipo_atividade: form.tipo_atividade || null,
        educador_id: form.educador_id || null,
        planejamento_id: form.planejamento_id || null,
        iniciativa: form.iniciativa,
        autonomia: form.autonomia,
        colaboracao: form.colaboracao,
        comunicacao: form.comunicacao,
        respeito_mutuo: form.respeito_mutuo,
        score_elo: parseFloat(scoreElo),
        engajamento: form.engajamento,
        situacoes_relevantes: form.situacoes_relevantes,
        objetivo_alcancado: (form.objetivo_alcancado || null) as any,
        intervencoes: form.intervencoes || null,
        observacoes: form.observacoes || null,
        num_matriculados: participantesTurma.length,
        num_participantes: numParticipantes,
        num_ausentes: numAusentes,
        pct_adesao: Math.round(pctAdesao * 100) / 100,
      }).select("id").single();

      if (error) throw error;
      const relId = rel.id;

      // turmas
      if (form.turma_ids.length > 0) {
        await supabase.from("relatorio_turmas").insert(form.turma_ids.map(turma_id => ({ relatorio_id: relId, turma_id })));
      }

      // presença no relatório
      const presRows = participantesTurma.map(p => ({
        relatorio_id: relId,
        participante_id: p.id,
        presente: form.presenca[p.id] ?? false,
        justificativa: !(form.presenca[p.id] ?? false) ? (form.justificativas[p.id] || null) : null,
      }));
      if (presRows.length > 0) {
        await supabase.from("relatorio_presenca").insert(presRows);
      }

      // salvar também na tabela presenca (frequência oficial) para cada turma
      if (form.turma_ids.length > 0) {
        const dataStr = format(form.data, "yyyy-MM-dd");
        for (const turmaId of form.turma_ids) {
          await supabase.from("presenca").delete().eq("turma_id", turmaId).eq("data", dataStr);
          const presencaRows = participantesTurma.map(p => ({
            turma_id: turmaId,
            participante_id: p.id,
            data: dataStr,
            presente: form.presenca[p.id] ?? false,
            justificativa: !(form.presenca[p.id] ?? false) ? (form.justificativas[p.id] || null) : null,
            registrado_por: user?.id || null,
          }));
          await supabase.from("presenca").insert(presencaRows);
        }
      }

      // fotos
      for (let i = 0; i < fotos.length; i++) {
        const file = fotos[i];
        const ext = file.name.split(".").pop();
        const path = `${relId}/${i}.${ext}`;
        const { error: upErr } = await supabase.storage.from("fotos-relatorios").upload(path, file);
        if (!upErr) {
          const { data: urlData } = supabase.storage.from("fotos-relatorios").getPublicUrl(path);
          await supabase.from("relatorio_fotos").insert({ relatorio_id: relId, foto_url: urlData.publicUrl, ordem: i });
        }
      }

      toast.success("Relatório salvo!");
      navigate("/relatorios");
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
          <Link to="/relatorios"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <h1 className="text-xl font-semibold text-foreground">Novo Relatório de Atividade</h1>
      </div>

      {/* Info Geral */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Informações Gerais</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Data *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal text-sm", !form.data && "text-muted-foreground")}>
                    {form.data ? format(form.data, "dd/MM/yyyy") : "Selecionar"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={form.data || undefined} onSelect={d => {
                    if (d) {
                      const dias = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
                      setForm(f => ({ ...f, data: d, dia_semana: dias[d.getDay()] }));
                    }
                  }} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Dia da Semana</Label>
              <Input value={form.dia_semana} readOnly className="bg-muted/50 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Tipo de Atividade</Label>
              <Input value={form.tipo_atividade} onChange={e => setForm(f => ({ ...f, tipo_atividade: e.target.value }))} placeholder="Ex: Oficina, Roda..." />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Nome da Atividade *</Label>
              <Input value={form.nome_atividade} onChange={e => setForm(f => ({ ...f, nome_atividade: e.target.value }))} placeholder="Nome da atividade realizada" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Educador</Label>
              <Select value={form.educador_id} onValueChange={v => setForm(f => ({ ...f, educador_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>{educadores.map(e => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Planejamento Vinculado</Label>
            <Select value={form.planejamento_id} onValueChange={v => setForm(f => ({ ...f, planejamento_id: v }))}>
              <SelectTrigger><SelectValue placeholder="Nenhum (opcional)" /></SelectTrigger>
              <SelectContent>{planejamentos.map(p => <SelectItem key={p.id} value={p.id}>{p.titulo}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Turmas */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Turmas</CardTitle></CardHeader>
        <CardContent>
          {turmas.length === 0 ? <p className="text-xs text-muted-foreground">Nenhuma turma ativa</p> : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {turmas.map(t => (
                <label key={t.id} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={form.turma_ids.includes(t.id)} onCheckedChange={() => toggleTurma(t.id)} />
                  {t.nome}
                </label>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Competências Likert */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Competências (Likert 1-5)</CardTitle>
            <div className="text-sm font-semibold text-primary">Score ELO: {scoreElo}</div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <LikertField label="Iniciativa" value={form.iniciativa} onChange={v => setForm(f => ({ ...f, iniciativa: v }))} />
          <LikertField label="Autonomia" value={form.autonomia} onChange={v => setForm(f => ({ ...f, autonomia: v }))} />
          <LikertField label="Colaboração" value={form.colaboracao} onChange={v => setForm(f => ({ ...f, colaboracao: v }))} />
          <LikertField label="Comunicação" value={form.comunicacao} onChange={v => setForm(f => ({ ...f, comunicacao: v }))} />
          <LikertField label="Respeito Mútuo" value={form.respeito_mutuo} onChange={v => setForm(f => ({ ...f, respeito_mutuo: v }))} />
        </CardContent>
      </Card>

      {/* Engajamento e Situações */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Observações da Atividade</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Engajamento dos Participantes</Label>
            <div className="grid grid-cols-2 gap-2">
              {ENGAJAMENTO_OPT.map(o => (
                <label key={o} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={form.engajamento.includes(o)} onCheckedChange={() => toggleEng(o)} />
                  {o}
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Situações Relevantes</Label>
            <div className="grid grid-cols-2 gap-2">
              {SITUACOES_OPT.map(o => (
                <label key={o} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={form.situacoes_relevantes.includes(o)} onCheckedChange={() => toggleSit(o)} />
                  {o}
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Objetivo Alcançado</Label>
            <Select value={form.objetivo_alcancado} onValueChange={v => setForm(f => ({ ...f, objetivo_alcancado: v }))}>
              <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="alcancado">Alcançado</SelectItem>
                <SelectItem value="parcial">Parcialmente</SelectItem>
                <SelectItem value="nao_alcancado">Não Alcançado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Intervenções Realizadas</Label>
            <Textarea value={form.intervencoes} onChange={e => setForm(f => ({ ...f, intervencoes: e.target.value }))} rows={2} placeholder="Descreva intervenções realizadas" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Observações Gerais</Label>
            <Textarea value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} rows={2} placeholder="Observações adicionais" />
          </div>
        </CardContent>
      </Card>

      {/* Presença */}
      {participantesTurma.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Presença ({numParticipantes}/{participantesTurma.length})</CardTitle>
              <span className="text-xs text-muted-foreground">{pctAdesao.toFixed(0)}% adesão</span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 max-h-72 overflow-y-auto">
              {participantesTurma.map((p, idx) => {
                const presente = form.presenca[p.id] ?? false;
                return (
                  <div key={p.id} className="flex items-center gap-2 py-1.5 border-b border-border/50 last:border-0">
                    <span className="text-xs text-muted-foreground w-6 text-right">{idx + 1}.</span>
                    <Checkbox
                      checked={presente}
                      onCheckedChange={c => {
                        setForm(f => ({
                          ...f,
                          presenca: { ...f.presenca, [p.id]: !!c },
                          justificativas: c ? (() => { const j = { ...f.justificativas }; delete j[p.id]; return j; })() : f.justificativas,
                        }));
                      }}
                    />
                    <span className={cn("text-sm flex-1", !presente && "text-muted-foreground line-through")}>{p.nome}</span>
                    {!presente && (
                      <Input
                        value={form.justificativas[p.id] || ""}
                        onChange={e => setForm(f => ({ ...f, justificativas: { ...f.justificativas, [p.id]: e.target.value.slice(0, 60) } }))}
                        placeholder="Justificativa (opcional)"
                        className="max-w-[200px] h-7 text-xs"
                        maxLength={60}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Fotos */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Fotos (máx. 5)</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <div className="flex gap-2 flex-wrap">
            {fotos.map((f, i) => (
              <div key={i} className="relative w-20 h-20 rounded border overflow-hidden">
                <img src={URL.createObjectURL(f)} alt="" className="w-full h-full object-cover" />
                <button onClick={() => setFotos(prev => prev.filter((_, j) => j !== i))} className="absolute top-0 right-0 bg-destructive text-destructive-foreground rounded-bl p-0.5">
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
          {fotos.length < 5 && (
            <label className="inline-flex items-center gap-1 text-sm text-primary cursor-pointer hover:underline">
              <Upload className="h-4 w-4" /> Adicionar foto
              <input type="file" accept="image/*" onChange={handleFotos} className="hidden" />
            </label>
          )}
        </CardContent>
      </Card>

      <div className="flex gap-2 pb-4">
        <Button onClick={handleSave} disabled={saving} className="gap-1">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar Relatório
        </Button>
        <Button variant="outline" asChild><Link to="/relatorios">Cancelar</Link></Button>
      </div>
    </div>
  );
};

export default RelatorioNovoPage;
