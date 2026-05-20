import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, FileSpreadsheet, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { fetchAllRows } from "@/lib/fetchAllRows";
import { sysCfvFileName } from "@/lib/fileNaming";
import { tryUploadToDrive } from "@/lib/driveUpload";
import { saveAs } from "file-saver";
import * as XLSX from "xlsx-js-style";
import { autoFitColumns } from "@/lib/xlsxAutoFit";
import { format, subMonths } from "date-fns";

interface Props { open: boolean; onOpenChange: (v: boolean) => void }
const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const ORGAOS = ["TODOS", "cras", "creas", "conselho_tutelar", "ubs", "caps", "escola", "ministerio_publico", "outro"];

export default function EncaminhamentosDialog({ open, onOpenChange }: Props) {
  const [orgao, setOrgao] = useState("TODOS");
  const [status, setStatus] = useState("TODOS");
  const [desde, setDesde] = useState(format(subMonths(new Date(), 3), "yyyy-MM-dd"));
  const [ate, setAte] = useState(format(new Date(), "yyyy-MM-dd"));
  const [loading, setLoading] = useState(false);
  const [driveUrl, setDriveUrl] = useState<string | null>(null);

  async function gerar() {
    setLoading(true); setDriveUrl(null);
    try {
      const [encs, parts, profs] = await Promise.all([
        fetchAllRows("encaminhamentos_externos", { select: "*" }),
        fetchAllRows("participantes", { select: "id, nome_completo, bairro_id" }),
        fetchAllRows("profiles", { select: "id, nome_completo" }),
      ]);
      const partMap: Record<string, any> = Object.fromEntries((parts as any[]).map((p) => [p.id, p]));
      const profMap: Record<string, any> = Object.fromEntries((profs as any[]).map((p) => [p.id, p]));

      const filt = (encs as any[]).filter((e) => {
        if (e.data_encaminhamento < desde || e.data_encaminhamento > ate) return false;
        if (orgao !== "TODOS" && e.tipo !== orgao) return false;
        if (status !== "TODOS" && e.status !== status) return false;
        return true;
      });

      // Aba 1: detalhado
      const detalhado: any[][] = [
        ["Data", "Participante", "Órgão (tipo)", "Órgão (nome)", "Motivo", "Status", "Data retorno", "Observações retorno", "Contato", "Profissional"],
        ...filt.sort((a, b) => b.data_encaminhamento.localeCompare(a.data_encaminhamento)).map((e) => [
          format(new Date(e.data_encaminhamento), "dd/MM/yyyy"),
          partMap[e.participante_id]?.nome_completo || "—",
          e.tipo || "—",
          e.orgao || "—",
          e.motivo || "—",
          e.status || "—",
          e.data_retorno ? format(new Date(e.data_retorno), "dd/MM/yyyy") : "—",
          e.observacoes_retorno || "—",
          e.contato || "—",
          profMap[e.profissional_id]?.nome_completo || "—",
        ]),
      ];

      // Aba 2: resumo por órgão
      const resumo: Record<string, { total: number; abertos: number; resolvidos: number }> = {};
      filt.forEach((e) => {
        const k = e.tipo || "outro";
        resumo[k] ||= { total: 0, abertos: 0, resolvidos: 0 };
        resumo[k].total++;
        if (e.status === "aberto" || e.status === "em_andamento") resumo[k].abertos++;
        if (e.status === "resolvido" || e.status === "fechado") resumo[k].resolvidos++;
      });
      const resumoRows: any[][] = [
        ["Órgão", "Total", "Em aberto/andamento", "Resolvidos/fechados"],
        ...Object.entries(resumo).map(([k, v]) => [k, v.total, v.abertos, v.resolvidos]),
      ];

      const wb = XLSX.utils.book_new();
      const header = [
        ["ENCAMINHAMENTOS À REDE DE PROTEÇÃO — SCFV"],
        [`Período: ${format(new Date(desde), "dd/MM/yyyy")} a ${format(new Date(ate), "dd/MM/yyyy")} · Órgão: ${orgao} · Status: ${status}`],
        [`Emitido em ${format(new Date(), "dd/MM/yyyy HH:mm")} · Total: ${filt.length}`],
        [],
      ];
      const wsDet = XLSX.utils.aoa_to_sheet([...header, ...detalhado]);
      wsDet["A1"].s = { font: { bold: true, sz: 13 } };
      wsDet["!merges"] = [0, 1, 2].map((r) => ({ s: { r, c: 0 }, e: { r, c: 9 } }));
      for (let c = 0; c < 10; c++) {
        const a = XLSX.utils.encode_cell({ r: 4, c });
        if (wsDet[a]) wsDet[a].s = { font: { bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "555555" } }, alignment: { horizontal: "center", wrapText: true } };
      }
      autoFitColumns(wsDet, { max: 50 });
      XLSX.utils.book_append_sheet(wb, wsDet, "Detalhado");

      const wsRes = XLSX.utils.aoa_to_sheet([["RESUMO POR ÓRGÃO"], [], ...resumoRows]);
      wsRes["A1"].s = { font: { bold: true, sz: 13 } };
      for (let c = 0; c < 4; c++) {
        const a = XLSX.utils.encode_cell({ r: 2, c });
        if (wsRes[a]) wsRes[a].s = { font: { bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "555555" } } };
      }
      autoFitColumns(wsRes, { max: 40 });
      XLSX.utils.book_append_sheet(wb, wsRes, "Resumo");

      const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
      const blob = new Blob([buf], { type: XLSX_MIME });
      const filename = sysCfvFileName("Encaminhamentos", "xlsx");
      saveAs(blob, filename);
      tryUploadToDrive({ blob, filename, mimeType: XLSX_MIME, categoria: "Encaminhamentos" }).then((r) => {
        if (r.url) { setDriveUrl(r.url); toast.success("Cópia salva no Google Drive."); }
      });
      toast.success(`Encaminhamentos exportados — ${filt.length} registros.`);
    } catch (e: any) {
      toast.error("Erro: " + (e?.message || e));
    } finally { setLoading(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Encaminhamentos por Órgão</DialogTitle>
          <DialogDescription>Lista detalhada + resumo por órgão (CRAS, CREAS, CT, UBS, MP…).</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-xs">Desde</Label><Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="h-9" /></div>
            <div><Label className="text-xs">Até</Label><Input type="date" value={ate} onChange={(e) => setAte(e.target.value)} className="h-9" /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Órgão</Label>
              <Select value={orgao} onValueChange={setOrgao}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>{ORGAOS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["TODOS", "aberto", "em_andamento", "resolvido", "fechado"].map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
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