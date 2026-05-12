import { useState, useCallback, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PDFDocument } from "pdf-lib";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Inbox, Loader2, FileText, Banknote, ClipboardList, FileSpreadsheet, Receipt, AlertTriangle, CheckCircle2, Trash2, Sparkles, Upload } from "lucide-react";
import { toast } from "sonner";

type DocTipo = "despesa" | "tributo" | "folha" | "orcamento" | "controle_bancario" | "desconhecido";

interface ClassifiedDoc {
  id: string;
  file: File;
  tipo: DocTipo;
  confianca: number;
  status: "fila" | "classificando" | "processando" | "ok" | "erro";
  motivo?: string;
  storageUrl?: string;
  resultado?: any;
  erro?: string;
  totalChunks?: number;
  doneChunks?: number;
}

const TIPO_META: Record<DocTipo, { label: string; icon: any; color: string }> = {
  despesa: { label: "Despesa", icon: Receipt, color: "bg-blue-500/10 text-blue-700 border-blue-500/30" },
  tributo: { label: "Tributo Federal", icon: FileText, color: "bg-purple-500/10 text-purple-700 border-purple-500/30" },
  folha: { label: "Folha/Holerite", icon: FileSpreadsheet, color: "bg-amber-500/10 text-amber-700 border-amber-500/30" },
  orcamento: { label: "Orçamento/Mapa", icon: ClipboardList, color: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30" },
  controle_bancario: { label: "Controle Bancário", icon: Banknote, color: "bg-slate-500/10 text-slate-700 border-slate-500/30" },
  desconhecido: { label: "Não classificado", icon: AlertTriangle, color: "bg-rose-500/10 text-rose-700 border-rose-500/30" },
};

async function fileToBase64(file: File) {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunk = 8192;
  for (let j = 0; j < bytes.length; j += chunk) binary += String.fromCharCode(...bytes.subarray(j, j + chunk));
  return btoa(binary);
}

async function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  const chunk = 8192;
  for (let j = 0; j < bytes.length; j += chunk) binary += String.fromCharCode(...bytes.subarray(j, j + chunk));
  return btoa(binary);
}

/** Extrai apenas a 1ª página do PDF como base64 (usado para classificação rápida). */
async function firstPagePdfBase64(file: File): Promise<{ base64: string; mime: string }> {
  const isPdf = (file.type || "").toLowerCase().includes("pdf");
  if (!isPdf) return { base64: await fileToBase64(file), mime: file.type };
  try {
    const buf = await file.arrayBuffer();
    const src = await PDFDocument.load(buf);
    if (src.getPageCount() <= 1) return { base64: await fileToBase64(file), mime: file.type };
    const dest = await PDFDocument.create();
    const [p0] = await dest.copyPages(src, [0]);
    dest.addPage(p0);
    const bytes = await dest.save();
    return { base64: await bytesToBase64(bytes), mime: "application/pdf" };
  } catch {
    return { base64: await fileToBase64(file), mime: file.type };
  }
}

/** Quebra um PDF em pedaços de N páginas (default 5). Retorna lista de base64. */
async function splitPdfIntoChunks(file: File, pagesPerChunk = 5): Promise<string[]> {
  const buf = await file.arrayBuffer();
  const src = await PDFDocument.load(buf);
  const total = src.getPageCount();
  if (total <= pagesPerChunk) return [await fileToBase64(file)];
  const out: string[] = [];
  for (let start = 0; start < total; start += pagesPerChunk) {
    const end = Math.min(start + pagesPerChunk, total);
    const dest = await PDFDocument.create();
    const indices = Array.from({ length: end - start }, (_, i) => start + i);
    const copied = await dest.copyPages(src, indices);
    copied.forEach((p) => dest.addPage(p));
    const bytes = await dest.save();
    out.push(await bytesToBase64(bytes));
  }
  return out;
}

interface Props {
  mesRef: string;
  onProcessed?: () => void;
  onRouteToTab?: (tab: "despesas" | "orcamentos" | "bancario", payload?: any) => void;
}

export default function CaixaEntradaTab({ mesRef, onProcessed, onRouteToTab }: Props) {
  const [docs, setDocs] = useState<ClassifiedDoc[]>([]);
  const [running, setRunning] = useState(false);
  // Progresso global (em "unidades de chunk")
  const [totalUnits, setTotalUnits] = useState(0);
  const [doneUnits, setDoneUnits] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const tickRef = useRef<number | null>(null);

  useEffect(() => {
    if (running) {
      tickRef.current = window.setInterval(() => setNow(Date.now()), 500);
      return () => { if (tickRef.current) window.clearInterval(tickRef.current); };
    }
  }, [running]);

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files?.length) return;
    const novos: ClassifiedDoc[] = Array.from(files).map((f) => ({
      id: crypto.randomUUID(),
      file: f,
      tipo: "desconhecido" as DocTipo,
      confianca: 0,
      status: "fila",
    }));
    setDocs((p) => [...p, ...novos]);

    setRunning(true);
    try {
      // 1) Upload + classificação em paralelo
      await Promise.all(
        novos.map(async (d) => {
          try {
            setDocs((p) => p.map((x) => (x.id === d.id ? { ...x, status: "classificando" } : x)));
            const ext = d.file.name.split(".").pop() || "pdf";
            const path = `financeiro/caixa/${Date.now()}_${d.id}.${ext}`;
            const { error: upErr } = await supabase.storage.from("documentos").upload(path, d.file);
            if (upErr) throw upErr;
            const { data: urlData } = await supabase.storage.from("documentos").getPublicUrl(path);

            const { base64, mime } = await firstPagePdfBase64(d.file);
            const { data, error } = await supabase.functions.invoke("classify-financeiro-doc", {
              body: { file_base64: base64, mime_type: mime },
            });
            if (error) throw error;
            const tipo: DocTipo = (data?.tipo as DocTipo) || "desconhecido";
            setDocs((p) =>
              p.map((x) =>
                x.id === d.id
                  ? { ...x, tipo, confianca: data?.confianca || 0, motivo: data?.motivo, storageUrl: urlData?.publicUrl, status: "fila" }
                  : x
              )
            );
          } catch (e: any) {
            console.error(e);
            setDocs((p) => p.map((x) => (x.id === d.id ? { ...x, status: "erro", erro: e?.message } : x)));
          }
        })
      );
    } finally {
      setRunning(false);
    }
  }, []);

  const processarTodos = async () => {
    setRunning(true);
    // Ordem: orcamentos → controle bancário → despesas/tributos/folha
    const ordem: DocTipo[] = ["orcamento", "controle_bancario", "despesa", "tributo", "folha"];
    const fila = docs.filter((d) => d.status === "fila").sort((a, b) => ordem.indexOf(a.tipo) - ordem.indexOf(b.tipo));

    // Pré-cálculo de unidades (chunks) para barra de progresso
    const planos = await Promise.all(
      fila.map(async (d) => {
        const isPdf = (d.file.type || "").toLowerCase().includes("pdf");
        const fnName =
          d.tipo === "despesa" || d.tipo === "tributo" || d.tipo === "folha" ? "detect-despesa-from-doc"
          : d.tipo === "orcamento" ? "detect-orcamento-from-doc"
          : d.tipo === "controle_bancario" ? "detect-controle-bancario" : null;
        const podeChunk = fnName === "detect-despesa-from-doc" && isPdf;
        let total = 1;
        if (podeChunk) {
          try {
            const buf = await d.file.arrayBuffer();
            const pdf = await PDFDocument.load(buf);
            total = Math.max(1, Math.ceil(pdf.getPageCount() / 5));
          } catch { total = 1; }
        }
        return { id: d.id, fnName, podeChunk, total };
      })
    );
    const unitsTotal = planos.reduce((a, p) => a + p.total, 0);
    setTotalUnits(unitsTotal);
    setDoneUnits(0);
    setStartedAt(Date.now());
    setDocs((p) => p.map((x) => {
      const plano = planos.find((pl) => pl.id === x.id);
      return plano ? { ...x, totalChunks: plano.total, doneChunks: 0 } : x;
    }));

    for (const d of fila) {
      const plano = planos.find((pl) => pl.id === d.id);
      setDocs((p) => p.map((x) => (x.id === d.id ? { ...x, status: "processando" } : x)));
      try {
        const fnName = plano?.fnName ?? null;
        if (!fnName) {
          setDocs((p) => p.map((x) => (x.id === d.id ? { ...x, status: "erro", erro: "Tipo desconhecido" } : x)));
          if (plano) setDoneUnits((u) => u + plano.total);
          continue;
        }

        // Para detect-despesa em PDFs, dividir em lotes de 5 páginas para evitar IDLE_TIMEOUT (150s).
        const podeChunk = !!plano?.podeChunk;
        const partes = podeChunk ? await splitPdfIntoChunks(d.file, 5) : [await fileToBase64(d.file)];

        const despesasAcc: any[] = [];
        let ultimaResposta: any = null;
        for (let idx = 0; idx < partes.length; idx++) {
          const { data, error } = await supabase.functions.invoke(fnName, {
            body: { file_base64: partes[idx], mime_type: d.file.type },
          });
          if (error) throw error;
          ultimaResposta = data;
          if (Array.isArray(data?.despesas)) despesasAcc.push(...data.despesas);
          setDoneUnits((u) => u + 1);
          setDocs((p) => p.map((x) => (x.id === d.id ? { ...x, doneChunks: (x.doneChunks ?? 0) + 1 } : x)));
        }
        const resultado = podeChunk
          ? { despesas: despesasAcc, extracted: despesasAcc[0] ?? null, total: despesasAcc.length }
          : ultimaResposta;
        setDocs((p) => p.map((x) => (x.id === d.id ? { ...x, status: "ok", resultado } : x)));
      } catch (e: any) {
        console.error(e);
        setDocs((p) => p.map((x) => (x.id === d.id ? { ...x, status: "erro", erro: e?.message || "Falha" } : x)));
        // Marca o restante das unidades dessa fila como concluídas para a barra avançar.
        if (plano) {
          const restante = plano.total - (docs.find((x) => x.id === d.id)?.doneChunks ?? 0);
          if (restante > 0) setDoneUnits((u) => u + restante);
        }
      }
    }
    setRunning(false);
    setStartedAt(null);
    toast.success("Processamento concluído. Revise nas abas específicas para confirmar o lançamento.");
    onProcessed?.();
  };

  const remove = (id: string) => setDocs((p) => p.filter((x) => x.id !== id));
  const clearAll = () => setDocs([]);

  const counts = docs.reduce((acc, d) => {
    acc[d.tipo] = (acc[d.tipo] || 0) + 1;
    return acc;
  }, {} as Record<DocTipo, number>);

  const progressPct = totalUnits > 0 ? Math.min(100, Math.round((doneUnits / totalUnits) * 100)) : 0;
  const elapsedMs = startedAt ? now - startedAt : 0;
  const avgMs = doneUnits > 0 ? elapsedMs / doneUnits : 0;
  const restanteMs = avgMs > 0 ? avgMs * (totalUnits - doneUnits) : 0;
  const fmtTime = (ms: number) => {
    const s = Math.max(0, Math.round(ms / 1000));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return m > 0 ? `${m}m${r.toString().padStart(2, "0")}s` : `${r}s`;
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Inbox className="h-4 w-4" /> Caixa de Entrada Financeira — {mesRef}
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Envie qualquer documento (despesa, tributo, folha, orçamento, extrato bancário). A IA classifica e direciona para o detector correto. Ordem ideal: <b>Orçamentos → Bancário → Despesas/Tributos/Folha</b>.
        </p>
        <p className="text-[11px] mt-1 px-2 py-1 rounded bg-yellow-200/40 border border-yellow-400/40 text-foreground/80">
          💡 Antes de subir o PDF de despesas, use o <b>marca-texto amarelo</b> do leitor de PDF nos valores que vieram de orçamento aprovado. A IA detecta o destaque e classifica essas despesas como <b>Pesquisa de Preço (modalidade 7)</b> automaticamente.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <label
          className="block cursor-pointer rounded-md border-2 border-dashed border-primary/30 bg-primary/5 hover:bg-primary/10 transition p-6 text-center"
          onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("bg-primary/15"); }}
          onDragLeave={(e) => { e.currentTarget.classList.remove("bg-primary/15"); }}
          onDrop={(e) => { e.preventDefault(); e.currentTarget.classList.remove("bg-primary/15"); handleFiles(e.dataTransfer.files); }}
        >
          <Upload className="h-6 w-6 mx-auto text-primary mb-1" />
          <div className="text-xs font-medium">Arraste arquivos aqui ou clique para escolher</div>
          <div className="text-[10px] text-muted-foreground">PDF, JPG, PNG — múltiplos arquivos</div>
          <input
            type="file"
            multiple
            accept="image/*,application/pdf"
            className="hidden"
            onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }}
          />
        </label>

        {docs.length > 0 && (
          <>
            <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
              <Badge variant="outline" className="text-[10px]">Total: {docs.length}</Badge>
              {Object.entries(counts).map(([t, n]) => {
                const meta = TIPO_META[t as DocTipo];
                if (!meta || !n) return null;
                return <Badge key={t} variant="outline" className={`text-[10px] ${meta.color}`}>{meta.label}: {n}</Badge>;
              })}
              <div className="ml-auto flex gap-1">
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={clearAll} disabled={running}>Limpar</Button>
                <Button size="sm" className="h-7 gap-1 text-xs" onClick={processarTodos} disabled={running || docs.every((d) => d.status !== "fila")}>
                  {running ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                  Processar todos
                </Button>
              </div>
            </div>

            {(running || (totalUnits > 0 && doneUnits >= totalUnits)) && totalUnits > 0 && (
              <div className="rounded-md border bg-muted/30 p-2 space-y-1">
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span className="font-medium text-foreground/80">
                    {running ? "Processando…" : "Concluído"} {doneUnits}/{totalUnits} lotes ({progressPct}%)
                  </span>
                  <span>
                    {running
                      ? (doneUnits > 0 ? `restam ~${fmtTime(restanteMs)} • decorrido ${fmtTime(elapsedMs)}` : `decorrido ${fmtTime(elapsedMs)}`)
                      : `tempo total ${fmtTime(elapsedMs)}`}
                  </span>
                </div>
                <Progress value={progressPct} className="h-1.5" />
              </div>
            )}

            <div className="space-y-1.5">
              {docs.map((d) => {
                const meta = TIPO_META[d.tipo] || TIPO_META.desconhecido;
                const Icon = meta.icon;
                return (
                  <div key={d.id} className="flex items-center gap-2 rounded-md border bg-card p-2">
                    <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium truncate">{d.file.name}</div>
                      <div className="flex flex-wrap items-center gap-1 mt-0.5">
                        <Badge variant="outline" className={`text-[9px] ${meta.color}`}>{meta.label}</Badge>
                        {d.confianca > 0 && (
                          <span className="text-[9px] text-muted-foreground">{Math.round(d.confianca * 100)}%</span>
                        )}
                        {d.motivo && <span className="text-[9px] text-muted-foreground truncate">— {d.motivo}</span>}
                        {d.status === "processando" && d.totalChunks && d.totalChunks > 1 && (
                          <span className="text-[9px] text-muted-foreground">
                            lote {d.doneChunks ?? 0}/{d.totalChunks}
                          </span>
                        )}
                      </div>
                      {d.status === "processando" && d.totalChunks && d.totalChunks > 1 && (
                        <Progress value={Math.round(((d.doneChunks ?? 0) / d.totalChunks) * 100)} className="h-1 mt-1" />
                      )}
                    </div>
                    <div className="shrink-0">
                      {d.status === "classificando" && <Badge variant="secondary" className="text-[9px] gap-0.5"><Loader2 className="h-2.5 w-2.5 animate-spin" />classificando</Badge>}
                      {d.status === "processando" && <Badge variant="secondary" className="text-[9px] gap-0.5"><Loader2 className="h-2.5 w-2.5 animate-spin" />processando</Badge>}
                      {d.status === "fila" && <Badge variant="outline" className="text-[9px]">na fila</Badge>}
                      {d.status === "ok" && <Badge variant="outline" className="text-[9px] border-emerald-400 text-emerald-700 gap-0.5"><CheckCircle2 className="h-2.5 w-2.5" />processado</Badge>}
                      {d.status === "erro" && <Badge variant="destructive" className="text-[9px]" title={d.erro}>erro</Badge>}
                    </div>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => remove(d.id)} disabled={running}>
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>
                );
              })}
            </div>

            <div className="rounded-md border bg-muted/30 p-2 text-[10px] text-muted-foreground">
              Após processar, abra a aba correspondente (<b>Despesas</b>, <b>Orçamentos</b> ou <b>Bancário</b>) para confirmar o lançamento. A revisão garante que nenhum dado é gravado sem sua aprovação.
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}