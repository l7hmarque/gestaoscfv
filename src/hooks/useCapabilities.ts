import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export type ModuleLevel = "none" | "read" | "write" | "admin";

export const ALL_MODULES = [
  "dashboard","participantes","turmas","presenca","planejamentos","relatorios",
  "registros_fotograficos","cronograma","transporte","cozinha","feed",
  "equipe_tecnica","integridade","banco_dados","configuracoes",
  "auditoria","permissoes","site_publico","coordenacao",
] as const;
export type ModuleKey = typeof ALL_MODULES[number];

export const MODULE_LABELS: Record<ModuleKey, string> = {
  dashboard: "Dashboard",
  participantes: "Participantes",
  turmas: "Turmas",
  presenca: "Presença",
  planejamentos: "Planejamentos",
  relatorios: "Relatórios",
  registros_fotograficos: "Registros Fotográficos",
  cronograma: "Cronograma",
  transporte: "Transporte",
  cozinha: "Cozinha",
  feed: "Feed / Mural",
  equipe_tecnica: "Equipe Técnica",
  integridade: "Integridade",
  banco_dados: "Banco de Dados",
  configuracoes: "Configurações",
  auditoria: "Auditoria",
  permissoes: "Permissões",
  site_publico: "Site Público",
  coordenacao: "Coordenação",
};

const SCORE: Record<ModuleLevel, number> = { none: 0, read: 1, write: 2, admin: 3 };

export interface CapabilityRow { module: ModuleKey; level: ModuleLevel; source: string }

export function useCapabilities() {
  const { user } = useAuth();
  const q = useQuery({
    queryKey: ["my-module-access", user?.id],
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<CapabilityRow[]> => {
      const { data, error } = await (supabase as any).rpc("get_my_module_access");
      if (error) throw error;
      return (data ?? []) as CapabilityRow[];
    },
  });

  const map = new Map<string, ModuleLevel>();
  (q.data ?? []).forEach((r) => map.set(r.module, r.level));

  function levelOf(module: ModuleKey): ModuleLevel {
    return map.get(module) ?? "none";
  }
  function can(module: ModuleKey, min: ModuleLevel = "read"): boolean {
    return SCORE[levelOf(module)] >= SCORE[min];
  }
  const isSuperAdmin = (q.data ?? []).some((r) => r.source === "super_admin");

  return { capabilities: q.data ?? [], loading: q.isLoading, can, levelOf, isSuperAdmin, refetch: q.refetch };
}