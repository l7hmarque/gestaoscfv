import { useEffect, useState } from "react";
import { ArrowLeft, Download, Loader2, FileSpreadsheet, FileText } from "lucide-react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { exportMatrizFrequenciaDocx, exportMatrizFrequenciaPdf } from "@/hooks/useDocumentExport";

const BAIRROS_SCFV = ["JARDIM IRENE", "PARQUE INDEPENDENCIA", "ALVORADA"];

const PresencaExportarPage = () => {
  const [turmas, setTurmas] = useState<any[]>([]);
  const [selectedTurma, setSelectedTurma] = useState("");
  const [preenchida, setPreenchida] = useState(true);
  const [loading, setLoading] = useState(false);
  const [turmasLoading, setTurmasLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("turmas").select("*, bairros(nome)").eq("ativa", true).order("nome");
      setTurmas(data || []);
      setTurmasLoading(false);
    };
    load();
  }, []);

  const handleExport = async (format: "docx" | "pdf") => {
    if (!selectedTurma) { toast.error("Selecione uma turma"); return; }
    setLoading(true);
    try {
      const turma = turmas.find(t => t.id === selectedTurma);
      if (!turma) return;

      // Get participants
      const { data: tpData } = await supabase
        .from("turma_participantes")
        .select("participante_id, participantes(nome_completo)")
        .eq("turma_id", selectedTurma);
      
      // Get all presenca records for this turma
      const { data: presData } = await supabase
        .from("presenca")
        .select("participante_id, data, presente")
        .eq("turma_id", selectedTurma)
        .order("data");

      // Unique dates
      const datasSet = new Set<string>();
      (presData || []).forEach(p => datasSet.add(p.data));
      const datas = Array.from(datasSet).sort();

      // Build participant data
      const participantes = (tpData || [])
        .map((tp: any) => {
          const presencas: Record<string, boolean> = {};
          (presData || []).filter(p => p.participante_id === tp.participante_id).forEach(p => {
            presencas[p.data] = p.presente || false;
          });
          return { nome: tp.participantes?.nome_completo || "", presencas };
        })
        .sort((a, b) => a.nome.localeCompare(b.nome));

      if (format === "docx") {
        await exportMatrizFrequenciaDocx(turma, participantes, datas, preenchida);
      } else {
        exportMatrizFrequenciaPdf(turma, participantes, datas, preenchida);
      }
      toast.success(`Matriz exportada em ${format.toUpperCase()}`);
    } catch (err) {
      toast.error("Erro ao exportar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild><Link to="/presenca"><ArrowLeft className="h-4 w-4" /></Link></Button>
        <h1 className="text-xl font-semibold text-foreground">Exportar Matriz de Frequência</h1>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">Configurações</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs">Turma</Label>
            <Select value={selectedTurma} onValueChange={setSelectedTurma}>
              <SelectTrigger><SelectValue placeholder={turmasLoading ? "Carregando..." : "Selecione a turma"} /></SelectTrigger>
              <SelectContent>
                {turmas.map(t => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.nome} — {t.bairros?.nome || "Sem bairro"} ({t.periodo})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox checked={preenchida} onCheckedChange={(v) => setPreenchida(!!v)} />
            Incluir presenças já lançadas (preenchida)
          </label>

          <div className="flex gap-2">
            <Button size="sm" className="gap-1.5" disabled={loading || !selectedTurma} onClick={() => handleExport("docx")}>
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileSpreadsheet className="h-3.5 w-3.5" />}
              Exportar DOCX
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5" disabled={loading || !selectedTurma} onClick={() => handleExport("pdf")}>
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
              Exportar PDF
            </Button>
          </div>

          <p className="text-[10px] text-muted-foreground">
            A matriz será gerada em formato A4 paisagem com cabeçalho institucional, lista de nomes e datas.
            {preenchida ? " Presenças lançadas digitalmente serão marcadas com ✓." : " Será gerada em branco para preenchimento manual."}
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default PresencaExportarPage;
