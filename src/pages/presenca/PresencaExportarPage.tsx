import { useEffect, useState } from "react";
import { ArrowLeft, Download, Loader2, Printer } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { isBairroSCFV } from "@/lib/constants";
import { buildLista } from "@/lib/listaFrequencia";
import { FormatPicker, type ExportFormat } from "@/components/FormatPicker";

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
  const [loadingFreq, setLoadingFreq] = useState(false);
  const [loadingChamada, setLoadingChamada] = useState(false);
  const [turmasLoading, setTurmasLoading] = useState(true);

  // Formatos selecionados em cada card
  const [fmtFreq, setFmtFreq] = useState<ExportFormat[]>(["docx"]);
  const [fmtChamada, setFmtChamada] = useState<ExportFormat[]>(["pdf"]);

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

  const handleRun = async (modo: "frequencia" | "chamada") => {
    const formatos = modo === "frequencia" ? fmtFreq : fmtChamada;
    if (filteredTurmas.length === 0) {
      toast.error("Nenhuma turma corresponde aos filtros");
      return;
    }
    if (formatos.length === 0) {
      toast.error("Selecione ao menos um formato");
      return;
    }
    const setLoading = modo === "frequencia" ? setLoadingFreq : setLoadingChamada;
    setLoading(true);
    try {
      const r = await buildLista({
        modo,
        escopo: "turma",
        formatos,
        mes: Number(mesSel) + 1, // page state usa 0-11
        ano: Number(anoSel),
        turmas: filteredTurmas as any,
      });
      if (r.ok) {
        toast.success(
          `${r.turmasProcessadas} turma(s) · ${r.formatosGerados.map((f) => f.toUpperCase()).join(", ")}` +
            (r.turmasIgnoradas ? ` · ${r.turmasIgnoradas} ignorada(s)` : "")
        );
      } else {
        toast.error(r.mensagens[0] || "Falha ao exportar");
      }
      if (r.formatosFalha.length > 0) {
        toast.warning(`Falhas em: ${r.formatosFalha.map((f) => f.toUpperCase()).join(", ")}`);
      }
    } catch (err: any) {
      toast.error(err?.message || "Erro ao exportar");
    } finally {
      setLoading(false);
    }
  };

  const anos = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1];

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild><Link to="/dashboard"><ArrowLeft className="h-4 w-4" /></Link></Button>
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

      {/* Mês e Ano (compartilhado pelas duas listas) */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Período de Referência</CardTitle></CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>

      {/* Lista de Frequência (preenchida — documento oficial) */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Lista de Frequência (preenchida)</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Documento oficial com as presenças já lançadas no sistema. Use para anexar a relatórios institucionais.
            Marcadores: <strong>■</strong> presente · vazio ausente · <strong>—</strong> sem aula/desligado · <strong>(BA)</strong> em busca ativa · <strong>(D)</strong> desligado · <strong>(T)</strong> transferido.
          </p>

          <FormatPicker available={["docx", "pdf", "xlsx"]} value={fmtFreq} onChange={setFmtFreq} />

          <Button
            size="sm"
            className="gap-1.5"
            disabled={loadingFreq || filteredTurmas.length === 0 || fmtFreq.length === 0}
            onClick={() => handleRun("frequencia")}
          >
            {loadingFreq ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            Exportar Frequência
          </Button>
        </CardContent>
      </Card>

      {/* Lista de Chamada (em branco — para impressão e marcação manual) */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Lista de Chamada (em branco — para impressão)</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Instrumento de campo. Gera lista em branco com as datas do mês baseadas nos dias de atendimento da turma — para o educador imprimir e marcar a presença de caneta durante a atividade.
          </p>

          <FormatPicker available={["pdf", "docx", "xlsx"]} value={fmtChamada} onChange={setFmtChamada} />

          <Button
            size="sm"
            className="gap-1.5"
            disabled={loadingChamada || filteredTurmas.length === 0 || fmtChamada.length === 0}
            onClick={() => handleRun("chamada")}
          >
            {loadingChamada ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Printer className="h-3.5 w-3.5" />}
            Gerar Lista de Chamada
          </Button>

          <p className="text-[10px] text-muted-foreground">
            PDF A4 paisagem com linhas altas para escrita, coluna de Observações e 3 assinaturas (educador, coordenação, data). Turmas sem dias de atendimento cadastrados são ignoradas.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default PresencaExportarPage;
