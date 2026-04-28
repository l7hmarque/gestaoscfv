import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export type Coluna = {
  id: string;
  projeto_id: string;
  nome: string;
  ordem: number;
  cor: string | null;
  is_concluido: boolean;
};

export type Tarefa = {
  id: string;
  projeto_id: string;
  coluna_id: string;
  titulo: string;
  descricao: string | null;
  responsavel_id: string | null;
  criador_id: string;
  prioridade: string;
  data_inicio: string | null;
  prazo: string | null;
  duracao_estimada_horas: number | null;
  progresso_pct: number;
  ordem_kanban: number;
  tags: string[] | null;
  concluido_em: string | null;
  created_at: string;
  updated_at: string;
};

export function useProjetoColunas(projeto_id: string | undefined) {
  return useQuery({
    queryKey: ["projeto-colunas", projeto_id],
    enabled: !!projeto_id,
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)("projeto_colunas")
        .select("*")
        .eq("projeto_id", projeto_id)
        .order("ordem");
      if (error) throw error;
      return (data ?? []) as Coluna[];
    },
  });
}

export function useProjetoTarefas(projeto_id: string | undefined) {
  return useQuery({
    queryKey: ["projeto-tarefas", projeto_id],
    enabled: !!projeto_id,
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)("projeto_tarefas")
        .select("*")
        .eq("projeto_id", projeto_id)
        .order("ordem_kanban");
      if (error) throw error;
      const tarefas = (data ?? []) as Tarefa[];
      const respIds = Array.from(new Set(tarefas.map(t => t.responsavel_id).filter(Boolean) as string[]));
      let respMap = new Map<string, { nome: string; foto_url: string | null }>();
      if (respIds.length) {
        const { data: profs } = await (supabase.from as any)("profiles").select("id, nome, foto_url").in("id", respIds);
        respMap = new Map(((profs ?? []) as any[]).map(p => [p.id, p]));
      }
      return tarefas.map(t => ({
        ...t,
        responsavel: t.responsavel_id ? respMap.get(t.responsavel_id) ?? null : null,
      }));
    },
  });
}

export function useProjetoDependencias(projeto_id: string | undefined) {
  return useQuery({
    queryKey: ["projeto-deps", projeto_id],
    enabled: !!projeto_id,
    queryFn: async () => {
      // Busca todas as tarefas do projeto e depois suas deps
      const { data: tarefas } = await (supabase.from as any)("projeto_tarefas").select("id").eq("projeto_id", projeto_id);
      const ids = ((tarefas ?? []) as any[]).map(t => t.id);
      if (!ids.length) return [];
      const { data, error } = await (supabase.from as any)("projeto_tarefa_dependencias")
        .select("*")
        .in("tarefa_id", ids);
      if (error) throw error;
      return (data ?? []) as { tarefa_id: string; depende_de_id: string; tipo: string }[];
    },
  });
}

export function useCriarTarefa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<Tarefa> & { projeto_id: string; coluna_id: string; titulo: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const { data: prof } = await (supabase.from as any)("profiles").select("id").eq("user_id", user.id).maybeSingle();
      if (!prof) throw new Error("Perfil não encontrado");
      const payload = { ...input, criador_id: prof.id };
      const { data, error } = await (supabase.from as any)("projeto_tarefas").insert(payload).select().single();
      if (error) throw error;
      // Notifica responsável via recado técnico
      if (input.responsavel_id && input.responsavel_id !== prof.id) {
        const { data: respUser } = await (supabase.from as any)("profiles").select("user_id").eq("id", input.responsavel_id).maybeSingle();
        if (respUser?.user_id) {
          await (supabase.from as any)("recados").insert({
            remetente_id: user.id,
            destinatario_id: respUser.user_id,
            conteudo: `📌 Nova tarefa atribuída: "${input.titulo}"${input.prazo ? ` — prazo ${input.prazo.split('-').reverse().join('/')}` : ""}`,
            status: "pendente",
            tipo_recado: "tecnico",
          });
        }
      }
      return data;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["projeto-tarefas", vars.projeto_id] });
      qc.invalidateQueries({ queryKey: ["projeto-stats", vars.projeto_id] });
      qc.invalidateQueries({ queryKey: ["projetos-lista"] });
      toast({ title: "Tarefa criada" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e?.message ?? String(e), variant: "destructive" }),
  });
}

export function useAtualizarTarefa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, projeto_id, ...patch }: Partial<Tarefa> & { id: string; projeto_id: string }) => {
      const { data, error } = await (supabase.from as any)("projeto_tarefas").update(patch).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["projeto-tarefas", vars.projeto_id] });
      qc.invalidateQueries({ queryKey: ["projeto-stats", vars.projeto_id] });
    },
    onError: (e: any) => toast({ title: "Erro ao atualizar", description: e?.message ?? String(e), variant: "destructive" }),
  });
}

export function useExcluirTarefa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, projeto_id: _p }: { id: string; projeto_id: string }) => {
      const { error } = await (supabase.from as any)("projeto_tarefas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["projeto-tarefas", vars.projeto_id] });
      qc.invalidateQueries({ queryKey: ["projeto-stats", vars.projeto_id] });
    },
  });
}
