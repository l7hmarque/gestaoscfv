import { differenceInYears } from "date-fns";

// Bairros SCFV — os 3 bairros operacionais do serviço
export const BAIRROS_SCFV = ["JARDIM IRENE", "PARQUE INDEPENDENCIA", "ALVORADA"];

export function isBairroSCFV(nome: string): boolean {
  return BAIRROS_SCFV.some(b => b.localeCompare(nome, "pt-BR", { sensitivity: "base" }) === 0);
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
