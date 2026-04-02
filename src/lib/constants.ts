import { differenceInYears } from "date-fns";

// Bairros SCFV — os 3 bairros operacionais do serviço
export const BAIRROS_SCFV = ["JARDIM IRENE", "PARQUE INDEPENDENCIA", "ALVORADA"];

export function isBairroSCFV(nome: string): boolean {
  return BAIRROS_SCFV.some(b => b.localeCompare(nome, "pt-BR", { sensitivity: "base" }) === 0);
}

/** Tipos de atividade estruturados */
export const TIPOS_ATIVIDADE = [
  { value: "momento_educando", label: "Momento Educando" },
  { value: "evento", label: "Evento ou Data Comemorativa", hasDetail: true },
  { value: "socioeducativa_idosos", label: "Atividade Socioeducativa (Idosos)" },
  { value: "colonia_ferias", label: "Atividade de Colônia de Férias" },
  { value: "arte_cultura", label: "Oficina de Arte e Cultura" },
  { value: "futebol_esportes", label: "Oficina de Futebol e Outros Esportes / Recreativo" },
  { value: "karate", label: "Oficina de Karatê" },
  { value: "outra_oficina", label: "Outra Oficina", hasDetail: true },
] as const;

/** Opções de oficina para vincular a turmas */
export const OFICINAS_TURMA = TIPOS_ATIVIDADE.filter(t =>
  ["arte_cultura", "futebol_esportes", "karate", "outra_oficina"].includes(t.value)
);

/** Helper: converte array de values em labels */
export function tipoAtividadeLabels(values: string[], detalhe?: string | null): string {
  return values.map(v => {
    const item = TIPOS_ATIVIDADE.find(t => t.value === v);
    if (!item) return v;
    if (item.value === "evento" && detalhe) return `${item.label}: ${detalhe}`;
    if (item.value === "outra_oficina" && detalhe) return `${item.label}: ${detalhe}`;
    return item.label;
  }).join(", ");
}

/** Calcula faixa etária a partir da data de nascimento */
export const calcFaixaFromDate = (dataNascimento: string | null): string => {
  if (!dataNascimento) return "";
  const age = differenceInYears(new Date(), new Date(dataNascimento));
  if (age >= 6 && age <= 8) return "6-8";
  if (age >= 9 && age <= 11) return "9-11";
  if (age >= 12 && age <= 17) return "12-17";
  if (age >= 60) return "idosos";
  return "";
};
