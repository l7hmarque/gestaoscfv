import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAtualizarTarefa, useExcluirTarefa, Tarefa } from "@/hooks/useProjetoTarefas";
import { useProjetoMembros } from "@/hooks/useProjetos";
import { PRIORIDADE_TAREFA_LABELS } from "@/lib/projetoHelpers";

type Props = {
  projetoId: string;
  tarefaId: string | null;
  tarefas: Tarefa[];
  onClose: () => void;
};

export function TarefaSheet({ projetoId, tarefaId, tarefas, onClose }: Props) {
  const tarefa = tarefas.find(t => t.id === tarefaId) ?? null;
  const { data: membros } = useProjetoMembros(projetoId);
  const atualizar = useAtualizarTarefa();
  const excluir = useExcluirTarefa();

  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [responsavelId, setResponsavelId] = useState<string>("none");
  const [prioridade, setPrioridade] = useState("media");
  const [dataInicio, setDataInicio] = useState("");
  const [prazo, setPrazo] = useState("");
  const [comentarios, setComentarios] = useState<any[]>([]);
  const [novoComent, setNovoComent] = useState("");

  useEffect(() => {
    if (!tarefa) return;
    setTitulo(tarefa.titulo);
    setDescricao(tarefa.descricao ?? "");
    setResponsavelId(tarefa.responsavel_id ?? "none");
    setPrioridade(tarefa.prioridade);
    setDataInicio(tarefa.data_inicio ?? "");
    setPrazo(tarefa.prazo ?? "");
    (async () => {
      const { data } = await (supabase.from as any)("projeto_tarefa_comentarios")
        .select("*").eq("tarefa_id", tarefa.id).order("created_at");
      setComentarios(data ?? []);
    })();
  }, [tarefa?.id]);

  if (!tarefa) return null;

  const salvar = () => {
    atualizar.mutate({
      id: tarefa.id,
      projeto_id: projetoId,
      titulo,
      descricao: descricao || null,
      responsavel_id: responsavelId === "none" ? null : responsavelId,
      prioridade,
      data_inicio: dataInicio || null,
      prazo: prazo || null,
    } as any);
  };

  const adicionarComent = async () => {
    if (!novoComent.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: prof } = await (supabase.from as any)("profiles").select("id").eq("user_id", user.id).maybeSingle();
    if (!prof) return;
    const { data } = await (supabase.from as any)("projeto_tarefa_comentarios")
      .insert({ tarefa_id: tarefa.id, autor_id: prof.id, texto: novoComent.trim() })
      .select().single();
    if (data) {
      setComentarios(prev => [...prev, data]);
      setNovoComent("");
    }
  };

  return (
    <Sheet open={!!tarefaId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Tarefa</SheetTitle>
        </SheetHeader>
        <div className="space-y-3 mt-4">
          <div>
            <Label>Título</Label>
            <Input value={titulo} onChange={e => setTitulo(e.target.value)} />
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea rows={4} value={descricao} onChange={e => setDescricao(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Responsável</Label>
              <Select value={responsavelId} onValueChange={setResponsavelId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem responsável</SelectItem>
                  {(membros ?? []).map((m: any) => (
                    <SelectItem key={m.profile_id} value={m.profile_id}>{m.profile?.nome ?? "—"}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Prioridade</Label>
              <Select value={prioridade} onValueChange={setPrioridade}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(PRIORIDADE_TAREFA_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Início</Label>
              <Input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} />
            </div>
            <div>
              <Label>Prazo</Label>
              <Input type="date" value={prazo} onChange={e => setPrazo(e.target.value)} />
            </div>
          </div>
          <div className="flex justify-between pt-2">
            <Button variant="destructive" size="sm" onClick={() => { excluir.mutate({ id: tarefa.id, projeto_id: projetoId }); onClose(); }}>
              <Trash2 className="h-4 w-4 mr-1" />Excluir
            </Button>
            <Button onClick={salvar} disabled={atualizar.isPending}>Salvar</Button>
          </div>

          <div className="border-t pt-4">
            <Label>Comentários</Label>
            <div className="space-y-2 mt-2 max-h-48 overflow-y-auto">
              {comentarios.length === 0 && <p className="text-xs text-muted-foreground">Nenhum comentário.</p>}
              {comentarios.map(c => (
                <div key={c.id} className="text-sm p-2 bg-muted/40 rounded">
                  <p className="text-[10px] text-muted-foreground">{new Date(c.created_at).toLocaleString("pt-BR")}</p>
                  <p>{c.texto}</p>
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-2">
              <Input value={novoComent} onChange={e => setNovoComent(e.target.value)} placeholder="Escrever comentário..." />
              <Button size="sm" onClick={adicionarComent}>Enviar</Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
