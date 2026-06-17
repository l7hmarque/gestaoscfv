/**
 * Fonte única de verdade para "quem aparece na chamada de uma turma".
 *
 * Regras (espelham a RPC `get_participantes_turma`):
 *  - Filtra por mês de referência (vínculo na turma + created_at do participante)
 *  - modo 'frequencia' (padrão): inclui ativos + desligados cujo desligamento
 *    ocorreu no mês de referência ou depois (some no mês seguinte ao desligamento)
 *  - modo 'chamada_branco': SOMENTE ativos (sem desligados, sem transferidos,
 *    sem marcadores) — uso para listas em branco para imprimir.
 */
import { supabase } from "@/integrations/supabase/client";

export interface ParticipanteTurma {
  participante_id: string;
  nome: string;
  status: string;
  data_desligamento: string | null;
  desligado_registrado_em: string | null;
  busca_ativa_desde: string | null;
  marcador: string; // "", "(BA)", "(Desligado)", "(Transferido DD/MM para \"X\")"
  bloqueado_chamada: boolean;
  bloqueado_desde: string | null;
  turma_destino_nome: string | null;
  data_transferencia: string | null;
  vinculo_saida: string | null;
  vinculo_entrada: string | null;
}

/**
 * Busca participantes elegíveis para chamada/listas em uma turma.
 *
 * @param turmaId  ID da turma
 * @param refDate  Data de referência (default = hoje). Para listas mensais,
 *                 use o 1º dia do mês.
 */
export type ModoListaParticipantes = "frequencia" | "chamada_branco";

export async function getParticipantesDaTurma(
  turmaId: string,
  refDate?: Date | string,
  modo: ModoListaParticipantes = "frequencia"
): Promise<ParticipanteTurma[]> {
  const ref =
    typeof refDate === "string"
      ? refDate
      : refDate
      ? refDate.toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10);

  const { data, error } = await supabase.rpc("get_participantes_turma", {
    _turma_id: turmaId,
    _ref_date: ref,
    _modo: modo,
  } as any);

  if (error) {
    console.error("[getParticipantesDaTurma]", error);
    throw error;
  }
  return (data || []) as ParticipanteTurma[];
}
