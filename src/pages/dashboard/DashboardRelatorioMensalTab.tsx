import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/fetchAllRows";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileSpreadsheet, Download, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx-js-style";
import { saveAs } from "file-saver";
import { BAIRROS_SCFV, calcFaixaFromDate, calcAge } from "@/lib/constants";
import { sysEloFileName } from "@/lib/fileNaming";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
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

// calcAge imported from constants

import { addInstitutionalHeader, applyInstitutionalStyle, applyTableHeaderStyle, applyAllBorders } from "@/lib/xlsxInstHeader";


// Metas fixas por bairro
const METAS_BAIRRO: Record<string, { criancasManha: number; criancasTarde: number; idosos: number | null }> = {
  "JARDIM IRENE": { criancasManha: 100, criancasTarde: 100, idosos: 30 },
  "PARQUE INDEPENDENCIA": { criancasManha: 60, criancasTarde: 60, idosos: 30 },
  "ALVORADA": { criancasManha: 60, criancasTarde: 60, idosos: null },
};

const TIPO_ATENDIMENTO_LABELS: Record<string, string> = {
  atendimento_individual: "Atendimento Individual",
  visita_domiciliar: "Visita Domiciliar",
  encaminhamento: "Encaminhamento",
  busca_ativa: "Busca Ativa",
  acolhida: "Acolhida",
  desligamento: "Desligamento",
};

export default function DashboardRelatorioMensalTab() {
  const now = new Date();
  const [ano, setAno] = useState(String(now.getFullYear()));
  const [mes, setMes] = useState(String(now.getMonth() + 1).padStart(2, "0"));
  const [generating, setGenerating] = useState(false);
  const [generatingLocal, setGeneratingLocal] = useState(false);
  const [generatingReo, setGeneratingReo] = useState(false);
  const [generatingFull, setGeneratingFull] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  const downloadFromUrl = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Download falhou`);
      const blob = await response.blob();
      saveAs(blob, filename);
    } catch {
      window.open(url, "_blank");
    }
  };

  const generateReo = async () => {
    setGeneratingReo(true);
    try {
      const [docxRes, xlsxRes] = await Promise.all([
        supabase.functions.invoke("generate-reo", { body: { mes, ano, formato: "docx" } }),
        supabase.functions.invoke("generate-reo", { body: { mes, ano, formato: "xlsx" } }),
      ]);

      const downloads: Promise<void>[] = [];
      if (docxRes.data?.url) downloads.push(downloadFromUrl(docxRes.data.url, docxRes.data.fileName || `REO_${ano}-${mes}.docx`));
      if (xlsxRes.data?.url) downloads.push(downloadFromUrl(xlsxRes.data.url, xlsxRes.data.fileName || `REO_${ano}-${mes}.xlsx`));

      if (downloads.length > 0) {
        await Promise.all(downloads);
        toast.success(`REO gerado! (${downloads.length} arquivo(s))`);
      } else {
        throw new Error(docxRes.data?.error || xlsxRes.data?.error || "Erro desconhecido");
      }
    } catch (err: any) {
      toast.error("Erro ao gerar REO: " + (err.message || "Erro desconhecido"));
    } finally {
      setGeneratingReo(false);
    }
  };

  // Background generation via edge function (works on mobile)
  const generateBackground = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-relatorio-mensal", {
        body: { mes, ano },
      });
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, "_blank");
        toast.success("Relatório gerado! O download iniciará automaticamente.");
      } else {
        throw new Error("URL não retornada");
      }
    } catch (err: any) {
      console.error("Erro:", err);
      toast.error("Erro ao gerar relatório: " + (err?.message || "Erro desconhecido"));
    } finally {
      setGenerating(false);
    }
  };

  // Local generation (fallback for quick desktop use)
  const generateLocal = async () => {
    setGeneratingLocal(true);
    try {
      const mesNum = parseInt(mes);
      const startDate = `${ano}-${mes}-01`;
      const endDate = mesNum === 12 ? `${parseInt(ano)+1}-01-01` : `${ano}-${String(mesNum+1).padStart(2,"0")}-01`;

      const [presencas_raw, participantes, turmas, bairros, relatorios, planejamentos, turmaParticipantes, relatorioTurmas, atendimentos_raw, profilesData, relatorioPresencas] = await Promise.all([
        fetchAllRows("presenca", { select: "*" }),
        fetchAllRows("participantes", { select: "*" }),
        fetchAllRows("turmas", { select: "*" }),
        fetchAllRows("bairros", { select: "*" }),
        fetchAllRows("relatorios_atividade", { select: "*" }),
        fetchAllRows("planejamentos", { select: "*" }),
        fetchAllRows("turma_participantes", { select: "*" }),
        fetchAllRows("relatorio_turmas", { select: "*" }),
        fetchAllRows("atendimentos", { select: "*" }),
        fetchAllRows("profiles", { select: "*" }),
        fetchAllRows("relatorio_presenca", { select: "*" }),
      ]);

      const presencas = (presencas_raw || []).filter((p: any) => p.data >= startDate && p.data < endDate);
      const filteredRelatorios = (relatorios || []).filter((r: any) => r.data >= startDate && r.data < endDate);
      const filteredPlanejamentos = (planejamentos || []).filter((p: any) => p.data_aplicacao && p.data_aplicacao >= startDate && p.data_aplicacao < endDate);
      const filteredAtendimentos = (atendimentos_raw || []).filter((a: any) => a.data_atendimento >= startDate && a.data_atendimento < endDate);

      // Enrich presencas with relatorio_presenca fallback
      const presencaKeys = new Set(presencas.map((p: any) => `${p.participante_id}_${p.data}_${p.turma_id}`));
      filteredRelatorios.forEach((r: any) => {
        const rTurmas = (relatorioTurmas || []).filter((rt: any) => rt.relatorio_id === r.id);
        const rPres = (relatorioPresencas || []).filter((rp: any) => rp.relatorio_id === r.id);
        rTurmas.forEach((rt: any) => {
          rPres.forEach((rp: any) => {
            const key = `${rp.participante_id}_${r.data}_${rt.turma_id}`;
            if (!presencaKeys.has(key)) {
              presencas.push({ participante_id: rp.participante_id, data: r.data, turma_id: rt.turma_id, presente: rp.presente, id: rp.id });
              presencaKeys.add(key);
            }
          });
        });
      });

      const partMap = new Map((participantes || []).map((p: any) => [p.id, p]));
      const bairroMap = new Map((bairros || []).map((b: any) => [b.id, b.nome]));
      const profileMap = new Map((profilesData || []).map((p: any) => [p.id, p]));

      // Filter out presencas from desligados after their data_desligamento
      const activePresencas = presencas.filter((p: any) => {
        const part = partMap.get(p.participante_id);
        if (!part) return true;
        if (part.status === "desligado" && part.data_desligamento && p.data > part.data_desligamento) return false;
        return true;
      });

      const wb = XLSX.utils.book_new();

      // --- Sheet 1: Resumo ---
      const atendidosIds = new Set(activePresencas.filter((p: any) => p.presente).map((p: any) => p.participante_id));
      const atendidos = [...atendidosIds].map(id => partMap.get(id)).filter(Boolean);
      // Exclude participants desligados before start of month
      const atendidosFiltered = atendidos.filter((p: any) => {
        if (p.status === "desligado" && p.data_desligamento && p.data_desligamento < startDate) return false;
        return true;
      });

      const byBairro: Record<string, number> = {};
      atendidosFiltered.forEach((p: any) => { const b = p.bairro_id ? (bairroMap.get(p.bairro_id) || "N/I") : "N/I"; byBairro[b] = (byBairro[b] || 0) + 1; });

      const byFaixa: Record<string, number> = {};
      atendidosFiltered.forEach((p: any) => {
        if (p.data_nascimento) {
          const f = calcFaixaFromDate(p.data_nascimento);
          if (f) byFaixa[f] = (byFaixa[f] || 0) + 1;
        }
      });

      const byPeriodo: Record<string, number> = {};
      atendidosFiltered.forEach((p: any) => { const per = p.periodo || "N/I"; byPeriodo[per] = (byPeriodo[per] || 0) + 1; });

      const novasInsercoes = participantes.filter((p: any) => {
        if (!p.iniciou_em) return false;
        return p.iniciou_em >= startDate && p.iniciou_em < endDate;
      });

      const atendByTipo: Record<string, number> = {};
      filteredAtendimentos.forEach((a: any) => {
        const t = a.tipo || "atendimento_individual";
        atendByTipo[t] = (atendByTipo[t] || 0) + 1;
      });

      const resumoData = [
        ["RELATÓRIO MENSAL — SysELO SCFV"],
        [`Mês: ${MESES_NOMES[mesNum - 1]} / ${ano}`],
        [`Data de geração: ${new Date().toLocaleString("pt-BR")}`],
        [],
        ["ATENDIDOS NO MÊS", atendidosFiltered.length],
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
        [],
        ["ATENDIMENTOS TÉCNICOS NO MÊS", filteredAtendimentos.length],
        ...Object.entries(atendByTipo).map(([t, c]) => [TIPO_ATENDIMENTO_LABELS[t] || t, c]),
      ];
      const wsResumo = XLSX.utils.aoa_to_sheet(resumoData);
      wsResumo["!cols"] = [{ wch: 40 }, { wch: 15 }];
      XLSX.utils.book_append_sheet(wb, wsResumo, "Resumo");

      // --- Sheet 2: Atividades (driven by relatórios) ---
      const planMap = new Map((planejamentos || []).map((p: any) => [p.id, p]));
      const atividadesRows: any[][] = [];
      filteredRelatorios.forEach((r: any) => {
        const plan = r.planejamento_id ? planMap.get(r.planejamento_id) : null;
        const proposta = plan ? (plan.titulo + (plan.tema ? ` — ${plan.tema}` : "")) : "Não planejada";
        atividadesRows.push([proposta, r.nome_atividade || "", r.analise_ia || "", ""]);
      });
      if (atividadesRows.length === 0) {
        atividadesRows.push(["Nenhuma atividade registrada no período", "", "", ""]);
      }

      const atividadesData = [
        ["ATIVIDADES PROPOSTAS x DESENVOLVIDAS"],
        [`Mês: ${MESES_NOMES[mesNum - 1]} / ${ano}`],
        [],
        ["Atividades Propostas", "Atividades Desenvolvidas", "Resultados Alcançados", "Justificativas"],
        ...atividadesRows,
      ];
      const wsAtiv = XLSX.utils.aoa_to_sheet(atividadesData);
      wsAtiv["!cols"] = [{ wch: 35 }, { wch: 35 }, { wch: 40 }, { wch: 30 }];
      applyTableHeaderStyle(wsAtiv, 3, 4);
      applyAllBorders(wsAtiv);
      XLSX.utils.book_append_sheet(wb, wsAtiv, "Atividades");

      // --- Sheet 3: Metas ---
      const turmaMap = new Map(turmas.map((t: any) => [t.id, t]));

      const bairroStats: Record<string, { criancasManha: Set<string>; criancasTarde: Set<string>; idosos: Set<string> }> = {};
      BAIRROS_SCFV.forEach(bn => {
        bairroStats[bn] = { criancasManha: new Set(), criancasTarde: new Set(), idosos: new Set() };
      });

      const relIdToAnalise = new Map(filteredRelatorios.map((r: any) => [r.id, r.analise_ia || ""]));
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

      // Use activePresencas for metas
      activePresencas.filter((p: any) => p.presente).forEach((pres: any) => {
        const turma = turmaMap.get(pres.turma_id);
        if (!turma) return;
        const bairroNome = bairroMap.get(turma.bairro_id) || "";
        if (!BAIRROS_SCFV.includes(bairroNome)) return;
        const part = partMap.get(pres.participante_id);
        if (!part) return;
        if (part.status === "desligado" && part.data_desligamento && part.data_desligamento < startDate) return;
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
      applyTableHeaderStyle(wsMetas, 3, 4);
      applyAllBorders(wsMetas);
      XLSX.utils.book_append_sheet(wb, wsMetas, "Metas");

      // --- Sheet 4: Monitoramento ---
      // Use activePresencas for monitoramento
      const totalPresencasRegistros = activePresencas.length;
      const totalPresentes = activePresencas.filter((p: any) => p.presente).length;
      const pctPresencaGeral = totalPresencasRegistros > 0 ? Math.round((totalPresentes / totalPresencasRegistros) * 100) : 0;

      const partFreq: Record<string, { total: number; presentes: number }> = {};
      activePresencas.forEach((p: any) => {
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
      applyTableHeaderStyle(wsMonitor, 3, 4);
      applyAllBorders(wsMonitor);
      XLSX.utils.book_append_sheet(wb, wsMonitor, "Monitoramento");

      // --- Sheet 5: Atendimentos Técnicos ---
      if (filteredAtendimentos.length > 0) {
        const atendRows = filteredAtendimentos.map((a: any) => {
          const part = partMap.get(a.participante_id);
          const prof = profileMap.get(a.profissional_id);
          return [
            a.data_atendimento,
            TIPO_ATENDIMENTO_LABELS[a.tipo] || a.tipo,
            part?.nome_completo || "—",
            prof?.nome || "—",
            (a.descricao || "").slice(0, 200),
            a.encaminhamento || "",
          ];
        });

        const atendData = [
          ["ATENDIMENTOS TÉCNICOS"],
          [`Mês: ${MESES_NOMES[mesNum - 1]} / ${ano}`],
          [],
          ["Data", "Tipo", "Participante", "Profissional", "Descrição", "Encaminhamento"],
          ...atendRows,
        ];
        const wsAtend = XLSX.utils.aoa_to_sheet(atendData);
        wsAtend["!cols"] = [{ wch: 12 }, { wch: 22 }, { wch: 30 }, { wch: 20 }, { wch: 50 }, { wch: 30 }];
        applyTableHeaderStyle(wsAtend, 3, 6);
        applyAllBorders(wsAtend);
        XLSX.utils.book_append_sheet(wb, wsAtend, "Atendimentos");
      }

      // --- Sheets: Matrizes de frequência por turma (black fill for presence) ---
      const turmasAtivas = turmas.filter((t: any) => t.ativa);
      const usedSheetNames = new Set<string>(["Resumo", "Atividades", "Metas", "Monitoramento", "Atendimentos"]);
      const border = { style: "thin", color: { rgb: "000000" } };
      const borderObj = { top: border, bottom: border, left: border, right: border };

      for (const turma of turmasAtivas) {
        const t = turma as any;
        const tpIds = turmaParticipantes.filter((tp: any) => tp.turma_id === t.id).map((tp: any) => tp.participante_id);
        const tParts = tpIds.map((id: string) => partMap.get(id)).filter(Boolean) as any[];
        const tPresencas = presencas.filter((p: any) => p.turma_id === t.id);

        // Build relatorio_presenca fallback
        const relIdsForTurma = relatorioTurmas.filter((rt: any) => rt.turma_id === t.id).map((rt: any) => rt.relatorio_id);
        const relsForTurma = filteredRelatorios.filter((r: any) => relIdsForTurma.includes(r.id));
        const relPresFallback: { participante_id: string; data: string; presente: boolean }[] = [];
        relsForTurma.forEach((r: any) => {
          const rps = (relatorioPresencas || []).filter((rp: any) => rp.relatorio_id === r.id);
          rps.forEach((rp: any) => {
            relPresFallback.push({ participante_id: rp.participante_id, data: r.data, presente: rp.presente });
          });
        });

        const diasSemana = t.dias_semana || [];
        const datasAtividade = getDatasAtividade(parseInt(ano), mesNum, diasSemana);
        const fallbackDates = [...new Set(relPresFallback.map(f => f.data))];
        const allDatesSet = new Set([...datasAtividade, ...tPresencas.map((p: any) => p.data), ...fallbackDates]);
        const datas = [...allDatesSet].sort();
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
          const isDesligado = p.status === "desligado";
          const dataDeslig = p.data_desligamento || null;
          const nameSuffix = isDesligado && dataDeslig ? ` (D ${dataDeslig.slice(8,10)}/${dataDeslig.slice(5,7)})` : "";
          const row: any[] = [idx + 1, p.nome_completo + nameSuffix];
          datas.forEach(() => row.push(""));
          return row;
        });

        const sheetData = [header1, header2, header3, [], colHeaders, ...rows, [], [`Assinatura do Educador: _______________________`]];
        const ws = XLSX.utils.aoa_to_sheet(sheetData);
        ws["!cols"] = [{ wch: 5 }, { wch: 30 }, ...datas.map(() => ({ wch: 6 }))];

        applyTableHeaderStyle(ws, 4, colHeaders.length);

        const dataStartRow = 5;
        tParts.forEach((p: any, pIdx: number) => {
          const excelRow = dataStartRow + pIdx;
          const isDesligado = p.status === "desligado";
          const dataDeslig = p.data_desligamento || null;
          for (let c = 0; c < 2; c++) {
            const addr = XLSX.utils.encode_cell({ r: excelRow, c });
            if (!ws[addr]) ws[addr] = { v: "", t: "s" };
            ws[addr].s = { ...(ws[addr].s || {}), border: borderObj };
          }
          datas.forEach((d, dIdx) => {
            const col = 2 + dIdx;
            const addr = XLSX.utils.encode_cell({ r: excelRow, c: col });
            if (!ws[addr]) ws[addr] = { v: "", t: "s" };
            if (isDesligado && dataDeslig && d > dataDeslig) {
              ws[addr].v = "D";
              ws[addr].s = { fill: { fgColor: { rgb: "CCCCCC" } }, font: { color: { rgb: "666666" } }, border: borderObj };
            } else {
              const rec = tPresencas.find((pr: any) => pr.participante_id === p.id && pr.data === d);
              const fallbackRec = !rec ? relPresFallback.find(f => f.participante_id === p.id && f.data === d) : null;
              if ((rec && rec.presente) || (fallbackRec && fallbackRec.presente)) {
                ws[addr].v = "■";
                ws[addr].s = { font: { sz: 14, color: { rgb: "000000" } }, alignment: { horizontal: "center", vertical: "center" }, border: borderObj };
              } else {
                ws[addr].s = { border: borderObj };
              }
            }
          });
        });

        XLSX.utils.book_append_sheet(wb, ws, sheetName);
      }

      const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      saveAs(new Blob([buf], { type: "application/octet-stream" }),
        sysEloFileName("RelatorioMensal", "xlsx", `${ano}-${mes}`));

      toast.success("Relatório mensal gerado com sucesso!");
    } catch (err: any) {
      console.error("Erro ao gerar relatório mensal:", err);
      toast.error("Erro ao gerar relatório: " + (err?.message || "Erro desconhecido"));
    } finally {
      setGeneratingLocal(false);
    }
  };

  const generateFullReport = async () => {
    setGeneratingFull(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-relatorio-mensal", {
        body: { completo: true },
      });
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, "_blank");
        toast.success("Relatório completo gerado com sucesso!");
      } else {
        throw new Error("URL não retornada");
      }
    } catch (err: any) {
      console.error("Erro:", err);
      toast.error("Erro ao gerar relatório completo: " + (err?.message || "Erro desconhecido"));
    } finally {
      setGeneratingFull(false);
    }
  };

  // Professional PDF generation
  const generatePdf = async () => {
    setGeneratingPdf(true);
    try {
      const mesNum = parseInt(mes);
      const startDate = `${ano}-${mes}-01`;
      const endDate = mesNum === 12 ? `${parseInt(ano)+1}-01-01` : `${ano}-${String(mesNum+1).padStart(2,"0")}-01`;

      const [presencas_raw, participantes, turmas, bairros, relatorios, turmaParticipantes, relatorioTurmas, atendimentos_raw, profilesData, relatorioPresencas] = await Promise.all([
        fetchAllRows("presenca", { select: "*" }),
        fetchAllRows("participantes", { select: "*" }),
        fetchAllRows("turmas", { select: "*" }),
        fetchAllRows("bairros", { select: "*" }),
        fetchAllRows("relatorios_atividade", { select: "*" }),
        fetchAllRows("turma_participantes", { select: "*" }),
        fetchAllRows("relatorio_turmas", { select: "*" }),
        fetchAllRows("atendimentos", { select: "*" }),
        fetchAllRows("profiles", { select: "*" }),
        fetchAllRows("relatorio_presenca", { select: "*" }),
      ]);

      const presencas = (presencas_raw || []).filter((p: any) => p.data >= startDate && p.data < endDate);
      const filteredRelatorios = (relatorios || []).filter((r: any) => r.data >= startDate && r.data < endDate);
      const filteredAtendimentos = (atendimentos_raw || []).filter((a: any) => a.data_atendimento >= startDate && a.data_atendimento < endDate);

      // Enrich presencas with relatorio_presenca
      const presencaKeys = new Set(presencas.map((p: any) => `${p.participante_id}_${p.data}_${p.turma_id}`));
      filteredRelatorios.forEach((r: any) => {
        const rTurmas = (relatorioTurmas || []).filter((rt: any) => rt.relatorio_id === r.id);
        const rPres = (relatorioPresencas || []).filter((rp: any) => rp.relatorio_id === r.id);
        rTurmas.forEach((rt: any) => {
          rPres.forEach((rp: any) => {
            const key = `${rp.participante_id}_${r.data}_${rt.turma_id}`;
            if (!presencaKeys.has(key)) {
              presencas.push({ participante_id: rp.participante_id, data: r.data, turma_id: rt.turma_id, presente: rp.presente, id: rp.id });
              presencaKeys.add(key);
            }
          });
        });
      });

      const partMap = new Map((participantes || []).map((p: any) => [p.id, p]));
      const bairroMap = new Map((bairros || []).map((b: any) => [b.id, b.nome]));
      const profileMap = new Map((profilesData || []).map((p: any) => [p.id, p]));

      const activePresencas = presencas.filter((p: any) => {
        const part = partMap.get(p.participante_id);
        if (!part) return true;
        if (part.status === "desligado" && part.data_desligamento && p.data > part.data_desligamento) return false;
        return true;
      });

      const atendidosIds = new Set(activePresencas.filter((p: any) => p.presente).map((p: any) => p.participante_id));
      const atendidos = [...atendidosIds].map(id => partMap.get(id)).filter(Boolean);
      const atendidosFiltered = atendidos.filter((p: any) => {
        if (p.status === "desligado" && p.data_desligamento && p.data_desligamento < startDate) return false;
        return true;
      });

      // Stats
      const byBairro: Record<string, number> = {};
      atendidosFiltered.forEach((p: any) => { const b = p.bairro_id ? (bairroMap.get(p.bairro_id) || "N/I") : "N/I"; byBairro[b] = (byBairro[b] || 0) + 1; });
      const byFaixa: Record<string, number> = {};
      atendidosFiltered.forEach((p: any) => { if (p.data_nascimento) { const f = calcFaixaFromDate(p.data_nascimento); if (f) byFaixa[f] = (byFaixa[f] || 0) + 1; } });

      const totalPresencasRegistros = activePresencas.length;
      const totalPresentes = activePresencas.filter((p: any) => p.presente).length;
      const pctPresencaGeral = totalPresencasRegistros > 0 ? Math.round((totalPresentes / totalPresencasRegistros) * 100) : 0;

      // Metas
      const turmaMap = new Map(turmas.map((t: any) => [t.id, t]));
      const bairroStats: Record<string, { criancasManha: Set<string>; criancasTarde: Set<string>; idosos: Set<string> }> = {};
      BAIRROS_SCFV.forEach(bn => { bairroStats[bn] = { criancasManha: new Set(), criancasTarde: new Set(), idosos: new Set() }; });
      activePresencas.filter((p: any) => p.presente).forEach((pres: any) => {
        const turma = turmaMap.get(pres.turma_id);
        if (!turma) return;
        const bairroNome = bairroMap.get(turma.bairro_id) || "";
        if (!BAIRROS_SCFV.includes(bairroNome)) return;
        const part = partMap.get(pres.participante_id);
        if (!part || (part.status === "desligado" && part.data_desligamento && part.data_desligamento < startDate)) return;
        const age = part.data_nascimento ? calcAge(part.data_nascimento) : 0;
        if (age >= 60) { bairroStats[bairroNome].idosos.add(pres.participante_id); }
        else {
          const periodo = turma.periodo || "manha";
          if (periodo === "manha" || periodo === "integral") bairroStats[bairroNome].criancasManha.add(pres.participante_id);
          if (periodo === "tarde" || periodo === "integral") bairroStats[bairroNome].criancasTarde.add(pres.participante_id);
        }
      });

      // Build PDF
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageW = doc.internal.pageSize.getWidth();
      const margin = 15;
      const contentW = pageW - margin * 2;

      // Colors — Grayscale palette for max legibility
      const CINZA_ESCURO = [50, 50, 50] as [number, number, number];
      const CINZA_MEDIO = [120, 120, 120] as [number, number, number];
      const CINZA_CLARO = [245, 245, 245] as [number, number, number];
      const BRANCO = [255, 255, 255] as [number, number, number];
      const PRETO = [0, 0, 0] as [number, number, number];

      const addHeader = (pageDoc: jsPDF) => {
        // Dark bar top
        pageDoc.setFillColor(...CINZA_ESCURO);
        pageDoc.rect(0, 0, pageW, 3, "F");
        // Medium bar below
        pageDoc.setFillColor(...CINZA_MEDIO);
        pageDoc.rect(0, 3, pageW, 1, "F");

        pageDoc.setFont("helvetica", "bold");
        pageDoc.setFontSize(8);
        pageDoc.setTextColor(...PRETO);
        pageDoc.text("PREFEITURA MUNICIPAL DE MEDIANEIRA", margin, 12);
        pageDoc.setTextColor(...CINZA_ESCURO);
        pageDoc.text("SECRETARIA DE ASSISTÊNCIA SOCIAL", margin, 16);
        pageDoc.setFont("helvetica", "normal");
        pageDoc.setFontSize(7);
        pageDoc.setTextColor(100, 100, 100);
        pageDoc.text("Centro de Atendimento Integrado ao Adolescente — CAIA", margin, 20);
        pageDoc.text("Serviço de Convivência e Fortalecimento de Vínculos — SCFV", margin, 24);

        // Divider
        pageDoc.setDrawColor(...CINZA_ESCURO);
        pageDoc.setLineWidth(0.5);
        pageDoc.line(margin, 27, pageW - margin, 27);
        return 32;
      };

      const addFooter = (pageDoc: jsPDF, pageNum: number) => {
        const h = pageDoc.internal.pageSize.getHeight();
        pageDoc.setDrawColor(...CINZA_MEDIO);
        pageDoc.setLineWidth(0.3);
        pageDoc.line(margin, h - 12, pageW - margin, h - 12);
        pageDoc.setFontSize(6);
        pageDoc.setTextColor(120, 120, 120);
        pageDoc.text(`SysELO — Gerado em ${new Date().toLocaleString("pt-BR")}`, margin, h - 8);
        pageDoc.text(`Página ${pageNum}`, pageW - margin, h - 8, { align: "right" });
      };

      const sectionTitle = (pageDoc: jsPDF, title: string, y: number, color: [number, number, number] = CINZA_ESCURO) => {
        pageDoc.setFillColor(...color);
        pageDoc.roundedRect(margin, y, contentW, 8, 1, 1, "F");
        pageDoc.setFont("helvetica", "bold");
        pageDoc.setFontSize(10);
        pageDoc.setTextColor(...BRANCO);
        pageDoc.text(title, margin + 3, y + 5.5);
        return y + 12;
      };

      let pageNum = 1;

      // Page 1: Cover / Summary
      let y = addHeader(doc);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.setTextColor(...PRETO);
      doc.text("RELATÓRIO MENSAL", pageW / 2, y + 5, { align: "center" });
      doc.setFontSize(12);
      doc.setTextColor(...CINZA_ESCURO);
      doc.text(`${MESES_NOMES[mesNum - 1].toUpperCase()} / ${ano}`, pageW / 2, y + 12, { align: "center" });
      y += 22;

      y = sectionTitle(doc, "RESUMO GERAL", y);

      // Summary cards
      const cardData = [
        { label: "Total de Atendidos", value: String(atendidosFiltered.length) },
        { label: "Frequência Geral", value: `${pctPresencaGeral}%` },
        { label: "Relatórios de Atividade", value: String(filteredRelatorios.length) },
        { label: "Atendimentos Técnicos", value: String(filteredAtendimentos.length) },
      ];
      const cardW = (contentW - 6) / 4;
      cardData.forEach((cd, i) => {
        const cx = margin + i * (cardW + 2);
        doc.setFillColor(...CINZA_CLARO);
        doc.roundedRect(cx, y, cardW, 18, 2, 2, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.setTextColor(...PRETO);
        doc.text(cd.value, cx + cardW / 2, y + 9, { align: "center" });
        doc.setFont("helvetica", "normal");
        doc.setFontSize(6);
        doc.setTextColor(80, 80, 80);
        doc.text(cd.label, cx + cardW / 2, y + 15, { align: "center" });
      });
      y += 24;

      // By bairro table
      y = sectionTitle(doc, "ATENDIDOS POR BAIRRO", y, CINZA_ESCURO);
      autoTable(doc, {
        startY: y,
        head: [["Bairro", "Qtd."]],
        body: Object.entries(byBairro).sort((a, b) => b[1] - a[1]).map(([b, c]) => [b, String(c)]),
        margin: { left: margin, right: margin },
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: CINZA_ESCURO, textColor: BRANCO, fontStyle: "bold" },
        alternateRowStyles: { fillColor: CINZA_CLARO },
        theme: "grid",
      });
      y = (doc as any).lastAutoTable.finalY + 6;

      // By faixa
      y = sectionTitle(doc, "ATENDIDOS POR FAIXA ETÁRIA", y, CINZA_ESCURO);
      autoTable(doc, {
        startY: y,
        head: [["Faixa Etária", "Qtd."]],
        body: Object.entries(byFaixa).map(([f, c]) => [f, String(c)]),
        margin: { left: margin, right: margin },
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: CINZA_ESCURO, textColor: BRANCO, fontStyle: "bold" },
        alternateRowStyles: { fillColor: CINZA_CLARO },
        theme: "grid",
      });
      y = (doc as any).lastAutoTable.finalY + 6;

      // Metas by bairro
      if (y > 220) { doc.addPage(); pageNum++; y = addHeader(doc); }
      y = sectionTitle(doc, "METAS POR BAIRRO — SCFV", y);
      const metasBody: string[][] = [];
      BAIRROS_SCFV.forEach(bn => {
        const meta = METAS_BAIRRO[bn];
        if (!meta) return;
        const stats = bairroStats[bn];
        const cm = stats.criancasManha.size;
        const ct = stats.criancasTarde.size;
        const totalB = cm + ct;
        const metaB = meta.criancasManha + meta.criancasTarde;
        const pct = metaB > 0 ? Math.round((totalB / metaB) * 100) : 0;
        metasBody.push([bn, `${cm}`, `${ct}`, `${totalB}/${metaB}`, `${pct}%`]);
        if (meta.idosos !== null) {
          const idC = stats.idosos.size;
          const pctId = meta.idosos > 0 ? Math.round((idC / meta.idosos) * 100) : 0;
          metasBody.push([`  └ Idosos`, `${idC}`, "—", `${idC}/${meta.idosos}`, `${pctId}%`]);
        }
      });
      autoTable(doc, {
        startY: y,
        head: [["Bairro / Público", "Manhã", "Tarde", "Atend./Meta", "% Meta"]],
        body: metasBody,
        margin: { left: margin, right: margin },
        styles: { fontSize: 7, cellPadding: 2 },
        headStyles: { fillColor: CINZA_ESCURO, textColor: BRANCO, fontStyle: "bold" },
        alternateRowStyles: { fillColor: CINZA_CLARO },
        theme: "grid",
      });
      y = (doc as any).lastAutoTable.finalY + 6;

      // Atendimentos técnicos
      if (filteredAtendimentos.length > 0) {
        if (y > 200) { doc.addPage(); pageNum++; y = addHeader(doc); }
        y = sectionTitle(doc, "ATENDIMENTOS TÉCNICOS", y, CINZA_ESCURO);
        const atendByTipo: Record<string, number> = {};
        filteredAtendimentos.forEach((a: any) => { const t = a.tipo || "atendimento_individual"; atendByTipo[t] = (atendByTipo[t] || 0) + 1; });
        autoTable(doc, {
          startY: y,
          head: [["Tipo", "Quantidade"]],
          body: Object.entries(atendByTipo).map(([t, c]) => [TIPO_ATENDIMENTO_LABELS[t] || t, String(c)]),
          margin: { left: margin, right: margin },
          styles: { fontSize: 8, cellPadding: 2 },
          headStyles: { fillColor: CINZA_ESCURO, textColor: BRANCO, fontStyle: "bold" },
          alternateRowStyles: { fillColor: CINZA_CLARO },
          theme: "grid",
        });
        y = (doc as any).lastAutoTable.finalY + 6;
      }

      // ── ANEXO: Listas de Presença por Turma ──
      const DIAS_MAP_PDF: Record<string, number> = { dom: 0, seg: 1, ter: 2, qua: 3, qui: 4, sex: 5, sab: 6 };
      const activeTurmas = (turmas || []).filter((t: any) => t.ativa);
      for (const turma of activeTurmas) {
        const diasSemana: string[] = turma.dias_semana || [];
        const diasNum = diasSemana.map((d: string) => DIAS_MAP_PDF[d.toLowerCase()]).filter((n: number) => n !== undefined);
        const datasDoMes: string[] = [];
        const dd = new Date(parseInt(ano), mesNum - 1, 1);
        while (dd.getMonth() === mesNum - 1) {
          if (diasNum.includes(dd.getDay())) {
            datasDoMes.push(dd.toISOString().slice(0, 10));
          }
          dd.setDate(dd.getDate() + 1);
        }
        if (datasDoMes.length === 0) continue;

        const tpMembers = (turmaParticipantes || []).filter((tp: any) => tp.turma_id === turma.id);
        const memberParts = tpMembers.map((tp: any) => partMap.get(tp.participante_id)).filter(Boolean);
        const sorted = [...memberParts].sort((a: any, b: any) => a.nome_completo.localeCompare(b.nome_completo));
        if (sorted.length === 0) continue;

        const turmaPresencas = presencas.filter((p: any) => p.turma_id === turma.id);
        const presencaSet = new Set(turmaPresencas.filter((p: any) => p.presente).map((p: any) => `${p.participante_id}_${p.data}`));

        doc.addPage("landscape");
        pageNum++;
        let ty = 10;
        doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.setTextColor(0, 0, 0);
        doc.text("PREFEITURA MUNICIPAL DE MEDIANEIRA — CAIA — SCFV", 148, ty, { align: "center" });
        ty += 5; doc.setFontSize(10);
        doc.text(`LISTA DE PRESENÇA — ${MESES_NOMES[mesNum - 1].toUpperCase()} / ${ano}`, 148, ty, { align: "center" });
        ty += 5; doc.setFontSize(9);
        doc.text(turma.nome, 148, ty, { align: "center" });
        ty += 4; doc.setFont("helvetica", "normal"); doc.setFontSize(7);
        const educador = (profilesData || []).find((p: any) => p.id === turma.educador_id);
        const bNome = bairroMap.get(turma.bairro_id) || "";
        const perLabel = turma.periodo === "manha" ? "Manhã" : turma.periodo === "tarde" ? "Tarde" : "Integral";
        doc.text(`Educador(a): ${educador?.nome || "—"}  ·  Bairro: ${bNome}  ·  Período: ${perLabel}`, 148, ty, { align: "center" });
        ty += 5;

        const dateHeaders = datasDoMes.map(d => { const dt = new Date(d + "T12:00:00"); return `${String(dt.getDate()).padStart(2, "0")}/${String(dt.getMonth() + 1).padStart(2, "0")}`; });
        autoTable(doc, {
          startY: ty,
          head: [["Nº", "Nome do Participante", ...dateHeaders]],
          body: sorted.map((member: any, i: number) => {
            const row = [i + 1, member.nome_completo];
            datasDoMes.forEach(d => {
              const key = `${member.id}_${d}`;
              row.push(presencaSet.has(key) ? "■" : "");
            });
            return row;
          }),
          headStyles: { fillColor: [50, 50, 50], fontSize: 5, cellPadding: 1, textColor: [255, 255, 255] },
          styles: { fontSize: 5, cellPadding: 1 },
          columnStyles: { 0: { cellWidth: 6, halign: "center" }, 1: { cellWidth: 35 } },
          alternateRowStyles: { fillColor: [245, 245, 245] },
          margin: { left: 8, right: 8 },
        });
      }

      // Add footers to all pages
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        addFooter(doc, i);
      }

      doc.save(sysEloFileName("RelatorioMensal_PDF", "pdf", `${ano}-${mes}`));
      toast.success("PDF profissional gerado com sucesso!");
    } catch (err: any) {
      console.error("Erro ao gerar PDF:", err);
      toast.error("Erro ao gerar PDF: " + (err?.message || "Erro desconhecido"));
    } finally {
      setGeneratingPdf(false);
    }
  };

  const anyGenerating = generating || generatingLocal || generatingFull || generatingReo || generatingPdf;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-foreground">Relatórios Mensais</h2>

      {/* Month/Year selector */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex gap-3 items-end flex-wrap">
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
          </div>
        </CardContent>
      </Card>

      {/* Relatório Mensal — XLSX + PDF */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4" /> Relatório Mensal
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Planilha completa com resumo, atividades, metas por bairro, monitoramento, atendimentos técnicos
            e matrizes de frequência por turma. Também gera PDF institucional.
          </p>
          <div className="flex gap-2 flex-wrap">
            <Button onClick={generateLocal} disabled={anyGenerating}>
              {generatingLocal ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" />Gerando...</> : <><Download className="h-4 w-4 mr-1" />Exportar XLSX</>}
            </Button>
            <Button onClick={generatePdf} disabled={anyGenerating} variant="outline">
              {generatingPdf ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" />Gerando...</> : <><FileText className="h-4 w-4 mr-1" />Exportar PDF</>}
            </Button>
            <Button onClick={generateBackground} disabled={anyGenerating} variant="ghost" size="sm" className="text-xs">
              {generating ? <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />...</> : "XLSX (servidor)"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Relatório Completo */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4" /> Relatório Completo (todo o período)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            XLSX com todos os meses que contêm dados — do primeiro registro ao mais recente.
            Inclui aba "Consolidado" com totais gerais.
          </p>
          <Button onClick={generateFullReport} disabled={anyGenerating} variant="outline" size="sm">
            {generatingFull ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" />Gerando...</> : <><FileSpreadsheet className="h-4 w-4 mr-1" />Gerar Relatório Completo</>}
          </Button>
        </CardContent>
      </Card>

      {/* REO */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <FileText className="h-4 w-4" /> Relatório de Execução do Objeto (REO)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            DOCX + XLSX institucional com atividades, equipe técnica, metas, RH, monitoramento,
            financeiro, fotos e listas de presença preenchidas.
          </p>
          <Button onClick={generateReo} disabled={anyGenerating}>
            {generatingReo ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" />Gerando REO...</> : <><Download className="h-4 w-4 mr-1" />Exportar REO (DOCX + XLSX)</>}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}