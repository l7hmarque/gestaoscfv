import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

interface Props {
  mesRef: string;
  onProcessed?: () => void;
  onRouteToTab?: (tab: "despesas" | "orcamentos" | "bancario", payload?: any) => void;
}

export default function CaixaEntradaTab({ mesRef, onProcessed, onRouteToTab }: Props) {
  const [docs, setDocs] = useState<ClassifiedDoc[]>([]);
  const [running, setRunning] = useState(false);

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

            const base64 = await fileToBase64(d.file);
            const { data, error } = await supabase.functions.invoke("classify-financeiro-doc", {
              body: { file_base64: base64, mime_type: d.file.type },
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

    for (const d of fila) {
      setDocs((p) => p.map((x) => (x.id === d.id ? { ...x, status: "processando" } : x)));
      try {
        const base64 = await fileToBase64(d.file);
        let fnName: string | null = null;
        if (d.tipo === "despesa" || d.tipo === "tributo" || d.tipo === "folha") fnName = "detect-despesa-from-doc";
        else if (d.tipo === "orcamento") fnName = "detect-orcamento-from-doc";
        else if (d.tipo === "controle_bancario") fnName = "detect-controle-bancario";

        if (!fnName) {
          setDocs((p) => p.map((x) => (x.id === d.id ? { ...x, status: "erro", erro: "Tipo desconhecido" } : x)));
          continue;
        }
        const { data, error } = await supabase.functions.invoke(fnName, {
          body: { file_base64: base64, mime_type: d.file.type },
        });
        if (error) throw error;
        setDocs((p) => p.map((x) => (x.id === d.id ? { ...x, status: "ok", resultado: data } : x)));
      } catch (e: any) {
        console.error(e);
        setDocs((p) => p.map((x) => (x.id === d.id ? { ...x, status: "erro", erro: e?.message || "Falha" } : x)));
      }
    }
    setRunning(false);
    toast.success("Processamento concluído. Revise nas abas específicas para confirmar o lançamento.");
    onProcessed?.();
  };

  const remove = (id: string) => setDocs((p) => p.filter((x) => x.id !== id));
  const clearAll = () => setDocs([]);

  const counts = docs.reduce((acc, d) => {
    acc[d.tipo] = (acc[d.tipo] || 0) + 1;
    return acc;
  }, {} as Record<DocTipo, number>);

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
                      </div>
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