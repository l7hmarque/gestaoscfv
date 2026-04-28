import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Calendar, AlertTriangle, Link2 } from "lucide-react";
import { PRIORIDADE_TAREFA_COLORS, PRIORIDADE_TAREFA_LABELS, formatDataBR, isAtrasada } from "@/lib/projetoHelpers";
import { Tarefa } from "@/hooks/useProjetoTarefas";

type Props = {
  tarefa: Tarefa & { responsavel?: { nome: string; foto_url: string | null } | null };
  isConcluida: boolean;
  hasDeps: boolean;
  onClick: () => void;
};

export function KanbanCard({ tarefa, isConcluida, hasDeps, onClick }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: tarefa.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };
  const atrasada = isAtrasada(tarefa.prazo, isConcluida);

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className="p-3 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow border-l-2"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-sm font-medium leading-tight line-clamp-2">{tarefa.titulo}</p>
        <Badge variant="outline" className={`text-[10px] shrink-0 ${PRIORIDADE_TAREFA_COLORS[tarefa.prioridade]}`}>
          {PRIORIDADE_TAREFA_LABELS[tarefa.prioridade]}
        </Badge>
      </div>
      {tarefa.tags && tarefa.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {tarefa.tags.slice(0, 3).map(t => (
            <span key={t} className="text-[10px] px-1.5 py-0.5 bg-muted rounded">{t}</span>
          ))}
        </div>
      )}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          {tarefa.prazo && (
            <span className={`flex items-center gap-1 ${atrasada ? "text-destructive font-semibold" : ""}`}>
              <Calendar className="h-3 w-3" />
              {formatDataBR(tarefa.prazo)}
              {atrasada && <AlertTriangle className="h-3 w-3" />}
            </span>
          )}
          {hasDeps && <Link2 className="h-3 w-3" title="Tem dependências" />}
        </div>
        {tarefa.responsavel ? (
          <Avatar className="h-6 w-6">
            <AvatarImage src={tarefa.responsavel.foto_url ?? undefined} />
            <AvatarFallback className="text-[9px]">{tarefa.responsavel.nome.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
        ) : (
          <span className="text-[10px] italic">Sem dono</span>
        )}
      </div>
    </Card>
  );
}
