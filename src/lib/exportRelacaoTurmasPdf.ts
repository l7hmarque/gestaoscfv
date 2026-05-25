import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { sysCfvFileName } from "@/lib/fileNaming";
import { FAIXA_LABELS } from "@/lib/constants";

export interface TurmaPdfRow {
  id: string;
  nome: string;
  oficina: string | null;
  bairro: string | null;
  periodo: string | null;
  faixa_etaria: string | null;
  dias_semana: string[] | null;
  educador: string | null;
  participantes: { nome: string; status?: string }[];
}

const PERIODO_LABEL: Record<string, string> = { manha: "Manhã", tarde: "Tarde", integral: "Integral" };
const DIAS_LABEL: Record<string, string> = { seg: "Seg", ter: "Ter", qua: "Qua", qui: "Qui", sex: "Sex", sab: "Sáb" };

export function exportRelacaoTurmasPdf(turmas: TurmaPdfRow[]) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  // Capa
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("RELAÇÃO DE TURMAS — SysCFV", pageW / 2, 22, { align: "center" });

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  const totalPart = turmas.reduce((s, t) => s + t.participantes.length, 0);
  doc.text(
    `Gerado em ${new Date().toLocaleString("pt-BR")} — ${turmas.length} turmas · ${totalPart} participantes`,
    pageW / 2, 28, { align: "center" }
  );

  // Agrupa por oficina
  const byOficina: Record<string, TurmaPdfRow[]> = {};
  turmas.forEach(t => {
    const k = t.oficina || "Sem oficina";
    (byOficina[k] = byOficina[k] || []).push(t);
  });
  const oficinas = Object.keys(byOficina).sort();

  let cursorY = 36;

  oficinas.forEach((oficina) => {
    const turmasOf = byOficina[oficina];
    const educadores = Array.from(new Set(turmasOf.map(t => t.educador).filter(Boolean))) as string[];
    const partOf = turmasOf.reduce((s, t) => s + t.participantes.length, 0);

    // Cabeçalho da oficina
    if (cursorY > pageH - 40) { doc.addPage(); cursorY = 18; }
    doc.setDrawColor(0); doc.setFillColor(0, 0, 0);
    doc.rect(10, cursorY, pageW - 20, 9, "F");
    doc.setTextColor(255); doc.setFont("helvetica", "bold"); doc.setFontSize(11);
    doc.text(oficina, 13, cursorY + 6);
    doc.setFontSize(8); doc.setFont("helvetica", "normal");
    doc.text(
      `${educadores.join(", ") || "Sem educador"}  ·  ${turmasOf.length} turmas  ·  ${partOf} part.`,
      pageW - 13, cursorY + 6, { align: "right" }
    );
    doc.setTextColor(0);
    cursorY += 12;

    // Cada turma
    turmasOf
      .sort((a, b) => a.nome.localeCompare(b.nome))
      .forEach((t) => {
        if (cursorY > pageH - 30) { doc.addPage(); cursorY = 18; }

        doc.setFont("helvetica", "bold"); doc.setFontSize(9.5);
        doc.text(t.nome, 12, cursorY);
        cursorY += 4;

        doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(0);
        const meta = [
          t.bairro ? `Bairro: ${t.bairro}` : "Bairro: —",
          t.periodo ? `Período: ${PERIODO_LABEL[t.periodo] || t.periodo}` : "",
          t.faixa_etaria ? `Faixa: ${FAIXA_LABELS[t.faixa_etaria] || t.faixa_etaria}` : "",
          t.dias_semana && t.dias_semana.length ? `Dias: ${t.dias_semana.map(d => DIAS_LABEL[d] || d).join("·")}` : "",
          `Educador: ${t.educador || "—"}`,
          `Participantes: ${t.participantes.length}`,
        ].filter(Boolean).join("   ");
        doc.text(meta, 12, cursorY);
        doc.setTextColor(0);
        cursorY += 2;

        const body = t.participantes.length
          ? t.participantes.map((p, i) => [
              String(i + 1),
              p.nome + (p.status === "busca_ativa" ? "  (BA)" : ""),
            ])
          : [["—", "Sem participantes vinculados"]];

        autoTable(doc, {
          startY: cursorY,
          head: [["#", "Participante"]],
          body,
          theme: "grid",
          styles: { fontSize: 7.5, cellPadding: 1.2, textColor: 20 },
          headStyles: { fillColor: [230, 230, 230], textColor: 20, fontStyle: "bold" },
          alternateRowStyles: { fillColor: [248, 248, 248] },
          columnStyles: { 0: { cellWidth: 10, halign: "right" } },
          margin: { left: 12, right: 12 },
          didDrawPage: () => { /* handled outside */ },
        });
        cursorY = (doc as any).lastAutoTable.finalY + 6;
      });

    cursorY += 2;
  });

  // Paginação
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFontSize(7); doc.setTextColor(120);
    doc.text(`Página ${i} de ${total}`, pageW - 12, pageH - 6, { align: "right" });
    doc.text("SysCFV — Relação de Turmas", 12, pageH - 6);
    doc.setTextColor(0);
  }

  doc.save(sysCfvFileName("Relacao_Turmas", "pdf"));
}