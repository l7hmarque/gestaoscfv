import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, FileText, ExternalLink, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { gerarRelatorioEvolucaoSAS } from "@/lib/exportEvolucaoSAS";

interface Props { open: boolean; onOpenChange: (v: boolean) => void }

export default function EvolucaoSASDialog({ open, onOpenChange }: Props) {
  const [mesInicio, setMesInicio] = useState("2026-03");
  const [mesFim, setMesFim] = useState("2026-05");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [driveUrl, setDriveUrl] = useState<string | null>(null);
  const { profileId } = useAuth();

  async function gerar() {
    if (mesInicio > mesFim) {
      toast.error("Mês inicial não pode ser posterior ao mês final.");
      return;
    }
    setLoading(true); setStatus("Iniciando..."); setDriveUrl(null);
    try {
      let nome: string | undefined;
      if (profileId) {
        const { data } = await supabase.from("profiles").select("nome_completo").eq("id", profileId).maybeSingle();
        nome = (data as any)?.nome_completo || undefined;
      }
      const r = await gerarRelatorioEvolucaoSAS({
        mesInicio, mesFim, autorNome: nome,
        onProgress: (s) => setStatus(s),
      });
      if (r.driveUrl) { setDriveUrl(r.driveUrl); toast.success("Relatório gerado e enviado ao Drive."); }
      else toast.success("Relatório gerado.");
    } catch (e: any) {
      console.error(e);
      toast.error("Erro ao gerar: " + (e?.message || e));
    } finally {
      setLoading(false); setStatus("");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" /> Relatório de Evolução SAS
          </DialogTitle>
          <DialogDescription>
            PDF institucional com KPIs mês a mês, gráficos, top 3 atividades por mês com fotos
            e texto-modelo interpretativo. Indicadores anteriores a 01/04/2026 são apresentados como linha de base.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Mês inicial</Label>
              <Input type="month" value={mesInicio} onChange={(e) => setMesInicio(e.target.value)} className="h-9" />
            </div>
            <div>
              <Label className="text-xs">Mês final</Label>
              <Input type="month" value={mesFim} onChange={(e) => setMesFim(e.target.value)} className="h-9" />
            </div>
          </div>
          {loading && status && (
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" /> {status}
            </div>
          )}
          {driveUrl && (
            <a href={driveUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-primary hover:underline">
              <ExternalLink className="h-3 w-3" /> Abrir no Google Drive
            </a>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Fechar</Button>
            <Button onClick={gerar} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <FileText className="h-4 w-4 mr-1" />}
              Gerar PDF
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}