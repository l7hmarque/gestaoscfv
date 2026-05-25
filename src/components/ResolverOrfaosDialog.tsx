import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Acao = "transferir" | "saida" | "desligar";

interface Sugestao { id: string; nome: string }
interface ParticipanteOrfao {
  participante_id: string;
  nome: string;
  status: string;
  sugestoes: Sugestao[];
}
interface TurmaOrfa {
  turma_id: string;
  turma_nome: string;
  participantes: ParticipanteOrfao[];
}

interface LinhaEstado {
  acao: Acao;
  turma_destino_id: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onResolved: () => void;
}

export default function ResolverOrfaosDialog({ open, onClose, onResolved }: Props) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [grupos, setGrupos] = useState<TurmaOrfa[]>([]);
  const [estado, setEstado] = useState<Record<string, LinhaEstado>>({});
  const [justificativa, setJustificativa] = useState("");

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setJustificativa("");
    supabase.rpc("get_orfaos_turmas_inativas" as any).then(({ data, error }) => {
      if (error) {
        toast.error("Erro ao carregar órfãos: " + error.message);
        setGrupos([]);
      } else {
        const list = (data as TurmaOrfa[]) || [];
        setGrupos(list);
        const initial: Record<string, LinhaEstado> = {};
        list.forEach(g => g.participantes.forEach(p => {
          const sug = p.sugestoes || [];
          initial[`${g.turma_id}:${p.participante_id}`] = sug.length > 0
            ? { acao: "transferir", turma_destino_id: sug[0].id }
            : { acao: "saida", turma_destino_id: null };
        }));
        setEstado(initial);
      }
      setLoading(false);
    });
  }, [open]);

  const total = useMemo(() => grupos.reduce((s, g) => s + g.participantes.length, 0), [grupos]);

  const setLinha = (key: string, patch: Partial<LinhaEstado>) => {
    setEstado(prev => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  };

  const aplicar = async () => {
    // valida: toda ação 'transferir' precisa de destino
    const acoes: any[] = [];
    for (const g of grupos) {
      for (const p of g.participantes) {
        const key = `${g.turma_id}:${p.participante_id}`;
        const l = estado[key];
        if (!l) continue;
        if (l.acao === "transferir" && !l.turma_destino_id) {
          toast.error(`Selecione turma destino para ${p.nome}`);
          return;
        }
        acoes.push({
          participante_id: p.participante_id,
          turma_origem_id: g.turma_id,
          acao: l.acao,
          turma_destino_id: l.turma_destino_id,
        });
      }
    }
    if (!justificativa.trim()) {
      toast.error("Justificativa é obrigatória");
      return;
    }
    setSaving(true);
    const { data, error } = await supabase.rpc("resolver_orfaos_lote" as any, {
      _acoes: acoes,
      _justificativa: justificativa.trim(),
    });
    setSaving(false);
    if (error) {
      toast.error("Erro: " + error.message);
      return;
    }
    const r = data as { transferidos: number; saidas: number; desligados: number; ignorados: number };
    toast.success(`${r.transferidos} transferidos · ${r.saidas} saídas · ${r.desligados} desligados${r.ignorados ? ` · ${r.ignorados} ignorados` : ""}`);
    onResolved();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Resolver vínculos órfãos</DialogTitle>
          <DialogDescription>
            Escolha o destino de cada participante ativo preso em turma desativada.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin mr-2" /> Carregando...
          </div>
        ) : total === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">Nenhum vínculo órfão encontrado.</div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
            <div className="rounded border border-warning/40 bg-warning/5 p-2 text-xs text-foreground flex gap-2">
              <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
              <div>
                <strong>{total} participante(s)</strong> em <strong>{grupos.length} turma(s) inativa(s)</strong>. Ações são auditadas individualmente.
                <div className="text-muted-foreground mt-0.5">• <strong>Transferir</strong> abre vínculo em turma ativa · <strong>Saída</strong> só fecha o vínculo atual · <strong>Desligar</strong> marca o participante como desligado.</div>
              </div>
            </div>

            {grupos.map((g) => (
              <div key={g.turma_id} className="border rounded">
                <div className="bg-muted/40 px-3 py-1.5 text-xs font-medium">
                  {g.turma_nome} <span className="text-muted-foreground">— {g.participantes.length} participante(s)</span>
                </div>
                <div className="divide-y">
                  {g.participantes.map((p) => {
                    const key = `${g.turma_id}:${p.participante_id}`;
                    const l = estado[key];
                    if (!l) return null;
                    const sug = p.sugestoes || [];
                    return (
                      <div key={key} className="px-3 py-2 grid grid-cols-1 md:grid-cols-[1fr,140px,1fr] gap-2 items-center text-xs">
                        <div className="font-medium">{p.nome} <span className="text-muted-foreground font-normal">· {p.status}</span></div>
                        <Select value={l.acao} onValueChange={(v) => setLinha(key, { acao: v as Acao, turma_destino_id: v === "transferir" ? (sug[0]?.id ?? null) : null })}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="transferir" disabled={sug.length === 0}>Transferir</SelectItem>
                            <SelectItem value="saida">Registrar saída</SelectItem>
                            <SelectItem value="desligar">Desligar</SelectItem>
                          </SelectContent>
                        </Select>
                        {l.acao === "transferir" ? (
                          <Select value={l.turma_destino_id ?? ""} onValueChange={(v) => setLinha(key, { turma_destino_id: v })}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder={sug.length ? "Escolha a turma" : "Sem turma compatível"} /></SelectTrigger>
                            <SelectContent>
                              {sug.map(s => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        ) : (
                          <div className="text-muted-foreground italic">{l.acao === "saida" ? "Fechar vínculo (continua ativo no cadastro)" : "Marca como desligado"}</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            <div>
              <Label className="text-xs">Justificativa (auditoria) <span className="text-destructive">*</span></Label>
              <Textarea
                value={justificativa}
                onChange={(e) => setJustificativa(e.target.value)}
                placeholder="Ex.: Realocação após reestruturação das oficinas de ALVORADA"
                rows={2}
                className="text-xs"
              />
            </div>
          </div>
        )}

        <DialogFooter className="border-t pt-3">
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={aplicar} disabled={saving || loading || total === 0}>
            {saving && <Loader2 className="h-3 w-3 animate-spin mr-1" />} Aplicar tudo ({total})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}