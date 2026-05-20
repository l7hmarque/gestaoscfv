import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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
import { format, startOfMonth, endOfMonth } from "date-fns";
import { BAIRROS_SCFV } from "@/lib/constants";

interface Props { open: boolean; onOpenChange: (v: boolean) => void }

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const ANOS = [2024, 2025, 2026, 2027];
const MESES = ["01","02","03","04","05","06","07","08","09","10","11","12"];
const MESES_NOMES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

export default function CoberturaPrioritariaDialog({ open, onOpenChange }: Props) {
  const now = new Date();
  const [ano, setAno] = useState(String(now.getFullYear()));
  const [mes, setMes] = useState(MESES[now.getMonth()]);
  const [loading, setLoading] = useState(false);
  const [driveUrl, setDriveUrl] = useState<string | null>(null);

  async function gerar() {
    setLoading(true); setDriveUrl(null);
    try {
      const ini = format(startOfMonth(new Date(Number(ano), Number(mes) - 1, 1)), "yyyy-MM-dd");
      const fim = format(endOfMonth(new Date(Number(ano), Number(mes) - 1, 1)), "yyyy-MM-dd");

      const [parts, brs, presencas, categorias] = await Promise.all([
        fetchAllRows("participantes", { select: "id, nome_completo, bairro_id, status, categoria_vulnerabilidade, periodo, data_nascimento" }),
        fetchAllRows("bairros", { select: "id, nome, meta_criancas_manha, meta_criancas_tarde, meta_idosos" }),
        supabase.from("relatorio_presenca").select("participante_id, presente, relatorios_atividade!inner(data)").gte("relatorios_atividade.data", ini).lte("relatorios_atividade.data", fim).then((r) => r.data || []),
        supabase.from("categorias_vulnerabilidade_padrao").select("nome").eq("ativo", true).order("ordem").then((r) => (r.data || []).map((x: any) => x.nome)),
      ]);

      const brMap: Record<string, any> = Object.fromEntries((brs as any[]).map((b) => [b.id, b]));

      // Set de participantes que tiveram pelo menos 1 presença no mês
      const idsAtendidos = new Set<string>();
      (presencas as any[]).forEach((r) => { if (r.presente && r.participante_id) idsAtendidos.add(r.participante_id); });

      const territorios = BAIRROS_SCFV;
      const colCategorias = [...(categorias as string[]), "Sem categoria informada"];

      const headerLine = ["Território", "Meta total", "Atendidos no mês", "% Cobertura", ...colCategorias];
      const dataRows: any[][] = [];

      for (const t of territorios) {
        const br = Object.values(brMap).find((b: any) => b.nome === t) as any;
        const meta = (br?.meta_criancas_manha || 0) + (br?.meta_criancas_tarde || 0) + (br?.meta_idosos || 0);
        const partsTerritorio = (parts as any[]).filter((p) => brMap[p.bairro_id]?.nome === t && idsAtendidos.has(p.id));
        const totalAtend = partsTerritorio.length;
        const pct = meta > 0 ? Math.round((totalAtend / meta) * 100) : 0;
        const catCounts = colCategorias.map((c) => {
          if (c === "Sem categoria informada") return partsTerritorio.filter((p) => !p.categoria_vulnerabilidade || !String(p.categoria_vulnerabilidade).trim()).length;
          return partsTerritorio.filter((p) => (p.categoria_vulnerabilidade || "").toLowerCase().includes(c.toLowerCase())).length;
        });
        dataRows.push([t, meta || "—", totalAtend, meta ? `${pct}%` : "—", ...catCounts]);
      }

      // Totalizador
      const totalMeta = dataRows.reduce((acc, r) => acc + (typeof r[1] === "number" ? r[1] : 0), 0);
      const totalAtend = dataRows.reduce((acc, r) => acc + (r[2] as number), 0);
      const totalPct = totalMeta > 0 ? `${Math.round((totalAtend / totalMeta) * 100)}%` : "—";
      const totalCats = colCategorias.map((_, i) => dataRows.reduce((acc, r) => acc + ((r[4 + i] as number) || 0), 0));
      dataRows.push(["TOTAL", totalMeta || "—", totalAtend, totalPct, ...totalCats]);

      const wb = XLSX.utils.book_new();
      const head = [
        ["RELATÓRIO DE COBERTURA DE PÚBLICO PRIORITÁRIO — SCFV"],
        [`Referência: ${MESES_NOMES[Number(mes) - 1]} / ${ano}`],
        [`Emitido em ${format(new Date(), "dd/MM/yyyy HH:mm")}`],
        [],
        headerLine,
        ...dataRows,
      ];
      const ws = XLSX.utils.aoa_to_sheet(head);
      const colCount = headerLine.length;
      ws["!merges"] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: colCount - 1 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: colCount - 1 } },
        { s: { r: 2, c: 0 }, e: { r: 2, c: colCount - 1 } },
      ];
      ws["A1"].s = { font: { bold: true, sz: 13 }, alignment: { horizontal: "center" } };
      for (let c = 0; c < colCount; c++) {
        const a = XLSX.utils.encode_cell({ r: 4, c });
        if (ws[a]) ws[a].s = { font: { bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "555555" } }, alignment: { horizontal: "center", wrapText: true } };
      }
      // Linha total em negrito
      const totalRow = 4 + dataRows.length;
      for (let c = 0; c < colCount; c++) {
        const a = XLSX.utils.encode_cell({ r: totalRow, c });
        if (ws[a]) ws[a].s = { font: { bold: true }, fill: { fgColor: { rgb: "EEEEEE" } } };
      }
      autoFitColumns(ws, { max: 30 });
      XLSX.utils.book_append_sheet(wb, ws, "Cobertura");

      const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
      const blob = new Blob([buf], { type: XLSX_MIME });
      const filename = sysCfvFileName("CoberturaPrioritaria", "xlsx", `${ano}-${mes}`);
      saveAs(blob, filename);

      tryUploadToDrive({ blob, filename, mimeType: XLSX_MIME, categoria: "CoberturaPrioritaria" }).then((r) => {
        if (r.url) { setDriveUrl(r.url); toast.success("Cópia salva no Google Drive."); }
      });
      toast.success("Relatório gerado.");
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
          <DialogTitle>Cobertura de Público Prioritário</DialogTitle>
          <DialogDescription>Cruza meta territorial × atendidos × categorias de vulnerabilidade. Para SAS, Controladoria e MP.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Mês</Label>
              <Select value={mes} onValueChange={setMes}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>{MESES.map((m, i) => <SelectItem key={m} value={m}>{MESES_NOMES[i]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Ano</Label>
              <Select value={ano} onValueChange={setAno}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>{ANOS.map((a) => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}</SelectContent>
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