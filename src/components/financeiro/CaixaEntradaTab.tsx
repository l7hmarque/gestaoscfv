import { useState, useCallback, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PDFDocument } from "pdf-lib";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Inbox, Loader2, Receipt, AlertTriangle, CheckCircle2, Trash2, Upload, FileText, Eye } from "lucide-react";
import { toast } from "sonner";
import { validateDespesa } from "@/lib/despesaImportValidation";
import { applyOrcamentoMatching } from "@/lib/orcamentoMatcher";
import { analyzePdf } from "@/lib/pdfTextAnalyzer";
import ConciliacaoExtratoCard from "./ConciliacaoExtratoCard";

interface ClassifiedDoc {
  id: string;
  file?: File;
  fileName: string;
  status: "fila" | "processando" | "ok" | "erro";
  storageUrl?: string;
  storagePath?: string;
  mimeType?: string;
  resultado?: any;
  erro?: string;
  totalChunks?: number;
  doneChunks?: number;
  persisted?: boolean;
  rota?: "texto" | "visao";
  rotaMotivo?: string;
}

const PAGES_PER_CHUNK = 5;
const MAX_PARALLEL_FILES = 3;

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

async function splitPdfIntoChunks(file: File, pagesPerChunk = PAGES_PER_CHUNK): Promise<string[]> {
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
  /** Disparado quando o usuário clica em "Revisar e Lançar" — entrega os docs ao pipeline do ImportReviewDialog na FinanceiroPage. */
  onRequestReview?: (caixaDocs: Array<{ id: string; fileName: string; storageUrl?: string; despesas: any[] }>) => void;
}

export default function CaixaEntradaTab({ mesRef, onProcessed, onRequestReview }: Props) {
  const [docs, setDocs] = useState<ClassifiedDoc[]>([]);
  const [running, setRunning] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [totalUnits, setTotalUnits] = useState(0);
  const [doneUnits, setDoneUnits] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const tickRef = useRef<number | null>(null);
  const queueRef = useRef<ClassifiedDoc[]>([]);
  const draining = useRef(false);

  useEffect(() => {
    if (running) {
      tickRef.current = window.setInterval(() => setNow(Date.now()), 500);
      return () => { if (tickRef.current) window.clearInterval(tickRef.current); };
    }
  }, [running]);

  // Carrega documentos persistidos do mês (sobrevive a HMR/refresh/troca de aba)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("caixa_entrada_documentos" as any)
        .select("*")
        .eq("mes_ref", mesRef)
        .order("created_at", { ascending: true });
      if (cancelled || error || !data) return;
      const carregados: ClassifiedDoc[] = (data as any[]).map((r) => ({
        id: r.id,
        fileName: r.file_name,
        status: r.status,
        storageUrl: r.storage_url ?? undefined,
        storagePath: r.storage_path ?? undefined,
        mimeType: r.mime_type ?? undefined,
        totalChunks: r.total_chunks ?? undefined,
        doneChunks: r.done_chunks ?? 0,
        resultado: Array.isArray(r.despesas_json) && r.despesas_json.length > 0
          ? { despesas: r.despesas_json, total: r.despesas_json.length }
          : undefined,
        erro: r.erro ?? undefined,
        persisted: true,
      }));
      setDocs(carregados);
    })();
    return () => { cancelled = true; };
  }, [mesRef]);

  const persistDoc = async (id: string, patch: Record<string, any>) => {
    try {
      await supabase.from("caixa_entrada_documentos" as any).update(patch).eq("id", id);
    } catch (e) { console.warn("persistDoc fail", e); }
  };

  const processOne = async (d: ClassifiedDoc) => {
    if (!d.file) return; // doc carregado de sessão anterior — não reprocessa
    setDocs((p) => p.map((x) => (x.id === d.id ? { ...x, status: "processando" } : x)));
    void persistDoc(d.id, { status: "processando" });
    try {
      // Upload em paralelo com a divisão em chunks
      const ext = d.file.name.split(".").pop() || "pdf";
      const path = `financeiro/caixa/${Date.now()}_${d.id}.${ext}`;
      const isPdf = (d.file.type || "").toLowerCase().includes("pdf");

      // 1) Sobe o arquivo (paralelo) e, para PDFs, analisa camada de texto + marca amarela.
      const uploadPromise = supabase.storage.from("documentos").upload(path, d.file).then(async (r) => {
        if (r.error) throw r.error;
        const { data: urlData } = await supabase.storage.from("documentos").getPublicUrl(path);
        setDocs((p) => p.map((x) => (x.id === d.id ? { ...x, storageUrl: urlData?.publicUrl, storagePath: path } : x)));
        void persistDoc(d.id, { storage_url: urlData?.publicUrl, storage_path: path });
      });

      let pagesText: string[] | null = null;
      let rota: "texto" | "visao" = "visao";
      let rotaMotivo = "";
      if (isPdf) {
        try {
          const an = await analyzePdf(d.file);
          rota = an.mode === "text" ? "texto" : "visao";
          rotaMotivo = an.reason;
          if (an.mode === "text") pagesText = an.pagesText;
          setDocs((p) => p.map((x) => (x.id === d.id ? { ...x, rota, rotaMotivo } : x)));
        } catch (e) {
          console.warn("analyzePdf falhou, usando visão:", e);
          rota = "visao";
          rotaMotivo = "análise de texto falhou — usando visão";
        }
      }

      // 2) Monta partes (texto: 1 chamada só; visão: chunks de N páginas em base64).
      let partes: { kind: "text"; pages: string[] }[] | { kind: "vision"; b64: string }[];
      if (pagesText) {
        // Quebra em lotes para não estourar memória/contexto da edge function em PDFs grandes.
        const TEXT_PAGES_PER_BATCH = 8;
        const lotes: { kind: "text"; pages: string[] }[] = [];
        for (let i = 0; i < pagesText.length; i += TEXT_PAGES_PER_BATCH) {
          lotes.push({ kind: "text", pages: pagesText.slice(i, i + TEXT_PAGES_PER_BATCH) });
        }
        partes = lotes as any;
      } else if (isPdf) {
        const chunks = await splitPdfIntoChunks(d.file, PAGES_PER_CHUNK);
        partes = chunks.map((b64) => ({ kind: "vision", b64 })) as any;
      } else {
        partes = [{ kind: "vision", b64: await fileToBase64(d.file) }] as any;
      }
      await uploadPromise;

      const totalChunks = partes.length;
      setDocs((p) => p.map((x) => (x.id === d.id ? { ...x, totalChunks, doneChunks: 0 } : x)));
      void persistDoc(d.id, { total_chunks: totalChunks, done_chunks: 0 });
      setTotalUnits((u) => u + (totalChunks - 1));

      const despesasAcc: any[] = [];
      let ultimaResposta: any = null;
      for (let idx = 0; idx < partes.length; idx++) {
        const parte: any = partes[idx];
        const body = parte.kind === "text"
          ? { pages_text: parte.pages, mime_type: d.file.type }
          : { file_base64: parte.b64, mime_type: d.file.type };
        const { data, error } = await supabase.functions.invoke("detect-despesa-from-doc", { body });
        if (error) throw error;
        ultimaResposta = data;
        if (Array.isArray(data?.despesas)) despesasAcc.push(...data.despesas);
        setDoneUnits((u) => u + 1);
        setDocs((p) => p.map((x) => (x.id === d.id ? { ...x, doneChunks: (x.doneChunks ?? 0) + 1 } : x)));
        void persistDoc(d.id, { done_chunks: idx + 1 });
      }

      const resultado = isPdf
        ? { despesas: despesasAcc, extracted: despesasAcc[0] ?? null, total: despesasAcc.length }
        : ultimaResposta;
      setDocs((p) => p.map((x) => (x.id === d.id ? { ...x, status: "ok", resultado } : x)));
      void persistDoc(d.id, { status: "ok", despesas_json: resultado?.despesas ?? [] });
      // Lança automaticamente as despesas extraídas (sem revisão manual).
      const despesasExtraidas = resultado?.despesas ?? [];
      if (despesasExtraidas.length > 0) {
        try {
          const inserted = await launchDespesasFromDoc(d.id, d.storageUrl, despesasExtraidas);
          if (inserted > 0) {
            // Remove da Caixa de Entrada — já está em Despesas.
            try { await supabase.from("caixa_entrada_documentos" as any).delete().eq("id", d.id); } catch {}
            setDocs((p) => p.filter((x) => x.id !== d.id));
            toast.success(`${inserted} despesa(s) lançada(s) de ${d.file.name}`);
          }
        } catch (e: any) {
          console.error("auto-launch fail", e);
          toast.error(`Extraído mas falhou ao lançar (${d.file.name}): ${e?.message || "erro"}`);
        }
      } else {
        toast.warning(`${d.file.name}: nenhuma despesa identificada — confira o documento.`);
      }
    } catch (e: any) {
      console.error(e);
      setDocs((p) => p.map((x) => (x.id === d.id ? { ...x, status: "erro", erro: e?.message || "Falha" } : x)));
      void persistDoc(d.id, { status: "erro", erro: e?.message || "Falha" });
      // Avança a barra para os chunks que faltavam
      const cur = docs.find((x) => x.id === d.id);
      const restante = (cur?.totalChunks ?? 1) - (cur?.doneChunks ?? 0);
      if (restante > 0) setDoneUnits((u) => u + restante);
    }
  };

  const drainQueue = async () => {
    if (draining.current) return;
    draining.current = true;
    setRunning(true);
    if (!startedAt) setStartedAt(Date.now());
    try {
      while (queueRef.current.length > 0) {
        const lote = queueRef.current.splice(0, MAX_PARALLEL_FILES);
        await Promise.all(lote.map(processOne));
      }
      toast.success("Processamento concluído. Revise as despesas extraídas para confirmar o lançamento.");
      onProcessed?.();
    } finally {
      draining.current = false;
      setRunning(false);
      setStartedAt(null);
    }
  };

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files?.length) return;
    const { data: userData } = await supabase.auth.getUser();
    const created_by = userData?.user?.id ?? null;
    const novos: ClassifiedDoc[] = Array.from(files).map((f) => ({
      id: crypto.randomUUID(),
      file: f,
      fileName: f.name,
      mimeType: f.type,
      status: "fila",
    }));
    // Persiste imediatamente — sobrevive a HMR/refresh/troca de aba
    try {
      await supabase.from("caixa_entrada_documentos" as any).insert(
        novos.map((n) => ({
          id: n.id, mes_ref: mesRef, file_name: n.fileName,
          mime_type: n.mimeType, status: "fila", created_by,
        }))
      );
    } catch (e) { console.warn("insert caixa fail", e); }
    setDocs((p) => [...p, ...novos]);
    // Estimativa inicial: 1 unidade por arquivo (ajustamos quando sabemos o nº de páginas)
    setTotalUnits((u) => u + novos.length);
    queueRef.current.push(...novos);
    void drainQueue();
  }, [mesRef]);

  const remove = async (id: string) => {
    setDocs((p) => p.filter((x) => x.id !== id));
    try { await supabase.from("caixa_entrada_documentos" as any).delete().eq("id", id); } catch {}
  };
  const clearAll = async () => {
    const ids = docs.map((d) => d.id);
    setDocs([]);
    setTotalUnits(0);
    setDoneUnits(0);
    if (ids.length) {
      try { await supabase.from("caixa_entrada_documentos" as any).delete().in("id", ids); } catch {}
    }
  };

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

  const totaisExtraidos = docs.reduce((acc, d) => acc + (d.resultado?.despesas?.length ?? 0), 0);

  const lancarTudoAgora = async () => {
    const prontos = docs.filter((d) => d.status === "ok" && (d.resultado?.despesas?.length ?? 0) > 0);
    if (prontos.length === 0) { toast.error("Nenhuma despesa pronta para lançar"); return; }
    setLaunching(true);
    try {
      const { data: cats } = await supabase.from("categorias_financeiras").select("id, codigo");
      const rubricaToCategoriaId: Record<string, string> = {};
      (cats || []).forEach((c: any) => { rubricaToCategoriaId[String(c.codigo).trim()] = c.id; });

      const rawRows: any[] = [];
      for (const d of prontos) {
        for (const e of (d.resultado.despesas as any[])) {
          const { row } = validateDespesa(e, { mesRef, storageUrl: d.storageUrl, rubricaToCategoriaId });
          rawRows.push(row);
        }
      }
      const lote_id = crypto.randomUUID();
      const { rows } = await applyOrcamentoMatching(rawRows, mesRef);
      const cleanRows = rows.map(({ marcado_orcamento, ...rest }: any) => ({ ...rest, lote_id }));
      const { error } = await supabase.from("despesas").insert(cleanRows as any);
      if (error) { toast.error(`Erro ao lançar: ${error.message}`); return; }
      toast.success(`${cleanRows.length} despesa(s) lançada(s) sem revisão`);
      const launchedIds = prontos.map((d) => d.id);
      try { await supabase.from("caixa_entrada_documentos" as any).delete().in("id", launchedIds); } catch {}
      setDocs((p) => p.filter((d) => !launchedIds.includes(d.id)));
      setTotalUnits(0); setDoneUnits(0);
      onProcessed?.();
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Falha ao lançar despesas");
    } finally {
      setLaunching(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Inbox className="h-4 w-4" /> Caixa de Entrada — Despesas para SIT — {mesRef}
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Envie PDFs/imagens de NFs, boletos, faturas, comprovantes PIX/TED, holerites, DARF, GPS e GFIP. A IA extrai cada despesa e prepara o lançamento no SIT. O processamento começa automaticamente.
        </p>
        <p className="text-[11px] mt-1 px-2 py-1 rounded bg-yellow-200/40 border border-yellow-400/40 text-foreground/80">
          💡 Antes de subir, marque com <b>marca-texto amarelo</b> os valores que vieram de orçamento aprovado — a IA classifica essas linhas como <b>Pesquisa de Preço (modalidade 7)</b>.
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
          <div className="text-[10px] text-muted-foreground">PDF, JPG, PNG — múltiplos arquivos. Processa em paralelo automaticamente.</div>
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
              <Badge variant="outline" className="text-[10px]">Arquivos: {docs.length}</Badge>
              <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-700 border-blue-500/30">
                Despesas extraídas: {totaisExtraidos}
              </Badge>
              <div className="ml-auto">
                {totaisExtraidos > 0 && !running && (
                  <Button
                    size="sm"
                    className="h-7 text-xs mr-1"
                    onClick={lancarTudoAgora}
                    disabled={launching}
                  >
                    {launching ? (<><Loader2 className="h-3 w-3 mr-1 animate-spin" />Lançando…</>) : `Lançar ${totaisExtraidos} no SIT agora (sem revisar)`}
                  </Button>
                )}
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={clearAll} disabled={running}>Limpar</Button>
              </div>
            </div>

            {totalUnits > 0 && (
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
                const qtd = d.resultado?.despesas?.length ?? 0;
                return (
                  <div key={d.id} className="flex items-center gap-2 rounded-md border bg-card p-2">
                    <Receipt className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium truncate">{d.fileName}</div>
                      <div className="flex flex-wrap items-center gap-1 mt-0.5">
                        {d.status === "ok" && (
                          <span className="text-[9px] text-emerald-700">{qtd} despesa{qtd === 1 ? "" : "s"} extraída{qtd === 1 ? "" : "s"}</span>
                        )}
                        {d.rota && (
                          <span
                            title={d.rotaMotivo}
                            className={`text-[9px] inline-flex items-center gap-0.5 px-1 py-px rounded border ${
                              d.rota === "texto"
                                ? "bg-blue-500/10 text-blue-700 border-blue-500/30"
                                : "bg-purple-500/10 text-purple-700 border-purple-500/30"
                            }`}
                          >
                            {d.rota === "texto" ? <FileText className="h-2.5 w-2.5" /> : <Eye className="h-2.5 w-2.5" />}
                            {d.rota === "texto" ? "texto" : "visão"}
                          </span>
                        )}
                        {d.status === "processando" && d.totalChunks && d.totalChunks > 1 && (
                          <span className="text-[9px] text-muted-foreground">
                            lote {d.doneChunks ?? 0}/{d.totalChunks}
                          </span>
                        )}
                        {d.erro && (
                          <span className="text-[9px] text-destructive flex items-center gap-0.5"><AlertTriangle className="h-2.5 w-2.5" />{d.erro}</span>
                        )}
                      </div>
                      {d.status === "processando" && d.totalChunks && d.totalChunks > 1 && (
                        <Progress value={Math.round(((d.doneChunks ?? 0) / d.totalChunks) * 100)} className="h-1 mt-1" />
                      )}
                    </div>
                    <div className="shrink-0">
                      {d.status === "processando" && <Badge variant="secondary" className="text-[9px] gap-0.5"><Loader2 className="h-2.5 w-2.5 animate-spin" />processando</Badge>}
                      {d.status === "fila" && <Badge variant="outline" className="text-[9px]">na fila</Badge>}
                      {d.status === "ok" && <Badge variant="outline" className="text-[9px] border-emerald-400 text-emerald-700 gap-0.5"><CheckCircle2 className="h-2.5 w-2.5" />pronto</Badge>}
                      {d.status === "erro" && <Badge variant="destructive" className="text-[9px]" title={d.erro}>erro</Badge>}
                    </div>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => remove(d.id)} disabled={d.status === "processando"}>
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>
                );
              })}
            </div>

            <div className="rounded-md border bg-muted/30 p-2 text-[10px] text-muted-foreground">
              Cada documento processado é lançado automaticamente na aba <b>Despesas</b>. Use o botão <b>Lançar agora</b> apenas para reprocessar arquivos que já estavam aqui de sessões anteriores.
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
