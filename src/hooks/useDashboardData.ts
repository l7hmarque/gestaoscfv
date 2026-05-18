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
  participantesAtivosMesAtual: number;
  participantesAtivosMesAnterior: number;
  deltaParticipantesBase: string | null;
  atividadesRecentes: AtividadeRecente[];
  dataInicioOperacional: string | null;
}

const COMPETENCIA_LABELS: Record<string, string> = {
  iniciativa: "Iniciativa",
  autonomia: "Autonomia",
  colaboracao: "Colaboração",
  comunicacao: "Comunicação",
  respeito_mutuo: "Respeito Mútuo",
};

function objectOrArrayToRows<T extends string>(value: any, keyName: T): Array<Record<T, string> & { count: number }> {
  if (Array.isArray(value)) {
    return value.map((x: any) => ({
      [keyName]: String(x[keyName] ?? x.name ?? x.label ?? "N/I"),
      count: Number(x.count ?? x.total ?? x.value ?? 0),
    } as Record<T, string> & { count: number }));
  }
  if (value && typeof value === "object") {
    return Object.entries(value).map(([key, count]) => ({
      [keyName]: key,
      count: Number(count ?? 0),
    } as Record<T, string> & { count: number }));
  }
  return [];
}

export interface DashboardDimFilters {
  faixa?: string | null;
  genero?: string | null;
  bairroId?: string | null;
  periodo?: string | null;
  idadeMin?: number | null;
  idadeMax?: number | null;
  apenasAtivos?: boolean;
}

export function useDashboardData(
  mes?: number | null,
  ano?: number | null,
  dataInicio?: string | null,
  dataFim?: string | null,
  dim?: DashboardDimFilters,
) {
  const faixa = dim?.faixa ?? null;
  const genero = dim?.genero ?? null;
  const bairroId = dim?.bairroId ?? null;
  const periodo = dim?.periodo ?? null;
  const idadeMin = dim?.idadeMin ?? null;
  const idadeMax = dim?.idadeMax ?? null;
  const apenasAtivos = dim?.apenasAtivos ?? true;
  const { data, isLoading: loading, error } = useQuery({
    queryKey: ["dashboard-data", mes, ano, dataInicio, dataFim, faixa, genero, bairroId, periodo, idadeMin, idadeMax, apenasAtivos],
    queryFn: async (): Promise<DashboardData> => {
      const { data: raw, error } = await supabase.rpc("get_dashboard_stats", {
        _mes: mes ?? null,
        _ano: ano ?? null,
        _data_inicio: dataInicio ?? null,
        _data_fim: dataFim ?? null,
        _faixa: faixa,
        _genero: genero,
        _bairro_id: bairroId,
        _periodo: periodo,
        _idade_min: idadeMin,
        _idade_max: idadeMax,
        _apenas_ativos: apenasAtivos,
      } as any);
      if (error) throw error;

      const d = raw as any;

      return {
        totalParticipantesAtivos: d.totalParticipantesAtivos ?? 0,
        totalTurmasAtivas: d.totalTurmasAtivas ?? 0,
        totalRelatorios: d.totalRelatorios ?? 0,
        totalConsolidadosChamada: d.totalConsolidadosChamada ?? 0,
        totalPlanejamentos: d.totalPlanejamentos ?? 0,
        mediaELO: Number(d.mediaELO ?? 0),
        mediaELON: Number(d.mediaELON ?? 0),
        mediaAdesao: Number(d.mediaAdesao ?? 0),
        mediaAdesaoConsolidada: Number(d.mediaAdesaoConsolidada ?? 0),
        participantesPorFaixa: objectOrArrayToRows(d.participantesPorFaixa, "faixa"),
        participantesPorGenero: objectOrArrayToRows(d.participantesPorGenero, "genero"),
        participantesPorBairro: objectOrArrayToRows(d.participantesPorBairro, "bairro"),
        participantesPorPeriodo: objectOrArrayToRows(d.participantesPorPeriodo, "periodo"),
        eloMensal: (d.eloMensal || []).map((x: any) => ({ mes: x.mes, elo: Number(x.elo ?? x.media ?? 0) })),
        adesaoMensal: (d.adesaoMensal || []).map((x: any) => ({ mes: x.mes, adesao: Number(x.adesao ?? x.media ?? 0) })),
        competencias: Object.entries(d.competencias || {}).map(([key, value]) => ({
          name: COMPETENCIA_LABELS[key] || key,
          value: Number(value),
        })),
        objetivos: objectOrArrayToRows(d.objetivos, "status"),
        taxaFrequenciaGeral: Number(d.taxaFrequenciaGeral ?? 0),
        topEducadores: (d.topEducadores || []).map((x: any) => ({ nome: x.nome, count: Number(x.count ?? x.total ?? 0) })),
        totalParticipantesAlerta: Number(d.totalParticipantesAlerta ?? 0),
        presencaMensal: (d.presencaMensal || []).map((x: any) => ({
          mes: x.mes,
          presentes: Number(x.presentes),
          total: Number(x.total),
          pct: Number(x.pct),
          parcial: Boolean(x.parcial),
        })),
        deltaParticipantes: Number(d.deltaParticipantes ?? 0),
        participantesAtivosMesAtual: Number(d.participantesAtivosMesAtual ?? 0),
        participantesAtivosMesAnterior: Number(d.participantesAtivosMesAnterior ?? 0),
        deltaParticipantesBase: d.deltaParticipantesBase ?? null,
        atividadesRecentes: (d.atividadesRecentes || []).map((x: any) => ({
          id: x.id,
          nome_atividade: x.nome_atividade || "Atividade",
          data: x.data,
          educador: x.educador || "Desconhecido",
          num_participantes: Number(x.num_participantes ?? 0),
        })),
        dataInicioOperacional: d.dataInicioOperacional ?? null,
      };
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  return { data: data ?? null, loading, error };
}
