import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Mail, User, Clock, ClipboardPlus, CheckCircle2 } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const STATUS_OPTIONS = [
  { value: "pendente", label: "Pendente", color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400" },
  { value: "em_andamento", label: "Em andamento", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" },
  { value: "resolvido", label: "Resolvido", color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400" },
  { value: "concluido", label: "Concluído", color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400" },
];

interface RecadosEquipeCardsProps {
  onPendingCount?: (count: number) => void;
  onRegistrarAtendimento?: (recado: any) => void;
  atendimentosVinculados?: Record<string, any>; // recado_id -> atendimento
}

export function RecadosEquipeCards({ onPendingCount, onRegistrarAtendimento, atendimentosVinculados = {} }: RecadosEquipeCardsProps) {
  const { user } = useAuth();
  const [recados, setRecados] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [participantes, setParticipantes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRecados();
    const channel = supabase
      .channel("recados-equipe")
      .on("postgres_changes", { event: "*", schema: "public", table: "recados" }, () => loadRecados())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const loadRecados = async () => {
    if (!user) return;
    const [{ data: recs }, { data: profs }, { data: parts }] = await Promise.all([
      supabase.from("recados").select("*").eq("tipo_recado", "tecnico").order("created_at", { ascending: false }).limit(50),
      supabase.from("profiles").select("id, nome, user_id"),
      supabase.from("participantes").select("id, nome_completo"),
    ]);
    setProfiles(profs || []);
    setParticipantes(parts || []);
    setRecados(recs || []);
    setLoading(false);
    const pending = (recs || []).filter((r: any) => r.status !== "concluido").length;
    onPendingCount?.(pending);
  };

  const handleStatusChange = async (recadoId: string, newStatus: string) => {
    const { error } = await supabase.from("recados").update({ status: newStatus } as any).eq("id", recadoId);
    if (error) {
      toast.error("Erro ao atualizar status");
      return;
    }
    toast.success("Status atualizado!");
    loadRecados();
  };

  const profName = (id: string) => profiles.find(p => p.id === id)?.nome || "—";
  const partName = (id: string) => participantes.find(p => p.id === id)?.nome_completo || "";
  const statusInfo = (s: string) => STATUS_OPTIONS.find(o => o.value === s) || STATUS_OPTIONS[0];

  const pendentes = recados.filter(r => (r as any).status !== "concluido");
  const concluidos = recados.filter(r => (r as any).status === "concluido");

  if (loading) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Mail className="h-4 w-4" />
          Recados da Equipe ({pendentes.length} pendente{pendentes.length !== 1 ? "s" : ""})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {pendentes.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-2">Nenhum recado pendente</p>
        )}
        {pendentes.map(r => {
          const si = statusInfo((r as any).status || "pendente");
          return (
            <div key={r.id} className="border rounded-lg p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 font-mono">#{r.numero}</Badge>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${si.color}`}>{si.label}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    <User className="h-3 w-3" />
                    De: <span className="font-medium text-foreground">{profName(r.remetente_id)}</span>
                    {" → "}
                    <span className="font-medium text-foreground">{profName(r.destinatario_id)}</span>
                  </p>
                  {r.participante_id && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Sobre:{" "}
                      <Link to={`/participantes/${r.participante_id}`} className="text-primary hover:underline">
                        {partName(r.participante_id)}
                      </Link>
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground shrink-0">
                  <Clock className="h-3 w-3" />
                  {formatDistanceToNow(new Date(r.created_at), { addSuffix: true, locale: ptBR })}
                </div>
              </div>
              <p className="text-sm line-clamp-3 bg-muted/50 rounded px-2 py-1.5">{r.conteudo}</p>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Status:</span>
                <Select value={(r as any).status || "pendente"} onValueChange={(v) => handleStatusChange(r.id, v)}>
                  <SelectTrigger className="h-7 text-xs w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map(o => (
                      <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          );
        })}
        {concluidos.length > 0 && (
          <details className="mt-2">
            <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
              {concluidos.length} recado{concluidos.length !== 1 ? "s" : ""} concluído{concluidos.length !== 1 ? "s" : ""}
            </summary>
            <div className="space-y-1.5 mt-2">
              {concluidos.slice(0, 5).map(r => (
                <div key={r.id} className="border rounded px-2 py-1.5 opacity-60 text-xs">
                  <span className="font-mono">#{r.numero}</span> — {profName(r.remetente_id)} → {profName(r.destinatario_id)}
                  <span className="ml-1 text-emerald-600">✓ Concluído</span>
                </div>
              ))}
            </div>
          </details>
        )}
      </CardContent>
    </Card>
  );
}
