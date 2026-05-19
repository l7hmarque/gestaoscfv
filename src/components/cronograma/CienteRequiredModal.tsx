import { useEffect, useRef, useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAuditLog } from "@/hooks/useAuditLog";
import { toast } from "sonner";

const PRIO_COLOR: Record<string, string> = {
  urgente: "bg-destructive/10 border-destructive text-destructive",
  alta: "bg-amber-50 border-amber-400 text-amber-900",
  normal: "bg-blue-50 border-blue-300 text-blue-900",
};

export function CienteRequiredModal() {
  const { user, profileId } = useAuth();
  const { log } = useAuditLog();
  const [pendentes, setPendentes] = useState<any[]>([]);
  const [recadosPend, setRecadosPend] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    if (!profileId) return;
    const [{ data: intervencoes }, { data: cientes }, { data: recs }] = await Promise.all([
      supabase.from("cronograma_intervencoes").select("*").order("created_at", { ascending: false }).limit(50),
      supabase.from("cronograma_intervencao_cientes").select("intervencao_id").eq("profile_id", profileId),
      supabase.from("recados").select("*").eq("destinatario_id", profileId).eq("requer_ciente", true).eq("ciente", false),
    ]);
    const cienteIds = new Set((cientes || []).map((c: any) => c.intervencao_id));
    const filtered = (intervencoes || []).filter((iv: any) => {
      if (cienteIds.has(iv.id)) return false;
      const dirigidaAmim = !iv.profissionais?.length || iv.profissionais.includes(profileId);
      return dirigidaAmim;
    });
    setPendentes(filtered);
    setRecadosPend(recs || []);
    setOpen(filtered.length > 0 || (recs || []).length > 0);
  }, [profileId]);

  const scheduleLoad = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { load(); }, 1500);
  }, [load]);

  useEffect(() => {
    if (!profileId) return;
    load();
    // Realtime apenas para recados (filtrado no servidor para este destinatário).
    // Intervenções → polling leve (60s + on focus), porque mudam raramente
    // e o filtro por array de profissionais não é suportado server-side.
    const ch = supabase
      .channel(`ciente-modal-${profileId}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "recados",
        filter: `destinatario_id=eq.${profileId}`,
      }, scheduleLoad)
      .subscribe();

    const pollId = setInterval(() => load(), 60_000);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);

    return () => {
      supabase.removeChannel(ch);
      clearInterval(pollId);
      window.removeEventListener("focus", onFocus);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [profileId, load, scheduleLoad]);

  const cienteIntervencao = async (iv: any) => {
    if (!profileId) return;
    const { error } = await supabase.from("cronograma_intervencao_cientes")
      .insert({ intervencao_id: iv.id, profile_id: profileId });
    if (error) { toast.error(error.message); return; }
    await log({ acao: "ciente", tabela: "cronograma_intervencoes", registro_id: iv.id, detalhes: `Intervenção "${iv.titulo}" — ciência registrada` });
    setPendentes(p => p.filter(x => x.id !== iv.id));
  };

  const cienteRecado = async (r: any) => {
    const { error } = await supabase.from("recados").update({ ciente: true, lido: true } as any).eq("id", r.id);
    if (error) { toast.error(error.message); return; }
    await log({ acao: "ciente", tabela: "recados", registro_id: r.id, detalhes: `Recado #${r.numero || "—"} — ciência registrada` });
    setRecadosPend(p => p.filter(x => x.id !== r.id));
  };

  const total = pendentes.length + recadosPend.length;
  useEffect(() => { if (total === 0) setOpen(false); }, [total]);

  if (!open || total === 0) return null;

  return (
    <Dialog open={open} onOpenChange={() => { /* no-op: bloqueante */ }}>
      <DialogContent className="max-w-lg" onPointerDownOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Ciência obrigatória ({total})
          </DialogTitle>
          <DialogDescription>
            Confirme a leitura de cada item para continuar. Sua ciência será registrada.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 max-h-[60vh] overflow-y-auto">
          {pendentes.map(iv => (
            <div key={iv.id} className={`border-2 rounded p-3 ${PRIO_COLOR[iv.prioridade] || PRIO_COLOR.alta}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1 mb-1">
                    <Badge variant="outline" className="text-[9px] uppercase">Intervenção</Badge>
                    <Badge variant="outline" className="text-[9px] uppercase">{iv.prioridade}</Badge>
                  </div>
                  <p className="text-sm font-bold">{iv.titulo}</p>
                  {iv.descricao && <p className="text-xs mt-1 whitespace-pre-wrap">{iv.descricao}</p>}
                  <p className="text-[10px] mt-1 opacity-70">
                    {new Date(iv.data_inicio).toLocaleDateString("pt-BR")}
                    {iv.data_fim ? ` — ${new Date(iv.data_fim).toLocaleDateString("pt-BR")}` : ""}
                  </p>
                </div>
                <Button size="sm" onClick={() => cienteIntervencao(iv)} className="shrink-0">
                  Estou ciente
                </Button>
              </div>
            </div>
          ))}
          {recadosPend.map(r => (
            <div key={r.id} className={`border-2 rounded p-3 ${PRIO_COLOR[r.prioridade] || PRIO_COLOR.normal}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1 mb-1">
                    <Badge variant="outline" className="text-[9px] uppercase">Recado #{r.numero || "—"}</Badge>
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{r.conteudo}</p>
                </div>
                <Button size="sm" onClick={() => cienteRecado(r)} className="shrink-0">
                  Estou ciente
                </Button>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
