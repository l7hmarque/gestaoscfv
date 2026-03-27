import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

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
  eloMensal: { mes: string; elo: number }[];
  adesaoMensal: { mes: string; adesao: number }[];
  competencias: { name: string; value: number }[];
  objetivos: { status: string; count: number }[];
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
  return d.slice(0, 7); // YYYY-MM
}

export function useDashboardData() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  const load = async () => {
    const [pRes, tRes, rRes, plRes] = await Promise.all([
      supabase.from("participantes").select("*"),
      supabase.from("turmas").select("*"),
      supabase.from("relatorios_atividade").select("*").order("data"),
      supabase.from("planejamentos").select("*"),
    ]);

    const parts = (pRes.data || []).filter((p: any) => p.status === "ativo");
    const turmas = (tRes.data || []).filter((t: any) => t.ativa);
    const rels = rRes.data || [];
    const plans = plRes.data || [];

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

    // Bairro
    const bairroMap: Record<string, number> = {};
    parts.forEach((p: any) => {
      const b = p.endereco_bairro || "Não informado";
      bairroMap[b] = (bairroMap[b] || 0) + 1;
    });

    // ELO mensal
    const eloByMonth: Record<string, number[]> = {};
    const adesaoByMonth: Record<string, number[]> = {};
    const compTotals = { iniciativa: [] as number[], autonomia: [] as number[], colaboracao: [] as number[], comunicacao: [] as number[], respeito_mutuo: [] as number[] };
    const objMap: Record<string, number> = {};

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
    });

    const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
    const allElo = rels.filter((r: any) => r.score_elo != null).map((r: any) => Number(r.score_elo));
    const allAdesao = rels.filter((r: any) => r.pct_adesao != null).map((r: any) => Number(r.pct_adesao));

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
    });
    setLoading(false);
  };

  return { data, loading };
}
