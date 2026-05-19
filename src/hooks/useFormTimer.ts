import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

type Tipo =
  | "relatorio" | "planejamento" | "presenca"
  | "edicao_relatorio" | "edicao_planejamento" | "edicao_presenca"
  | "atendimento" | "edicao_atendimento"
  | "encaminhamento" | "edicao_encaminhamento"
  | "busca_ativa" | "edicao_busca_ativa"
  | "roteiro_visita" | "edicao_roteiro_visita";

/**
 * Cronômetro invisível para formulários. Mede do mount até a chamada de `stop(registroId)`.
 * Resultado vai para user_action_durations — lido só por coordenação.
 */
export function useFormTimer(tipo: Tipo) {
  const { user } = useAuth();
  const location = useLocation();
  const startRef = useRef<number>(Date.now());
  const sentRef = useRef(false);

  useEffect(() => {
    startRef.current = Date.now();
    sentRef.current = false;
  }, [tipo]);

  const stop = async (registroId?: string) => {
    if (sentRef.current || !user?.id) return;
    sentRef.current = true;
    const inicio = new Date(startRef.current).toISOString();
    const dur = Math.max(1, Math.round((Date.now() - startRef.current) / 1000));
    try {
      await (supabase.from as any)("user_action_durations").insert({
        user_id: user.id,
        tipo,
        registro_id: registroId ?? null,
        iniciado_em: inicio,
        duracao_segundos: dur,
        rota: location.pathname,
      });
    } catch {
      // silencioso
    }
  };

  /** Reinicia o cronômetro (útil quando o mesmo componente reabre um diálogo). */
  const start = () => {
    startRef.current = Date.now();
    sentRef.current = false;
  };

  return { stop, start };
}