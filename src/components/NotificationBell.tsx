import { useState, useEffect } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { Link } from "react-router-dom";

export function NotificationBell() {
  const { user } = useAuth();
  const [recados, setRecados] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [participantes, setParticipantes] = useState<any[]>([]);
  const [myProfileId, setMyProfileId] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    loadData();

    const channel = supabase
      .channel("recados-notif")
      .on("postgres_changes", { event: "*", schema: "public", table: "recados" }, () => loadData())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const loadData = async () => {
    if (!user) return;
    const [{ data: prof }, { data: rec }, { data: parts }] = await Promise.all([
      supabase.from("profiles").select("id, nome, user_id"),
      supabase.from("recados").select("*").order("created_at", { ascending: false }).limit(50),
      supabase.from("participantes").select("id, nome_completo"),
    ]);
    setProfiles(prof || []);
    setParticipantes(parts || []);
    const me = (prof || []).find((p: any) => p.user_id === user.id);
    if (me) {
      setMyProfileId(me.id);
      // Filter only recados where I'm the destinatario
      setRecados((rec || []).filter((r: any) => r.destinatario_id === me.id));
    }
  };

  const unread = recados.filter(r => !r.lido).length;
  const profName = (id: string) => profiles.find(p => p.id === id)?.nome || "—";
  const partName = (id: string) => participantes.find(p => p.id === id)?.nome_completo || "";

  const markCiente = async (recadoId: string) => {
    await supabase.from("recados").update({ lido: true, ciente: true } as any).eq("id", recadoId);
    toast.success("Marcado como ciente!");
    loadData();
  };

  const markRead = async (recadoId: string) => {
    await supabase.from("recados").update({ lido: true } as any).eq("id", recadoId);
    loadData();
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center font-bold">
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
              <div key={r.id} className={`p-3 text-sm ${!r.lido ? "bg-primary/5" : ""}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground">
                      De: <span className="font-medium text-foreground">{profName(r.remetente_id)}</span>
                      {" · "}
                      {formatDistanceToNow(new Date(r.created_at), { addSuffix: true, locale: ptBR })}
                    </p>
                    {r.participante_id && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Sobre: <Link to={`/participantes/${r.participante_id}`} className="text-primary hover:underline" onClick={() => setOpen(false)}>{partName(r.participante_id)}</Link>
                      </p>
                    )}
                    <p className="text-sm mt-1">{r.conteudo}</p>
                  </div>
                </div>
                <div className="flex gap-1 mt-2">
                  {!r.ciente && (
                    <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" onClick={() => markCiente(r.id)}>
                      ✅ Ciente!
                    </Button>
                  )}
                  {!r.lido && !r.ciente && (
                    <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2" onClick={() => markRead(r.id)}>
                      Marcar lido
                    </Button>
                  )}
                  {r.ciente && <Badge variant="secondary" className="text-[10px]">✅ Ciente</Badge>}
                </div>
              </div>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
