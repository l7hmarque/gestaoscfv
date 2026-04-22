import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface CoordenacaoStats {
  dashboard: any;
  pendencias: any;
  gestao: {
    acoes_pendentes: {
      transferencias_pendentes: number;
      avisos_ativos: number;
      avisos_expirando_7d: number;
      recados_tecnicos_pendentes: number;
      encaminhamentos_abertos_30d: number;
      pendencias_integridade_total: number;
    };
    qualidade: {
      relatorios_mes_atual: number;
      educadores_ativos_mes: number;
      educadores_total: number;
      pct_educadores_ativos: number;
      pct_planej_com_turma: number;
      pct_turmas_com_educador: number;
      tempo_medio_transferencia_dias: number;
    };
    decisoes: {
      proprias_periodo: number;
      equipe_periodo: number;
      exclusoes: number;
      aprovacoes: number;
      desligamentos_validados: number;
    };
    cobertura_metas: Array<{
      bairro: string;
      meta_criancas_manha: number;
      meta_criancas_tarde: number;
      meta_idosos: number;
      real_manha: number;
      real_tarde: number;
      real_total: number;
    }>;
    atividades_periodo?: { count: number; minutos_totais: number };
    data_inicio_operacional: string;
    periodo_dias: number;
  };
}

export function useCoordenacaoData(periodoDias = 30) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["coordenacao-stats", user?.id, periodoDias],
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<CoordenacaoStats> => {
      const { data, error } = await (supabase.rpc as any)("get_coordenacao_stats", {
        _periodo_dias: periodoDias,
      });
      if (error) throw error;
      return data as CoordenacaoStats;
    },
  });
}