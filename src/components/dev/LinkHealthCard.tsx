import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Activity, Download, RefreshCw, Loader2, Play } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx-js-style";
import { saveAs } from "file-saver";
import { buildFileName } from "@/lib/fileNaming";

type Bucket = "ativos_sem_vinculo" | "desligados_com_vinculo" | "busca_ativa_stale" | "ativos_sem_presenca";

const BUCKET_LABELS: Record<Bucket, { label: string; hint: string }> = {
  ativos_sem_vinculo:    { label: "Ativos sem vínculo",        hint: "Status ativo mas sem turma aberta" },
  desligados_com_vinculo:{ label: "Desligados com vínculo",    hint: "Desligados/transferidos com turma ainda aberta" },
  busca_ativa_stale:     { label: "Busca ativa antiga",        hint: "Candidatos a desligamento (sem presença há muito tempo)" },
  ativos_sem_presenca:   { label: "Ativos sem presença",       hint: "Sem presença há mais do que o limite" },
};

export default function LinkHealthCard() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [downloading, setDownloading] = useState<Bucket | null>(null);
  const [lastRun, setLastRun] = useState<{ at: string; result: string } | null>(null);

  const load = async () => {
    setLoading(true);
    const [{ data: s }, { data: cfg }] = await Promise.all([
      supabase.rpc("get_link_health_stats"),
      supabase.from("configuracoes_gerais").select("chave,valor")
        .in("chave", ["recompute_ultima_execucao", "recompute_ultimo_resultado"]),
    ]);
    setStats(s);
    const cm: Record<string, string> = {};
    (cfg || []).forEach((c: any) => { cm[c.chave] = c.valor || ""; });
    setLastRun({ at: cm.recompute_ultima_execucao || "", result: cm.recompute_ultimo_resultado || "" });
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const runRecompute = async () => {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("recompute-participantes-status");
      if (error) throw error;
      toast.success(`Recompute concluído: ${data?.reativados ?? 0} reativados, ${data?.sinalizados ?? 0} sinalizados, ${data?.alertados ?? 0} alertas`);
      await load();
    } catch (e: any) {
      toast.error("Falha no recompute: " + (e?.message || e));
    } finally {
      setRunning(false);
    }
  };

  const downloadBucket = async (bucket: Bucket) => {
    setDownloading(bucket);
    try {
      const { data, error } = await supabase.rpc("get_link_health_list", { _bucket: bucket });
      if (error) throw error;
      const rows = (data as any[]) || [];
      if (rows.length === 0) {
        toast.info("Nenhum registro neste bucket");
        return;
      }
      const aoa = [
        ["Nome", "Status", "Bairro", "Período", "Última Presença", "Dias sem Presença"],
        ...rows.map(r => [r.nome, r.status, r.bairro || "", r.periodo || "", r.ultima_presenca || "—", r.dias_sem_presenca ?? "—"]),
      ];
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, BUCKET_LABELS[bucket].label.slice(0, 30));
      const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
      const filename = buildFileName(`SaudeVinculos_${bucket}`, "xlsx");
      saveAs(new Blob([buf]), filename);
    } catch (e: any) {
      toast.error("Falha ao gerar planilha: " + (e?.message || e));
    } finally {
      setDownloading(null);
    }
  };

  const cards: Bucket[] = ["ativos_sem_vinculo", "desligados_com_vinculo", "busca_ativa_stale", "ativos_sem_presenca"];
  const lastResult = lastRun?.result ? safeParse(lastRun.result) : null;

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm flex items-center gap-2">
          <Activity className="h-4 w-4" /> Saúde dos Vínculos
        </CardTitle>
        <div className="flex gap-1">
          <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={load} disabled={loading}>
            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Button size="sm" className="h-7 text-[10px]" onClick={runRecompute} disabled={running}>
            {running ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Play className="h-3 w-3 mr-1" />}
            Recompute
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading || !stats ? (
          <p className="text-xs text-muted-foreground">Carregando indicadores...</p>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
              {cards.map(b => (
                <div key={b} className="border rounded p-2 space-y-1">
                  <p className="text-[10px] text-muted-foreground leading-tight">{BUCKET_LABELS[b].label}</p>
                  <p className="text-2xl font-bold">{stats[b] ?? 0}</p>
                  <p className="text-[9px] text-muted-foreground leading-tight">{BUCKET_LABELS[b].hint}</p>
                  <Button
                    size="sm" variant="outline"
                    className="h-6 text-[9px] w-full"
                    disabled={!stats[b] || downloading === b}
                    onClick={() => downloadBucket(b)}
                  >
                    {downloading === b ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Download className="h-3 w-3 mr-1" />Planilha</>}
                  </Button>
                </div>
              ))}
            </div>
            <div className="text-[10px] text-muted-foreground border-t pt-2">
              {lastRun?.at ? (
                <>Última execução: {new Date(lastRun.at).toLocaleString("pt-BR")}
                  {lastResult && <> — {lastResult.reativados} reativados, {lastResult.sinalizados} sinalizados, {lastResult.alertados} alertas</>}
                </>
              ) : <>Recompute nunca executado.</>}
              {" · "}Limites: {stats.parametros?.dias_inatividade}d inatividade / {stats.parametros?.dias_alerta}d alerta
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function safeParse(s: string) { try { return JSON.parse(s); } catch { return null; } }