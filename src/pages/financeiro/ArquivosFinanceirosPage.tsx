import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Accordion, AcordeonItem } from "@/pages/biblioteca/BibliotecaAccordion";
import { Loader2, Download, FolderOpen, Package, FileText, Receipt, Search, ExternalLink, AlertCircle } from "lucide-react";
import { saveAs } from "file-saver";
import JSZip from "jszip";
import { toast } from "sonner";

type Despesa = {
  id: string;
  descricao: string;
  valor: number;
  data_lancamento: string;
  fornecedor: string | null;
  cnpj_cpf: string | null;
  numero_documento: string | null;
  comprovante_url: string | null;
  nota_url: string | null;
  boleto_url: string | null;
  status_sit: string | null;
  pendente_comprovante: boolean;
  sit_completo: boolean;
  sit_codigo_tipo_despesa: number | null;
  sit_codigo?: { codigo: number; descricao: string; categoria: string } | null;
};

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

function nomeArquivo(d: Despesa, kind: "comprovante" | "nota" | "boleto"): string {
  const safe = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\w-]/g, "_").slice(0, 40);
  const ext = kind === "boleto" ? "pdf" : "pdf";
  const numero = d.numero_documento || d.id.slice(0, 8);
  const fornec = d.fornecedor ? `_${safe(d.fornecedor)}` : "";
  return `${kind}_${safe(numero)}${fornec}.${ext}`;
}

async function baixarUrl(url: string): Promise<Blob | null> {
  try {
    // Se for URL relativa do bucket, gerar signed URL
    if (!url.startsWith("http")) {
      const { data } = await supabase.storage.from("prestacao-contas").createSignedUrl(url, 60);
      if (!data?.signedUrl) return null;
      url = data.signedUrl;
    }
    const r = await fetch(url);
    if (!r.ok) return null;
    return await r.blob();
  } catch {
    return null;
  }
}

export default function ArquivosFinanceirosPage() {
  const [busca, setBusca] = useState("");
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [baixandoLote, setBaixandoLote] = useState(false);

  const { data: despesas, isLoading } = useQuery({
    queryKey: ["arquivos-financeiros"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("despesas")
        .select("id, descricao, valor, data_lancamento, fornecedor, cnpj_cpf, numero_documento, comprovante_url, nota_url, boleto_url, status_sit, pendente_comprovante, sit_completo, sit_codigo_tipo_despesa")
        .order("data_lancamento", { ascending: false });
      if (error) throw error;

      // Buscar códigos SIT
      const codigos = Array.from(new Set((data || []).map((d: any) => d.sit_codigo_tipo_despesa).filter(Boolean)));
      const { data: codigosData } = codigos.length
        ? await supabase.from("sit_codigos").select("codigo, descricao, categoria").in("codigo", codigos)
        : { data: [] as any[] };
      const codMap = new Map((codigosData || []).map((c: any) => [c.codigo, c]));

      return (data || []).map((d: any) => ({
        ...d,
        sit_codigo: d.sit_codigo_tipo_despesa ? codMap.get(d.sit_codigo_tipo_despesa) || null : null,
      })) as Despesa[];
    },
  });

  // Apenas despesas com pelo menos 1 arquivo anexado
  const comArquivo = useMemo(
    () => (despesas || []).filter(d => d.comprovante_url || d.nota_url || d.boleto_url),
    [despesas]
  );

  // Árvore: Ano → Mês → Categoria SIT
  const arvore = useMemo(() => {
    const filtrados = comArquivo.filter(d => {
      if (!busca) return true;
      const q = busca.toLowerCase();
      return d.descricao.toLowerCase().includes(q)
        || (d.fornecedor || "").toLowerCase().includes(q)
        || (d.numero_documento || "").toLowerCase().includes(q);
    });
    const porAno = new Map<number, Map<number, Map<string, Despesa[]>>>();
    filtrados.forEach(d => {
      const dt = new Date(d.data_lancamento + "T12:00:00");
      const ano = dt.getFullYear();
      const mes = dt.getMonth() + 1;
      const cat = d.sit_codigo
        ? `${d.sit_codigo.categoria} — ${d.sit_codigo.codigo}: ${d.sit_codigo.descricao}`
        : "Sem categoria SIT";
      if (!porAno.has(ano)) porAno.set(ano, new Map());
      if (!porAno.get(ano)!.has(mes)) porAno.get(ano)!.set(mes, new Map());
      const catMap = porAno.get(ano)!.get(mes)!;
      if (!catMap.has(cat)) catMap.set(cat, []);
      catMap.get(cat)!.push(d);
    });
    return Array.from(porAno.entries()).sort((a, b) => b[0] - a[0]);
  }, [comArquivo, busca]);

  const totalArq = comArquivo.reduce((s, d) => s + (d.comprovante_url ? 1 : 0) + (d.nota_url ? 1 : 0) + (d.boleto_url ? 1 : 0), 0);
  const semArquivo = (despesas || []).length - comArquivo.length;

  function toggleDespesa(id: string) {
    setSelecionados(prev => {
      const nv = new Set(prev);
      nv.has(id) ? nv.delete(id) : nv.add(id);
      return nv;
    });
  }

  function toggleCategoria(items: Despesa[]) {
    const ids = items.map(i => i.id);
    const todos = ids.every(id => selecionados.has(id));
    setSelecionados(prev => {
      const nv = new Set(prev);
      if (todos) ids.forEach(id => nv.delete(id));
      else ids.forEach(id => nv.add(id));
      return nv;
    });
  }

  async function baixarArquivo(d: Despesa, url: string, kind: "comprovante" | "nota" | "boleto") {
    const blob = await baixarUrl(url);
    if (!blob) {
      toast.error("Não foi possível baixar o arquivo");
      return;
    }
    saveAs(blob, nomeArquivo(d, kind));
  }

  async function baixarLote() {
    if (selecionados.size === 0) {
      toast.error("Selecione despesas para baixar");
      return;
    }
    setBaixandoLote(true);
    try {
      const zip = new JSZip();
      const escolhidas = comArquivo.filter(d => selecionados.has(d.id));
      let ok = 0, fail = 0;
      for (const d of escolhidas) {
        const dt = new Date(d.data_lancamento + "T12:00:00");
        const ano = dt.getFullYear();
        const mes = String(dt.getMonth() + 1).padStart(2, "0");
        const cat = d.sit_codigo ? `${d.sit_codigo.categoria.replace(/[/]/g, "_")}` : "Sem_categoria";
        const subpasta = `${ano}/${mes}/${cat}`;
        for (const [kind, url] of [["comprovante", d.comprovante_url], ["nota", d.nota_url], ["boleto", d.boleto_url]] as const) {
          if (!url) continue;
          const blob = await baixarUrl(url);
          if (blob) {
            zip.file(`${subpasta}/${nomeArquivo(d, kind)}`, blob);
            ok++;
          } else fail++;
        }
      }
      const conteudo = await zip.generateAsync({ type: "blob" });
      const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
      saveAs(conteudo, `SysCFV_ArquivosFinanceiros_${ts}.zip`);
      toast.success(`${ok} arquivo(s) no ZIP${fail ? ` · ${fail} falha(s)` : ""}`);
      setSelecionados(new Set());
    } catch (e: any) {
      toast.error("Falha ao gerar ZIP: " + (e.message || "erro"));
    } finally {
      setBaixandoLote(false);
    }
  }

  return (
    <div className="container mx-auto py-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Receipt className="h-6 w-6 text-primary" />
            Arquivos Financeiros
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Comprovantes, notas e boletos importados, organizados por <strong>Ano → Mês → Categoria SIT</strong>. Download individual ou em lote (ZIP).
          </p>
        </div>
        <Button onClick={baixarLote} disabled={selecionados.size === 0 || baixandoLote} className="gap-2">
          {baixandoLote ? <Loader2 className="h-4 w-4 animate-spin" /> : <Package className="h-4 w-4" />}
          Baixar selecionados ({selecionados.size})
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs font-normal text-muted-foreground">Despesas com arquivo</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{comArquivo.length}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs font-normal text-muted-foreground">Total de arquivos</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{totalArq}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs font-normal text-muted-foreground flex items-center gap-1"><AlertCircle className="h-3 w-3 text-amber-600" />Sem comprovante</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-amber-600">{semArquivo}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar por descrição, fornecedor ou nº documento..." value={busca} onChange={e => setBusca(e.target.value)} className="pl-9" />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-12 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : arvore.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <FolderOpen className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Nenhum arquivo encontrado</p>
            </div>
          ) : (
            <div className="space-y-3">
              {arvore.map(([ano, mesMap]) => {
                const totalAno = Array.from(mesMap.values()).reduce((s, c) => s + Array.from(c.values()).reduce((a, l) => a + l.length, 0), 0);
                return (
                  <Accordion key={ano} title={`${ano}`} count={totalAno} defaultOpen>
                    <div className="space-y-2 pl-4 mt-2">
                      {Array.from(mesMap.entries()).sort((a, b) => b[0] - a[0]).map(([mes, catMap]) => {
                        const totalMes = Array.from(catMap.values()).reduce((s, l) => s + l.length, 0);
                        return (
                          <AcordeonItem key={mes} title={`${MESES[mes - 1]}`} count={totalMes}>
                            <div className="space-y-2 mt-2">
                              {Array.from(catMap.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([cat, items]) => {
                                const ids = items.map(i => i.id);
                                const todos = ids.every(id => selecionados.has(id));
                                const alguns = ids.some(id => selecionados.has(id));
                                return (
                                  <AcordeonItem
                                    key={cat}
                                    title={cat}
                                    count={items.length}
                                    checked={todos}
                                    indeterminate={alguns && !todos}
                                    onToggleAll={() => toggleCategoria(items)}
                                  >
                                    <div className="divide-y border rounded-md mt-2">
                                      {items.map(d => (
                                        <div key={d.id} className="flex items-start gap-3 p-2 hover:bg-muted/50">
                                          <Checkbox checked={selecionados.has(d.id)} onCheckedChange={() => toggleDespesa(d.id)} className="mt-1" />
                                          <div className="flex-1 min-w-0">
                                            <div className="font-medium truncate">{d.descricao}</div>
                                            <div className="text-xs text-muted-foreground flex flex-wrap gap-2 mt-0.5">
                                              <span>R$ {Number(d.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                                              {d.fornecedor && <span>· {d.fornecedor}</span>}
                                              {d.numero_documento && <span>· Doc {d.numero_documento}</span>}
                                              {d.sit_completo && <Badge variant="secondary" className="h-5">SIT ✓</Badge>}
                                              {d.pendente_comprovante && <Badge variant="outline" className="h-5 border-amber-500 text-amber-700">Pendente</Badge>}
                                            </div>
                                            <div className="flex flex-wrap gap-1 mt-1">
                                              {d.comprovante_url && (
                                                <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => baixarArquivo(d, d.comprovante_url!, "comprovante")}>
                                                  <Download className="h-3 w-3" />Comprovante
                                                </Button>
                                              )}
                                              {d.nota_url && (
                                                <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => baixarArquivo(d, d.nota_url!, "nota")}>
                                                  <FileText className="h-3 w-3" />Nota
                                                </Button>
                                              )}
                                              {d.boleto_url && (
                                                <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => baixarArquivo(d, d.boleto_url!, "boleto")}>
                                                  <ExternalLink className="h-3 w-3" />Boleto
                                                </Button>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </AcordeonItem>
                                );
                              })}
                            </div>
                          </AcordeonItem>
                        );
                      })}
                    </div>
                  </Accordion>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}