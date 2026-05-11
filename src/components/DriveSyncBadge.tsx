import { useEffect, useState } from "react";
import { ExternalLink, Loader2, AlertTriangle, FileText, UploadCloud } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  tipo: "relatorio" | "planejamento" | "roteiro_visita" | "atendimento" | "orcamento" | "prestacao_contas" | "lista_chamada_lote" | "lista_frequencia_lote";
  origemId: string;
  driveUrl?: string | null;
}

export function DriveSyncBadge({ tipo, origemId, driveUrl }: Props) {
  const [status, setStatus] = useState<string | null>(driveUrl ? "sincronizado" : null);
  const [url, setUrl] = useState<string | null>(driveUrl || null);
  const [erro, setErro] = useState<string | null>(null);
  const [hasRow, setHasRow] = useState<boolean>(!!driveUrl);
  const [enqueueing, setEnqueueing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const fetchStatus = async () => {
      const { data } = await supabase
        .from("drive_sync_queue")
        .select("status, drive_url, ultimo_erro")
        .eq("tipo", tipo).eq("origem_id", origemId).maybeSingle();
      if (cancelled) return;
      if (!data) { setHasRow(false); return; }
      setHasRow(true);
      setStatus(data.status);
      if (data.drive_url) setUrl(data.drive_url);
      setErro(data.ultimo_erro);
    };
    fetchStatus();
    const ch = supabase
      .channel(`drive-sync-${origemId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "drive_sync_queue", filter: `origem_id=eq.${origemId}` }, fetchStatus)
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [tipo, origemId]);

  const retry = async () => {
    await supabase.rpc("enqueue_drive_sync", { _tipo: tipo, _origem_id: origemId });
    toast.info("Reagendado para sincronização");
    await supabase.functions.invoke("drive-sync-worker", { body: { manual: true } }).catch(() => {});
  };

  const enqueueNew = async () => {
    setEnqueueing(true);
    try {
      const { error } = await supabase.rpc("enqueue_drive_sync", { _tipo: tipo, _origem_id: origemId });
      if (error) throw error;
      setHasRow(true); setStatus("pendente");
      toast.info("Gerando no Drive…");
      await supabase.functions.invoke("drive-sync-worker", { body: { manual: true } }).catch(() => {});
    } catch (e: any) {
      toast.error(e.message || "Falha ao enfileirar");
    } finally { setEnqueueing(false); }
  };

  if (url && status === "sincronizado") {
    return (
      <Button variant="outline" size="sm" className="gap-1" asChild>
        <a href={url} target="_blank" rel="noreferrer">
          <FileText className="h-3.5 w-3.5" />Abrir no Drive<ExternalLink className="h-3 w-3" />
        </a>
      </Button>
    );
  }
  if (status === "processando" || status === "pendente") {
    return <Badge variant="secondary" className="gap-1"><Loader2 className="h-3 w-3 animate-spin" />Sincronizando Drive…</Badge>;
  }
  if (status === "erro") {
    return (
      <Button variant="outline" size="sm" className="gap-1 text-destructive" onClick={retry} title={erro || ""}>
        <AlertTriangle className="h-3.5 w-3.5" />Falha • Tentar novamente
      </Button>
    );
  }
  // Sem registro em fila: oferece gerar agora
  if (!hasRow) {
    return (
      <Button variant="outline" size="sm" className="gap-1" onClick={enqueueNew} disabled={enqueueing}>
        {enqueueing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UploadCloud className="h-3.5 w-3.5" />}
        Gerar no Drive
      </Button>
    );
  }
  return null;
}