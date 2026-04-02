import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/fetchAllRows";

export interface DashboardData {
  totalParticipantesAtivos: number;
  totalTurmasAtivas: number;
  totalRelatorios: number;
  totalPlanejamentos: number;
  mediaELO: number;
  mediaAdesao: number;
  participantesPorFaixa: { faixa: string; count: number }[];
  participantesPorGenero: { genero: string; count: number }[];
  participantesPorBairro: { bairro: string; count: number }[];
  participantesPorPeriodo: { periodo: string; count: number }[];
  eloMensal: { mes: string; elo: number }[];
  adesaoMensal: { mes: string; adesao: number }[];
  competencias: { name: string; value: number }[];
  objetivos: { status: string; count: number }[];
  taxaFrequenciaGeral: number;
  topEducadores: { nome: string; count: number }[];
  totalParticipantesAlerta: number;
}

function calcAge(dob: string): number {
  const b = new Date(dob);
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  if (now.getMonth() < b.getMonth() || (now.getMonth() === b.getMonth() && now.getDate() < b.getDate())) age--;
  return age;
}

function faixaFromAge(age: number): string {
  if (age <= 8) return "6-8";
  if (age <= 11) return "9-11";
  if (age <= 17) return "12-17";
  return "60+";
}

function monthKey(d: string) {
  return d.slice(0, 7);
}

const PERIODO_LABELS: Record<string, string> = { manha: "Manhã", tarde: "Tarde", integral: "Integral" };

export function useDashboardData() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  const load = async () => {
    const [parts_raw, turmas_raw, rels, plans, bairrosData, presencaAll] = await Promise.all([
      fetchAllRows("participantes", { select: "*" }),
      fetchAllRows("turmas", { select: "*" }),
      fetchAllRows("relatorios_atividade", { select: "*, profiles!relatorios_atividade_educador_id_fkey(nome)", order: { column: "data" } }),
      fetchAllRows("planejamentos", { select: "*" }),
      fetchAllRows("bairros", { select: "id, nome" }),
      fetchAllRows("presenca", { select: "id, presente" }),
    ]);

    const parts = (parts_raw || []).filter((p: any) => p.status === "ativo");
    const turmas = (turmas_raw || []).filter((t: any) => t.ativa);
    const rels = rRes.data || [];
    const plans = plRes.data || [];
    const presencaAll = presRes.data || [];
    const bairrosMap: Record<string, string> = {};
    (bRes.data || []).forEach((b: any) => { bairrosMap[b.id] = b.nome; });

    // Faixa etária
    const faixaMap: Record<string, number> = {};
    parts.forEach((p: any) => {
      if (p.data_nascimento) {
        const f = faixaFromAge(calcAge(p.data_nascimento));
        faixaMap[f] = (faixaMap[f] || 0) + 1;
      }
    });

    // Gênero
    const generoMap: Record<string, number> = {};
    parts.forEach((p: any) => {
      const g = p.genero || "Não informado";
      generoMap[g] = (generoMap[g] || 0) + 1;
    });

    // Bairro SCFV
    const bairroMap: Record<string, number> = {};
    parts.forEach((p: any) => {
      const b = p.bairro_id ? (bairrosMap[p.bairro_id] || "Não informado") : "Não informado";
      bairroMap[b] = (bairroMap[b] || 0) + 1;
    });

    // Período
    const periodoMap: Record<string, number> = {};
    parts.forEach((p: any) => {
      const per = p.periodo || "manha";
      const label = PERIODO_LABELS[per] || per;
      periodoMap[label] = (periodoMap[label] || 0) + 1;
    });

    // ELO mensal
    const eloByMonth: Record<string, number[]> = {};
    const adesaoByMonth: Record<string, number[]> = {};
    const compTotals = { iniciativa: [] as number[], autonomia: [] as number[], colaboracao: [] as number[], comunicacao: [] as number[], respeito_mutuo: [] as number[] };
    const objMap: Record<string, number> = {};
    const educadorCount: Record<string, number> = {};

    rels.forEach((r: any) => {
      const mk = monthKey(r.data);
      if (r.score_elo != null) {
        if (!eloByMonth[mk]) eloByMonth[mk] = [];
        eloByMonth[mk].push(Number(r.score_elo));
      }
      if (r.pct_adesao != null) {
        if (!adesaoByMonth[mk]) adesaoByMonth[mk] = [];
        adesaoByMonth[mk].push(Number(r.pct_adesao));
      }
      if (r.iniciativa != null) compTotals.iniciativa.push(r.iniciativa);
      if (r.autonomia != null) compTotals.autonomia.push(r.autonomia);
      if (r.colaboracao != null) compTotals.colaboracao.push(r.colaboracao);
      if (r.comunicacao != null) compTotals.comunicacao.push(r.comunicacao);
      if (r.respeito_mutuo != null) compTotals.respeito_mutuo.push(r.respeito_mutuo);
      if (r.objetivo_alcancado) objMap[r.objetivo_alcancado] = (objMap[r.objetivo_alcancado] || 0) + 1;
      const edName = r.profiles?.nome || "Desconhecido";
      educadorCount[edName] = (educadorCount[edName] || 0) + 1;
    });

    const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
    const allElo = rels.filter((r: any) => r.score_elo != null).map((r: any) => Number(r.score_elo));
    const allAdesao = rels.filter((r: any) => r.pct_adesao != null).map((r: any) => Number(r.pct_adesao));

    // Frequência geral
    const totalPresencaRecords = presencaAll.length;
    const totalPresentes = presencaAll.filter((p: any) => p.presente).length;
    const taxaFrequencia = totalPresencaRecords > 0 ? (totalPresentes / totalPresencaRecords) * 100 : 0;

    // Top educadores
    const topEd = Object.entries(educadorCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([nome, count]) => ({ nome, count }));

    setData({
      totalParticipantesAtivos: parts.length,
      totalTurmasAtivas: turmas.length,
      totalRelatorios: rels.length,
      totalPlanejamentos: plans.length,
      mediaELO: avg(allElo),
      mediaAdesao: avg(allAdesao),
      participantesPorFaixa: Object.entries(faixaMap).map(([faixa, count]) => ({ faixa, count })),
      participantesPorGenero: Object.entries(generoMap).map(([genero, count]) => ({ genero, count })),
      participantesPorBairro: Object.entries(bairroMap).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([bairro, count]) => ({ bairro, count })),
      participantesPorPeriodo: Object.entries(periodoMap).map(([periodo, count]) => ({ periodo, count })),
      eloMensal: Object.entries(eloByMonth).sort().map(([mes, vals]) => ({ mes, elo: Number(avg(vals).toFixed(2)) })),
      adesaoMensal: Object.entries(adesaoByMonth).sort().map(([mes, vals]) => ({ mes, adesao: Number(avg(vals).toFixed(1)) })),
      competencias: [
        { name: "Iniciativa", value: Number(avg(compTotals.iniciativa).toFixed(2)) },
        { name: "Autonomia", value: Number(avg(compTotals.autonomia).toFixed(2)) },
        { name: "Colaboração", value: Number(avg(compTotals.colaboracao).toFixed(2)) },
        { name: "Comunicação", value: Number(avg(compTotals.comunicacao).toFixed(2)) },
        { name: "Respeito Mútuo", value: Number(avg(compTotals.respeito_mutuo).toFixed(2)) },
      ],
      objetivos: Object.entries(objMap).map(([status, count]) => ({ status, count })),
      taxaFrequenciaGeral: Number(taxaFrequencia.toFixed(1)),
      topEducadores: topEd,
      totalParticipantesAlerta: 0, // calculated in turma page
    });
    setLoading(false);
  };

  return { data, loading };
}
