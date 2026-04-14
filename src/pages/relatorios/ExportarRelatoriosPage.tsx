import { useState, useEffect, useMemo } from "react";
import { exportRelatorioGestaoPDF, exportRelatorioGestaoXLSX } from "@/hooks/useRelatorioGestao";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/fetchAllRows";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { FileSpreadsheet, Download, FileText, Loader2, Calendar, ClipboardList, Users } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx-js-style";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { BAIRROS_SCFV, calcFaixaFromDate, calcAge } from "@/lib/constants";
import { sysCfvFileName } from "@/lib/fileNaming";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { autoFitColumns } from "@/lib/xlsxAutoFit";
import { exportBulkRelatorios } from "@/hooks/useBulkRelatorioExport";

const MESES = ["01","02","03","04","05","06","07","08","09","10","11","12"];
const MESES_NOMES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

const DIAS_MAP: Record<string, number> = { dom: 0, seg: 1, ter: 2, qua: 3, qui: 4, sex: 5, sab: 6 };

function getDatasAtividade(ano: number, mes: number, diasSemana: string[]): string[] {
  const diasNum = diasSemana.map(d => DIAS_MAP[d.toLowerCase()]).filter(n => n !== undefined);
  if (!diasNum.length) return [];
  const datas: string[] = [];
  const d = new Date(ano, mes - 1, 1);
  while (d.getMonth() === mes - 1) {
    if (diasNum.includes(d.getDay())) datas.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + 1);
  }
  return datas;
}

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
  atendimento_comunidade: "Atendimento Comunidade",
  atendimento_familiar: "Atendimento Familiares",
  atendimento_educador: "Atendimento Educadores",
  acao_social: "Ações Sociais/Eventos",
  reuniao_rede: "Reunião de Rede",
  visita_escolar: "Visita Escolar",
  aplicacao_grupo: "Aplicação de Grupos",
};

const TIPOS_DOCUMENTO = [
  { value: "nota_fiscal", label: "Nota Fiscal" },
  { value: "recibo", label: "Recibo" },
  { value: "cupom_fiscal", label: "Cupom Fiscal" },
  { value: "boleto", label: "Boleto" },
  { value: "darf", label: "DARF" },
  { value: "gps", label: "GPS" },
  { value: "outro", label: "Outro" },
];

import { addInstitutionalHeader, applyInstitutionalStyle, applyTableHeaderStyle, applyAllBorders } from "@/lib/xlsxInstHeader";

function applyBorders(ws: XLSX.WorkSheet) {
  const range = XLSX.utils.decode_range(ws["!ref"] || "A1");
  const border = { style: "thin" as const, color: { rgb: "000000" } };
  for (let r = range.s.r; r <= range.e.r; r++) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      if (!ws[addr]) ws[addr] = { v: "", t: "s" };
      ws[addr].s = { ...(ws[addr].s || {}), border: { top: border, bottom: border, left: border, right: border } };
    }
  }
}

function addInstHeader(rows: any[][], title: string): { data: any[][]; offset: number } {
  const { data, dataStartOffset } = addInstitutionalHeader(rows, title);
  return { data, offset: dataStartOffset };
}

function applyInstStyle(ws: XLSX.WorkSheet, totalCols = 2) {
  applyInstitutionalStyle(ws, totalCols);
}

function applyHeaderStyle(ws: XLSX.WorkSheet, row: number, colCount: number) {
  applyTableHeaderStyle(ws, row, colCount);
}

/** Helper to enrich presencas with relatorio_presenca fallback */
function enrichPresencas(
  presencas: any[],
  filteredRelatorios: any[],
  relatorioTurmas: any[],
  relatorioPresencas: any[]
) {
  const presencaKeys = new Set(presencas.map((p: any) => `${p.participante_id}_${p.data}_${p.turma_id}`));
  filteredRelatorios.forEach((r: any) => {
    const rTurmas = (relatorioTurmas || []).filter((rt: any) => rt.relatorio_id === r.id);
    const rPres = (relatorioPresencas || []).filter((rp: any) => rp.relatorio_id === r.id);
    rTurmas.forEach((rt: any) => {
      rPres.forEach((rp: any) => {
        if (!rp.participante_id) return;
        const key = `${rp.participante_id}_${r.data}_${rt.turma_id}`;
        if (!presencaKeys.has(key)) {
          presencas.push({ participante_id: rp.participante_id, data: r.data, turma_id: rt.turma_id, presente: rp.presente, id: rp.id });
          presencaKeys.add(key);
        }
      });
    });
  });
  return presencas;
}

export default function ExportarRelatoriosPage() {
  const now = new Date();
  const [ano, setAno] = useState(String(now.getFullYear()));
  const [mes, setMes] = useState(String(now.getMonth() + 1).padStart(2, "0"));
  const [anoAnual, setAnoAnual] = useState(String(now.getFullYear()));

  const [loadingReo, setLoadingReo] = useState(false);
  const [loadingRelMensal, setLoadingRelMensal] = useState(false);
  const [loadingPC, setLoadingPC] = useState(false);
  const [loadingAnual, setLoadingAnual] = useState(false);
  const [loadingAtividades, setLoadingAtividades] = useState(false);
  const [loadingAtendimentos, setLoadingAtendimentos] = useState(false);
  const [loadingGestao, setLoadingGestao] = useState(false);
  const [gestaoMesInicio, setGestaoMesInicio] = useState(String(now.getMonth() + 1).padStart(2, "0"));
  const [gestaoMesFim, setGestaoMesFim] = useState(String(now.getMonth() + 1).padStart(2, "0"));
  const [gestaoAnoInicio, setGestaoAnoInicio] = useState(String(now.getFullYear()));
  const [gestaoAnoFim, setGestaoAnoFim] = useState(String(now.getFullYear()));

  // Atividades bulk export state
  const [ativDateFrom, setAtivDateFrom] = useState(format(startOfMonth(now), "yyyy-MM-dd"));
  const [ativDateTo, setAtivDateTo] = useState(format(endOfMonth(now), "yyyy-MM-dd"));
  const [ativEducadorId, setAtivEducadorId] = useState("__all__");
  const [educadores, setEducadores] = useState<any[]>([]);

  // Atendimentos export state
  const [atendDateFrom, setAtendDateFrom] = useState(format(startOfMonth(now), "yyyy-MM-dd"));
  const [atendDateTo, setAtendDateTo] = useState(format(endOfMonth(now), "yyyy-MM-dd"));

  const mesRef = `${ano}-${mes}`;
  const mesNum = parseInt(mes);

  // Load educadores on mount
  useEffect(() => {
    supabase.from("profiles").select("id, nome, cargo").order("nome").then(({ data }) => {
      setEducadores(data || []);
    });
  }, []);

  // ===================== REO =====================
  const downloadFromUrl = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Download falhou: ${response.statusText}`);
      const blob = await response.blob();
      saveAs(blob, filename);
    } catch {
      window.open(url, "_blank");
    }
  };

  const exportarREO = async () => {
    setLoadingReo(true);
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
        toast.success(`REO gerado com sucesso! (${downloads.length} arquivo(s))`);
      } else {
        throw new Error(docxRes.data?.error || xlsxRes.data?.error || "Erro desconhecido");
      }
    } catch (err: any) {
      console.error("Erro REO:", err);
      toast.error("Erro ao gerar REO: " + (err.message || "Erro desconhecido"));
    } finally {
      setLoadingReo(false);
    }
  };

  // ===================== Relatório Mensal (XLSX + PDF) =====================
  const exportarRelatorioMensal = async () => {
    setLoadingRelMensal(true);
    try {
      const startDate = `${ano}-${mes}-01`;
      const endDate = mesNum === 12 ? `${parseInt(ano)+1}-01-01` : `${ano}-${String(mesNum+1).padStart(2,"0")}-01`;

      const [presencas_raw, participantes, turmas, bairros, relatorios, planejamentos,
             turmaParticipantes, relatorioTurmas, atendimentos_raw, profilesData, relatorioPresencas] = await Promise.all([
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

      let presencas = (presencas_raw || []).filter((p: any) => p.data >= startDate && p.data < endDate);
      const filteredRelatorios = (relatorios || []).filter((r: any) => r.data >= startDate && r.data < endDate);
      const filteredPlanejamentos = (planejamentos || []).filter((p: any) => p.data_aplicacao && p.data_aplicacao >= startDate && p.data_aplicacao < endDate);
      const filteredAtendimentos = (atendimentos_raw || []).filter((a: any) => a.data_atendimento >= startDate && a.data_atendimento < endDate);

      presencas = enrichPresencas(presencas, filteredRelatorios, relatorioTurmas, relatorioPresencas);

      const partMap = new Map((participantes || []).map((p: any) => [p.id, p]));
      const bairroMap = new Map((bairros || []).map((b: any) => [b.id, b.nome]));
      const profileMap = new Map((profilesData || []).map((p: any) => [p.id, p]));
      const planMap = new Map((planejamentos || []).map((p: any) => [p.id, p]));

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

      // ======= XLSX =======
      const wb = XLSX.utils.book_new();

      // Resumo
      const byBairro: Record<string, number> = {};
      atendidosFiltered.forEach((p: any) => { const b = p.bairro_id ? (bairroMap.get(p.bairro_id) || "N/I") : "N/I"; byBairro[b] = (byBairro[b] || 0) + 1; });
      const byFaixa: Record<string, number> = {};
      atendidosFiltered.forEach((p: any) => { if (p.data_nascimento) { const f = calcFaixaFromDate(p.data_nascimento); if (f) byFaixa[f] = (byFaixa[f] || 0) + 1; } });
      const byPeriodo: Record<string, number> = {};
      atendidosFiltered.forEach((p: any) => { const per = p.periodo || "N/I"; byPeriodo[per] = (byPeriodo[per] || 0) + 1; });
      const novasInsercoes = participantes.filter((p: any) => p.iniciou_em && p.iniciou_em >= startDate && p.iniciou_em < endDate);
      const atendByTipo: Record<string, number> = {};
      filteredAtendimentos.forEach((a: any) => { const t = a.tipo || "atendimento_individual"; atendByTipo[t] = (atendByTipo[t] || 0) + 1; });

      const { data: resumoData } = addInstHeader([
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
        ["NOVAS INSERÇÕES NO MÊS", novasInsercoes.length],
        ...novasInsercoes.map((p: any) => [p.nome_completo, p.iniciou_em]),
        [],
        ["ATENDIMENTOS TÉCNICOS NO MÊS", filteredAtendimentos.length],
        ...Object.entries(atendByTipo).map(([t, c]) => [TIPO_ATENDIMENTO_LABELS[t] || t, c]),
      ], `RELATÓRIO MENSAL — ${MESES_NOMES[mesNum - 1]} / ${ano}`);
      const wsResumo = XLSX.utils.aoa_to_sheet(resumoData);
      wsResumo["!cols"] = [{ wch: 40 }, { wch: 15 }];
      autoFitColumns(wsResumo);
      applyInstStyle(wsResumo);
      XLSX.utils.book_append_sheet(wb, wsResumo, "Resumo");

      // Atividades
      const atividadesRows: any[][] = [];
      filteredRelatorios.forEach((r: any) => {
        const plan = r.planejamento_id ? planMap.get(r.planejamento_id) : null;
        const proposta = plan ? (plan.titulo + (plan.tema ? ` — ${plan.tema}` : "")) : "Não planejada";
        atividadesRows.push([proposta, r.nome_atividade || "", r.analise_ia || "", ""]);
      });
      if (!atividadesRows.length) atividadesRows.push(["Nenhuma atividade registrada", "", "", ""]);
      const { data: ativData, offset: ativOff } = addInstHeader([
        ["Atividades Propostas", "Atividades Desenvolvidas", "Resultados Alcançados", "Justificativas"],
        ...atividadesRows,
      ], `ATIVIDADES — ${MESES_NOMES[mesNum - 1]} / ${ano}`);
      const wsAtiv = XLSX.utils.aoa_to_sheet(ativData);
      wsAtiv["!cols"] = [{ wch: 35 }, { wch: 35 }, { wch: 40 }, { wch: 30 }];
      autoFitColumns(wsAtiv);
      applyInstStyle(wsAtiv, 4);
      applyHeaderStyle(wsAtiv, ativOff, 4);
      applyBorders(wsAtiv);
      XLSX.utils.book_append_sheet(wb, wsAtiv, "Atividades");

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
      const metasRows: any[][] = [];
      let totalCriancas = 0, totalMeta = 0;
      BAIRROS_SCFV.forEach(bn => {
        const meta = METAS_BAIRRO[bn]; if (!meta) return;
        const stats = bairroStats[bn];
        const cm = stats.criancasManha.size, ct = stats.criancasTarde.size;
        const totalBairro = cm + ct, metaBairro = meta.criancasManha + meta.criancasTarde;
        const pct = metaBairro > 0 ? Math.round((totalBairro / metaBairro) * 100) : 0;
        metasRows.push([bn, `${totalBairro} (${pct}% da meta)`, `Manhã: ${cm} | Tarde: ${ct}`, ""]);
        if (meta.idosos !== null) metasRows.push([`  ${bn} - Idosos (meta: ${meta.idosos})`, `${stats.idosos.size}`, "", ""]);
        totalCriancas += totalBairro; totalMeta += metaBairro;
      });
      metasRows.push(["TOTAL", `${totalCriancas}/${totalMeta}`, `${totalMeta > 0 ? Math.round((totalCriancas/totalMeta)*100) : 0}%`, ""]);
      const { data: metaData, offset: metaOff } = addInstHeader([
        ["Metas Propostas", "Quant.", "Resultados Alcançados", "Justificativa"],
        ...metasRows,
      ], `METAS — ${MESES_NOMES[mesNum - 1]} / ${ano}`);
      const wsMetas = XLSX.utils.aoa_to_sheet(metaData);
      wsMetas["!cols"] = [{ wch: 55 }, { wch: 35 }, { wch: 50 }, { wch: 25 }];
      autoFitColumns(wsMetas);
      applyInstStyle(wsMetas, 4);
      applyHeaderStyle(wsMetas, metaOff, 4);
      applyBorders(wsMetas);
      XLSX.utils.book_append_sheet(wb, wsMetas, "Metas");

      // Monitoramento
      const totalPresReg = activePresencas.length;
      const totalPres = activePresencas.filter((p: any) => p.presente).length;
      const pctGeral = totalPresReg > 0 ? Math.round((totalPres / totalPresReg) * 100) : 0;
      const { data: monData, offset: monOff } = addInstHeader([
        ["Objetivo", "Indicador", "Meta Prevista", "Meta Atingida"],
        ["Assegurar espaços de referência para o convívio grupal", "Participação nas atividades", "100%", `${pctGeral}%`],
        ["Desenvolvimento de potencialidades e habilidades", "Participação em atividades culturais e esportivas", "100%", `${pctGeral}%`],
        ["Inserção e permanência no sistema educacional", "Matrícula, rendimento e frequência", "100%", `${pctGeral}%`],
        ["Acesso a benefícios socioassistenciais", "Quantidade de beneficiários", "100%", "100%"],
      ], `MONITORAMENTO — ${MESES_NOMES[mesNum - 1]} / ${ano}`);
      const wsMonitor = XLSX.utils.aoa_to_sheet(monData);
      wsMonitor["!cols"] = [{ wch: 60 }, { wch: 45 }, { wch: 15 }, { wch: 15 }];
      autoFitColumns(wsMonitor);
      applyInstStyle(wsMonitor, 4);
      applyHeaderStyle(wsMonitor, monOff, 4);
      applyBorders(wsMonitor);
      XLSX.utils.book_append_sheet(wb, wsMonitor, "Monitoramento");

      // Matrizes de frequência por turma
      const turmasAtivas = turmas.filter((t: any) => t.ativa);
      const usedSheetNames = new Set<string>(["Resumo", "Atividades", "Metas", "Monitoramento"]);
      const border = { style: "thin" as const, color: { rgb: "000000" } };
      const borderObj = { top: border, bottom: border, left: border, right: border };

      for (const turma of turmasAtivas) {
        const t = turma as any;
        const tpIds = turmaParticipantes.filter((tp: any) => tp.turma_id === t.id).map((tp: any) => tp.participante_id);
        const tParts = tpIds.map((id: string) => partMap.get(id)).filter(Boolean) as any[];
        const tPresencas = presencas.filter((p: any) => p.turma_id === t.id);
        const relIdsForTurma = relatorioTurmas.filter((rt: any) => rt.turma_id === t.id).map((rt: any) => rt.relatorio_id);
        const relsForTurma = filteredRelatorios.filter((r: any) => relIdsForTurma.includes(r.id));
        const relPresFallback: { participante_id: string; data: string; presente: boolean }[] = [];
        relsForTurma.forEach((r: any) => {
          (relatorioPresencas || []).filter((rp: any) => rp.relatorio_id === r.id).forEach((rp: any) => {
            relPresFallback.push({ participante_id: rp.participante_id, data: r.data, presente: rp.presente });
          });
        });

        const datasAtividade = getDatasAtividade(parseInt(ano), mesNum, t.dias_semana || []);
        const fallbackDates = [...new Set(relPresFallback.map(f => f.data))];
        const allDatesSet = new Set([...datasAtividade, ...tPresencas.map((p: any) => p.data), ...fallbackDates]);
        const datas = [...allDatesSet].sort();
        if (!datas.length && !tParts.length) continue;

        const bairroNome = bairroMap.get(t.bairro_id) || "N/I";
        let sheetName = (t.nome || "Turma").slice(0, 28).replace(/[\\\/\*\?\[\]:]/g, "_");
        let suffix = 2;
        while (usedSheetNames.has(sheetName)) { sheetName = sheetName.slice(0, 25) + `_${suffix++}`; }
        usedSheetNames.add(sheetName);

        const colHeaders = ["Nº", "Nome do Participante", ...datas.map(d => d.slice(5))];
        const rows = tParts.map((p: any, idx: number) => {
          const isDesligado = p.status === "desligado";
          const dataDeslig = p.data_desligamento || null;
          const nameSuffix = isDesligado && dataDeslig ? ` (D ${dataDeslig.slice(8,10)}/${dataDeslig.slice(5,7)})` : "";
          const row: any[] = [idx + 1, p.nome_completo + nameSuffix];
          datas.forEach(() => row.push(""));
          return row;
        });

        const turmaInfoLine = `Turma: ${t.nome} | Bairro: ${bairroNome} | Período: ${t.periodo || "N/I"}`;
        const subInfoLine = `Mês: ${MESES_NOMES[mesNum - 1]} / ${ano}`;
        const { data: sheetData, dataStartOffset: matOffset } = addInstitutionalHeader(
          [colHeaders, ...rows, [], [`Assinatura do Educador: _______________________`]],
          "MATRIZ DE FREQUÊNCIA", turmaInfoLine, subInfoLine,
        );
        const ws = XLSX.utils.aoa_to_sheet(sheetData);
        ws["!cols"] = [{ wch: 5 }, { wch: 30 }, ...datas.map(() => ({ wch: 6 }))];
        autoFitColumns(ws, { max: 55 });
        applyInstitutionalStyle(ws, colHeaders.length, { hasTurmaInfo: true, hasSubInfo: true });
        applyHeaderStyle(ws, matOffset, colHeaders.length);
        const dataStartRow = matOffset + 1;
        tParts.forEach((p: any, pIdx: number) => {
          const excelRow = dataStartRow + pIdx;
          datas.forEach((d, dIdx) => {
            const col = 2 + dIdx;
            const addr = XLSX.utils.encode_cell({ r: excelRow, c: col });
            if (!ws[addr]) ws[addr] = { v: "", t: "s" };
            const isDesligado = p.status === "desligado" && p.data_desligamento && d > p.data_desligamento;
            if (isDesligado) {
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
        sysCfvFileName("RelatorioMensal", "xlsx", mesRef));

      toast.success("Relatório mensal XLSX gerado!");
    } catch (err: any) {
      console.error("Erro ao gerar relatório mensal:", err);
      // Fallback to server
      try {
        const { data, error } = await supabase.functions.invoke("generate-relatorio-mensal", { body: { mes, ano } });
        if (error) throw error;
        if (data?.url) {
          window.open(data.url, "_blank");
          toast.success("Relatório gerado no servidor!");
        }
      } catch (err2: any) {
        toast.error("Erro ao gerar relatório: " + (err2?.message || err.message));
      }
    } finally {
      setLoadingRelMensal(false);
    }
  };

  // ===================== Prestação de Contas =====================
  const exportarPrestacaoContas = async () => {
    setLoadingPC(true);
    try {
      const fmtVal = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const mesLabel = MESES_NOMES[mesNum - 1] + " " + ano;

      const [catRes, parRes, despRes, estRes] = await Promise.all([
        supabase.from("categorias_financeiras").select("*").order("codigo"),
        supabase.from("parcelas_financeiras").select("*").order("numero_parcela"),
        supabase.from("despesas").select("*").order("data_lancamento"),
        supabase.from("estornos").select("*").eq("mes_referencia", mesRef).order("created_at"),
      ]);

      const categorias = catRes.data || [];
      const parcelas = parRes.data || [];
      const allDespesas = despRes.data || [];
      const estornos = estRes.data || [];
      const despMes = allDespesas.filter((d: any) => d.mes_referencia === mesRef);

      const totalRec = parcelas.reduce((s: number, p: any) => s + Number(p.valor), 0);
      const totalDesp = despMes.reduce((s: number, d: any) => s + Number(d.valor), 0);
      const totalEst = estornos.reduce((s: number, e: any) => s + Number(e.valor), 0);
      const saldoPC = totalRec - allDespesas.reduce((s: number, d: any) => s + Number(d.valor), 0) + totalEst;

      // XLSX
      const wb = XLSX.utils.book_new();
      const { data: pcData } = addInstHeader([
        ["Item", "Valor"],
        ["Total Recebido (Parcelas)", totalRec],
        ["Despesas no Mês", totalDesp],
        ["Estornos no Mês", totalEst],
        ["Saldo Acumulado", saldoPC],
      ], "PRESTAÇÃO DE CONTAS — " + mesLabel);
      const wsResumoPC = XLSX.utils.aoa_to_sheet(pcData);
      wsResumoPC["!cols"] = [{ wch: 35 }, { wch: 20 }];
      autoFitColumns(wsResumoPC);
      applyInstStyle(wsResumoPC);
      XLSX.utils.book_append_sheet(wb, wsResumoPC, "Resumo");

      const despRows: any[] = [["Código", "Descrição", "Fornecedor", "CNPJ/CPF", "Tipo Doc", "Nº Doc", "Valor", "Data", "Status"]];
      despMes.sort((a: any, b: any) => a.data_lancamento.localeCompare(b.data_lancamento)).forEach((d: any) => {
        despRows.push([
          d.codigo_lancamento || "", d.descricao, d.fornecedor || "", d.cnpj_cpf || "",
          TIPOS_DOCUMENTO.find(t => t.value === d.tipo_documento)?.label || "",
          d.numero_documento || "", Number(d.valor),
          d.data_lancamento ? format(new Date(d.data_lancamento + "T12:00:00"), "dd/MM/yyyy") : "",
          d.comprovante_url ? "Pago ✓" : "Aguardando ⏳",
        ]);
      });
      const wsD = XLSX.utils.aoa_to_sheet(despRows);
      wsD["!cols"] = [{ wch: 12 }, { wch: 30 }, { wch: 20 }, { wch: 18 }, { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 16 }];
      autoFitColumns(wsD);
      XLSX.utils.book_append_sheet(wb, wsD, "Despesas");

      const catRows: any[] = [["Código", "Descrição", "Previsto", "Gasto", "Estornado", "Saldo"]];
      categorias.forEach((c: any) => {
        const gasto = allDespesas.filter((d: any) => d.categoria_id === c.id).reduce((s: number, d: any) => s + Number(d.valor), 0);
        const est = estornos.filter((e: any) => e.categoria_id === c.id).reduce((s: number, e: any) => s + Number(e.valor), 0);
        const prev = Number(c.valor_previsto || 0);
        catRows.push([c.codigo, c.descricao, prev, gasto, est, prev - gasto + est]);
      });
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(catRows), "Categorias");

      const bufXlsx = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      saveAs(new Blob([bufXlsx], { type: "application/octet-stream" }), sysCfvFileName("PrestacaoContas", "xlsx", mesRef));

      // PDF
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      doc.setFontSize(16);
      doc.text("PRESTAÇÃO DE CONTAS — " + mesLabel, 14, 15);
      doc.setFontSize(8);
      doc.text("Gerado em: " + new Date().toLocaleString("pt-BR"), 14, 21);
      autoTable(doc, {
        startY: 26,
        head: [["Item", "Valor (R$)"]],
        body: [
          ["Total Recebido (Parcelas)", fmtVal(totalRec)],
          ["Despesas no Mês", fmtVal(totalDesp)],
          ["Estornos no Mês", fmtVal(totalEst)],
          ["Saldo Acumulado", fmtVal(saldoPC)],
        ],
        styles: { fontSize: 8 },
        headStyles: { fillColor: [50, 50, 50] },
      });
      const lastY = (doc as any).lastAutoTable?.finalY || 60;
      doc.setFontSize(11);
      doc.text("Despesas Detalhadas", 14, lastY + 8);
      autoTable(doc, {
        startY: lastY + 12,
        head: [["Cód.", "Descrição", "Fornecedor", "Valor", "Data", "Status"]],
        body: despMes.sort((a: any, b: any) => a.data_lancamento.localeCompare(b.data_lancamento)).map((d: any) => [
          d.codigo_lancamento || "—", d.descricao, d.fornecedor || "—",
          fmtVal(Number(d.valor)),
          d.data_lancamento ? format(new Date(d.data_lancamento + "T12:00:00"), "dd/MM/yyyy") : "—",
          d.comprovante_url ? "Pago ✓" : "Aguardando ⏳",
        ]),
        styles: { fontSize: 7 },
        headStyles: { fillColor: [50, 50, 50], fontSize: 7 },
      });
      doc.save(sysCfvFileName("PrestacaoContas", "pdf", mesRef));

      toast.success("Prestação de Contas gerada (XLSX + PDF)!");
    } catch (err: any) {
      toast.error("Erro ao gerar prestação de contas: " + (err.message || ""));
    } finally {
      setLoadingPC(false);
    }
  };

  // ===================== Relatório Completo Anual =====================
  const exportarAnual = async () => {
    setLoadingAnual(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-relatorio-mensal", {
        body: { completo: true },
      });
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, "_blank");
        toast.success("Relatório completo anual gerado!");
      } else {
        throw new Error("URL não retornada");
      }
    } catch (err: any) {
      toast.error("Erro ao gerar relatório anual: " + (err?.message || ""));
    } finally {
      setLoadingAnual(false);
    }
  };

  // ===================== Atividades em Lote =====================
  const exportarAtividadesLote = async () => {
    setLoadingAtividades(true);
    try {
      await exportBulkRelatorios({
        dateFrom: ativDateFrom,
        dateTo: ativDateTo,
        educadorId: ativEducadorId === "__all__" ? undefined : ativEducadorId,
      });
      toast.success("Relatórios de atividades exportados!");
    } catch (err: any) {
      toast.error("Erro: " + (err.message || "Erro desconhecido"));
    } finally {
      setLoadingAtividades(false);
    }
  };

  // ===================== Atendimentos Técnicos =====================
  const exportarAtendimentosTecnicos = async () => {
    setLoadingAtendimentos(true);
    try {
      const [{ data: atendimentos }, { data: profilesData }, { data: participantesData }] = await Promise.all([
        supabase.from("atendimentos").select("*").gte("data_atendimento", atendDateFrom).lte("data_atendimento", atendDateTo).order("data_atendimento"),
        supabase.from("profiles").select("id, nome, cargo"),
        supabase.from("participantes").select("id, nome_completo"),
      ]);

      const atds = atendimentos || [];
      if (atds.length === 0) { toast.error("Nenhum atendimento no período"); setLoadingAtendimentos(false); return; }

      const profMap = new Map((profilesData || []).map((p: any) => [p.id, p.nome]));
      const partMap = new Map((participantesData || []).map((p: any) => [p.id, p.nome_completo]));
      const tipoLabel = (v: string) => TIPO_ATENDIMENTO_LABELS[v] || v;
      const periodoLabel = `${format(new Date(atendDateFrom + "T12:00:00"), "dd/MM/yyyy")} a ${format(new Date(atendDateTo + "T12:00:00"), "dd/MM/yyyy")}`;

      // XLSX
      const border = { style: "thin" as const, color: { rgb: "000000" } };
      const hdr = { font: { bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "323232" } }, border: { top: border, bottom: border, left: border, right: border } };
      const cellS = { border: { top: border, bottom: border, left: border, right: border } };
      const wb = XLSX.utils.book_new();
      const rows: any[][] = [
        ["Sociedade Civil Nossa Senhora Aparecida"],
        ["Centro de Atenção Integral ao Adolescente - Medianeira"],
        ["RELATÓRIO DE ATIVIDADES DA EQUIPE TÉCNICA"],
        [],
        ["Período: " + periodoLabel],
        ["Gerado em: " + new Date().toLocaleString("pt-BR")],
        [],
        ["Data", "Profissional", "Participante", "Tipo", "Descrição", "Encaminhamento"],
      ];
      atds.forEach((a: any) => {
        rows.push([
          format(new Date(a.data_atendimento + "T12:00:00"), "dd/MM/yyyy"),
          profMap.get(a.profissional_id) || "—",
          partMap.get(a.participante_id) || "—",
          tipoLabel(a.tipo),
          a.descricao || "",
          a.encaminhamento || "",
        ]);
      });
      const ws = XLSX.utils.aoa_to_sheet(rows);
      ws["!cols"] = [{ wch: 12 }, { wch: 22 }, { wch: 28 }, { wch: 20 }, { wch: 40 }, { wch: 30 }];
      autoFitColumns(ws, { min: 10 });
      for (let c = 0; c < 6; c++) {
        const addr = XLSX.utils.encode_cell({ r: 7, c });
        if (ws[addr]) ws[addr].s = hdr;
      }
      for (let r = 8; r < rows.length; r++) {
        for (let c = 0; c < 6; c++) {
          const addr = XLSX.utils.encode_cell({ r, c });
          if (ws[addr]) ws[addr].s = cellS;
        }
      }
      XLSX.utils.book_append_sheet(wb, ws, "Atendimentos");

      // Resumo por tipo
      const tipoMap: Record<string, number> = {};
      atds.forEach((a: any) => { tipoMap[tipoLabel(a.tipo)] = (tipoMap[tipoLabel(a.tipo)] || 0) + 1; });
      const resumoRows: any[][] = [["Tipo", "Quantidade"]];
      Object.entries(tipoMap).forEach(([tipo, qt]) => resumoRows.push([tipo, qt]));
      resumoRows.push(["TOTAL", atds.length]);
      const wsR = XLSX.utils.aoa_to_sheet(resumoRows);
      wsR["!cols"] = [{ wch: 25 }, { wch: 12 }];
      XLSX.utils.book_append_sheet(wb, wsR, "Resumo");
      const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      saveAs(new Blob([buf]), sysCfvFileName("RelEquipeTecnica", "xlsx"));

      // PDF
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      doc.setFontSize(14);
      doc.text("RELATÓRIO DE ATIVIDADES DA EQUIPE TÉCNICA", 14, 15);
      doc.setFontSize(9);
      doc.text("Período: " + periodoLabel, 14, 22);
      doc.text("Gerado em: " + new Date().toLocaleString("pt-BR"), 14, 27);
      autoTable(doc, {
        startY: 32,
        head: [["Data", "Profissional", "Participante", "Tipo", "Descrição", "Encaminhamento"]],
        body: atds.map((a: any) => [
          format(new Date(a.data_atendimento + "T12:00:00"), "dd/MM/yyyy"),
          profMap.get(a.profissional_id) || "—",
          partMap.get(a.participante_id) || "—",
          tipoLabel(a.tipo),
          a.descricao || "—",
          a.encaminhamento || "—",
        ]),
        styles: { fontSize: 7, cellPadding: 1.5 },
        headStyles: { fillColor: [50, 50, 50], fontSize: 7 },
        alternateRowStyles: { fillColor: [240, 240, 240] },
        columnStyles: { 4: { cellWidth: 60 }, 5: { cellWidth: 40 } },
      });
      const lastY = (doc as any).lastAutoTable?.finalY || 100;
      doc.setFontSize(11);
      doc.text("Resumo por Tipo", 14, lastY + 8);
      autoTable(doc, {
        startY: lastY + 12,
        head: [["Tipo", "Quantidade"]],
        body: [...Object.entries(tipoMap).map(([t, q]) => [t, String(q)]), ["TOTAL", String(atds.length)]],
        styles: { fontSize: 8 },
        headStyles: { fillColor: [50, 50, 50] },
      });
      doc.save(sysCfvFileName("RelEquipeTecnica", "pdf"));

      toast.success("Relatório da equipe técnica gerado (XLSX + PDF)!");
    } catch (err: any) {
      toast.error("Erro: " + (err.message || "Erro desconhecido"));
    } finally {
      setLoadingAtendimentos(false);
    }
  };

  const exportarGestao = async (formato: "pdf" | "xlsx" | "ambos") => {
    setLoadingGestao(true);
    try {
      const mi = parseInt(gestaoMesInicio);
      const ai = parseInt(gestaoAnoInicio);
      const mf = parseInt(gestaoMesFim);
      const af = parseInt(gestaoAnoFim);
      if (formato === "pdf" || formato === "ambos") {
        await exportRelatorioGestaoPDF(mi, ai, mf, af);
      }
      if (formato === "xlsx" || formato === "ambos") {
        await exportRelatorioGestaoXLSX(mi, ai, mf, af);
      }
      toast.success(`Relatório de Gestão exportado em ${formato === "ambos" ? "PDF + XLSX" : formato.toUpperCase()}!`);
    } catch (err: any) {
      console.error("Erro ao exportar Relatório de Gestão:", err);
      toast.error("Erro ao gerar relatório: " + (err.message || "Erro desconhecido"));
    } finally {
      setLoadingGestao(false);
    }
  };

  const anyLoading = loadingReo || loadingRelMensal || loadingPC || loadingAnual || loadingAtividades || loadingAtendimentos || loadingGestao;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Exportar Relatórios</h1>
        <p className="text-sm text-muted-foreground">Central unificada de exportação de relatórios institucionais</p>
      </div>

      {/* Seletor de período */}
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
            <div className="text-sm text-muted-foreground self-center ml-2">
              <Calendar className="inline h-4 w-4 mr-1" />
              {MESES_NOMES[mesNum - 1]} / {ano}
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="reo" className="space-y-4">
        <TabsList className="grid grid-cols-7 w-full">
          <TabsTrigger value="reo">REO</TabsTrigger>
          <TabsTrigger value="mensal">Rel. Mensal</TabsTrigger>
          <TabsTrigger value="pc">Prest. Contas</TabsTrigger>
          <TabsTrigger value="atividades">Atividades</TabsTrigger>
          <TabsTrigger value="atendimentos">Atend. Técnicos</TabsTrigger>
          <TabsTrigger value="anual">Anual</TabsTrigger>
          <TabsTrigger value="gestao">Gestão</TabsTrigger>
        </TabsList>

        {/* REO */}
        <TabsContent value="reo">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-5 w-5" /> Relatório de Execução do Objeto (REO)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Documento institucional com atividades propostas × desenvolvidas, equipe técnica,
                metas, recursos humanos, monitoramento, execução financeira e anexos fotográficos.
                Gera <strong>DOCX + XLSX</strong> simultaneamente no servidor.
              </p>
              <Button onClick={exportarREO} disabled={anyLoading} className="gap-2">
                {loadingReo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                Exportar REO (DOCX + XLSX)
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Relatório Mensal */}
        <TabsContent value="mensal">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5" /> Relatório Mensal Completo
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                XLSX com resumo, atividades, metas por bairro, monitoramento e
                <strong> matrizes de frequência preenchidas</strong> por turma.
                Tenta gerar localmente; se falhar, gera automaticamente no servidor.
              </p>
              <Button onClick={exportarRelatorioMensal} disabled={anyLoading} className="gap-2">
                {loadingRelMensal ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                Exportar Relatório Mensal
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Prestação de Contas */}
        <TabsContent value="pc">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-5 w-5" /> Prestação de Contas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Resumo financeiro, despesas detalhadas com status de comprovação e saldos por categoria.
                Gera <strong>XLSX + PDF</strong> simultaneamente.
              </p>
              <Button onClick={exportarPrestacaoContas} disabled={anyLoading} className="gap-2">
                {loadingPC ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                Exportar Prestação de Contas (PDF + XLSX)
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Atividades em Lote */}
        <TabsContent value="atividades">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ClipboardList className="h-5 w-5" /> Relatórios de Atividades + Listas de Presença
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Exporta todos os relatórios de atividades do período selecionado com listas de presença preenchidas.
                Gera <strong>DOCX + PDF + XLSX</strong> simultaneamente.
              </p>
              <div className="flex flex-wrap gap-3 items-end">
                <div>
                  <Label className="text-xs">Data Início</Label>
                  <Input type="date" value={ativDateFrom} onChange={e => setAtivDateFrom(e.target.value)} className="h-9 text-sm mt-1 w-44" />
                </div>
                <div>
                  <Label className="text-xs">Data Fim</Label>
                  <Input type="date" value={ativDateTo} onChange={e => setAtivDateTo(e.target.value)} className="h-9 text-sm mt-1 w-44" />
                </div>
                <div>
                  <Label className="text-xs">Educador</Label>
                  <Select value={ativEducadorId} onValueChange={setAtivEducadorId}>
                    <SelectTrigger className="w-[200px] mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">Todos</SelectItem>
                      {educadores.map(e => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={exportarAtividadesLote} disabled={anyLoading} className="gap-2">
                {loadingAtividades ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                Exportar Atividades (DOCX + PDF + XLSX)
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Atendimentos Técnicos */}
        <TabsContent value="atendimentos">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-5 w-5" /> Relatório de Atendimentos Técnicos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Exporta os atendimentos técnicos (Assistente Social / Psicólogo) do período selecionado.
                Gera <strong>XLSX + PDF</strong> simultaneamente.
              </p>
              <div className="flex flex-wrap gap-3 items-end">
                <div>
                  <Label className="text-xs">Data Início</Label>
                  <Input type="date" value={atendDateFrom} onChange={e => setAtendDateFrom(e.target.value)} className="h-9 text-sm mt-1 w-44" />
                </div>
                <div>
                  <Label className="text-xs">Data Fim</Label>
                  <Input type="date" value={atendDateTo} onChange={e => setAtendDateTo(e.target.value)} className="h-9 text-sm mt-1 w-44" />
                </div>
              </div>
              <Button onClick={exportarAtendimentosTecnicos} disabled={anyLoading} className="gap-2">
                {loadingAtendimentos ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                Exportar Atendimentos (XLSX + PDF)
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Anual */}
        <TabsContent value="anual">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5" /> Relatório Completo Anual
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                XLSX consolidado com todos os meses que contêm dados — do primeiro registro ao mais recente.
                Inclui aba "Consolidado" com totais gerais. <strong>Gerado no servidor.</strong>
              </p>
              <Button onClick={exportarAnual} disabled={anyLoading} variant="outline" className="gap-2">
                {loadingAnual ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                Exportar Relatório Completo
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Relatório de Gestão */}
        <TabsContent value="gestao">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-5 w-5" /> Relatório de Gestão e Prestação de Contas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Relatório institucional unificado com 8 seções: identificação, público atendido, atividades pedagógicas,
                frequência, atendimentos técnicos, execução financeira, transporte e indicadores de resultado.
                Ideal para <strong>Secretaria de Assistência Social, Controladoria, CRAS e captação de recursos</strong>.
              </p>
              <div className="flex flex-wrap gap-3 items-end">
                <div>
                  <Label className="text-xs">Mês Início</Label>
                  <Select value={gestaoMesInicio} onValueChange={setGestaoMesInicio}>
                    <SelectTrigger className="w-[130px] mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>{MESES.map((m, i) => <SelectItem key={m} value={m}>{MESES_NOMES[i]}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Ano Início</Label>
                  <Input className="w-[90px] mt-1" value={gestaoAnoInicio} onChange={e => setGestaoAnoInicio(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Mês Fim</Label>
                  <Select value={gestaoMesFim} onValueChange={setGestaoMesFim}>
                    <SelectTrigger className="w-[130px] mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>{MESES.map((m, i) => <SelectItem key={m} value={m}>{MESES_NOMES[i]}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Ano Fim</Label>
                  <Input className="w-[90px] mt-1" value={gestaoAnoFim} onChange={e => setGestaoAnoFim(e.target.value)} />
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => exportarGestao("ambos")} disabled={anyLoading} className="gap-2">
                  {loadingGestao ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  Exportar PDF + XLSX
                </Button>
                <Button onClick={() => exportarGestao("pdf")} disabled={anyLoading} variant="outline" className="gap-2">
                  {loadingGestao ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                  Só PDF
                </Button>
                <Button onClick={() => exportarGestao("xlsx")} disabled={anyLoading} variant="outline" className="gap-2">
                  {loadingGestao ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
                  Só XLSX
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
