import { useState, useEffect } from "react";
import { Plus, Users, Download } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { saveAs } from "file-saver";
import { sysEloFileName } from "@/lib/fileNaming";
import * as XLSX from "xlsx-js-style";
import { exportAllListasPresenca } from "@/lib/exportListaPresenca";

const periodoLabel: Record<string, string> = { manha: "Manhã", tarde: "Tarde", integral: "Integral" };
const faixaLabel: Record<string, string> = { "6-8": "6-8 anos", "9-11": "9-11 anos", "12-17": "12-17 anos", idosos: "Idosos" };
const diasLabel: Record<string, string> = { seg: "Seg", ter: "Ter", qua: "Qua", qui: "Qui", sex: "Sex", sab: "Sáb" };
const MESES_NOMES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

interface TurmaRow {
  id: string; nome: string; periodo: string | null; faixa_etaria: string | null;
  tipo: string | null; ativa: boolean | null; dias_semana: string[] | null;
  educador_id: string | null; bairro_id: string | null;
  profiles?: { nome: string } | null; bairros?: { nome: string } | null;
  participante_count: number;
}

const TurmasPage = () => {
  const [turmas, setTurmas] = useState<TurmaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportMes, setExportMes] = useState(String(new Date().getMonth() + 1));
  const [exportAno, setExportAno] = useState(String(new Date().getFullYear()));
  const [exporting, setExporting] = useState(false);

  useEffect(() => { fetchTurmas(); }, []);

  const fetchTurmas = async () => {
    setLoading(true);
    const { data } = await supabase.from("turmas").select("*, profiles(nome), bairros(nome)").order("nome");
    if (data) {
      const counts = await Promise.all(data.map((t) =>
        supabase.from("turma_participantes").select("id", { count: "exact", head: true }).eq("turma_id", t.id)
      ));
      setTurmas(data.map((t, i) => ({ ...t, participante_count: counts[i].count || 0 } as TurmaRow)));
    }
    setLoading(false);
  };

  const exportAllListas = async () => {
    setExporting(true);
    try {
      const mesNum = parseInt(exportMes);
      const anoNum = parseInt(exportAno);
      const ativas = turmas.filter(t => t.ativa);
      if (!ativas.length) { toast.error("Nenhuma turma ativa"); return; }

      const { data: allTp } = await supabase.from("turma_participantes").select("turma_id, participante_id, participantes(nome_completo, status)");
      const membersByTurma: Record<string, { nome: string }[]> = {};
      (allTp || []).forEach((tp: any) => {
        if (tp.participantes?.status === "desligado") return;
        if (!membersByTurma[tp.turma_id]) membersByTurma[tp.turma_id] = [];
        membersByTurma[tp.turma_id].push({ nome: tp.participantes?.nome_completo || "" });
      });

      const wb = XLSX.utils.book_new();
      const border = { style: "thin" as const, color: { rgb: "000000" } };
      const borders = { top: border, bottom: border, left: border, right: border };
      const hdrStyle = { font: { bold: true, color: { rgb: "FFFFFF" }, sz: 9 }, fill: { fgColor: { rgb: "1A5276" } }, border: borders, alignment: { horizontal: "center" as const, vertical: "center" as const, wrapText: true } };
      const cellStyle = { border: borders, alignment: { vertical: "center" as const }, font: { sz: 9 } };
      let sheetsAdded = 0;

      for (const t of ativas) {
        const diasSemana: string[] = t.dias_semana || [];
        const diasNum = diasSemana.map(d => DIAS_MAP[d.toLowerCase()]).filter(n => n !== undefined);
        const datas: string[] = [];
        const d = new Date(anoNum, mesNum - 1, 1);
        while (d.getMonth() === mesNum - 1) {
          if (diasNum.includes(d.getDay())) datas.push(format(d, "dd/MM"));
          d.setDate(d.getDate() + 1);
        }
        if (datas.length === 0) continue;

        const members = (membersByTurma[t.id] || []).sort((a, b) => a.nome.localeCompare(b.nome));
        const header = ["Nº", "Nome do Participante", ...datas];
        const rows = members.map((m, i) => [i + 1, m.nome, ...datas.map(() => "")]);

        const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
        const range = XLSX.utils.decode_range(ws["!ref"] || "A1");
        for (let r = range.s.r; r <= range.e.r; r++) {
          for (let c = range.s.c; c <= range.e.c; c++) {
            const addr = XLSX.utils.encode_cell({ r, c });
            if (!ws[addr]) ws[addr] = { v: "", t: "s" };
            ws[addr].s = r === 0 ? { ...hdrStyle } : { ...cellStyle };
          }
        }
        ws["!cols"] = [{ wch: 4 }, { wch: 35 }, ...datas.map(() => ({ wch: 5 }))];

        let sheetName = t.nome.replace(/[:\\/?*[\]]/g, "").slice(0, 31);
        const existingNames = wb.SheetNames || [];
        let suffix = 2;
        while (existingNames.includes(sheetName)) {
          const tag = ` (${suffix})`;
          sheetName = t.nome.replace(/[:\\/?*[\]]/g, "").slice(0, 31 - tag.length) + tag;
          suffix++;
        }
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
        sheetsAdded++;
      }

      if (sheetsAdded === 0) { toast.error("Nenhuma turma com dias de atividade neste mês"); return; }

      const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      saveAs(new Blob([buf], { type: "application/octet-stream" }), sysEloFileName("ListasPresenca", "xlsx", `${MESES_NOMES[mesNum - 1]}_${anoNum}`));
      toast.success(`${sheetsAdded} lista(s) exportada(s)!`);
      setExportOpen(false);
    } catch (e: any) {
      toast.error("Erro ao exportar: " + e.message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Turmas</h1>
          <p className="text-sm text-muted-foreground">{turmas.length} turma{turmas.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setExportOpen(true)}>
            <Download className="h-4 w-4 mr-1" />Listas de Presença
          </Button>
          <Button size="sm" asChild>
            <Link to="/turmas/nova"><Plus className="h-4 w-4 mr-1" />Nova Turma</Link>
          </Button>
        </div>
      </div>

      <Dialog open={exportOpen} onOpenChange={setExportOpen}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>Exportar Listas de Presença</DialogTitle>
            <DialogDescription>Gera um XLSX com uma aba por turma ativa, em branco para impressão.</DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Select value={exportMes} onValueChange={setExportMes}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{MESES_NOMES.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={exportAno} onValueChange={setExportAno}>
              <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
              <SelectContent>{[2025, 2026, 2027].map(a => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Button onClick={exportAllListas} disabled={exporting} className="w-full gap-1">
            <Download className="h-4 w-4" />{exporting ? "Gerando..." : "Gerar XLSX"}
          </Button>
        </DialogContent>
      </Dialog>

      {loading ? (
        <div className="flex justify-center py-12"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
      ) : turmas.length === 0 ? (
        <div className="text-sm text-muted-foreground border border-dashed rounded-lg p-8 text-center">Nenhuma turma cadastrada.</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {turmas.map((t) => (
            <Link key={t.id} to={`/turmas/${t.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between">
                    <h3 className="text-sm font-semibold text-foreground">{t.nome}</h3>
                    <Badge variant={t.ativa ? "default" : "secondary"} className="text-[10px]">{t.ativa ? "Ativa" : "Inativa"}</Badge>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {t.periodo && <Badge variant="outline" className="text-[10px]">{periodoLabel[t.periodo]}</Badge>}
                    {t.faixa_etaria && <Badge variant="outline" className="text-[10px]">{faixaLabel[t.faixa_etaria] || t.faixa_etaria}</Badge>}
                    {t.tipo === "extraordinaria" && <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">Extra</Badge>}
                  </div>
                  {t.dias_semana && t.dias_semana.length > 0 && (
                    <p className="text-xs text-muted-foreground">{t.dias_semana.map((d) => diasLabel[d] || d).join(", ")}</p>
                  )}
                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Users className="h-3 w-3" />{t.participante_count} participante{t.participante_count !== 1 ? "s" : ""}
                    </div>
                    {t.profiles?.nome && <span className="text-xs text-muted-foreground truncate max-w-[120px]">{t.profiles.nome}</span>}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default TurmasPage;
