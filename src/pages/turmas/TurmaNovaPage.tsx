import { useState, useEffect } from "react";
import { ArrowLeft, Save, Zap, Users } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import { isBairroSCFV, calcFaixaFromDate, OFICINAS_TURMA } from "@/lib/constants";
import { useIsDemo, guardDemo } from "@/hooks/useIsDemo";

const diasOptions = [
  { value: "seg", label: "Segunda" }, { value: "ter", label: "Terça" }, { value: "qua", label: "Quarta" },
  { value: "qui", label: "Quinta" }, { value: "sex", label: "Sexta" }, { value: "sab", label: "Sábado" },
];

const FAIXAS = [
  { value: "6-8", label: "6-8 anos" },
  { value: "9-11", label: "9-11 anos" },
  { value: "12-17", label: "12-17 anos" },
  { value: "idosos", label: "Idosos" },
];

const PERIODOS = [
  { value: "manha", label: "Manhã" },
  { value: "tarde", label: "Tarde" },
  { value: "integral", label: "Integral" },
];

const TurmaNovaPage = () => {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [bairros, setBairros] = useState<Tables<"bairros">[]>([]);
  const [educadores, setEducadores] = useState<Tables<"profiles">[]>([]);
  const [nome, setNome] = useState("");
  const [periodo, setPeriodo] = useState("manha");
  const [faixaEtaria, setFaixaEtaria] = useState("");
  const [tipo, setTipo] = useState("ordinaria");
  const [bairroId, setBairroId] = useState("");
  const [educadorId, setEducadorId] = useState("");
  const [diasSemana, setDiasSemana] = useState<string[]>([]);
  const [oficina, setOficina] = useState("");
  const [oficinaNome, setOficinaNome] = useState("");

  // Batch generation state
  const [batchBairros, setBatchBairros] = useState<string[]>([]);
  const [batchFaixas, setBatchFaixas] = useState<string[]>([]);
  const [batchPeriodos, setBatchPeriodos] = useState<string[]>([]);
  const [batchDias, setBatchDias] = useState<string[]>([]);
  const [batchEducadorId, setBatchEducadorId] = useState("");
  const [batchTipo, setBatchTipo] = useState("ordinaria");
  const [batchSaving, setBatchSaving] = useState(false);
  const [autoVincular, setAutoVincular] = useState(true);

  const scfvBairros = bairros.filter(b => isBairroSCFV(b.nome));

  useEffect(() => {
    Promise.all([
      supabase.from("bairros").select("*").order("nome"),
      supabase.from("profiles").select("*").order("nome"),
    ]).then(([{ data: b }, { data: e }]) => {
      setBairros(b || []);
      setEducadores(e || []);
    });
  }, []);

  const toggleDia = (dia: string) => {
    setDiasSemana((prev) => prev.includes(dia) ? prev.filter((d) => d !== dia) : [...prev, dia]);
  };

  const toggleArray = (arr: string[], val: string, setter: (v: string[]) => void) => {
    setter(arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val]);
  };

  const isDemo = useIsDemo();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (guardDemo(isDemo)) return;
    if (!nome.trim()) { toast.error("Nome da turma é obrigatório"); return; }
    setSaving(true);
    const payload: Record<string, unknown> = {
      nome, periodo, tipo, dias_semana: diasSemana,
    };
    if (faixaEtaria) payload.faixa_etaria = faixaEtaria;
    if (bairroId) payload.bairro_id = bairroId;
    if (educadorId) payload.educador_id = educadorId;
    const { error } = await supabase.from("turmas").insert(payload as any);
    setSaving(false);
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success("Turma criada!");
    navigate("/turmas");
  };

  // Generate combinations for batch
  const batchCombinations = () => {
    const combos: { bairro: Tables<"bairros">; faixa: string; periodo: string }[] = [];
    for (const bId of batchBairros) {
      const bairro = scfvBairros.find(b => b.id === bId);
      if (!bairro) continue;
      for (const faixa of batchFaixas) {
        for (const per of batchPeriodos) {
          combos.push({ bairro, faixa, periodo: per });
        }
      }
    }
    return combos;
  };

  const combos = batchCombinations();

  const handleBatchGenerate = async () => {
    if (combos.length === 0) { toast.error("Selecione ao menos uma opção de cada filtro"); return; }
    setBatchSaving(true);
    const periodoLabels: Record<string, string> = { manha: "Manhã", tarde: "Tarde", integral: "Integral" };
    const rows = combos.map(c => ({
      nome: `${c.bairro.nome} — ${c.faixa} — ${periodoLabels[c.periodo] || c.periodo}`,
      bairro_id: c.bairro.id,
      faixa_etaria: c.faixa,
      periodo: c.periodo,
      tipo: batchTipo,
      dias_semana: batchDias,
      ...(batchEducadorId ? { educador_id: batchEducadorId } : {}),
    }));

    const { data: turmasCriadas, error } = await supabase.from("turmas").insert(rows as any).select();
    if (error) { setBatchSaving(false); toast.error("Erro: " + error.message); return; }

    let totalVinculados = 0;

    if (autoVincular && turmasCriadas && turmasCriadas.length > 0) {
      // Fetch active participants from selected bairros
      const { data: participantes } = await supabase
        .from("participantes")
        .select("id, bairro_id, periodo, data_nascimento")
        .eq("status", "ativo")
        .in("bairro_id", batchBairros);

      if (participantes && participantes.length > 0) {
        // Fetch existing assignments to avoid duplicates
        const { data: existingLinks } = await supabase
          .from("turma_participantes")
          .select("participante_id, turmas(faixa_etaria, periodo)")
          .in("participante_id", participantes.map(p => p.id));

        const alreadyAssigned = new Set<string>();
        (existingLinks || []).forEach((link: any) => {
          if (link.turmas) {
            alreadyAssigned.add(`${link.participante_id}_${link.turmas.faixa_etaria}_${link.turmas.periodo}`);
          }
        });

        const links: { turma_id: string; participante_id: string }[] = [];

        for (const turma of turmasCriadas) {
          const matched = participantes.filter(p => {
            if (p.bairro_id !== turma.bairro_id) return false;
            const tPeriodo = turma.periodo as string;
            if (tPeriodo !== "integral" && p.periodo !== tPeriodo) return false;
            const faixa = calcFaixaFromDate(p.data_nascimento);
            if (faixa !== (turma.faixa_etaria as string)) return false;
            // Skip if already in a turma with same faixa+periodo
            const key = `${p.id}_${turma.faixa_etaria}_${turma.periodo}`;
            if (alreadyAssigned.has(key)) return false;
            return true;
          });

          for (const p of matched) {
            links.push({ turma_id: turma.id, participante_id: p.id });
            alreadyAssigned.add(`${p.id}_${turma.faixa_etaria}_${turma.periodo}`);
          }
        }

        if (links.length > 0) {
          const { error: linkError } = await supabase.from("turma_participantes").insert(links);
          if (linkError) {
            toast.warning("Turmas criadas, mas erro ao vincular: " + linkError.message);
          } else {
            totalVinculados = links.length;
          }
        }
      }
    }

    setBatchSaving(false);
    const msg = totalVinculados > 0
      ? `${turmasCriadas!.length} turma(s) criada(s) com ${totalVinculados} participante(s) vinculado(s)!`
      : `${turmasCriadas!.length} turma(s) criada(s)!`;
    toast.success(msg);
    navigate("/turmas");
  };

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild><Link to="/turmas"><ArrowLeft className="h-4 w-4" /></Link></Button>
        <h1 className="text-xl font-semibold text-foreground">Nova Turma</h1>
      </div>

      <Tabs defaultValue="individual">
        <TabsList className="h-8">
          <TabsTrigger value="individual" className="text-xs h-7">Individual</TabsTrigger>
          <TabsTrigger value="lote" className="text-xs h-7 gap-1"><Zap className="h-3 w-3" />Gerar em Lote</TabsTrigger>
        </TabsList>

        <TabsContent value="individual">
          <form onSubmit={handleSubmit} className="space-y-4">
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">Informações da Turma</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Label className="text-xs font-medium">Nome da Turma *</Label>
                  <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Turma A - Manhã" className="h-9 text-sm mt-1" required />
                </div>
                <div>
                  <Label className="text-xs font-medium">Período</Label>
                  <Select value={periodo} onValueChange={setPeriodo}>
                    <SelectTrigger className="h-9 text-sm mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PERIODOS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs font-medium">Faixa Etária</Label>
                  <Select value={faixaEtaria} onValueChange={setFaixaEtaria}>
                    <SelectTrigger className="h-9 text-sm mt-1"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                    <SelectContent>
                      {FAIXAS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs font-medium">Tipo</Label>
                  <Select value={tipo} onValueChange={setTipo}>
                    <SelectTrigger className="h-9 text-sm mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ordinaria">Ordinária</SelectItem>
                      <SelectItem value="extraordinaria">Extraordinária</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs font-medium">Bairro</Label>
                  <Select value={bairroId} onValueChange={setBairroId}>
                    <SelectTrigger className="h-9 text-sm mt-1"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                    <SelectContent>{scfvBairros.map((b) => <SelectItem key={b.id} value={b.id}>{b.nome}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <Label className="text-xs font-medium">Educador</Label>
                  <Select value={educadorId} onValueChange={setEducadorId}>
                    <SelectTrigger className="h-9 text-sm mt-1"><SelectValue placeholder="Selecionar educador" /></SelectTrigger>
                    <SelectContent>{educadores.map((e) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <Label className="text-xs font-medium mb-2 block">Dias da Semana</Label>
                  <div className="flex flex-wrap gap-3">
                    {diasOptions.map((d) => (
                      <label key={d.value} className="flex items-center gap-1.5 cursor-pointer">
                        <Checkbox checked={diasSemana.includes(d.value)} onCheckedChange={() => toggleDia(d.value)} />
                        <span className="text-sm">{d.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" asChild><Link to="/turmas">Cancelar</Link></Button>
              <Button type="submit" disabled={saving}><Save className="h-4 w-4 mr-1" />{saving ? "Salvando..." : "Criar Turma"}</Button>
            </div>
          </form>
        </TabsContent>

        <TabsContent value="lote">
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">Gerar Turmas em Lote</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <p className="text-xs text-muted-foreground">Selecione múltiplas opções para gerar automaticamente todas as combinações de turmas.</p>

                <div>
                  <Label className="text-xs font-medium mb-2 block">Bairros SCFV</Label>
                  <div className="flex flex-wrap gap-3">
                    {scfvBairros.map(b => (
                      <label key={b.id} className="flex items-center gap-1.5 cursor-pointer">
                        <Checkbox checked={batchBairros.includes(b.id)} onCheckedChange={() => toggleArray(batchBairros, b.id, setBatchBairros)} />
                        <span className="text-sm">{b.nome}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-medium mb-2 block">Faixas Etárias</Label>
                  <div className="flex flex-wrap gap-3">
                    {FAIXAS.map(f => (
                      <label key={f.value} className="flex items-center gap-1.5 cursor-pointer">
                        <Checkbox checked={batchFaixas.includes(f.value)} onCheckedChange={() => toggleArray(batchFaixas, f.value, setBatchFaixas)} />
                        <span className="text-sm">{f.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-medium mb-2 block">Períodos</Label>
                  <div className="flex flex-wrap gap-3">
                    {PERIODOS.map(p => (
                      <label key={p.value} className="flex items-center gap-1.5 cursor-pointer">
                        <Checkbox checked={batchPeriodos.includes(p.value)} onCheckedChange={() => toggleArray(batchPeriodos, p.value, setBatchPeriodos)} />
                        <span className="text-sm">{p.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-medium mb-2 block">Dias da Semana (aplicados a todas)</Label>
                  <div className="flex flex-wrap gap-3">
                    {diasOptions.map(d => (
                      <label key={d.value} className="flex items-center gap-1.5 cursor-pointer">
                        <Checkbox checked={batchDias.includes(d.value)} onCheckedChange={() => toggleArray(batchDias, d.value, setBatchDias)} />
                        <span className="text-sm">{d.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs font-medium">Tipo</Label>
                    <Select value={batchTipo} onValueChange={setBatchTipo}>
                      <SelectTrigger className="h-9 text-sm mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ordinaria">Ordinária</SelectItem>
                        <SelectItem value="extraordinaria">Extraordinária</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs font-medium">Educador (opcional)</Label>
                    <Select value={batchEducadorId} onValueChange={setBatchEducadorId}>
                      <SelectTrigger className="h-9 text-sm mt-1"><SelectValue placeholder="Nenhum" /></SelectTrigger>
                      <SelectContent>{educadores.map(e => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center gap-3 rounded-md border p-3 bg-muted/50">
                  <Switch checked={autoVincular} onCheckedChange={setAutoVincular} />
                  <div>
                    <Label className="text-xs font-medium flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5" />Vincular participantes automaticamente
                    </Label>
                    <p className="text-[10px] text-muted-foreground">Participantes ativos com bairro, período e faixa etária compatíveis serão adicionados às turmas</p>
                  </div>
                </div>

                {combos.length > 0 && (
                  <div className="rounded-md border p-3 space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">Pré-visualização: {combos.length} turma(s) serão criadas</p>
                    <div className="flex flex-wrap gap-1.5 max-h-40 overflow-auto">
                      {combos.map((c, i) => (
                        <Badge key={i} variant="secondary" className="text-[10px]">
                          {c.bairro.nome} · {c.faixa} · {c.periodo === "manha" ? "Manhã" : c.periodo === "tarde" ? "Tarde" : "Integral"}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" asChild><Link to="/turmas">Cancelar</Link></Button>
              <Button onClick={handleBatchGenerate} disabled={batchSaving || combos.length === 0}>
                <Zap className="h-4 w-4 mr-1" />{batchSaving ? "Gerando..." : `Gerar ${combos.length} Turma(s)`}
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default TurmaNovaPage;
