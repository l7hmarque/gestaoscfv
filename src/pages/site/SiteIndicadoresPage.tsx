import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Users, GraduationCap, BarChart3, TrendingUp, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import jsPDF from "jspdf";

interface Indicadores {
  totalParticipantes: number;
  totalTurmas: number;
  mediaFrequencia: number;
  totalAtendimentos: number;
}

export default function SiteIndicadoresPage() {
  const [data, setData] = useState<Indicadores | null>(null);
  const [loading, setLoading] = useState(true);
  const [showLead, setShowLead] = useState(false);
  const [leadNome, setLeadNome] = useState("");
  const [leadEmail, setLeadEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadIndicadores();
  }, []);

  async function loadIndicadores() {
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/public-indicadores`;
      const res = await fetch(url, {
        headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
      });
      if (res.ok) {
        setData(await res.json());
      } else {
        // Fallback — no edge function yet, use defaults
        setData({ totalParticipantes: 0, totalTurmas: 0, mediaFrequencia: 0, totalAtendimentos: 0 });
      }
    } catch {
      setData({ totalParticipantes: 0, totalTurmas: 0, mediaFrequencia: 0, totalAtendimentos: 0 });
    } finally {
      setLoading(false);
    }
  }

  async function handleExport() {
    if (!leadNome.trim() || !leadEmail.trim()) {
      toast.error("Preencha nome e email");
      return;
    }
    setSubmitting(true);
    try {
      await supabase.from("site_leads" as any).insert({ nome: leadNome, email: leadEmail, interesse: "indicadores" });
      generatePdf();
      setShowLead(false);
      toast.success("Relatório exportado com sucesso!");
    } catch {
      toast.error("Erro ao enviar dados");
    } finally {
      setSubmitting(false);
    }
  }

  function generatePdf() {
    if (!data) return;
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.setTextColor(229, 84, 27);
    doc.text("Relatório Sintético — SCNSA / CAIA", 20, 25);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Gerado em ${new Date().toLocaleDateString("pt-BR")}`, 20, 33);

    doc.setDrawColor(229, 84, 27);
    doc.line(20, 37, 190, 37);

    const items = [
      ["Participantes Ativos", String(data.totalParticipantes)],
      ["Turmas Ativas", String(data.totalTurmas)],
      ["Frequência Média", `${data.mediaFrequencia.toFixed(1)}%`],
      ["Atendimentos Realizados", String(data.totalAtendimentos)],
    ];

    let y = 50;
    doc.setFontSize(12);
    items.forEach(([label, value]) => {
      doc.setTextColor(60);
      doc.text(label, 20, y);
      doc.setTextColor(229, 84, 27);
      doc.setFont("helvetica", "bold");
      doc.text(value, 150, y, { align: "right" });
      doc.setFont("helvetica", "normal");
      y += 12;
    });

    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text("Sociedade Civil Nossa Senhora Aparecida — Medianeira/PR", 105, 280, { align: "center" });

    doc.save("SysELO_Indicadores_SCNSA.pdf");
  }

  const cards = data
    ? [
        { icon: Users, label: "Participantes Ativos", value: data.totalParticipantes, color: "#E5541B" },
        { icon: GraduationCap, label: "Turmas Ativas", value: data.totalTurmas, color: "#3B8FC2" },
        { icon: BarChart3, label: "Frequência Média", value: `${data.mediaFrequencia.toFixed(1)}%`, color: "#E5541B" },
        { icon: TrendingUp, label: "Atendimentos", value: data.totalAtendimentos, color: "#3B8FC2" },
      ]
    : [];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div className="text-center mb-12">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
          Painel de <span className="text-[#E5541B]">Indicadores</span>
        </h1>
        <p className="text-gray-500 max-w-2xl mx-auto">
          Dados agregados do Serviço de Convivência e Fortalecimento de Vínculos executado pela SCNSA.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-[#E5541B]" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            {cards.map((c) => (
              <div key={c.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 text-center hover:shadow-md transition-shadow">
                <div className="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center" style={{ backgroundColor: c.color + "15" }}>
                  <c.icon className="h-6 w-6" style={{ color: c.color }} />
                </div>
                <p className="text-3xl font-bold text-gray-900">{c.value}</p>
                <p className="text-sm text-gray-500 mt-1">{c.label}</p>
              </div>
            ))}
          </div>

          <div className="text-center">
            <Button
              onClick={() => setShowLead(true)}
              className="bg-[#E5541B] hover:bg-[#E5541B]/90 text-white gap-2"
            >
              <Download className="h-4 w-4" /> Exportar Relatório Sintético
            </Button>
          </div>
        </>
      )}

      <Dialog open={showLead} onOpenChange={setShowLead}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Exportar Relatório</DialogTitle>
            <DialogDescription>Informe seus dados para receber o relatório.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Seu nome" value={leadNome} onChange={(e) => setLeadNome(e.target.value)} />
            <Input placeholder="Seu email" type="email" value={leadEmail} onChange={(e) => setLeadEmail(e.target.value)} />
            <Button onClick={handleExport} disabled={submitting} className="w-full bg-[#E5541B] hover:bg-[#E5541B]/90 text-white">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Baixar PDF"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
