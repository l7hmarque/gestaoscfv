import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, FileSpreadsheet, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { LEGENDA_MARCADORES } from "@/lib/marcadoresFrequencia";

const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

const PresencaExportarPage = () => {
  const now = new Date();
  const [mesSel, setMesSel] = useState(String(now.getMonth()));
  const [anoSel, setAnoSel] = useState(String(now.getFullYear()));

  const [loadingFreq, setLoadingFreq] = useState(false);
  const [loadingChamada, setLoadingChamada] = useState(false);
  const [urlFreq, setUrlFreq] = useState<string | null>(null);
  const [urlChamada, setUrlChamada] = useState<string | null>(null);

  // Carrega URLs já geradas anteriormente para o mês selecionado
  useEffect(() => {
    let active = true;
    const ano_mes = `${anoSel}-${String(Number(mesSel) + 1).padStart(2, "0")}`;
    (async () => {
      const { data } = await supabase
        .from("drive_planilhas_mensais")
        .select("tipo, drive_url")
        .eq("ano_mes", ano_mes)
        .in("tipo", ["listas_frequencia", "listas_chamada"]);
      if (!active) return;
      setUrlFreq(data?.find((d) => d.tipo === "listas_frequencia")?.drive_url || null);
      setUrlChamada(data?.find((d) => d.tipo === "listas_chamada")?.drive_url || null);
    })();
    return () => { active = false; };
  }, [mesSel, anoSel]);

  const gerar = async (
    tipo: "frequencia" | "chamada",
    fn: string,
    setLoading: (b: boolean) => void,
    setUrl: (u: string | null) => void
  ) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke(fn, {
        body: { mes: Number(mesSel) + 1, ano: Number(anoSel) },
      });
      if (error) throw error;
      const url = (data as any)?.url || (data as any)?.drive_url;
      if (!url) throw new Error("Edge não retornou URL");
      setUrl(url);
      toast.success(`${tipo === "frequencia" ? "Lista de Frequência" : "Lista de Chamada"} gerada no Google Drive`);
      window.open(url, "_blank", "noopener");
    } catch (e: any) {
      toast.error(e?.message || "Falha ao gerar lista no Google Drive");
    } finally {
      setLoading(false);
    }
  };

  const anos = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1];

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/dashboard"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-xl font-semibold text-foreground">Listas de Frequência (mensal)</h1>
          <p className="text-xs text-muted-foreground">
            Geração unificada via Google Drive (Sheets). Cada arquivo contém todas as turmas ativas, uma aba por turma.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">Mês de Referência</CardTitle></CardHeader>
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
                  {anos.map((a) => (
                    <SelectItem key={a} value={String(a)}>{a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground mt-3">{LEGENDA_MARCADORES}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Lista de Frequência (preenchida)</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Documento oficial com as presenças já lançadas no sistema. Usado para prestação de contas e anexar a relatórios.
          </p>
          <div className="flex gap-2 flex-wrap">
            <Button
              size="sm"
              className="gap-1.5"
              disabled={loadingFreq}
              onClick={() => gerar("frequencia", "generate-listas-frequencia-mes-gsheet", setLoadingFreq, setUrlFreq)}
            >
              {loadingFreq ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileSpreadsheet className="h-3.5 w-3.5" />}
              {urlFreq ? "Regenerar no Google Drive" : "Gerar no Google Drive"}
            </Button>
            {urlFreq && (
              <Button size="sm" variant="outline" className="gap-1.5" asChild>
                <a href={urlFreq} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3.5 w-3.5" /> Abrir planilha atual
                </a>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Lista de Chamada (em branco — para impressão)</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Instrumento de campo. Lista em branco com as datas do mês baseadas nos dias de atendimento — educador imprime e marca a presença de caneta.
          </p>
          <div className="flex gap-2 flex-wrap">
            <Button
              size="sm"
              className="gap-1.5"
              disabled={loadingChamada}
              onClick={() => gerar("chamada", "generate-listas-chamada-mes-gsheet", setLoadingChamada, setUrlChamada)}
            >
              {loadingChamada ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileSpreadsheet className="h-3.5 w-3.5" />}
              {urlChamada ? "Regenerar no Google Drive" : "Gerar no Google Drive"}
            </Button>
            {urlChamada && (
              <Button size="sm" variant="outline" className="gap-1.5" asChild>
                <a href={urlChamada} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3.5 w-3.5" /> Abrir planilha atual
                </a>
              </Button>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground">
            Turmas sem dias de atendimento cadastrados são ignoradas automaticamente.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default PresencaExportarPage;