/**
 * Marcadores institucionais padronizados de frequência.
 *
 * Aplicados em TODOS os formatos: DOCX, PDF, XLSX e Google Sheets.
 *
 * Células da matriz de presença:
 *   P  presente
 *   A  ausente
 *   J  ausência justificada
 *   —  sem aula / desligado / pós-transferência (data ≥ corte)
 *   "" (vazio) → ainda não lançado
 *
 * Rótulos no nome do participante (em parênteses, após o nome):
 *   (BA)                                          em busca ativa
 *   (Desligado)                                   desligado (≤ 30 dias do registro)
 *   (Transferido DD/MM para "TURMA DESTINO")      transferido recentemente
 */

export const MARCADOR_PRESENTE = "P";
export const MARCADOR_AUSENTE = "A";
export const MARCADOR_JUSTIFICADA = "J";
export const MARCADOR_BLOQUEADO = "—";
export const MARCADOR_VAZIO = "";

export type CelulaPresenca =
  | typeof MARCADOR_PRESENTE
  | typeof MARCADOR_AUSENTE
  | typeof MARCADOR_JUSTIFICADA
  | typeof MARCADOR_BLOQUEADO
  | typeof MARCADOR_VAZIO;

export interface CelulaInput {
  /** true = presente, false = ausente, null/undefined = não lançado */
  presente?: boolean | null;
  /** se houver justificativa não-vazia e ausente, vira "J" */
  justificativa?: string | null;
  /** data desta célula no formato YYYY-MM-DD */
  data?: string;
  /** datas a partir da qual o participante está bloqueado (desligado/transferido) */
  bloqueadoDesde?: string | null;
  /** se o participante está globalmente bloqueado para chamada */
  bloqueado?: boolean;
}

/** Resolve o símbolo de uma célula da matriz de presença. */
export function celulaPresenca(input: CelulaInput): CelulaPresenca {
  const { presente, justificativa, data, bloqueadoDesde, bloqueado } = input;

  if (bloqueado && data && bloqueadoDesde && data >= bloqueadoDesde) {
    return MARCADOR_BLOQUEADO;
  }
  if (presente === true) return MARCADOR_PRESENTE;
  if (presente === false) {
    if (justificativa && justificativa.trim().length > 0) {
      return MARCADOR_JUSTIFICADA;
    }
    return MARCADOR_AUSENTE;
  }
  return MARCADOR_VAZIO;
}

/** Aplica marcador institucional ao nome do participante. */
export function rotularNomeParticipante(
  nome: string,
  marcador?: string | null
): string {
  const m = (marcador || "").trim();
  if (!m) return nome;
  return `${nome} ${m}`;
}

/** Legenda padronizada (para topo/rodapé de relatórios). */
export const LEGENDA_MARCADORES =
  "P presente · A ausente · J ausência justificada · — sem aula/desligado · " +
  "(BA) busca ativa · (Desligado) desligado · (Transferido DD/MM para \"Turma\") transferido";
