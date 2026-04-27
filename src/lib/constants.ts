import { differenceInYears } from "date-fns";

// Bairros SCFV — os 3 bairros operacionais do serviço
export const BAIRROS_SCFV = ["JARDIM IRENE", "PARQUE INDEPENDENCIA", "ALVORADA"];

// Labels reutilizáveis — evita duplicação em 8+ arquivos
export const PERIODO_LABELS: Record<string, string> = { manha: "Manhã", tarde: "Tarde", integral: "Integral" };
export const STATUS_LABELS: Record<string, string> = { ativo: "Ativo", desligado: "Desligado", incompleto: "Incompleto", pendente: "Pendente", busca_ativa: "Busca Ativa" };
export const STATUS_COLORS: Record<string, string> = { ativo: "bg-green-100 text-green-800", desligado: "bg-red-100 text-red-800", incompleto: "bg-yellow-100 text-yellow-800", pendente: "bg-blue-100 text-blue-800", busca_ativa: "bg-orange-100 text-orange-800" };
export const FAIXA_LABELS: Record<string, string> = { "6-8": "6-8 anos", "9-11": "9-11 anos", "12-17": "12-17 anos", idosos: "Idosos" };

/** Tipos de Registro da Coordenação (diário operacional) */
export const TIPOS_REGISTRO_COORD = [
  { value: "reuniao", label: "Reunião" },
  { value: "comunicado", label: "Comunicado" },
  { value: "tarefa", label: "Tarefa" },
  { value: "acao_decisao", label: "Ação / Decisão" },
  { value: "visita_tecnica", label: "Visita técnica" },
  { value: "articulacao_rede", label: "Articulação de rede" },
  { value: "formacao_equipe", label: "Formação de equipe" },
  { value: "documento", label: "Documento / Ofício" },
  { value: "evento", label: "Evento" },
  { value: "outro", label: "Outro" },
] as const;

export const STATUS_REGISTRO: Record<string, string> = {
  aberto: "Aberto",
  em_andamento: "Em andamento",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

export const STATUS_REGISTRO_COLORS: Record<string, string> = {
  aberto: "bg-blue-100 text-blue-800",
  em_andamento: "bg-yellow-100 text-yellow-800",
  concluido: "bg-green-100 text-green-800",
  cancelado: "bg-gray-200 text-gray-700",
};

export const PRIORIDADE_REGISTRO: Record<string, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
};

export const PRIORIDADE_REGISTRO_COLORS: Record<string, string> = {
  baixa: "bg-gray-100 text-gray-700",
  media: "bg-blue-100 text-blue-800",
  alta: "bg-red-100 text-red-800",
};

export function tipoRegistroLabel(v: string): string {
  return TIPOS_REGISTRO_COORD.find((t) => t.value === v)?.label ?? v;
}

/** Calcula idade a partir de data de nascimento (reutilizável) */
export function calcAge(dob: string | null): number {
  if (!dob) return 0;
  const b = new Date(dob);
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  if (now.getMonth() < b.getMonth() || (now.getMonth() === b.getMonth() && now.getDate() < b.getDate())) age--;
  return age;
}

/** Formata idade para exibição */
export function displayAge(dob: string | null): string {
  if (!dob) return "—";
  return calcAge(dob) + " anos";
}

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
