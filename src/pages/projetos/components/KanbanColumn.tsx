import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { KanbanCard } from "./KanbanCard";

type Props = {
  coluna: { id: string; nome: string; is_concluido: boolean };
  tarefas: any[];
  depsByTarefa: Record<string, boolean>;
  onAdd: () => void;
  onCardClick: (id: string) => void;
};

export function KanbanColumn({ coluna, tarefas, depsByTarefa, onAdd, onCardClick }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: coluna.id });
  return (
    <div
      ref={setNodeRef}
      className={`w-[280px] shrink-0 bg-muted/30 rounded-md p-2 flex flex-col gap-2 ${isOver ? "ring-2 ring-primary/40" : ""}`}
    >
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide">{coluna.nome}</span>
          <span className="text-[10px] text-muted-foreground">{tarefas.length}</span>
        </div>
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={onAdd}><Plus className="h-3.5 w-3.5" /></Button>
      </div>
      <SortableContext items={tarefas.map(t => t.id)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-2 min-h-[60px]">
          {tarefas.map(t => (
            <KanbanCard
              key={t.id}
              tarefa={t}
              isConcluida={coluna.is_concluido}
              hasDeps={!!depsByTarefa[t.id]}
              onClick={() => onCardClick(t.id)}
            />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}