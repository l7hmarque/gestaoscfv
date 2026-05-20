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

export default function EvasaoDialog({ open, onOpenChange }: Props) {
  const [bairro, setBairro] = useState("TODOS");
  const [desde, setDesde] = useState(format(subMonths(new Date(), 3), "yyyy-MM-dd"));
  const [ate, setAte] = useState(format(new Date(), "yyyy-MM-dd"));
  const [loading, setLoading] = useState(false);
  const [driveUrl, setDriveUrl] = useState<string | null>(null);

  async function gerar() {
    setLoading(true); setDriveUrl(null);
    try {
      const [parts, brs] = await Promise.all([
        fetchAllRows("participantes", {
          select: "id, nome_completo, data_nascimento, status, bairro_id, periodo, iniciou_em, data_desligamento, motivo_desligamento, justificativa_desligamento, responsavel1_nome, responsavel1_whatsapp, categoria_vulnerabilidade",
        }),
        fetchAllRows("bairros", { select: "id, nome" }),
      ]);
      const brMap: Record<string, string> = Object.fromEntries((brs as any[]).map((b) => [b.id, b.nome]));

      // Busca ativa por participante (último registro antes do desligamento)
      const { data: baReg } = await supabase
        .from("busca_ativa_registros")
        .select("participante_id, data_registro, tipo_contato, resultado")
        .order("data_registro", { ascending: false });
      const baMap: Record<string, any[]> = {};
      (baReg || []).forEach((r: any) => (baMap[r.participante_id] ||= []).push(r));

      const rows: any[][] = [];
      for (const p of parts as any[]) {
        if (p.status !== "desligado") continue;
        if (!p.data_desligamento) continue;
        if (p.data_desligamento < desde || p.data_desligamento > ate) continue;
        if (bairro !== "TODOS" && brMap[p.bairro_id] !== bairro) continue;
        const ba = baMap[p.id] || [];
        const permanencia = p.iniciou_em
          ? Math.max(0, Math.round((new Date(p.data_desligamento).getTime() - new Date(p.iniciou_em).getTime()) / 86400000))
          : null;
        rows.push([
          p.nome_completo,
          calcAge(p.data_nascimento),
          brMap[p.bairro_id] || "—",
          p.periodo || "—",
          p.iniciou_em ? format(new Date(p.iniciou_em), "dd/MM/yyyy") : "—",
          format(new Date(p.data_desligamento), "dd/MM/yyyy"),
          permanencia != null ? `${permanencia} dias` : "—",
          p.motivo_desligamento || "—",
          p.justificativa_desligamento || "—",
          ba.length,
          ba[0] ? `${format(new Date(ba[0].data_registro), "dd/MM/yyyy")} (${ba[0].tipo_contato})` : "—",
          p.categoria_vulnerabilidade || "—",
          p.responsavel1_nome || "—",
          p.responsavel1_whatsapp || "—",
        ]);
      }

      rows.sort((a, b) => String(b[5]).localeCompare(String(a[5])));

      const wb = XLSX.utils.book_new();
      const head = [
        ["RELATÓRIO DE EVASÃO — SCFV"],
        [`Período: ${format(new Date(desde), "dd/MM/yyyy")} a ${format(new Date(ate), "dd/MM/yyyy")} · Território: ${bairro}`],
        [`Emitido em ${format(new Date(), "dd/MM/yyyy HH:mm")} · Total: ${rows.length}`],
        [],
        ["Participante", "Idade", "Território", "Período", "Início", "Desligamento", "Permanência", "Motivo", "Justificativa", "Buscas ativas", "Última busca", "Vulnerabilidade", "Responsável", "Contato"],
        ...rows,
      ];
      const ws = XLSX.utils.aoa_to_sheet(head);
      ws["A1"].s = { font: { bold: true, sz: 13 }, alignment: { horizontal: "center" } };
      ws["!merges"] = [0, 1, 2].map((r) => ({ s: { r, c: 0 }, e: { r, c: 13 } }));
      for (let c = 0; c < 14; c++) {
        const a = XLSX.utils.encode_cell({ r: 4, c });
        if (ws[a]) ws[a].s = { font: { bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "555555" } }, alignment: { horizontal: "center", wrapText: true } };
      }
      autoFitColumns(ws, { max: 50 });
      XLSX.utils.book_append_sheet(wb, ws, "Evasão");

      const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
      const blob = new Blob([buf], { type: XLSX_MIME });
      const filename = sysCfvFileName("Evasao", "xlsx");
      saveAs(blob, filename);
      tryUploadToDrive({ blob, filename, mimeType: XLSX_MIME, categoria: "Evasao" }).then((r) => {
        if (r.url) { setDriveUrl(r.url); toast.success("Cópia salva no Google Drive."); }
      });
      toast.success(`Relatório de evasão gerado — ${rows.length} desligamentos.`);
    } catch (e: any) {
      toast.error("Erro: " + (e?.message || e));
    } finally { setLoading(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Relatório de Evasão</DialogTitle>
          <DialogDescription>Desligamentos no período, com motivo, permanência e histórico de busca ativa.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-xs">Desde</Label><Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="h-9" /></div>
            <div><Label className="text-xs">Até</Label><Input type="date" value={ate} onChange={(e) => setAte(e.target.value)} className="h-9" /></div>
          </div>
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