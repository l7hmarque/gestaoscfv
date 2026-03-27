// Bairros SCFV — os 3 bairros operacionais do serviço
export const BAIRROS_SCFV = ["JARDIM IRENE", "PARQUE INDEPENDENCIA", "ALVORADA"];

export function isBairroSCFV(nome: string): boolean {
  return BAIRROS_SCFV.some(b => b.localeCompare(nome, "pt-BR", { sensitivity: "base" }) === 0);
}
