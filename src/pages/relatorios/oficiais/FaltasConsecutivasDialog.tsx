import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, FileSpreadsheet, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/fetchAllRows";
import { sysCfvFileName } from "@/lib/fileNaming";
import { tryUploadToDrive } from "@/lib/driveUpload";
import { saveAs } from "file-saver";
import * as XLSX from "xlsx-js-style";
import { autoFitColumns } from "@/lib/xlsxAutoFit";
import { format, subMonths } from "date-fns";
import { BAIRROS_SCFV, calcAge } from "@/lib/constants";

interface Props { open: boolean; onOpenChange: (v: boolean) => void }

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export default function FaltasConsecutivasDialog({ open, onOpenChange }: Props) {
  const [bairro, setBairro] = useState<string>("TODOS");
  const [desde, setDesde] = useState(format(subMonths(new Date(), 1), "yyyy-MM-dd"));
  const [ate, setAte] = useState(format(new Date(), "yyyy-MM-dd"));
  const [limiar, setLimiar] = useState(3);
  const [loading, setLoading] = useState(false);
  const [driveUrl, setDriveUrl] = useState<string | null>(null);

  async function gerar() {
    setLoading(true); setDriveUrl(null);
    try {
      // Carrega presenças no intervalo
      const { data: presencas } = await supabase
        .from("relatorio_presenca")
        .select("presente, participante_id, justificativa, relatorios_atividade!inner(data, turma_id)")
        .gte("relatorios_atividade.data", desde)
        .lte("relatorios_atividade.data", ate);

      const [parts, brs] = await Promise.all([
        fetchAllRows("participantes", { select: "id, nome_completo, data_nascimento, status, bairro_id, periodo, responsavel1_nome, responsavel1_whatsapp, busca_ativa_desde" }),
        fetchAllRows("bairros", { select: "id, nome" }),
      ]);
      const brMap: Record<string, string> = Object.fromEntries((brs as any[]).map((b) => [b.id, b.nome]));

      // Agrupar por participante ordenado por data DESC
      const byPart: Record<string, { data: string; presente: boolean }[]> = {};
      (presencas || []).forEach((r: any) => {
        if (!r.participante_id) return;
        const d = r.relatorios_atividade?.data;
        if (!d) return;
        (byPart[r.participante_id] ||= []).push({ data: d, presente: !!r.presente });
      });

      const rows: any[][] = [];
      for (const p of parts as any[]) {
        if (p.status === "desligado") continue;
        if (bairro !== "TODOS" && brMap[p.bairro_id] !== bairro) continue;
        const hist = (byPart[p.id] || []).sort((a, b) => b.data.localeCompare(a.data));
        if (!hist.length) continue;

        // Conta faltas consecutivas a partir do registro mais recente
        let consec = 0;
        let ultimaPres: string | null = null;
        for (const h of hist) {
          if (!h.presente) consec++;
          else { ultimaPres = h.data; break; }
        }
        if (consec < limiar) continue;
        rows.push([
          p.nome_completo,
          calcAge(p.data_nascimento),
          brMap[p.bairro_id] || "—",
          p.periodo || "—",
          consec,
          ultimaPres ? format(new Date(ultimaPres), "dd/MM/yyyy") : "Sem presença no período",
          p.responsavel1_nome || "—",
          p.responsavel1_whatsapp || "—",
          p.busca_ativa_desde ? "Sim — " + format(new Date(p.busca_ativa_desde), "dd/MM/yyyy") : "Não",
          consec >= 5 ? "Encaminhar Conselho Tutelar" : "Reforçar busca ativa",
        ]);
      }

      rows.sort((a, b) => (b[4] as number) - (a[4] as number));

      const wb = XLSX.utils.book_new();
      const head = [
        ["RELATÓRIO DE FALTAS CONSECUTIVAS — SCFV"],
        [`Período: ${format(new Date(desde), "dd/MM/yyyy")} a ${format(new Date(ate), "dd/MM/yyyy")} · Limiar: ${limiar} faltas · Território: ${bairro}`],
        [`Emitido em ${format(new Date(), "dd/MM/yyyy HH:mm")}`],
        [],
        ["Participante", "Idade", "Território", "Período", "Faltas consec.", "Última presença", "Responsável", "Contato", "Em busca ativa?", "Encaminhamento sugerido"],
        ...rows,
      ];
      const ws = XLSX.utils.aoa_to_sheet(head);
      // estilo título
      ws["A1"].s = { font: { bold: true, sz: 13 }, alignment: { horizontal: "center" } };
      ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 9 } }, { s: { r: 1, c: 0 }, e: { r: 1, c: 9 } }, { s: { r: 2, c: 0 }, e: { r: 2, c: 9 } }];
      for (let c = 0; c < 10; c++) {
        const a = XLSX.utils.encode_cell({ r: 4, c });
        if (ws[a]) ws[a].s = { font: { bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "555555" } }, alignment: { horizontal: "center", wrapText: true } };
      }
      autoFitColumns(ws, { max: 50 });
      XLSX.utils.book_append_sheet(wb, ws, "Faltas Consecutivas");

      const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
      const blob = new Blob([buf], { type: XLSX_MIME });
      const filename = sysCfvFileName("FaltasConsecutivas", "xlsx");
      saveAs(blob, filename);

      tryUploadToDrive({ blob, filename, mimeType: XLSX_MIME, categoria: "FaltasConsecutivas" }).then((r) => {
        if (r.url) { setDriveUrl(r.url); toast.success("Cópia salva no Google Drive."); }
      });
      toast.success(`Relatório gerado — ${rows.length} participantes.`);
    } catch (e: any) {
      toast.error("Erro: " + (e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Faltas Consecutivas com Alerta</DialogTitle>
          <DialogDescription>Para Conselho Tutelar, coordenação interna e equipe técnica.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Desde</Label>
              <Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="h-9" />
            </div>
            <div>
              <Label className="text-xs">Até</Label>
              <Input type="date" value={ate} onChange={(e) => setAte(e.target.value)} className="h-9" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Território</Label>
              <Select value={bairro} onValueChange={setBairro}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODOS">Todos</SelectItem>
                  {BAIRROS_SCFV.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Limiar (faltas consec.)</Label>
              <Input type="number" min={1} max={20} value={limiar} onChange={(e) => setLimiar(Number(e.target.value) || 3)} className="h-9" />
            </div>
          </div>
          {driveUrl && (
            <a href={driveUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-primary hover:underline">
              <ExternalLink className="h-3 w-3" /> Abrir no Google Drive
            </a>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
            <Button onClick={gerar} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <FileSpreadsheet className="h-4 w-4 mr-1" />}
              Gerar XLSX
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}