import { useEffect, useMemo, useState } from "react";
import { Loader2, Save, UserCheck, AlertCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useIsDemo, guardDemo } from "@/hooks/useIsDemo";

interface Turma {
  id: string;
  nome: string;
  oficina: string | null;
  educador_id: string | null;
  educador_nome?: string | null;
}

interface Profile { id: string; nome: string }

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}

export default function ReviewEducadoresDialog({ open, onOpenChange, onSaved }: Props) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [educadores, setEducadores] = useState<Profile[]>([]);
  const [draft, setDraft] = useState<Record<string, string | null>>({});
  const [busca, setBusca] = useState("");
  const isDemo = useIsDemo();

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    Promise.all([
      supabase.from("turmas").select("id, nome, oficina, educador_id, profiles(nome)").eq("ativa", true).order("oficina").order("nome"),
      supabase.from("profiles").select("id, nome").eq("ativo", true).order("nome"),
    ]).then(([t, p]) => {
      const list: Turma[] = (t.data || []).map((x: any) => ({
        id: x.id, nome: x.nome, oficina: x.oficina, educador_id: x.educador_id,
        educador_nome: x.profiles?.nome || null,
      }));
      setTurmas(list);
      setEducadores((p.data as any) || []);
      const d: Record<string, string | null> = {};
      list.forEach(t => { d[t.id] = t.educador_id; });
      setDraft(d);
    }).finally(() => setLoading(false));
  }, [open]);

  const turmasFiltradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return turmas;
    return turmas.filter(t => t.nome.toLowerCase().includes(q) || (t.oficina || "").toLowerCase().includes(q));
  }, [turmas, busca]);

  const grupos = useMemo(() => {
    const map: Record<string, Turma[]> = {};
    turmasFiltradas.forEach(t => {
      const k = t.oficina || "Sem oficina";
      (map[k] = map[k] || []).push(t);
    });
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0]));
  }, [turmasFiltradas]);

  const mudancas = useMemo(() =>
    turmas.filter(t => draft[t.id] !== t.educador_id), [turmas, draft]
  );

  const semEducador = turmas.filter(t => !draft[t.id]).length;

  const handleSave = async () => {
    if (guardDemo(isDemo)) return;
    if (mudancas.length === 0) { toast.info("Nenhuma mudança para salvar"); return; }
    setSaving(true);
    try {
      const results = await Promise.all(
        mudancas.map(t =>
          supabase.from("turmas").update({ educador_id: draft[t.id] || null }).eq("id", t.id)
        )
      );
      const firstErr = results.find(r => r.error);
      if (firstErr?.error) throw firstErr.error;
      // Audit
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: prof } = await supabase.from("profiles").select("nome").eq("user_id", user.id).single();
        await supabase.from("audit_log").insert(mudancas.map(t => ({
          user_id: user.id, user_nome: prof?.nome || user.email,
          tabela: "turmas", acao: "atualizacao_educador", registro_id: t.id,
          detalhes: `Educador da turma "${t.nome}" alterado`,
        })));
      }
      toast.success(`${mudancas.length} turma(s) atualizada(s)`);
      onSaved?.();
      onOpenChange(false);
    } catch (e: any) {
      toast.error("Erro ao salvar: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><UserCheck className="h-5 w-5" />Revisar educadores das turmas</DialogTitle>
          <DialogDescription>
            Confirme ou atualize o educador vinculado a cada turma ativa. Mudanças só são gravadas ao clicar em <strong>Salvar</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2">
          <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar turma ou oficina..." className="h-9 text-sm" />
          {semEducador > 0 && (
            <Badge variant="destructive" className="gap-1 whitespace-nowrap"><AlertCircle className="h-3 w-3" />{semEducador} sem educador</Badge>
          )}
          {mudancas.length > 0 && (
            <Badge variant="default" className="whitespace-nowrap">{mudancas.length} mudança(s)</Badge>
          )}
        </div>

        <div className="flex-1 overflow-y-auto -mx-6 px-6 space-y-3">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : grupos.map(([oficina, ts]) => (
            <div key={oficina} className="rounded-md border border-border/60">
              <div className="px-3 py-1.5 bg-muted/60 border-b text-xs font-semibold uppercase tracking-wide flex justify-between">
                <span>{oficina}</span>
                <span className="text-muted-foreground font-normal">{ts.length} turmas</span>
              </div>
              <div className="divide-y">
                {ts.map(t => {
                  const changed = draft[t.id] !== t.educador_id;
                  const empty = !draft[t.id];
                  return (
                    <div key={t.id} className={`flex items-center gap-2 px-3 py-1.5 text-sm ${changed ? "bg-warning/10" : ""} ${empty ? "bg-destructive/5" : ""}`}>
                      <span className="flex-1 truncate">{t.nome}</span>
                      <Select value={draft[t.id] || "none"} onValueChange={(v) => setDraft(d => ({ ...d, [t.id]: v === "none" ? null : v }))}>
                        <SelectTrigger className="w-56 h-8 text-xs"><SelectValue placeholder="Sem educador" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none"><span className="text-muted-foreground">Sem educador</span></SelectItem>
                          {educadores.map(e => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving || mudancas.length === 0} className="gap-1">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar {mudancas.length > 0 ? `(${mudancas.length})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}