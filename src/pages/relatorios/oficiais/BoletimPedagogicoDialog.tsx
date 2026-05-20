import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Loader2, FileText, ExternalLink, ChevronsUpDown } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/fetchAllRows";
import { sysCfvFileName } from "@/lib/fileNaming";
import { tryUploadToDrive } from "@/lib/driveUpload";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format, subMonths, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface Props { open: boolean; onOpenChange: (v: boolean) => void }

function fmtDate(d?: string | null) {
  if (!d) return "—";
  try { return format(parseISO(d), "dd/MM/yyyy"); } catch { return d; }
}

export default function BoletimPedagogicoDialog({ open, onOpenChange }: Props) {
  const [participantes, setParticipantes] = useState<any[]>([]);
  const [bairros, setBairros] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<string>("");
  const [comboOpen, setComboOpen] = useState(false);
  const [inicio, setInicio] = useState(format(subMonths(new Date(), 6), "yyyy-MM-dd"));
  const [fim, setFim] = useState(format(new Date(), "yyyy-MM-dd"));
  const [loading, setLoading] = useState(false);
  const [driveUrl, setDriveUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setDriveUrl(null);
    (async () => {
      const [parts, brs] = await Promise.all([
        fetchAllRows("participantes", { select: "id, nome_completo, status, bairro_id, iniciou_em, data_nascimento", order: { column: "nome_completo" } }),
        fetchAllRows("bairros", { select: "id, nome" }),
      ]);
      setParticipantes(parts);
      setBairros(Object.fromEntries((brs as any[]).map((b) => [b.id, b.nome])));
    })();
  }, [open]);

  const selectedPart = useMemo(() => participantes.find((p) => p.id === selected), [participantes, selected]);

  async function gerar() {
    if (!selected) { toast.error("Selecione um participante."); return; }
    if (!inicio || !fim) { toast.error("Informe o período."); return; }
    setLoading(true);
    try {
      const { data: p } = await supabase.from("participantes").select("*").eq("id", selected).maybeSingle();
      if (!p) throw new Error("Participante não encontrado.");

      // 1) Presenças no período (com info da atividade)
      const { data: presRows } = await supabase
        .from("relatorio_presenca")
        .select("presente, justificativa, relatorios_atividade!inner(id, data, nome_atividade, score_elo, observacoes, objetivo_alcancado, tipo_atividade)")
        .eq("participante_id", selected)
        .gte("relatorios_atividade.data", inicio)
        .lte("relatorios_atividade.data", fim);
      const pres = (presRows || []) as any[];
      const totalReg = pres.length;
      const totalPres = pres.filter((r) => r.presente).length;
      const totalAus = totalReg - totalPres;
      const pct = totalReg ? Math.round((totalPres / totalReg) * 100) : 0;

      // Frequência mês a mês
      const porMes = new Map<string, { pres: number; tot: number }>();
      pres.forEach((r) => {
        const m = String(r.relatorios_atividade?.data || "").slice(0, 7);
        if (!m) return;
        const acc = porMes.get(m) || { pres: 0, tot: 0 };
        acc.tot += 1; if (r.presente) acc.pres += 1;
        porMes.set(m, acc);
      });
      const mesesOrd = Array.from(porMes.entries()).sort((a, b) => a[0].localeCompare(b[0]));

      // Atividades em que participou (presente=true), com ELO e objetivo
      const ativ = pres
        .filter((r) => r.presente && r.relatorios_atividade)
        .map((r) => r.relatorios_atividade)
        .sort((a: any, b: any) => String(b.data).localeCompare(String(a.data)))
        .slice(0, 25);

      // 2) Relatos da equipe técnica vinculados a este participante
      const { data: relatos } = await supabase
        .from("relato_equipe_participantes")
        .select("relato_equipe_tecnica(motivo, descricao, created_at)")
        .eq("participante_id", selected);
      const relatosOrd = ((relatos || []) as any[])
        .map((r) => r.relato_equipe_tecnica)
        .filter(Boolean)
        .filter((r) => r.created_at >= inicio && r.created_at <= fim + "T23:59:59")
        .sort((a: any, b: any) => String(b.created_at).localeCompare(String(a.created_at)))
        .slice(0, 15);

      // 3) Encaminhamentos externos no período
      const { data: encs } = await supabase
        .from("encaminhamentos_externos")
        .select("data_encaminhamento, orgao, tipo, motivo, status, data_retorno, observacoes_retorno")
        .eq("participante_id", selected)
        .gte("data_encaminhamento", inicio)
        .lte("data_encaminhamento", fim)
        .order("data_encaminhamento", { ascending: false });

      // 4) Turma atual
      const { data: tp } = await supabase
        .from("turma_participantes")
        .select("turmas(nome, faixa_etaria, periodo)")
        .eq("participante_id", selected)
        .is("data_saida", null)
        .maybeSingle();
      const turma = (tp as any)?.turmas;

      // ===== PDF =====
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const W = doc.internal.pageSize.getWidth();
      let y = 40;

      doc.setFont("helvetica", "bold").setFontSize(14);
      doc.text("BOLETIM PEDAGÓGICO INDIVIDUAL", W / 2, y, { align: "center" });
      y += 14;
      doc.setFont("helvetica", "normal").setFontSize(9);
      doc.text(
        `Período: ${fmtDate(inicio)} a ${fmtDate(fim)} · Emitido em ${format(new Date(), "dd/MM/yyyy HH:mm")}`,
        W / 2, y, { align: "center" },
      );
      y += 18;

      // Identificação
      autoTable(doc, {
        startY: y, theme: "grid", styles: { fontSize: 9, cellPadding: 4, lineColor: [80, 80, 80] },
        headStyles: { fillColor: [80, 80, 80], textColor: 255 },
        head: [["Identificação", ""]],
        body: [
          ["Nome", p.nome_completo || "—"],
          ["Nascimento", fmtDate(p.data_nascimento)],
          ["Bairro / Período", `${bairros[p.bairro_id] || "—"} · ${p.periodo || "—"}`],
          ["Turma atual", turma ? `${turma.nome} — ${turma.faixa_etaria || ""} — ${turma.periodo || ""}` : "Sem turma ativa"],
          ["Início no SCFV", fmtDate(p.iniciou_em)],
          ["Status", p.status || "—"],
        ],
      });
      y = (doc as any).lastAutoTable.finalY + 12;

      // Frequência resumo
      autoTable(doc, {
        startY: y, theme: "grid", styles: { fontSize: 9, cellPadding: 4, lineColor: [80, 80, 80] },
        headStyles: { fillColor: [80, 80, 80], textColor: 255 },
        head: [["Frequência no período", ""]],
        body: [
          ["Registros", String(totalReg)],
          ["Presenças", String(totalPres)],
          ["Faltas", String(totalAus)],
          ["% de presença", `${pct}%`],
        ],
      });
      y = (doc as any).lastAutoTable.finalY + 12;

      // Frequência mês a mês
      autoTable(doc, {
        startY: y, theme: "grid", styles: { fontSize: 9, cellPadding: 4, lineColor: [80, 80, 80] },
        headStyles: { fillColor: [80, 80, 80], textColor: 255 },
        head: [["Mês", "Presenças / Total", "%"]],
        body: mesesOrd.length
          ? mesesOrd.map(([m, v]) => {
              const [yy, mm] = m.split("-");
              const label = format(new Date(Number(yy), Number(mm) - 1, 1), "MMM/yyyy", { locale: ptBR });
              const p = v.tot ? Math.round((v.pres / v.tot) * 100) : 0;
              return [label, `${v.pres}/${v.tot}`, `${p}%`];
            })
          : [["—", "Sem registros no período", ""]],
      });
      y = (doc as any).lastAutoTable.finalY + 12;

      // Atividades participadas
      autoTable(doc, {
        startY: y, theme: "grid", styles: { fontSize: 8.5, cellPadding: 3, lineColor: [80, 80, 80] },
        headStyles: { fillColor: [80, 80, 80], textColor: 255 },
        head: [["Data", "Atividade", "Tipo", "ELO", "Objetivo"]],
        body: ativ.length
          ? ativ.map((a: any) => [
              fmtDate(a.data),
              a.nome_atividade || "—",
              Array.isArray(a.tipo_atividade) ? a.tipo_atividade.join(", ") : (a.tipo_atividade || "—"),
              a.score_elo != null ? Number(a.score_elo).toFixed(2) : "—",
              a.objetivo_alcancado || "—",
            ])
          : [["—", "Sem atividades registradas no período", "", "", ""]],
        columnStyles: { 0: { cellWidth: 55 }, 3: { cellWidth: 32, halign: "center" } },
      });
      y = (doc as any).lastAutoTable.finalY + 12;

      // Observações da equipe técnica
      autoTable(doc, {
        startY: y, theme: "grid", styles: { fontSize: 8.5, cellPadding: 3, lineColor: [80, 80, 80] },
        headStyles: { fillColor: [80, 80, 80], textColor: 255 },
        head: [["Data", "Motivo", "Observação da equipe técnica"]],
        body: relatosOrd.length
          ? relatosOrd.map((r: any) => [
              r.created_at ? format(new Date(r.created_at), "dd/MM/yyyy") : "—",
              r.motivo || "—",
              r.descricao || "—",
            ])
          : [["—", "Sem relatos vinculados ao participante", ""]],
        columnStyles: { 0: { cellWidth: 55 }, 1: { cellWidth: 110 } },
      });
      y = (doc as any).lastAutoTable.finalY + 12;

      // Encaminhamentos
      autoTable(doc, {
        startY: y, theme: "grid", styles: { fontSize: 8.5, cellPadding: 3, lineColor: [80, 80, 80] },
        headStyles: { fillColor: [80, 80, 80], textColor: 255 },
        head: [["Data", "Órgão", "Motivo", "Status", "Retorno"]],
        body: (encs || []).length
          ? (encs as any[]).map((e) => [
              fmtDate(e.data_encaminhamento),
              e.orgao || (e.tipo || "—"),
              e.motivo || "—",
              e.status || "—",
              e.data_retorno ? `${fmtDate(e.data_retorno)} — ${e.observacoes_retorno || ""}` : "—",
            ])
          : [["—", "Sem encaminhamentos no período", "", "", ""]],
        columnStyles: { 0: { cellWidth: 55 } },
      });
      y = (doc as any).lastAutoTable.finalY + 14;

      doc.setFontSize(8).setFont("helvetica", "italic");
      doc.text(
        "Boletim gerado automaticamente pelo SysCFV. Documento pedagógico de evolução individual — uso restrito à família e à rede de proteção.",
        40, y, { maxWidth: W - 80 },
      );

      const filename = sysCfvFileName(
        "BoletimPedagogico", "pdf",
        (p.nome_completo || "Participante").replace(/\s+/g, "_"),
      );
      const blob = doc.output("blob");
      saveAs(blob, filename);

      tryUploadToDrive({ blob, filename, mimeType: "application/pdf", categoria: "BoletinsPedagogicos" }).then((r) => {
        if (r.url) { setDriveUrl(r.url); toast.success("Cópia salva no Google Drive."); }
      });
      toast.success("Boletim gerado.");
    } catch (e: any) {
      toast.error("Erro: " + (e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Boletim Pedagógico Individual</DialogTitle>
          <DialogDescription>
            Evolução do participante: frequência mês a mês, atividades, observações da equipe técnica e encaminhamentos.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Participante</Label>
            <Popover open={comboOpen} onOpenChange={setComboOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className={cn("h-9 w-full justify-between font-normal text-sm mt-1", !selected && "text-muted-foreground")}>
                  <span className="truncate">{selectedPart?.nome_completo || "Selecionar participante..."}</span>
                  <ChevronsUpDown className="h-4 w-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start">
                <Command>
                  <CommandInput placeholder="Buscar..." />
                  <CommandList>
                    <CommandEmpty>Nenhum encontrado.</CommandEmpty>
                    <CommandGroup>
                      {participantes.map((p) => (
                        <CommandItem key={p.id} value={p.nome_completo} onSelect={() => { setSelected(p.id); setComboOpen(false); }}>
                          {p.nome_completo}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Início</Label>
              <Input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} className="h-9 mt-1" />
            </div>
            <div>
              <Label className="text-xs">Fim</Label>
              <Input type="date" value={fim} onChange={(e) => setFim(e.target.value)} className="h-9 mt-1" />
            </div>
          </div>
          {driveUrl && (
            <a href={driveUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-primary hover:underline">
              <ExternalLink className="h-3 w-3" /> Abrir no Google Drive
            </a>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
            <Button onClick={gerar} disabled={loading || !selected}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <FileText className="h-4 w-4 mr-1" />}
              Gerar PDF
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}