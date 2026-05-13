import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { saveAs } from "file-saver";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileSpreadsheet, Download, Loader2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { sysCfvFileName } from "@/lib/fileNaming";

const MESES = ["01","02","03","04","05","06","07","08","09","10","11","12"];
const MESES_NOMES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

/**
 * Tab simplificada — atalho rápido para o Relatório Mensal Consolidado.
 * UI completa em /relatorios/exportar (Hub Unificado).
 */
export default function DashboardRelatorioMensalTab() {
  const now = new Date();
  const [ano, setAno] = useState(String(now.getFullYear()));
  const [mes, setMes] = useState(String(now.getMonth() + 1).padStart(2, "0"));
  const [loadingMensal, setLoadingMensal] = useState(false);
  const [mensalDriveUrl, setMensalDriveUrl] = useState<string | null>(null);

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
    setMensalDriveUrl(null);
    try {
      const { data, error } = await supabase.functions.invoke("generate-relatorio-mensal", {
        body: { mes, ano },
      });
      if (error) throw error;
      if (!data?.url) throw new Error("URL não retornada");
      await downloadFromUrl(data.url, data.fileName || sysCfvFileName("RelatorioMensal", "xlsx", `${ano}-${mes}`));
      if (data.gsheet_url) setMensalDriveUrl(data.gsheet_url);
      toast.success(data.gsheet_url ? "Relatório gerado e salvo no Drive!" : "Relatório mensal gerado!");
    } catch (err: any) {
      toast.error("Erro: " + (err?.message || "Erro desconhecido"));
    } finally {
      setLoadingMensal(false);
    }
  };

  const anyLoading = loadingMensal;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Relatórios Mensais</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Atalho rápido. Para mais opções (Atividades, Atendimentos, Gestão, Anual)
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
              : <><Download className="h-4 w-4 mr-1" />Gerar no Drive (Sheets)</>}
          </Button>
          {mensalDriveUrl && (
            <a
              href={mensalDriveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline ml-2"
            >
              <ExternalLink className="h-3 w-3" /> Abrir no Drive
            </a>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
