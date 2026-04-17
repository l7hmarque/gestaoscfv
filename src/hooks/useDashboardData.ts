import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AtividadeRecente {
  id: string;
  nome_atividade: string;
  data: string;
  educador: string;
  num_participantes: number;
}

export interface DashboardData {
  totalParticipantesAtivos: number;
  totalTurmasAtivas: number;
  totalRelatorios: number;
  totalConsolidadosChamada: number;
  totalPlanejamentos: number;
  mediaELO: number;
  mediaELON: number;
  mediaAdesao: number;
  mediaAdesaoConsolidada: number;
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
  presencaMensal: { mes: string; presentes: number; total: number; pct: number; parcial?: boolean }[];
  deltaParticipantes: number;
  atividadesRecentes: AtividadeRecente[];
}

const COMPETENCIA_LABELS: Record<string, string> = {
  iniciativa: "Iniciativa",
  autonomia: "Autonomia",
  colaboracao: "Colaboração",
  comunicacao: "Comunicação",
  respeito_mutuo: "Respeito Mútuo",
};

export function useDashboardData(mes?: number | null, ano?: number | null) {
  const { data, isLoading: loading } = useQuery({
    queryKey: ["dashboard-data", mes, ano],
    queryFn: async (): Promise<DashboardData> => {
      const { data: raw, error } = await supabase.rpc("get_dashboard_stats", {
        _mes: mes ?? null,
        _ano: ano ?? null,
      } as any);
      if (error) throw error;

      const d = raw as any;

      return {
        totalParticipantesAtivos: d.totalParticipantesAtivos ?? 0,
        totalTurmasAtivas: d.totalTurmasAtivas ?? 0,
        totalRelatorios: d.totalRelatorios ?? 0,
        totalPlanejamentos: d.totalPlanejamentos ?? 0,
        mediaELO: Number(d.mediaELO ?? 0),
        mediaAdesao: Number(d.mediaAdesao ?? 0),
        participantesPorFaixa: (d.participantesPorFaixa || []).map((x: any) => ({ faixa: x.faixa, count: Number(x.count) })),
        participantesPorGenero: (d.participantesPorGenero || []).map((x: any) => ({ genero: x.genero, count: Number(x.count) })),
        participantesPorBairro: (d.participantesPorBairro || []).map((x: any) => ({ bairro: x.bairro, count: Number(x.count) })),
        participantesPorPeriodo: (d.participantesPorPeriodo || []).map((x: any) => ({ periodo: x.periodo, count: Number(x.count) })),
        eloMensal: (d.eloMensal || []).map((x: any) => ({ mes: x.mes, elo: Number(x.elo) })),
        adesaoMensal: (d.adesaoMensal || []).map((x: any) => ({ mes: x.mes, adesao: Number(x.adesao) })),
        competencias: Object.entries(d.competencias || {}).map(([key, value]) => ({
          name: COMPETENCIA_LABELS[key] || key,
          value: Number(value),
        })),
        objetivos: (d.objetivos || []).map((x: any) => ({ status: x.status, count: Number(x.count) })),
        taxaFrequenciaGeral: Number(d.taxaFrequenciaGeral ?? 0),
        topEducadores: (d.topEducadores || []).map((x: any) => ({ nome: x.nome, count: Number(x.count) })),
        totalParticipantesAlerta: Number(d.totalParticipantesAlerta ?? 0),
        presencaMensal: (d.presencaMensal || []).map((x: any) => ({
          mes: x.mes,
          presentes: Number(x.presentes),
          total: Number(x.total),
          pct: Number(x.pct),
        })),
        deltaParticipantes: Number(d.deltaParticipantes ?? 0),
        atividadesRecentes: (d.atividadesRecentes || []).map((x: any) => ({
          id: x.id,
          nome_atividade: x.nome_atividade || "Atividade",
          data: x.data,
          educador: x.educador || "Desconhecido",
          num_participantes: Number(x.num_participantes ?? 0),
        })),
      };
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  return { data: data ?? null, loading };
}
