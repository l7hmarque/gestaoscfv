import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export type RoteiroVisita = {
  id: string;
  titulo: string;
  data_visita: string;
  horario_saida: string | null;
  observacoes: string | null;
  responsaveis: string[] | null;
  veiculo: string | null;
  status: "rascunho" | "em_andamento" | "concluido";
  criado_por: string | null;
  concluido_em: string | null;
  created_at: string;
  updated_at: string;
};

export type RoteiroVisitaItem = {
  id: string;
  roteiro_id: string;
  participante_id: string;
  bairro_nome: string | null;
  origem: "busca_ativa" | "matricula_pendente";
  ordem: number;
  status_visita: "pendente" | "realizada" | "nao_atendido" | "recusou" | "endereco_nao_encontrado";
  relato: string | null;
  horario_realizado: string | null;
  atendimento_id: string | null;
};

export const STATUS_VISITA_LABELS: Record<string, string> = {
  pendente: "Pendente",
  realizada: "Realizada",
  nao_atendido: "Não atendido",
  recusou: "Recusou",
  endereco_nao_encontrado: "Endereço não localizado",
};

export const STATUS_VISITA_COLORS: Record<string, string> = {
  pendente: "bg-gray-100 text-gray-700 border-gray-300",
  realizada: "bg-green-100 text-green-800 border-green-300",
  nao_atendido: "bg-yellow-100 text-yellow-800 border-yellow-300",
  recusou: "bg-red-100 text-red-800 border-red-300",
  endereco_nao_encontrado: "bg-orange-100 text-orange-800 border-orange-300",
};

export const STATUS_ROTEIRO_LABELS: Record<string, string> = {
  rascunho: "Rascunho",
  em_andamento: "Em andamento",
  concluido: "Concluído",
};

export const STATUS_ROTEIRO_COLORS: Record<string, string> = {
  rascunho: "bg-gray-100 text-gray-700",
  em_andamento: "bg-blue-100 text-blue-800",
  concluido: "bg-green-100 text-green-800",
};

export function useRoteiros() {
  return useQuery({
    queryKey: ["roteiros-visita"],
    queryFn: async (): Promise<(RoteiroVisita & { total: number; realizadas: number })[]> => {
      const { data: roteiros, error } = await (supabase.from as any)("roteiros_visita")
        .select("*").order("data_visita", { ascending: false });
      if (error) throw error;
      const lst = (roteiros ?? []) as RoteiroVisita[];
      if (!lst.length) return [];
      const ids = lst.map(r => r.id);
      const { data: visitas } = await (supabase.from as any)("roteiro_visitas")
        .select("roteiro_id, status_visita").in("roteiro_id", ids);
      const stats: Record<string, { total: number; realizadas: number }> = {};
      (visitas ?? []).forEach((v: any) => {
        if (!stats[v.roteiro_id]) stats[v.roteiro_id] = { total: 0, realizadas: 0 };
        stats[v.roteiro_id].total++;
        if (v.status_visita === "realizada") stats[v.roteiro_id].realizadas++;
      });
      return lst.map(r => ({ ...r, total: stats[r.id]?.total ?? 0, realizadas: stats[r.id]?.realizadas ?? 0 }));
    },
  });
}

export function useRoteiro(id: string | undefined) {
  return useQuery({
    enabled: !!id,
    queryKey: ["roteiro-visita", id],
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)("roteiros_visita").select("*").eq("id", id).single();
      if (error) throw error;
      return data as RoteiroVisita;
    },
  });
}

export function useRoteiroVisitas(roteiroId: string | undefined) {
  return useQuery({
    enabled: !!roteiroId,
    queryKey: ["roteiro-visitas", roteiroId],
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)("roteiro_visitas")
        .select("*").eq("roteiro_id", roteiroId).order("ordem");
      if (error) throw error;
      return (data ?? []) as RoteiroVisitaItem[];
    },
  });
}

export function useAtualizarVisita() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<RoteiroVisitaItem> & { id: string }) => {
      const { id, ...rest } = payload;
      const { error } = await (supabase.from as any)("roteiro_visitas").update(rest).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["roteiro-visitas"] });
      qc.invalidateQueries({ queryKey: ["roteiros-visita"] });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });
}

export function useAtualizarRoteiro() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<RoteiroVisita> & { id: string }) => {
      const { id, ...rest } = payload;
      const { error } = await (supabase.from as any)("roteiros_visita").update(rest).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["roteiros-visita"] });
      qc.invalidateQueries({ queryKey: ["roteiro-visita"] });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });
}

export function useExcluirRoteiro() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from as any)("roteiros_visita").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["roteiros-visita"] });
      toast({ title: "Roteiro excluído" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });
}