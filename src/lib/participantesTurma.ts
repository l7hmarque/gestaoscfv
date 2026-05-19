/**
 * Fonte única de verdade para "quem aparece na chamada de uma turma".
 *
 * Regras (espelham a RPC `get_participantes_turma`):
 *  - Inclui status: ativo, cadastro_incompleto, busca_ativa
 *  - Inclui desligados cujo registro de desligamento ocorreu há ≤ 30 dias
 *    da `refDate` (campo `desligado_registrado_em`)
 *  - Inclui transferidos com marcador completo se transferência foi
 *    nos últimos 30 dias
 *  - NÃO filtra por `data_saida` ou `data_entrada` do vínculo
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
}

/**
 * Busca participantes elegíveis para chamada/listas em uma turma.
 *
 * @param turmaId  ID da turma
 * @param refDate  Data de referência (default = hoje). Para listas mensais,
 *                 use o 1º dia do mês.
 */
export async function getParticipantesDaTurma(
  turmaId: string,
  refDate?: Date | string
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
  });

  if (error) {
    console.error("[getParticipantesDaTurma]", error);
    throw error;
  }
  return (data || []) as ParticipanteTurma[];
}
