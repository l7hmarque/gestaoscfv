import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/fetchAllRows";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileSpreadsheet, Download } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { BAIRROS_SCFV, calcFaixaFromDate } from "@/lib/constants";

const MESES = ["01","02","03","04","05","06","07","08","09","10","11","12"];
const MESES_NOMES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

const DIAS_MAP: Record<string, number> = {
  dom: 0, seg: 1, ter: 2, qua: 3, qui: 4, sex: 5, sab: 6
};

function getDatasAtividade(ano: number, mes: number, diasSemana: string[]): string[] {
  const diasNum = diasSemana.map(d => DIAS_MAP[d.toLowerCase()]).filter(n => n !== undefined);
  if (!diasNum.length) return [];
  const datas: string[] = [];
  const d = new Date(ano, mes - 1, 1);
  while (d.getMonth() === mes - 1) {
    if (diasNum.includes(d.getDay())) {
      datas.push(d.toISOString().slice(0, 10));
    }
    d.setDate(d.getDate() + 1);
  }
  return datas;
}

function calcAge(dob: string): number {
  const b = new Date(dob); const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  if (now.getMonth() < b.getMonth() || (now.getMonth() === b.getMonth() && now.getDate() < b.getDate())) age--;
  return age;
}

/** Apply thin borders to all cells in a sheet */
function applyBorders(ws: XLSX.WorkSheet) {
  const range = XLSX.utils.decode_range(ws["!ref"] || "A1");
  const border = { style: "thin", color: { rgb: "000000" } };
  for (let r = range.s.r; r <= range.e.r; r++) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      if (!ws[addr]) ws[addr] = { v: "", t: "s" };
      ws[addr].s = {
        ...(ws[addr].s || {}),
        border: { top: border, bottom: border, left: border, right: border },
      };
    }
  }
}

/** Apply bold + grey background to a row */
function applyHeaderStyle(ws: XLSX.WorkSheet, row: number, colCount: number) {
  const border = { style: "thin", color: { rgb: "000000" } };
  for (let c = 0; c < colCount; c++) {
    const addr = XLSX.utils.encode_cell({ r: row, c });
    if (!ws[addr]) ws[addr] = { v: "", t: "s" };
    ws[addr].s = {
      font: { bold: true },
      fill: { fgColor: { rgb: "D9D9D9" } },
      border: { top: border, bottom: border, left: border, right: border },
      alignment: { wrapText: true, vertical: "center" },
    };
  }
}

// Metas fixas por bairro
const METAS_BAIRRO: Record<string, { criancasManha: number; criancasTarde: number; idosos: number | null }> = {
  "JARDIM IRENE": { criancasManha: 100, criancasTarde: 100, idosos: 30 },
  "PARQUE INDEPENDENCIA": { criancasManha: 60, criancasTarde: 60, idosos: 30 },
  "ALVORADA": { criancasManha: 60, criancasTarde: 60, idosos: null },
};

export default function DashboardRelatorioMensalTab() {
  const now = new Date();
  const [ano, setAno] = useState(String(now.getFullYear()));
  const [mes, setMes] = useState(String(now.getMonth() + 1).padStart(2, "0"));
  const [generating, setGenerating] = useState(false);

  const generate = async () => {
    setGenerating(true);
    try {
      const mesNum = parseInt(mes);
      const startDate = `${ano}-${mes}-01`;
      const endDate = mesNum === 12 ? `${parseInt(ano)+1}-01-01` : `${ano}-${String(mesNum+1).padStart(2,"0")}-01`;

      const [presencas_raw, participantes, turmas, bairros, relatorios, planejamentos, turmaParticipantes, relatorioTurmas] = await Promise.all([
        fetchAllRows("presenca", { select: "*" }),
        fetchAllRows("participantes", { select: "*" }),
        fetchAllRows("turmas", { select: "*" }),
        fetchAllRows("bairros", { select: "*" }),
        fetchAllRows("relatorios_atividade", { select: "*" }),
        fetchAllRows("planejamentos", { select: "*" }),
        fetchAllRows("turma_participantes", { select: "*" }),
        fetchAllRows("relatorio_turmas", { select: "*" }),
      ]);

      const presencas = (presencas_raw || []).filter((p: any) => p.data >= startDate && p.data < endDate);
      const filteredRelatorios = (relatorios || []).filter((r: any) => r.data >= startDate && r.data < endDate);
      const filteredPlanejamentos = (planejamentos || []).filter((p: any) => p.data_aplicacao && p.data_aplicacao >= startDate && p.data_aplicacao < endDate);

      const partMap = new Map((participantes || []).map((p: any) => [p.id, p]));
      const bairroMap = new Map((bairros || []).map((b: any) => [b.id, b.nome]));
      const bairroIdByName = new Map((bairros || []).map((b: any) => [b.nome, b.id]));

      const wb = XLSX.utils.book_new();

      // --- Sheet 1: Resumo ---
      const atendidosIds = new Set(presencas.filter((p: any) => p.presente).map((p: any) => p.participante_id));
      const atendidos = [...atendidosIds].map(id => partMap.get(id)).filter(Boolean);

      // Use bairro_id (CAIA) instead of endereco_bairro for correct distribution
      const byBairro: Record<string, number> = {};
      atendidos.forEach((p: any) => { const b = p.bairro_id ? (bairroMap.get(p.bairro_id) || "N/I") : "N/I"; byBairro[b] = (byBairro[b] || 0) + 1; });

      const byFaixa: Record<string, number> = {};
      atendidos.forEach((p: any) => {
        if (p.data_nascimento) {
          const f = calcFaixaFromDate(p.data_nascimento);
          if (f) byFaixa[f] = (byFaixa[f] || 0) + 1;
        }
      });

      const byPeriodo: Record<string, number> = {};
      atendidos.forEach((p: any) => { const per = p.periodo || "N/I"; byPeriodo[per] = (byPeriodo[per] || 0) + 1; });

      const novasInsercoes = participantes.filter((p: any) => {
        if (!p.iniciou_em) return false;
        return p.iniciou_em >= startDate && p.iniciou_em < endDate;
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
        ["NOVAS INSERÇÕES NO MÊS (por data de início)", novasInsercoes.length],
        ...novasInsercoes.map((p: any) => [p.nome_completo, p.iniciou_em]),
      ];
      const wsResumo = XLSX.utils.aoa_to_sheet(resumoData);
      wsResumo["!cols"] = [{ wch: 40 }, { wch: 15 }];
      XLSX.utils.book_append_sheet(wb, wsResumo, "Resumo");

      // --- Sheet 2: Atividades Propostas x Desenvolvidas (4 colunas) ---
      const relByPlan = new Map<string, any>();
      filteredRelatorios.forEach((r: any) => { if (r.planejamento_id) relByPlan.set(r.planejamento_id, r); });

      const atividadesRows: any[][] = [];
      filteredPlanejamentos.forEach((p: any) => {
        const rel = relByPlan.get(p.id);
        atividadesRows.push([
          p.titulo + (p.tema ? ` — ${p.tema}` : ""),
          rel ? (rel.nome_atividade || "") : "",
          rel ? (rel.analise_ia || "") : "",
          rel ? "" : "Atividade não realizada no período",
        ]);
        if (rel) relByPlan.delete(p.id);
      });
      filteredRelatorios.filter((r: any) => !r.planejamento_id).forEach((r: any) => {
        atividadesRows.push(["", r.nome_atividade || "", r.analise_ia || "", ""]);
      });

      const atividadesData = [
        ["ATIVIDADES PROPOSTAS x DESENVOLVIDAS"],
        [`Mês: ${MESES_NOMES[mesNum - 1]} / ${ano}`],
        [],
        ["Atividades Propostas", "Atividades Desenvolvidas", "Resultados Alcançados", "Justificativas"],
        ...atividadesRows,
      ];
      const wsAtiv = XLSX.utils.aoa_to_sheet(atividadesData);
      wsAtiv["!cols"] = [{ wch: 35 }, { wch: 35 }, { wch: 40 }, { wch: 30 }];
      XLSX.utils.book_append_sheet(wb, wsAtiv, "Atividades");

      // --- Sheet 3: Metas Propostas ---
      // Build turma-to-bairroName map
      const turmaMap = new Map(turmas.map((t: any) => [t.id, t]));

      // For each bairro SCFV, calculate attendance by period
      const bairroStats: Record<string, { criancasManha: Set<string>; criancasTarde: Set<string>; idosos: Set<string>; resultados: string[] }> = {};
      BAIRROS_SCFV.forEach(bn => {
        bairroStats[bn] = { criancasManha: new Set(), criancasTarde: new Set(), idosos: new Set(), resultados: [] };
      });

      // Map relatorios to bairros via relatorio_turmas
      const relIdToAnalise = new Map(relatorios.map((r: any) => [r.id, r.analise_ia || ""]));
      const bairroRelResultados: Record<string, Set<string>> = {};
      BAIRROS_SCFV.forEach(bn => { bairroRelResultados[bn] = new Set(); });

      relatorioTurmas.forEach((rt: any) => {
        const turma = turmaMap.get(rt.turma_id);
        if (!turma) return;
        const bairroNome = bairroMap.get(turma.bairro_id) || "";
        if (BAIRROS_SCFV.includes(bairroNome)) {
          const analise = relIdToAnalise.get(rt.relatorio_id);
          if (analise) bairroRelResultados[bairroNome].add(analise);
        }
      });

      // Count attendance per bairro+period
      presencas.filter((p: any) => p.presente).forEach((pres: any) => {
        const turma = turmaMap.get(pres.turma_id);
        if (!turma) return;
        const bairroNome = bairroMap.get(turma.bairro_id) || "";
        if (!BAIRROS_SCFV.includes(bairroNome)) return;
        const part = partMap.get(pres.participante_id);
        if (!part) return;
        const age = part.data_nascimento ? calcAge(part.data_nascimento) : 0;
        const isIdoso = age >= 60;
        const periodo = turma.periodo || "manha";

        if (isIdoso) {
          bairroStats[bairroNome].idosos.add(pres.participante_id);
        } else if (periodo === "manha" || periodo === "integral") {
          bairroStats[bairroNome].criancasManha.add(pres.participante_id);
        }
        if (!isIdoso && (periodo === "tarde" || periodo === "integral")) {
          bairroStats[bairroNome].criancasTarde.add(pres.participante_id);
        }
      });

      // Build Metas sheet rows
      const metasRows: any[][] = [];
      let totalCriancas = 0, totalMeta = 0, totalIdosos = 0, totalMetaIdosos = 0;

      BAIRROS_SCFV.forEach(bn => {
        const meta = METAS_BAIRRO[bn];
        if (!meta) return;
        const stats = bairroStats[bn];
        const cm = stats.criancasManha.size;
        const ct = stats.criancasTarde.size;
        const totalBairro = cm + ct;
        const metaBairro = meta.criancasManha + meta.criancasTarde;
        const pct = metaBairro > 0 ? Math.round((totalBairro / metaBairro) * 100) : 0;
        const resultados = [...bairroRelResultados[bn]].filter(Boolean).join("; ").slice(0, 500);

        metasRows.push([bn, "", "", ""]);
        metasRows.push([`  Crianças/adolescentes — Manhã (meta: ${meta.criancasManha})`, `${cm} atendidos`, resultados, ""]);
        metasRows.push([`  Crianças/adolescentes — Tarde (meta: ${meta.criancasTarde})`, `${ct} atendidos`, "", ""]);
        metasRows.push([`  Total crianças: ${pct}% da meta (${totalBairro}/${metaBairro})`, `${pct}% de atendidos em relação à meta`, "", ""]);

        if (meta.idosos !== null) {
          const idCount = stats.idosos.size;
          const pctId = meta.idosos > 0 ? Math.round((idCount / meta.idosos) * 100) : 0;
          metasRows.push([`  Idosos (meta: ${meta.idosos})`, `${idCount} atendidos — ${pctId}% da meta`, "", ""]);
          totalIdosos += idCount;
          totalMetaIdosos += meta.idosos;
        }

        metasRows.push([]);
        totalCriancas += totalBairro;
        totalMeta += metaBairro;
      });

      const pctGeral = totalMeta > 0 ? Math.round((totalCriancas / totalMeta) * 100) : 0;
      const pctIdosos = totalMetaIdosos > 0 ? Math.round((totalIdosos / totalMetaIdosos) * 100) : 0;
      metasRows.push(["TOTAL GERAL", "", "", ""]);
      metasRows.push([`  Crianças/adolescentes: ${totalCriancas} (${pctGeral}% da meta de ${totalMeta})`, `${totalCriancas}`, "", ""]);
      metasRows.push([`  Idosos: ${totalIdosos} (${pctIdosos}% da meta de ${totalMetaIdosos})`, `${totalIdosos}`, "", ""]);

      const metasData = [
        ["METAS PROPOSTAS — ACOMPANHAMENTO MENSAL"],
        [`Mês: ${MESES_NOMES[mesNum - 1]} / ${ano}`],
        [],
        ["Metas Propostas", "Quant.", "Resultados Alcançados", "Justificativa"],
        ...metasRows,
      ];
      const wsMetas = XLSX.utils.aoa_to_sheet(metasData);
      wsMetas["!cols"] = [{ wch: 55 }, { wch: 35 }, { wch: 50 }, { wch: 25 }];
      applyHeaderStyle(wsMetas, 3, 4);
      applyBorders(wsMetas);
      XLSX.utils.book_append_sheet(wb, wsMetas, "Metas");

      // --- Sheet 4: Monitoramento e Avaliação ---
      // Calculate metrics
      const totalPresencasRegistros = presencas.length;
      const totalPresentes = presencas.filter((p: any) => p.presente).length;
      const pctPresencaGeral = totalPresencasRegistros > 0 ? Math.round((totalPresentes / totalPresencasRegistros) * 100) : 0;

      // % de participantes ativos com frequência >= 75%
      const partFreq: Record<string, { total: number; presentes: number }> = {};
      presencas.forEach((p: any) => {
        if (!partFreq[p.participante_id]) partFreq[p.participante_id] = { total: 0, presentes: 0 };
        partFreq[p.participante_id].total++;
        if (p.presente) partFreq[p.participante_id].presentes++;
      });
      const partComFreq = Object.values(partFreq);
      const partBomFreq = partComFreq.filter(pf => pf.total > 0 && (pf.presentes / pf.total) >= 0.75).length;
      const pctBomFreq = partComFreq.length > 0 ? Math.round((partBomFreq / partComFreq.length) * 100) : 0;

      const monitorRows: any[][] = [
        [
          "Assegurar espaços de referência para o convívio grupal, comunitário e social e o desenvolvimento de relações de afetividade, solidariedade e respeito mútuo",
          "Participação nas atividades sócio educacionais",
          "100%",
          `${pctPresencaGeral}%`,
        ],
        [
          "Possibilitar o reconhecimento do trabalho e a ampliação do universo informacional, artístico e cultural, bem como o desenvolvimento de potencialidades, habilidades, talentos e propiciar sua formação cidadã",
          "Participação nas atividades culturais, esportivas e sócio educacionais",
          "100%",
          `${pctPresencaGeral}%`,
        ],
        [
          "Contribuir para a inserção, reinserção e permanência no sistema educacional",
          "Matrícula, rendimento e frequência escolar",
          "100%",
          `${pctBomFreq}%`,
        ],
        [
          "Promover o acesso aos benefícios e serviços socioassistenciais, fortalecendo a função protetiva das famílias",
          "Quantidade de beneficiários encaminhados para a proteção social básica",
          "100%",
          "100%",
        ],
      ];

      const monitorData = [
        ["MONITORAMENTO E AVALIAÇÃO"],
        [`Mês: ${MESES_NOMES[mesNum - 1]} / ${ano}`],
        [],
        ["Objetivo", "Indicador", "Meta Prevista", "Meta Atingida"],
        ...monitorRows,
      ];
      const wsMonitor = XLSX.utils.aoa_to_sheet(monitorData);
      wsMonitor["!cols"] = [{ wch: 60 }, { wch: 45 }, { wch: 15 }, { wch: 15 }];
      applyHeaderStyle(wsMonitor, 3, 4);
      applyBorders(wsMonitor);
      XLSX.utils.book_append_sheet(wb, wsMonitor, "Monitoramento");

      // --- Sheets 5+: Matrizes de frequência por turma ---
      const turmasAtivas = turmas.filter((t: any) => t.ativa);
      const usedSheetNames = new Set<string>(["Resumo", "Atividades", "Metas", "Monitoramento"]);
      for (const turma of turmasAtivas) {
        const t = turma as any;
        const tpIds = turmaParticipantes.filter((tp: any) => tp.turma_id === t.id).map((tp: any) => tp.participante_id);
        const tParts = tpIds.map((id: string) => partMap.get(id)).filter(Boolean) as any[];
        const tPresencas = presencas.filter((p: any) => p.turma_id === t.id);

        const diasSemana = t.dias_semana || [];
        const datasAtividade = getDatasAtividade(parseInt(ano), mesNum, diasSemana);
        const datas = datasAtividade.length > 0
          ? datasAtividade
          : [...new Set(tPresencas.map((p: any) => p.data))].sort();
        if (!datas.length && !tParts.length) continue;

        const bairroNome = bairroMap.get(t.bairro_id) || "N/I";
        let sheetName = (t.nome || "Turma").slice(0, 28).replace(/[\\\/\*\?\[\]:]/g, "_");
        let suffix = 2;
        while (usedSheetNames.has(sheetName)) { sheetName = sheetName.slice(0, 25) + `_${suffix++}`; }
        usedSheetNames.add(sheetName);

        const header1 = [`SCFV — CAIA Medianeira — Matriz de Frequência`];
        const header2 = [`Turma: ${t.nome} | Bairro: ${bairroNome} | Faixa: ${t.faixa_etaria || "N/I"} | Período: ${t.periodo || "N/I"}`];
        const header3 = [`Mês: ${MESES_NOMES[mesNum - 1]} / ${ano} | Exportado em: ${new Date().toLocaleString("pt-BR")}`];

        const colHeaders = ["Nº", "Nome do Participante", ...datas.map(d => d.slice(5))];
        const rows = tParts.map((p: any, idx: number) => {
          const row: any[] = [idx + 1, p.nome_completo];
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
    } catch (err: any) {
      console.error("Erro ao gerar relatório mensal:", err);
      toast.error("Erro ao gerar relatório: " + (err?.message || "Erro desconhecido"));
    } finally {
      setGenerating(false);
    }
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
            metas por bairro, monitoramento SCFV e matrizes de frequência por turma.
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
