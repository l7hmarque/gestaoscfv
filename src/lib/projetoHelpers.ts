export const PROJETO_STATUS_LABELS: Record<string, string> = {
  ativo: "Ativo",
  pausado: "Pausado",
  concluido: "Concluído",
  arquivado: "Arquivado",
};

export const PROJETO_STATUS_COLORS: Record<string, string> = {
  ativo: "bg-green-100 text-green-800",
  pausado: "bg-yellow-100 text-yellow-800",
  concluido: "bg-blue-100 text-blue-800",
  arquivado: "bg-gray-200 text-gray-700",
};

export const PRIORIDADE_TAREFA_LABELS: Record<string, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
  urgente: "Urgente",
};

export const PRIORIDADE_TAREFA_COLORS: Record<string, string> = {
  baixa: "bg-gray-100 text-gray-700 border-gray-300",
  media: "bg-blue-100 text-blue-800 border-blue-300",
  alta: "bg-orange-100 text-orange-800 border-orange-300",
  urgente: "bg-red-100 text-red-800 border-red-300",
};

export const PAPEL_LABELS: Record<string, string> = {
  owner: "Dono",
  membro: "Membro",
  observador: "Observador",
};

export const CORES_PROJETO = [
  "#64748b", "#0ea5e9", "#10b981", "#f59e0b",
  "#ef4444", "#a855f7", "#ec4899", "#14b8a6",
];

export function formatDataBR(d: string | null | undefined): string {
  if (!d) return "—";
  const [y, m, day] = d.slice(0, 10).split("-");
  return `${day}/${m}/${y}`;
}

export function diasAteHoje(prazo: string | null | undefined): number | null {
  if (!prazo) return null;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const p = new Date(prazo + "T00:00:00");
  return Math.round((p.getTime() - hoje.getTime()) / 86400000);
}

export function isAtrasada(prazo: string | null | undefined, isConcluida: boolean): boolean {
  if (isConcluida || !prazo) return false;
  const d = diasAteHoje(prazo);
  return d !== null && d < 0;
}
