import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { saveAs } from "file-saver";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileSpreadsheet, Download, FileText, Loader2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { FormatPicker, ExportFormat } from "@/components/FormatPicker";

const MESES = ["01","02","03","04","05","06","07","08","09","10","11","12"];
const MESES_NOMES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

/**
 * Tab simplificada — toda a lógica pesada de geração de relatórios mensais
 * vive agora nas Edge Functions `generate-relatorio-mensal` e `generate-reo`,
 * e a UI completa está em /relatorios/exportar (Hub Unificado).
 *
 * Esta aba mantém atalhos rápidos para os 2 documentos mais usados (Relatório
 * Mensal XLSX e REO DOCX+XLSX) e linka para o hub para opções avançadas.
 */
export default function DashboardRelatorioMensalTab() {
  const now = new Date();
  const [ano, setAno] = useState(String(now.getFullYear()));
  const [mes, setMes] = useState(String(now.getMonth() + 1).padStart(2, "0"));
  const [loadingMensal, setLoadingMensal] = useState(false);
  const [loadingReo, setLoadingReo] = useState(false);
  const [reoFormats, setReoFormats] = useState<ExportFormat[]>(["docx", "xlsx"]);

  const downloadFromUrl = async (url: string, filename: string) => {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error("Falha no download");
      saveAs(await res.blob(), filename);
    } catch {
      window.open(url, "_blank");
    }
  };

  const exportarMensal = async () => {
    setLoadingMensal(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-relatorio-mensal", {
        body: { mes, ano },
      });
      if (error) throw error;
      if (!data?.url) throw new Error("URL não retornada");
      await downloadFromUrl(data.url, data.fileName || `RelatorioMensal_${ano}-${mes}.xlsx`);
      toast.success("Relatório mensal gerado!");
    } catch (err: any) {
      toast.error("Erro: " + (err?.message || "Erro desconhecido"));
    } finally {
      setLoadingMensal(false);
    }
  };

  const exportarReo = async () => {
    if (!reoFormats.length) {
      toast.error("Selecione ao menos um formato");
      return;
    }
    setLoadingReo(true);
    try {
      const calls = reoFormats.map((formato) =>
        supabase.functions.invoke("generate-reo", { body: { mes, ano, formato } }),
      );
      const results = await Promise.allSettled(calls);
      const downloads: Promise<void>[] = [];
      let ok = 0;
      results.forEach((r, i) => {
        if (r.status === "fulfilled" && r.value.data?.url) {
          ok++;
          downloads.push(
            downloadFromUrl(
              r.value.data.url,
              r.value.data.fileName || `REO_${ano}-${mes}.${reoFormats[i]}`,
            ),
          );
        }
      });
      await Promise.all(downloads);
      if (ok > 0) toast.success(`REO gerado em ${ok} formato(s)!`);
      else throw new Error("Nenhum formato retornou arquivo");
    } catch (err: any) {
      toast.error("Erro REO: " + (err?.message || "Erro desconhecido"));
    } finally {
      setLoadingReo(false);
    }
  };

  const anyLoading = loadingMensal || loadingReo;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Relatórios Mensais</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Atalhos rápidos. Para mais opções (Atividades, Atendimentos, Gestão, Anual, Prestação de Contas)
            acesse o hub completo.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/relatorios/exportar">
            <ExternalLink className="h-4 w-4 mr-1" />
            Hub de Exportação
          </Link>
        </Button>
      </div>

      <Card>
        <CardContent className="pt-4">
          <div className="flex gap-3 items-end flex-wrap">
            <div>
              <Label className="text-xs">Mês</Label>
              <Select value={mes} onValueChange={setMes}>
                <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                <SelectContent>{MESES.map((m, i) => <SelectItem key={m} value={m}>{MESES_NOMES[i]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Ano</Label>
              <Input className="w-[100px]" value={ano} onChange={e => setAno(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4" /> Relatório Mensal Consolidado (XLSX)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Planilha com resumo, atividades, metas, monitoramento, atendimentos e
            matrizes de frequência preenchidas por turma. Geração no servidor.
          </p>
          <Button onClick={exportarMensal} disabled={anyLoading}>
            {loadingMensal
              ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" />Gerando...</>
              : <><Download className="h-4 w-4 mr-1" />Exportar XLSX</>}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <FileText className="h-4 w-4" /> Relatório de Execução do Objeto (REO)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Documento institucional com atividades, equipe técnica, metas, RH,
            monitoramento, financeiro, fotos e listas de presença preenchidas.
          </p>
          <FormatPicker
            available={["docx", "xlsx"]}
            value={reoFormats}
            onChange={setReoFormats}
          />
          <Button onClick={exportarReo} disabled={anyLoading || !reoFormats.length}>
            {loadingReo
              ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" />Gerando REO...</>
              : <><Download className="h-4 w-4 mr-1" />Exportar REO</>}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
