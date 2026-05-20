import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2, FileText, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/fetchAllRows";
import { sysCfvFileName } from "@/lib/fileNaming";
import { tryUploadToDrive } from "@/lib/driveUpload";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format, subDays } from "date-fns";
import { CategoriaVulnerabilidadeCombobox } from "@/components/CategoriaVulnerabilidadeCombobox";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props { open: boolean; onOpenChange: (v: boolean) => void }

export default function FichaReferenciamentoDialog({ open, onOpenChange }: Props) {
  const [participantes, setParticipantes] = useState<any[]>([]);
  const [bairros, setBairros] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<string>("");
  const [comboOpen, setComboOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [driveUrl, setDriveUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setDriveUrl(null);
    (async () => {
      const [parts, brs] = await Promise.all([
        fetchAllRows("participantes", { select: "id, nome_completo, status, bairro_id", order: { column: "nome_completo" } }),
        fetchAllRows("bairros", { select: "id, nome" }),
      ]);
      setParticipantes(parts);
      setBairros(Object.fromEntries((brs as any[]).map((b) => [b.id, b.nome])));
    })();
  }, [open]);

  async function gerar() {
    if (!selected) { toast.error("Selecione um participante."); return; }
    setLoading(true);
    try {
      const { data: p } = await supabase.from("participantes").select("*").eq("id", selected).maybeSingle();
      if (!p) throw new Error("Participante não encontrado.");
      const desde = format(subDays(new Date(), 90), "yyyy-MM-dd");

      // Frequência últimos 90 dias
      const { data: presencas } = await supabase
        .from("relatorio_presenca")
        .select("presente, relatorios_atividade!inner(data)")
        .eq("participante_id", selected)
        .gte("relatorios_atividade.data", desde);
      const totalReg = presencas?.length || 0;
      const totalPres = (presencas || []).filter((r: any) => r.presente).length;
      const pct = totalReg ? Math.round((totalPres / totalReg) * 100) : 0;

      // Busca ativa
      const { data: ba } = await supabase
        .from("busca_ativa_registros")
        .select("data_registro, tipo_contato, descricao, resultado")
        .eq("participante_id", selected)
        .order("data_registro", { ascending: false })
        .limit(10);

      // Turma vínculo
      const { data: tp } = await supabase
        .from("turma_participantes")
        .select("turmas(nome, faixa_etaria, periodo)")
        .eq("participante_id", selected)
        .is("data_saida", null)
        .maybeSingle();
      const turma = (tp as any)?.turmas;

      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const W = doc.internal.pageSize.getWidth();
      let y = 40;

      doc.setFont("helvetica", "bold").setFontSize(14);
      doc.text("FICHA DE REFERENCIAMENTO — SCFV", W / 2, y, { align: "center" });
      y += 16;
      doc.setFont("helvetica", "normal").setFontSize(9);
      doc.text(`Emitido em ${format(new Date(), "dd/MM/yyyy HH:mm")}`, W / 2, y, { align: "center" });
      y += 18;

      autoTable(doc, {
        startY: y, theme: "grid", styles: { fontSize: 9, cellPadding: 4, lineColor: [80, 80, 80] },
        headStyles: { fillColor: [80, 80, 80], textColor: 255 },
        head: [["Dado", "Valor"]],
        body: [
          ["Nome completo", p.nome_completo || "—"],
          ["CPF", p.cpf || "—"],
          ["Data de nascimento", p.data_nascimento ? format(new Date(p.data_nascimento), "dd/MM/yyyy") : "—"],
          ["Gênero", p.genero || "—"],
          ["Cor/Raça", p.cor_raca || "—"],
          ["Endereço", [p.endereco_rua, p.endereco_numero, p.endereco_bairro].filter(Boolean).join(", ") || "—"],
          ["Bairro de atendimento", bairros[p.bairro_id] || "—"],
          ["Período", p.periodo || "—"],
          ["Escola / Série", [p.escola, p.serie].filter(Boolean).join(" — ") || "—"],
          ["Início no SCFV", p.iniciou_em ? format(new Date(p.iniciou_em), "dd/MM/yyyy") : "—"],
          ["Status atual", p.status || "—"],
          ["Vulnerabilidade", p.categoria_vulnerabilidade || "—"],
          ["Origem do encaminhamento", p.origem_encaminhamento || "—"],
          ["Responsável técnico", p.responsavel_tecnico || "—"],
        ],
      });

      y = (doc as any).lastAutoTable.finalY + 14;
      autoTable(doc, {
        startY: y, theme: "grid", styles: { fontSize: 9, cellPadding: 4, lineColor: [80, 80, 80] },
        headStyles: { fillColor: [80, 80, 80], textColor: 255 },
        head: [["Responsável familiar", "Vínculo", "Contato"]],
        body: [
          [p.responsavel1_nome || "—", p.vinculo_resp1 || "—", p.responsavel1_whatsapp || "—"],
          [p.responsavel2_nome || "—", p.vinculo_resp2 || "—", p.responsavel2_whatsapp || "—"],
        ],
      });

      y = (doc as any).lastAutoTable.finalY + 14;
      autoTable(doc, {
        startY: y, theme: "grid", styles: { fontSize: 9, cellPadding: 4, lineColor: [80, 80, 80] },
        headStyles: { fillColor: [80, 80, 80], textColor: 255 },
        head: [["Vínculo institucional"]],
        body: [
          [turma ? `${turma.nome} — ${turma.faixa_etaria || ""} — ${turma.periodo || ""}` : "Sem turma ativa"],
          [`Frequência últimos 90 dias: ${totalPres}/${totalReg} (${pct}%)`],
        ],
      });

      y = (doc as any).lastAutoTable.finalY + 14;
      autoTable(doc, {
        startY: y, theme: "grid", styles: { fontSize: 9, cellPadding: 4, lineColor: [80, 80, 80] },
        headStyles: { fillColor: [80, 80, 80], textColor: 255 },
        head: [["Data", "Tipo de contato", "Descrição", "Resultado"]],
        body: (ba || []).length
          ? (ba as any[]).map((r) => [
              format(new Date(r.data_registro), "dd/MM/yyyy"),
              r.tipo_contato || "—",
              r.descricao || "—",
              r.resultado || "—",
            ])
          : [["—", "Sem registros de busca ativa", "", ""]],
      });

      y = (doc as any).lastAutoTable.finalY + 14;
      doc.setFontSize(8).setFont("helvetica", "italic");
      doc.text(
        "Documento gerado automaticamente pelo SysCFV para fins de referenciamento à rede de proteção. " +
        "Dados sigilosos protegidos pela LGPD — uso restrito ao órgão destinatário.",
        40, y, { maxWidth: W - 80 },
      );

      const filename = sysCfvFileName("FichaReferenciamento", "pdf", (p.nome_completo || "Participante").replace(/\s+/g, "_"));
      const blob = doc.output("blob");
      saveAs(blob, filename);

      tryUploadToDrive({ blob, filename, mimeType: "application/pdf", categoria: "FichasReferenciamento" }).then((r) => {
        if (r.url) { setDriveUrl(r.url); toast.success("Cópia salva no Google Drive."); }
      });
      toast.success("Ficha gerada.");
    } catch (e: any) {
      toast.error("Erro: " + (e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  const selectedNome = participantes.find((p) => p.id === selected)?.nome_completo;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Ficha de Referenciamento</DialogTitle>
          <DialogDescription>Documento individual em PDF para CRAS, CREAS, Conselho Tutelar ou MP.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Participante</Label>
            <Popover open={comboOpen} onOpenChange={setComboOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className={cn("h-9 w-full justify-between font-normal text-sm mt-1", !selected && "text-muted-foreground")}>
                  <span className="truncate">{selectedNome || "Selecionar participante..."}</span>
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