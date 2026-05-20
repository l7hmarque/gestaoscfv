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
import { format, startOfMonth, endOfMonth, parseISO } from "date-fns";
import { BAIRROS_SCFV } from "@/lib/constants";

interface Props { open: boolean; onOpenChange: (v: boolean) => void }
const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export default function BoletimArticulacaoDialog({ open, onOpenChange }: Props) {
  const [mes, setMes] = useState(format(new Date(), "yyyy-MM"));
  const [bairro, setBairro] = useState("TODOS");
  const [loading, setLoading] = useState(false);
  const [driveUrl, setDriveUrl] = useState<string | null>(null);

  async function gerar() {
    setLoading(true); setDriveUrl(null);
    try {
      const ref = parseISO(mes + "-01");
      const desde = format(startOfMonth(ref), "yyyy-MM-dd");
      const ate = format(endOfMonth(ref), "yyyy-MM-dd");

      const [parts, brs, baReg, encs, roteiros] = await Promise.all([
        fetchAllRows("participantes", { select: "id, status, bairro_id, busca_ativa_desde, data_desligamento, categoria_vulnerabilidade, iniciou_em" }),
        fetchAllRows("bairros", { select: "id, nome" }),
        fetchAllRows("busca_ativa_registros", { select: "participante_id, data_registro, tipo_contato, resultado" }),
        fetchAllRows("encaminhamentos_externos", { select: "participante_id, tipo, status, data_encaminhamento, data_retorno" }),
        fetchAllRows("roteiro_visitas", { select: "id, status, created_at" }).catch(() => []),
      ]);
      const brMap: Record<string, string> = Object.fromEntries((brs as any[]).map((b) => [b.id, b.nome]));

      const inTerr = (bid: string) => bairro === "TODOS" || brMap[bid] === bairro;
      const inPeriod = (d?: string | null) => !!d && d >= desde && d <= ate;

      // Métricas
      const ativos = (parts as any[]).filter((p) => p.status === "ativo" && inTerr(p.bairro_id));
      const desligamentos = (parts as any[]).filter((p) => inPeriod(p.data_desligamento) && inTerr(p.bairro_id));
      const ingressos = (parts as any[]).filter((p) => inPeriod(p.iniciou_em) && inTerr(p.bairro_id));
      const emBA = (parts as any[]).filter((p) => p.busca_ativa_desde && p.status !== "desligado" && inTerr(p.bairro_id));

      const partIdSet = new Set((parts as any[]).filter((p) => inTerr(p.bairro_id)).map((p) => p.id));
      const baMes = (baReg as any[]).filter((r) => partIdSet.has(r.participante_id) && inPeriod(r.data_registro));
      const encMes = (encs as any[]).filter((r) => partIdSet.has(r.participante_id) && inPeriod(r.data_encaminhamento));
      const retornos = (encs as any[]).filter((r) => partIdSet.has(r.participante_id) && inPeriod(r.data_retorno));

      // Por órgão
      const porOrgao: Record<string, number> = {};
      encMes.forEach((e) => { porOrgao[e.tipo || "outro"] = (porOrgao[e.tipo || "outro"] || 0) + 1; });

      // Vulnerabilidades
      const porVuln: Record<string, number> = {};
      ativos.forEach((p) => {
        const c = (p.categoria_vulnerabilidade || "").trim() || "Não informado";
        porVuln[c] = (porVuln[c] || 0) + 1;
      });

      const wb = XLSX.utils.book_new();
      const sec = (titulo: string) => [[titulo], []];
      const linhas: any[][] = [
        ["BOLETIM DE ARTICULAÇÃO COM A REDE — SCFV"],
        [`Mês de referência: ${format(ref, "MM/yyyy")} · Território: ${bairro}`],
        [`Emitido em ${format(new Date(), "dd/MM/yyyy HH:mm")}`],
        [],
        ...sec("1. PÚBLICO ATENDIDO"),
        ["Ativos no período", ativos.length],
        ["Ingressos no mês", ingressos.length],
        ["Desligamentos no mês", desligamentos.length],
        ["Em busca ativa", emBA.length],
        [],
        ...sec("2. AÇÕES DA EQUIPE TÉCNICA"),
        ["Registros de busca ativa no mês", baMes.length],
        ["Visitas/roteiros no mês", (roteiros as any[]).filter((r) => inPeriod(String(r.created_at).slice(0, 10))).length],
        [],
        ...sec("3. ARTICULAÇÃO COM A REDE"),
        ["Encaminhamentos emitidos", encMes.length],
        ["Retornos recebidos", retornos.length],
        [],
        ["Encaminhamentos por órgão", "Quantidade"],
        ...Object.entries(porOrgao).map(([k, v]) => [k, v]),
        [],
        ...sec("4. VULNERABILIDADE DECLARADA (ativos)"),
        ["Categoria", "Atendidos"],
        ...Object.entries(porVuln).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, v]),
      ];
      const ws = XLSX.utils.aoa_to_sheet(linhas);
      ws["A1"].s = { font: { bold: true, sz: 14 }, alignment: { horizontal: "center" } };
      ws["!merges"] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 1 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 1 } },
        { s: { r: 2, c: 0 }, e: { r: 2, c: 1 } },
      ];
      // Destaca títulos de seção
      linhas.forEach((row, idx) => {
        if (typeof row[0] === "string" && /^\d\. /.test(row[0])) {
          const a = XLSX.utils.encode_cell({ r: idx, c: 0 });
          if (ws[a]) ws[a].s = { font: { bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "333333" } } };
        }
      });
      autoFitColumns(ws, { max: 60 });
      XLSX.utils.book_append_sheet(wb, ws, "Boletim");

      const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
      const blob = new Blob([buf], { type: XLSX_MIME });
      const filename = sysCfvFileName("BoletimArticulacao", "xlsx", format(ref, "yyyy-MM"));
      saveAs(blob, filename);
      tryUploadToDrive({ blob, filename, mimeType: XLSX_MIME, categoria: "BoletimArticulacao" }).then((r) => {
        if (r.url) { setDriveUrl(r.url); toast.success("Cópia salva no Google Drive."); }
      });
      toast.success("Boletim de articulação gerado.");
    } catch (e: any) {
      toast.error("Erro: " + (e?.message || e));
    } finally { setLoading(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Boletim de Articulação com a Rede</DialogTitle>
          <DialogDescription>Consolidado mensal: atendidos, busca ativa, encaminhamentos e vulnerabilidades.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-xs">Mês</Label><Input type="month" value={mes} onChange={(e) => setMes(e.target.value)} className="h-9" /></div>
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