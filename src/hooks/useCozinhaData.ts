import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CozinhaStats {
  estoque_baixo: number;
  vencendo_7d: number;
  vencidos: number;
  total_itens: number;
  valor_estoque: number;
  total_restricoes: number;
  top_consumo_30d: { nome: string; total: number }[];
  refeicoes_hoje: { manha: number; tarde: number };
  proximas_refeicoes: { dia_semana: number; refeicao: string; prato: string }[];
  semana_inicio: string;
}

export interface ParticipanteRestricao {
  id: string;
  nome: string;
  idade: number | null;
  periodo: string | null;
  bairro: string | null;
  foto_url: string | null;
  restricao_alimentar: string | null;
  remedio_continuo: string | null;
  outras_condicoes: string | null;
  turmas: { id: string; nome: string; dias_semana: string[] }[];
  dias_frequenta: string[];
  sem_turma: boolean;
}

export function useCozinhaStats() {
  return useQuery({
    queryKey: ["cozinha-stats"],
    queryFn: async (): Promise<CozinhaStats> => {
      const { data, error } = await supabase.rpc("get_cozinha_stats" as any);
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data as CozinhaStats;
    },
  });
}

export function useRestricoesAlimentares() {
  return useQuery({
    queryKey: ["cozinha-restricoes"],
    queryFn: async (): Promise<ParticipanteRestricao[]> => {
      const { data, error } = await supabase.rpc("get_restricoes_alimentares" as any);
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return ((data as any)?.participantes ?? []) as ParticipanteRestricao[];
    },
  });
}

export function useInsumos() {
  return useQuery({
    queryKey: ["cozinha-insumos"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("cozinha_insumos").select("*").order("nome");
      if (error) throw error;
      return data as any[];
    },
  });
}

export function useMovimentacoes() {
  return useQuery({
    queryKey: ["cozinha-movimentacoes"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("cozinha_movimentacoes")
        .select("*, insumo:cozinha_insumos(nome,unidade), responsavel:profiles(nome)")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data as any[];
    },
  });
}

export function useCardapio(semanaInicio: string) {
  return useQuery({
    queryKey: ["cozinha-cardapio", semanaInicio],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("cozinha_cardapio")
        .select("*")
        .eq("semana_inicio", semanaInicio);
      if (error) throw error;
      return data as any[];
    },
  });
}

export function getCategoriaRestricao(texto: string | null): { label: string; cor: string; grave: boolean } {
  if (!texto) return { label: "Outros", cor: "muted", grave: false };
  const t = texto.toLowerCase();
  const grave = /anafil|alergia grave|epipen/i.test(texto);
  if (/lactose|leite|laticín/.test(t)) return { label: "Lactose", cor: "amber", grave };
  if (/glúten|gluten|trigo/.test(t)) return { label: "Glúten", cor: "amber", grave };
  if (/alergia|amendoim|castanha|nozes|frutos do mar/.test(t)) return { label: "Alergia", cor: "red", grave: true };
  if (/vegetarian|vegan/.test(t)) return { label: "Vegetariano", cor: "green", grave: false };
  if (/diabet/.test(t)) return { label: "Diabetes", cor: "blue", grave };
  return { label: "Outros", cor: "muted", grave };
}

export const DIAS_SEMANA = [
  { num: 1, key: "seg", label: "Segunda" },
  { num: 2, key: "ter", label: "Terça" },
  { num: 3, key: "qua", label: "Quarta" },
  { num: 4, key: "qui", label: "Quinta" },
  { num: 5, key: "sex", label: "Sexta" },
];

export const REFEICOES = [
  { key: "cafe", label: "Café da Manhã" },
  { key: "almoco", label: "Almoço" },
  { key: "lanche", label: "Lanche da Tarde" },
];