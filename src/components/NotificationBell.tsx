import { useState, useEffect, useCallback, useRef } from "react";
import { Bell, Eye, Hash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAuditLog } from "@/hooks/useAuditLog";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { Link } from "react-router-dom";

export function NotificationBell() {
  const { user } = useAuth();
  const { log: auditLog } = useAuditLog();
  const [recados, setRecados] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [participantes, setParticipantes] = useState<any[]>([]);
  const [myProfileId, setMyProfileId] = useState("");
  const [isCoord, setIsCoord] = useState(false);
  const [open, setOpen] = useState(false);
  const [detailRecado, setDetailRecado] = useState<any | null>(null);
  const channelRef = useRef<any>(null);

  const loadData = useCallback(async () => {
    if (!user) return;
    const [{ data: prof }, { data: rec }, { data: parts }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("id, nome, user_id"),
      supabase.from("recados").select("*").order("created_at", { ascending: false }).limit(50),
      supabase.from("participantes").select("id, nome_completo"),
      supabase.from("user_roles").select("role").eq("user_id", user.id),
    ]);
    setProfiles(prof || []);
    setParticipantes(parts || []);
    const coordRole = (roles || []).some((r: any) => r.role === "coordenacao");
    setIsCoord(coordRole);
    const me = (prof || []).find((p: any) => p.user_id === user.id);
    if (me) {
      setMyProfileId(me.id);
      if (coordRole) {
        setRecados(rec || []);
      } else {
        setRecados((rec || []).filter((r: any) => r.destinatario_id === me.id || r.remetente_id === me.id));
      }
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    loadData();

    // Clean up previous channel
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const channel = supabase
      .channel(`recados-notif-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "recados" }, () => {
        loadData();
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [user, loadData]);

  // Unread = recados where I'm the destinatário and not read
  const unread = recados.filter(r => r.destinatario_id === myProfileId && !r.lido).length;
  const profName = (id: string) => profiles.find(p => p.id === id)?.nome || "—";
  const partName = (id: string) => participantes.find(p => p.id === id)?.nome_completo || "";

  const markCiente = async (recado: any) => {
    await supabase.from("recados").update({ lido: true, ciente: true } as any).eq("id", recado.id);
    await auditLog({ acao: "ciente", tabela: "recados", registro_id: recado.id, detalhes: `Recado #${recado.numero || "—"} marcado como ciente` });
    toast.success("Marcado como ciente!");
    loadData();
  };

  const markRead = async (recado: any) => {
    await supabase.from("recados").update({ lido: true } as any).eq("id", recado.id);
    await auditLog({ acao: "leitura", tabela: "recados", registro_id: recado.id, detalhes: `Recado #${recado.numero || "—"} lido` });
    loadData();
  };

  const isMine = (r: any) => r.remetente_id === myProfileId;
  const isForMe = (r: any) => r.destinatario_id === myProfileId;

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="relative h-10 w-10">
            <Bell className="h-5 w-5" />
            {unread > 0 && (
              <span className="absolute top-1 right-1 h-4 w-4 rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center font-bold">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0 max-h-[400px] overflow-auto" align="end">
          <div className="p-3 border-b">
            <h3 className="text-sm font-semibold">Notificações</h3>
          </div>
          {recados.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">Nenhuma notificação</div>
          ) : (
            <div className="divide-y">
              {recados.map(r => (
                <div
                  key={r.id}
                  className={`p-3 text-sm cursor-pointer hover:bg-accent/50 transition-colors ${!r.lido && isForMe(r) ? "bg-primary/5" : ""}`}
                  onClick={() => { setDetailRecado(r); setOpen(false); }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        {r.numero && <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 font-mono">#{r.numero}</Badge>}
                        {isMine(r) && <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4">Enviado</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {isMine(r) ? "Para: " : "De: "}
                        <span className="font-medium text-foreground">{isMine(r) ? profName(r.destinatario_id) : profName(r.remetente_id)}</span>
                        {isCoord && !isMine(r) && !isForMe(r) && (
                          <span className="text-muted-foreground"> → {profName(r.destinatario_id)}</span>
                        )}
                        {" · "}
                        {formatDistanceToNow(new Date(r.created_at), { addSuffix: true, locale: ptBR })}
                      </p>
                      <p className="text-sm mt-0.5 line-clamp-2">{r.conteudo}</p>
                    </div>
                  </div>
                  <div className="flex gap-1 mt-1.5 flex-wrap">
                    {r.ciente && <Badge variant="secondary" className="text-[10px]">✅ Ciente</Badge>}
                    {!r.ciente && isForMe(r) && !r.lido && <Badge variant="default" className="text-[10px]">Novo</Badge>}
                    {(r as any).status && (r as any).status !== "pendente" && (
                      <Badge variant={(r as any).status === "concluido" ? "default" : "secondary"} className="text-[10px]">
                        {(r as any).status === "concluido" ? "✓ Concluído" : "⏳ Em andamento"}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </PopoverContent>
      </Popover>

      {/* Detail Dialog */}
      <Dialog open={!!detailRecado} onOpenChange={(v) => { if (!v) setDetailRecado(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Hash className="h-4 w-4" />
              Recado {detailRecado?.numero ? `#${detailRecado.numero}` : ""}
            </DialogTitle>
          </DialogHeader>
          {detailRecado && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Remetente</p>
                  <p className="font-medium">{profName(detailRecado.remetente_id)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Destinatário</p>
                  <p className="font-medium">{profName(detailRecado.destinatario_id)}</p>
                </div>
              </div>

              {detailRecado.participante_id && (
                <div className="text-sm">
                  <p className="text-xs text-muted-foreground">Sobre participante</p>
                  <Link
                    to={`/participantes/${detailRecado.participante_id}`}
                    className="text-primary hover:underline font-medium"
                    onClick={() => setDetailRecado(null)}
                  >
                    {partName(detailRecado.participante_id)}
                  </Link>
                </div>
              )}

              <div className="text-sm">
                <p className="text-xs text-muted-foreground">Data</p>
                <p>{new Date(detailRecado.created_at).toLocaleString("pt-BR")}</p>
              </div>

              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-sm whitespace-pre-wrap">{detailRecado.conteudo}</p>
              </div>

              <div className="flex items-center gap-2 text-xs flex-wrap">
                <Badge variant={detailRecado.lido ? "secondary" : "outline"}>{detailRecado.lido ? "✓ Lido" : "Não lido"}</Badge>
                <Badge variant={detailRecado.ciente ? "secondary" : "outline"}>{detailRecado.ciente ? "✅ Ciente" : "Pendente"}</Badge>
                {(detailRecado as any).status && (
                  <Badge variant={(detailRecado as any).status === "concluido" ? "default" : (detailRecado as any).status === "em_andamento" ? "secondary" : "outline"}>
                    Status: {(detailRecado as any).status === "concluido" ? "Concluído" : (detailRecado as any).status === "em_andamento" ? "Em andamento" : "Pendente"}
                  </Badge>
                )}
              </div>

              {isForMe(detailRecado) && !detailRecado.ciente && (
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => { markCiente(detailRecado); setDetailRecado(null); }} className="flex-1">
                    ✅ Marcar Ciente
                  </Button>
                  {!detailRecado.lido && (
                    <Button size="sm" variant="outline" onClick={() => { markRead(detailRecado); setDetailRecado(null); }}>
                      <Eye className="h-3.5 w-3.5 mr-1" />Lido
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
