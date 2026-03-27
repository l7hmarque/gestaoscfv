import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileSpreadsheet, Download } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

const MESES = ["01","02","03","04","05","06","07","08","09","10","11","12"];
const MESES_NOMES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

function calcAge(dob: string): number {
  const b = new Date(dob); const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  if (now.getMonth() < b.getMonth() || (now.getMonth() === b.getMonth() && now.getDate() < b.getDate())) age--;
  return age;
}
function faixaFromAge(age: number): string {
  if (age <= 8) return "6-8"; if (age <= 11) return "9-11"; if (age <= 17) return "12-17"; return "60+";
}

export default function DashboardRelatorioMensalTab() {
  const now = new Date();
  const [ano, setAno] = useState(String(now.getFullYear()));
  const [mes, setMes] = useState(String(now.getMonth() + 1).padStart(2, "0"));
  const [generating, setGenerating] = useState(false);

  const generate = async () => {
    setGenerating(true);
    const mesNum = parseInt(mes);
    const startDate = `${ano}-${mes}-01`;
    const endDate = mesNum === 12 ? `${parseInt(ano)+1}-01-01` : `${ano}-${String(mesNum+1).padStart(2,"0")}-01`;

    // Fetch all data
    const [presRes, partRes, turmasRes, bairrosRes, relRes, planRes, tpRes] = await Promise.all([
      supabase.from("presenca").select("*").gte("data", startDate).lt("data", endDate),
      supabase.from("participantes").select("*"),
      supabase.from("turmas").select("*"),
      supabase.from("bairros").select("*"),
      supabase.from("relatorios_atividade").select("*").gte("data", startDate).lt("data", endDate),
      supabase.from("planejamentos").select("*").gte("data_aplicacao", startDate).lt("data_aplicacao", endDate),
      supabase.from("turma_participantes").select("*"),
    ]);

    const presencas = presRes.data || [];
    const participantes = partRes.data || [];
    const turmas = turmasRes.data || [];
    const bairros = bairrosRes.data || [];
    const relatorios = relRes.data || [];
    const planejamentos = planRes.data || [];
    const turmaParticipantes = tpRes.data || [];

    const partMap = new Map(participantes.map((p: any) => [p.id, p]));
    const bairroMap = new Map(bairros.map((b: any) => [b.id, b.nome]));
    const turmaMap = new Map(turmas.map((t: any) => [t.id, t]));

    const wb = XLSX.utils.book_new();

    // --- Sheet 1: Resumo ---
    const atendidosIds = new Set(presencas.filter((p: any) => p.presente).map((p: any) => p.participante_id));
    const atendidos = [...atendidosIds].map(id => partMap.get(id)).filter(Boolean);

    // By bairro
    const byBairro: Record<string, number> = {};
    atendidos.forEach((p: any) => { const b = p.endereco_bairro || "N/I"; byBairro[b] = (byBairro[b] || 0) + 1; });

    // By faixa
    const byFaixa: Record<string, number> = {};
    atendidos.forEach((p: any) => {
      if (p.data_nascimento) { const f = faixaFromAge(calcAge(p.data_nascimento)); byFaixa[f] = (byFaixa[f] || 0) + 1; }
    });

    // By periodo
    const byPeriodo: Record<string, number> = {};
    atendidos.forEach((p: any) => { const per = p.periodo || "N/I"; byPeriodo[per] = (byPeriodo[per] || 0) + 1; });

    // New registrations
    const novasInsercoes = participantes.filter((p: any) => {
      if (!p.created_at) return false;
      const d = p.created_at.slice(0, 10);
      return d >= startDate && d < endDate;
    });

    const resumoData = [
      ["RELATÓRIO MENSAL — SysELO SCFV"],
      [`Mês: ${MESES_NOMES[mesNum - 1]} / ${ano}`],
      [`Data de geração: ${new Date().toLocaleString("pt-BR")}`],
      [],
      ["ATENDIDOS NO MÊS", atendidosIds.size],
      [],
      ["POR BAIRRO"],
      ...Object.entries(byBairro).sort((a, b) => b[1] - a[1]).map(([b, c]) => [b, c]),
      [],
      ["POR FAIXA ETÁRIA"],
      ...Object.entries(byFaixa).map(([f, c]) => [f, c]),
      [],
      ["POR PERÍODO"],
      ...Object.entries(byPeriodo).map(([p, c]) => [p, c]),
      [],
      ["NOVAS INSERÇÕES NO MÊS", novasInsercoes.length],
      ...novasInsercoes.map((p: any) => [p.nome_completo, p.created_at?.slice(0, 10)]),
    ];
    const wsResumo = XLSX.utils.aoa_to_sheet(resumoData);
    wsResumo["!cols"] = [{ wch: 40 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(wb, wsResumo, "Resumo");

    // --- Sheet 2: Atividades Planejadas x Relatadas ---
    const atividadesData = [
      ["ATIVIDADES PLANEJADAS x RELATADAS"],
      [],
      ["Planejamentos", "Título", "Tema", "Data"],
      ...planejamentos.map((p: any) => ["Planejamento", p.titulo, p.tema || "", p.data_aplicacao || ""]),
      [],
      ["Relatórios", "Atividade", "Tipo", "Data"],
      ...relatorios.map((r: any) => ["Relatório", r.nome_atividade || "", r.tipo_atividade || "", r.data]),
    ];
    const wsAtiv = XLSX.utils.aoa_to_sheet(atividadesData);
    wsAtiv["!cols"] = [{ wch: 15 }, { wch: 35 }, { wch: 20 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, wsAtiv, "Atividades");

    // --- Sheets 3+: Matrizes de frequência por turma ---
    const turmasAtivas = turmas.filter((t: any) => t.ativa);
    for (const turma of turmasAtivas) {
      const t = turma as any;
      const tpIds = turmaParticipantes.filter((tp: any) => tp.turma_id === t.id).map((tp: any) => tp.participante_id);
      const tParts = tpIds.map((id: string) => partMap.get(id)).filter(Boolean) as any[];
      const tPresencas = presencas.filter((p: any) => p.turma_id === t.id);

      // Get unique dates
      const datas = [...new Set(tPresencas.map((p: any) => p.data))].sort();
      if (!datas.length && !tParts.length) continue;

      const bairroNome = bairroMap.get(t.bairro_id) || "N/I";
      const sheetName = (t.nome || "Turma").slice(0, 28);

      const header1 = [`SCFV — CAIA Medianeira — Matriz de Frequência`];
      const header2 = [`Turma: ${t.nome} | Bairro: ${bairroNome} | Faixa: ${t.faixa_etaria || "N/I"} | Período: ${t.periodo || "N/I"}`];
      const header3 = [`Mês: ${MESES_NOMES[mesNum - 1]} / ${ano} | Exportado em: ${new Date().toLocaleString("pt-BR")}`];

      const colHeaders = ["Nº", "Nome do Participante", ...datas.map(d => d.slice(5))];
      const rows = tParts.map((p: any, idx: number) => {
        const row = [idx + 1, p.nome_completo];
        datas.forEach(d => {
          const rec = tPresencas.find((pr: any) => pr.participante_id === p.id && pr.data === d);
          row.push(rec ? (rec.presente ? "✓" : "F") : "");
        });
        return row;
      });

      const sheetData = [header1, header2, header3, [], colHeaders, ...rows, [], [`Assinatura do Educador: _______________________`]];
      const ws = XLSX.utils.aoa_to_sheet(sheetData);
      ws["!cols"] = [{ wch: 5 }, { wch: 30 }, ...datas.map(() => ({ wch: 6 }))];
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    }

    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    saveAs(new Blob([buf], { type: "application/octet-stream" }),
      `SysELO_Relatorio_Mensal_${ano}-${mes}_${new Date().toISOString().slice(0, 10)}.xlsx`);

    toast.success("Relatório mensal gerado com sucesso!");
    setGenerating(false);
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-foreground">Relatório Mensal</h2>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4" /> Gerar Relatório Mensal Completo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Inclui: atendidos por bairro/faixa/período, novas inserções, atividades planejadas × relatadas,
            e matrizes de frequência por turma com cabeçalho institucional.
          </p>
          <div className="flex gap-3 items-end">
            <div>
              <Label className="text-xs">Mês</Label>
              <Select value={mes} onValueChange={setMes}>
                <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                <SelectContent>{MESES.map((m, i) => <SelectItem key={m} value={m}>{MESES_NOMES[i]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Ano</Label>
              <Input className="w-[100px]" value={ano} onChange={e => setAno(e.target.value)} />
            </div>
            <Button onClick={generate} disabled={generating}>
              <Download className="h-4 w-4 mr-1" /> {generating ? "Gerando..." : "Gerar XLSX"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
