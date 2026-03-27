import { useEffect, useState } from "react";
import { ArrowLeft, Download, Loader2, FileSpreadsheet, FileText, Printer } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { exportMatrizFrequenciaDocx, exportMatrizFrequenciaPdf, exportListaPresencaPdf } from "@/hooks/useDocumentExport";
import { isBairroSCFV } from "@/lib/constants";

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

const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

const PresencaExportarPage = () => {
  const [turmas, setTurmas] = useState<any[]>([]);
  const [preenchida, setPreenchida] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loadingLista, setLoadingLista] = useState(false);
  const [turmasLoading, setTurmasLoading] = useState(true);

  // Month/year for lista de presença
  const now = new Date();
  const [mesSel, setMesSel] = useState(String(now.getMonth()));
  const [anoSel, setAnoSel] = useState(String(now.getFullYear()));

  // Multi-select filters
  const [selBairros, setSelBairros] = useState<string[]>([]);
  const [selFaixas, setSelFaixas] = useState<string[]>([]);
  const [selPeriodos, setSelPeriodos] = useState<string[]>([]);

  // Unique bairros from turmas (SCFV only)
  const bairrosSCFV = Array.from(
    new Map(
      turmas
        .filter(t => t.bairros?.nome && isBairroSCFV(t.bairros.nome))
        .map(t => [t.bairro_id, { id: t.bairro_id, nome: t.bairros.nome }])
    ).values()
  ).sort((a, b) => a.nome.localeCompare(b.nome));

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("turmas").select("*, bairros(nome)").eq("ativa", true).order("nome");
      setTurmas(data || []);
      setTurmasLoading(false);
    };
    load();
  }, []);

  const toggleArray = (arr: string[], val: string, setter: (v: string[]) => void) => {
    setter(arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val]);
  };

  // Filtered turmas based on multi-select
  const filteredTurmas = turmas.filter(t => {
    if (selBairros.length > 0 && !selBairros.includes(t.bairro_id)) return false;
    if (selFaixas.length > 0 && !selFaixas.includes(t.faixa_etaria)) return false;
    if (selPeriodos.length > 0 && !selPeriodos.includes(t.periodo)) return false;
    return true;
  });

  const handleExport = async (format: "docx" | "pdf") => {
    if (filteredTurmas.length === 0) { toast.error("Nenhuma turma corresponde aos filtros"); return; }
    setLoading(true);
    try {
      for (const turma of filteredTurmas) {
        const { data: tpData } = await supabase
          .from("turma_participantes")
          .select("participante_id, participantes(nome_completo)")
          .eq("turma_id", turma.id);

        const { data: presData } = await supabase
          .from("presenca")
          .select("participante_id, data, presente")
          .eq("turma_id", turma.id)
          .order("data");

        const datasSet = new Set<string>();
        (presData || []).forEach(p => datasSet.add(p.data));
        const datas = Array.from(datasSet).sort();

        const participantes = (tpData || [])
          .map((tp: any) => {
            const presencas: Record<string, boolean> = {};
            (presData || []).filter(p => p.participante_id === tp.participante_id).forEach(p => {
              presencas[p.data] = p.presente || false;
            });
            return { nome: tp.participantes?.nome_completo || "", presencas };
          })
          .sort((a, b) => a.nome.localeCompare(b.nome));

        if (format === "docx") {
          await exportMatrizFrequenciaDocx(turma, participantes, datas, preenchida);
        } else {
          await exportMatrizFrequenciaPdf(turma, participantes, datas, preenchida);
        }
      }
      toast.success(`${filteredTurmas.length} matriz(es) exportada(s) em ${format.toUpperCase()}`);
    } catch (err) {
      toast.error("Erro ao exportar");
    } finally {
      setLoading(false);
    }
  };

  const handleExportLista = async () => {
    if (filteredTurmas.length === 0) { toast.error("Nenhuma turma corresponde aos filtros"); return; }
    const turmasSemDias = filteredTurmas.filter(t => !t.dias_semana || t.dias_semana.length === 0);
    if (turmasSemDias.length > 0) {
      toast.warning(`${turmasSemDias.length} turma(s) sem dias de atendimento cadastrados serão ignoradas`);
    }
    const turmasComDias = filteredTurmas.filter(t => t.dias_semana && t.dias_semana.length > 0);
    if (turmasComDias.length === 0) { toast.error("Nenhuma turma com dias de atendimento cadastrados"); return; }

    setLoadingLista(true);
    try {
      for (const turma of turmasComDias) {
        const { data: tpData } = await supabase
          .from("turma_participantes")
          .select("participante_id, participantes(nome_completo)")
          .eq("turma_id", turma.id);

        const participantes = (tpData || [])
          .map((tp: any) => ({ nome: tp.participantes?.nome_completo || "" }))
          .sort((a, b) => a.nome.localeCompare(b.nome));

        await exportListaPresencaPdf(turma, participantes, Number(anoSel), Number(mesSel));
      }
      toast.success(`${turmasComDias.length} lista(s) de presença gerada(s)`);
    } catch (err) {
      toast.error("Erro ao gerar lista de presença");
    } finally {
      setLoadingLista(false);
    }
  };

  const anos = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1];

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild><Link to="/presenca"><ArrowLeft className="h-4 w-4" /></Link></Button>
        <h1 className="text-xl font-semibold text-foreground">Exportar Presença</h1>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">Filtros</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">Selecione os filtros para escolher quais turmas exportar. Deixe em branco para incluir todas.</p>

          <div>
            <Label className="text-xs font-medium mb-2 block">Bairros SCFV</Label>
            <div className="flex flex-wrap gap-3">
              {turmasLoading ? (
                <span className="text-xs text-muted-foreground">Carregando...</span>
              ) : bairrosSCFV.map(b => (
                <label key={b.id} className="flex items-center gap-1.5 cursor-pointer">
                  <Checkbox checked={selBairros.includes(b.id)} onCheckedChange={() => toggleArray(selBairros, b.id, setSelBairros)} />
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
                  <Checkbox checked={selFaixas.includes(f.value)} onCheckedChange={() => toggleArray(selFaixas, f.value, setSelFaixas)} />
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
                  <Checkbox checked={selPeriodos.includes(p.value)} onCheckedChange={() => toggleArray(selPeriodos, p.value, setSelPeriodos)} />
                  <span className="text-sm">{p.label}</span>
                </label>
              ))}
            </div>
          </div>

          {filteredTurmas.length > 0 && (
            <div className="rounded-md border p-3 space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Turmas selecionadas: {filteredTurmas.length}</p>
              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-auto">
                {filteredTurmas.map(t => (
                  <Badge key={t.id} variant="secondary" className="text-[10px]">
                    {t.nome}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Matriz de Frequência */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Matriz de Frequência</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">Exporta as presenças já registradas no sistema.</p>

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox checked={preenchida} onCheckedChange={(v) => setPreenchida(!!v)} />
            Incluir presenças já lançadas (preenchida)
          </label>

          <div className="flex gap-2">
            <Button size="sm" className="gap-1.5" disabled={loading || filteredTurmas.length === 0} onClick={() => handleExport("docx")}>
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileSpreadsheet className="h-3.5 w-3.5" />}
              Exportar DOCX
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5" disabled={loading || filteredTurmas.length === 0} onClick={() => handleExport("pdf")}>
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
              Exportar PDF
            </Button>
          </div>

          <p className="text-[10px] text-muted-foreground">
            {preenchida ? "Presenças lançadas digitalmente serão marcadas com ✓." : "Será gerada em branco para preenchimento manual."}
          </p>
        </CardContent>
      </Card>

      {/* Lista de Presença (em branco) */}
      <Card>
        <CardHeader><CardTitle className="text-sm">📋 Lista de Presença (para impressão)</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Gera lista em branco com as datas do mês baseadas nos dias de atendimento da turma. Ideal para imprimir e preencher de caneta.
          </p>

          <div className="flex gap-3">
            <div className="flex-1">
              <Label className="text-xs font-medium mb-1 block">Mês</Label>
              <Select value={mesSel} onValueChange={setMesSel}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MESES.map((m, i) => (
                    <SelectItem key={i} value={String(i)}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-24">
              <Label className="text-xs font-medium mb-1 block">Ano</Label>
              <Select value={anoSel} onValueChange={setAnoSel}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {anos.map(a => (
                    <SelectItem key={a} value={String(a)}>{a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button size="sm" className="gap-1.5" disabled={loadingLista || filteredTurmas.length === 0} onClick={handleExportLista}>
            {loadingLista ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Printer className="h-3.5 w-3.5" />}
            Gerar Lista de Presença (PDF)
          </Button>

          <p className="text-[10px] text-muted-foreground">
            PDF A4 paisagem com cabeçalho institucional, nomes e quadradinhos ☐ para cada data de atendimento do mês.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default PresencaExportarPage;
