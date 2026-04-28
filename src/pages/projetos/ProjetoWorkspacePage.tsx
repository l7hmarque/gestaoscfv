import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Loader2, Plus, Trash2, UserPlus } from "lucide-react";
import { DndContext, DragEndEvent, PointerSensor, useSensor, useSensors, closestCorners } from "@dnd-kit/core";
import { useProjeto, useProjetoStats, useProjetoMembros } from "@/hooks/useProjetos";
import { useProjetoColunas, useProjetoTarefas, useProjetoDependencias, useCriarTarefa, useAtualizarTarefa } from "@/hooks/useProjetoTarefas";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { KanbanColumn } from "./components/KanbanColumn";
import { TarefaSheet } from "./components/TarefaSheet";
import { GanttChart } from "./components/GanttChart";
import { PROJETO_STATUS_COLORS, PROJETO_STATUS_LABELS, PRIORIDADE_TAREFA_COLORS, PRIORIDADE_TAREFA_LABELS, PAPEL_LABELS, formatDataBR, isAtrasada } from "@/lib/projetoHelpers";

export default function ProjetoWorkspacePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState("visao");
  const [tarefaAberta, setTarefaAberta] = useState<string | null>(null);

  const { data: projeto, isLoading } = useProjeto(id);
  const { data: stats } = useProjetoStats(id);
  const { data: colunas } = useProjetoColunas(id);
  const { data: tarefas } = useProjetoTarefas(id);
  const { data: deps } = useProjetoDependencias(id);
  const { data: membros, refetch: refetchMembros } = useProjetoMembros(id);
  const criarTarefa = useCriarTarefa();
  const atualizarTarefa = useAtualizarTarefa();

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const tarefasPorColuna = useMemo(() => {
    const m: Record<string, any[]> = {};
    (colunas ?? []).forEach(c => { m[c.id] = []; });
    (tarefas ?? []).forEach(t => { if (m[t.coluna_id]) m[t.coluna_id].push(t); });
    Object.values(m).forEach(arr => arr.sort((a, b) => a.ordem_kanban - b.ordem_kanban));
    return m;
  }, [colunas, tarefas]);

  const depsByTarefa = useMemo(() => {
    const m: Record<string, boolean> = {};
    (deps ?? []).forEach(d => { m[d.tarefa_id] = true; });
    return m;
  }, [deps]);

  const onDragEnd = async (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const tarefaId = String(active.id);
    const tarefa = (tarefas ?? []).find(t => t.id === tarefaId);
    if (!tarefa) return;
    // Drop sobre coluna ou outra tarefa
    let novaColuna = String(over.id);
    if (!(colunas ?? []).find(c => c.id === novaColuna)) {
      const tAlvo = (tarefas ?? []).find(t => t.id === novaColuna);
      if (tAlvo) novaColuna = tAlvo.coluna_id;
    }
    if (novaColuna === tarefa.coluna_id) return;
    const colDest = (colunas ?? []).find(c => c.id === novaColuna);
    atualizarTarefa.mutate({
      id: tarefaId,
      projeto_id: id!,
      coluna_id: novaColuna,
      ...(colDest?.is_concluido ? { concluido_em: new Date().toISOString(), progresso_pct: 100 } : { concluido_em: null }),
    } as any);
  };

  if (isLoading || !projeto) {
    return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="container mx-auto py-6 space-y-4 max-w-[1400px]">
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/projetos")}><ArrowLeft className="h-4 w-4" /></Button>
          <div className="h-8 w-1.5 rounded" style={{ backgroundColor: projeto.cor }} />
          <div>
            <h1 className="text-xl font-bold">{projeto.nome}</h1>
            <p className="text-xs text-muted-foreground">
              {projeto.descricao ?? "Sem descrição"}
              {projeto.data_fim_prevista && ` • Prazo: ${formatDataBR(projeto.data_fim_prevista)}`}
            </p>
          </div>
        </div>
        <Badge variant="outline" className={PROJETO_STATUS_COLORS[projeto.status]}>{PROJETO_STATUS_LABELS[projeto.status]}</Badge>
      </header>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="visao">Visão geral</TabsTrigger>
          <TabsTrigger value="kanban">Kanban</TabsTrigger>
          <TabsTrigger value="lista">Lista</TabsTrigger>
          <TabsTrigger value="gantt">Gantt</TabsTrigger>
          <TabsTrigger value="membros">Membros</TabsTrigger>
        </TabsList>

        <TabsContent value="visao" className="mt-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KPI label="Tarefas" value={stats?.total ?? 0} />
            <KPI label="Concluídas" value={stats?.concluidas ?? 0} />
            <KPI label="Atrasadas" value={stats?.atrasadas ?? 0} accent={(stats?.atrasadas ?? 0) > 0 ? "destructive" : "primary"} />
            <KPI label="% Conclusão" value={`${stats?.pct_conclusao ?? 0}%`} />
          </div>
        </TabsContent>

        <TabsContent value="kanban" className="mt-4">
          <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={onDragEnd}>
            <div className="flex gap-3 overflow-x-auto pb-3">
              {(colunas ?? []).map(c => (
                <KanbanColumn
                  key={c.id}
                  coluna={c}
                  tarefas={tarefasPorColuna[c.id] ?? []}
                  depsByTarefa={depsByTarefa}
                  onAdd={async () => {
                    const titulo = window.prompt("Título da tarefa:");
                    if (!titulo?.trim()) return;
                    criarTarefa.mutate({ projeto_id: id!, coluna_id: c.id, titulo: titulo.trim() });
                  }}
                  onCardClick={setTarefaAberta}
                />
              ))}
            </div>
          </DndContext>
        </TabsContent>

        <TabsContent value="lista" className="mt-4">
          <Card><CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs">
                <tr>
                  <th className="text-left p-2">Tarefa</th>
                  <th className="text-left p-2">Status</th>
                  <th className="text-left p-2">Responsável</th>
                  <th className="text-left p-2">Prioridade</th>
                  <th className="text-left p-2">Prazo</th>
                </tr>
              </thead>
              <tbody>
                {(tarefas ?? []).map((t: any) => {
                  const col = (colunas ?? []).find(c => c.id === t.coluna_id);
                  return (
                    <tr key={t.id} className="border-t hover:bg-accent/30 cursor-pointer" onClick={() => setTarefaAberta(t.id)}>
                      <td className="p-2 font-medium">{t.titulo}</td>
                      <td className="p-2"><Badge variant="outline">{col?.nome ?? "—"}</Badge></td>
                      <td className="p-2">{t.responsavel?.nome ?? <span className="text-muted-foreground italic">—</span>}</td>
                      <td className="p-2"><Badge variant="outline" className={PRIORIDADE_TAREFA_COLORS[t.prioridade]}>{PRIORIDADE_TAREFA_LABELS[t.prioridade]}</Badge></td>
                      <td className={`p-2 ${isAtrasada(t.prazo, !!col?.is_concluido) ? "text-destructive font-semibold" : ""}`}>{formatDataBR(t.prazo)}</td>
                    </tr>
                  );
                })}
                {(tarefas ?? []).length === 0 && (
                  <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Sem tarefas</td></tr>
                )}
              </tbody>
            </table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="gantt" className="mt-4">
          <GanttChart tarefas={tarefas ?? []} dependencias={deps ?? []} prazoProjeto={projeto.data_fim_prevista} onSelect={setTarefaAberta} />
        </TabsContent>

        <TabsContent value="membros" className="mt-4">
          <MembrosPanel projetoId={id!} membros={membros ?? []} onChange={() => { refetchMembros(); qc.invalidateQueries({ queryKey: ["projetos-lista"] }); }} />
        </TabsContent>
      </Tabs>

      <TarefaSheet projetoId={id!} tarefaId={tarefaAberta} tarefas={tarefas ?? []} onClose={() => setTarefaAberta(null)} />
    </div>
  );
}

function KPI({ label, value, accent = "primary" }: { label: string; value: any; accent?: "primary" | "destructive" }) {
  return (
    <Card className={`border-l-4 ${accent === "destructive" ? "border-l-destructive" : "border-l-primary/60"}`}>
      <CardContent className="p-3">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}

function MembrosPanel({ projetoId, membros, onChange }: { projetoId: string; membros: any[]; onChange: () => void }) {
  const [busca, setBusca] = useState("");
  const [resultados, setResultados] = useState<any[]>([]);

  const buscar = async (q: string) => {
    setBusca(q);
    if (q.length < 2) { setResultados([]); return; }
    const { data } = await (supabase.from as any)("profiles")
      .select("id, nome, foto_url").ilike("nome", `%${q}%`).eq("ativo", true).limit(8);
    const existentes = new Set(membros.map(m => m.profile_id));
    setResultados((data ?? []).filter((p: any) => !existentes.has(p.id)));
  };

  const adicionar = async (profile_id: string) => {
    const { error } = await (supabase.from as any)("projeto_membros")
      .insert({ projeto_id: projetoId, profile_id, papel: "membro" });
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    setBusca(""); setResultados([]); onChange();
  };

  const remover = async (profile_id: string) => {
    const { error } = await (supabase.from as any)("projeto_membros")
      .delete().eq("projeto_id", projetoId).eq("profile_id", profile_id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    onChange();
  };

  const trocarPapel = async (profile_id: string, papel: string) => {
    const { error } = await (supabase.from as any)("projeto_membros")
      .update({ papel }).eq("projeto_id", projetoId).eq("profile_id", profile_id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    onChange();
  };

  return (
    <Card><CardContent className="p-4 space-y-4">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <UserPlus className="h-4 w-4" />
          <Input value={busca} onChange={e => buscar(e.target.value)} placeholder="Buscar profissional pra adicionar..." />
        </div>
        {resultados.length > 0 && (
          <div className="border rounded-md divide-y">
            {resultados.map(r => (
              <button key={r.id} onClick={() => adicionar(r.id)} className="w-full text-left p-2 hover:bg-accent flex items-center gap-2">
                <Avatar className="h-6 w-6"><AvatarImage src={r.foto_url} /><AvatarFallback>{r.nome?.slice(0,2)}</AvatarFallback></Avatar>
                <span className="text-sm">{r.nome}</span>
                <Plus className="h-3 w-3 ml-auto" />
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="space-y-1">
        {membros.map(m => (
          <div key={m.profile_id} className="flex items-center gap-2 p-2 border rounded-md">
            <Avatar className="h-7 w-7"><AvatarImage src={m.profile?.foto_url} /><AvatarFallback>{m.profile?.nome?.slice(0,2)}</AvatarFallback></Avatar>
            <span className="text-sm flex-1">{m.profile?.nome ?? "—"}</span>
            {m.papel === "owner" ? (
              <Badge variant="outline">{PAPEL_LABELS.owner}</Badge>
            ) : (
              <>
                <Select value={m.papel} onValueChange={v => trocarPapel(m.profile_id, v)}>
                  <SelectTrigger className="w-[130px] h-7 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="membro">Membro</SelectItem>
                    <SelectItem value="observador">Observador</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="ghost" size="sm" onClick={() => remover(m.profile_id)}><Trash2 className="h-3.5 w-3.5" /></Button>
              </>
            )}
          </div>
        ))}
      </div>
    </CardContent></Card>
  );
}
