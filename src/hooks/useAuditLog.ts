import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCallback } from "react";

export function useAuditLog() {
  const { user } = useAuth();

  const log = useCallback(async (params: {
    acao: string;
    tabela: string;
    registro_id?: string;
    detalhes?: string;
    justificativa?: string;
    user_nome?: string;
  }) => {
    if (!user) return;
    // Get profile name
    let nome = params.user_nome;
    if (!nome) {
      const { data } = await supabase.from("profiles").select("nome").eq("user_id", user.id).single();
      nome = data?.nome || user.email || "Desconhecido";
    }
    await (supabase.from as any)("audit_log").insert({
      user_id: user.id,
      user_nome: nome,
      acao: params.acao,
      tabela: params.tabela,
      registro_id: params.registro_id || null,
      detalhes: params.detalhes || null,
      justificativa: params.justificativa || null,
    });
  }, [user]);

  return { log };
}
