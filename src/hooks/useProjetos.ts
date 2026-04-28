import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export type Projeto = {
  id: string;
  nome: string;
  descricao: string | null;
  status: string;
  cor: string;
  owner_id: string;
  data_inicio: string | null;
  data_fim_prevista: string | null;
  created_at: string;
  updated_at: string;
};

export type ProjetoComStats = Projeto & {
  total_tarefas: number;
  tarefas_concluidas: number;
  total_membros: number;
  papel_atual?: string | null;
  owner_nome?: string | null;
};

export function useProjetos() {
  return useQuery({
    queryKey: ["projetos-lista"],
    queryFn: async (): Promise<ProjetoComStats[]> => {
      const { data: projs, error } = await (supabase.from as any)("projetos")
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      const projects = (projs ?? []) as Projeto[];
      if (!projects.length) return [];
      const ids = projects.map(p => p.id);

      const [{ data: tarefas }, { data: membros }, { data: colunas }, { data: ownerProfiles }] = await Promise.all([
        (supabase.from as any)("projeto_tarefas").select("projeto_id, coluna_id").in("projeto_id", ids),
        (supabase.from as any)("projeto_membros").select("projeto_id, profile_id, papel").in("projeto_id", ids),
        (supabase.from as any)("projeto_colunas").select("id, projeto_id, is_concluido").in("projeto_id", ids),
        (supabase.from as any)("profiles").select("id, nome").in("id", projects.map(p => p.owner_id)),
      ]);

      const { data: { user } } = await supabase.auth.getUser();
      const { data: meProf } = user
        ? await (supabase.from as any)("profiles").select("id").eq("user_id", user.id).maybeSingle()
        : { data: null };
      const meProfileId = meProf?.id ?? null;

      const colunasMap = new Map<string, boolean>(
        ((colunas ?? []) as any[]).map(c => [c.id, c.is_concluido])
      );
      const ownerNomeMap = new Map<string, string>(
        ((ownerProfiles ?? []) as any[]).map(p => [p.id, p.nome])
      );

      return projects.map(p => {
        const ts = ((tarefas ?? []) as any[]).filter(t => t.projeto_id === p.id);
        const concluidas = ts.filter(t => colunasMap.get(t.coluna_id)).length;
        const ms = ((membros ?? []) as any[]).filter(m => m.projeto_id === p.id);
        const myMembership = meProfileId ? ms.find(m => m.profile_id === meProfileId) : null;
        return {
          ...p,
          total_tarefas: ts.length,
          tarefas_concluidas: concluidas,
          total_membros: ms.length,
          papel_atual: myMembership?.papel ?? null,
          owner_nome: ownerNomeMap.get(p.owner_id) ?? null,
        };
      });
    },
  });
}

export function useCriarProjeto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      nome: string;
      descricao?: string;
      cor?: string;
      data_inicio?: string;
      data_fim_prevista?: string;
      membros_ids?: string[];
    }) => {
      const { data, error } = await (supabase.rpc as any)("criar_projeto", {
        _nome: input.nome,
        _descricao: input.descricao ?? null,
        _cor: input.cor ?? "#64748b",
        _data_inicio: input.data_inicio ?? null,
        _data_fim_prevista: input.data_fim_prevista ?? null,
        _membros_ids: input.membros_ids ?? [],
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projetos-lista"] });
      toast({ title: "Projeto criado", description: "Já pode adicionar tarefas e membros." });
    },
    onError: (e: any) => toast({ title: "Erro ao criar projeto", description: e?.message ?? String(e), variant: "destructive" }),
  });
}

export function useProjeto(id: string | undefined) {
  return useQuery({
    queryKey: ["projeto", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)("projetos").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data as Projeto | null;
    },
  });
}

export function useProjetoStats(id: string | undefined) {
  return useQuery({
    queryKey: ["projeto-stats", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("get_projeto_stats", { _projeto_id: id });
      if (error) throw error;
      return data as any;
    },
  });
}

export function useProjetoMembros(id: string | undefined) {
  return useQuery({
    queryKey: ["projeto-membros", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)("projeto_membros")
        .select("projeto_id, profile_id, papel")
        .eq("projeto_id", id);
      if (error) throw error;
      const rows = (data ?? []) as any[];
      const ids = rows.map(r => r.profile_id);
      if (!ids.length) return [];
      const { data: profs } = await (supabase.from as any)("profiles").select("id, nome, foto_url").in("id", ids);
      const map = new Map<string, any>(((profs ?? []) as any[]).map(p => [p.id, p]));
      return rows.map(r => ({ ...r, profile: map.get(r.profile_id) }));
    },
  });
}
