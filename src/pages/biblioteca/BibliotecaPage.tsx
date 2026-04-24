import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Accordion, AcordeonItem } from "./BibliotecaAccordion";
import { Loader2, Download, FileText, FolderOpen, Search, Package, AlertCircle, Clock } from "lucide-react";
import { saveAs } from "file-saver";
import JSZip from "jszip";
import { toast } from "sonner";
import { obterOuGerarDocx, nomeArquivoDoc } from "@/lib/bibliotecaDocx";

type Doc = {
  id: string;
  tipo: "relatorio" | "planejamento";
  origem_id: string;
  titulo: string;
  data_referencia: string;
  ano: number;
  mes: number;
  educador_nome: string | null;
  turma_nome: string | null;
  storage_path: string;
  status: "pendente" | "gerado" | "erro";
  gerado_em: string | null;
};

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export default function BibliotecaPage() {
  const { user, loading: authLoading } = useAuth();
  const [tab, setTab] = useState<"relatorio" | "planejamento">("relatorio");
  const [busca, setBusca] = useState("");
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [baixando, setBaixando] = useState<string | null>(null);
  const [baixandoLote, setBaixandoLote] = useState(false);
  const [roles, setRoles] = useState<string[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase.from("user_roles").select("role").eq("user_id", user.id).then(({ data }) => {
      setRoles((data || []).map((r: any) => r.role));
    });
  }, [user]);

  const isGestao = roles.includes("coordenacao") || roles.includes("tecnico");

  const { data: docs, isLoading, refetch } = useQuery({
    queryKey: ["biblioteca", tab],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("biblioteca_documentos")
        .select("id, tipo, origem_id, titulo, data_referencia, ano, mes, educador_nome, turma_nome, storage_path, status, gerado_em")
        .eq("tipo", tab)
        .order("data_referencia", { ascending: false });
      if (error) throw error;
      return (data || []) as Doc[];
    },
    enabled: !authLoading,
  });

  // Sincroniza com origem: garante que cada relatório/planejamento tem registro
  const { data: missing } = useQuery({
    queryKey: ["biblioteca-sync", tab],
    queryFn: async () => {
      const tabela = tab === "relatorio" ? "relatorios_atividade" : "planejamentos";
      const { data: origens } = await supabase.from(tabela).select("id");
      const idsExistentes = new Set((docs || []).map(d => d.origem_id));
      const faltantes = (origens || []).filter((o: any) => !idsExistentes.has(o.id));
      // Enfileira até 50 por vez para não sobrecarregar
      for (const o of faltantes.slice(0, 50)) {
        await supabase.rpc("enqueue_biblioteca_doc", { _tipo: tab, _origem_id: o.id });
      }
      return faltantes.length;
    },
    enabled: !!docs,
  });

  // Refetch após sync
  if (missing && missing > 0 && !isLoading) {
    setTimeout(() => refetch(), 500);
  }

  // Agrupar por Ano → Mês
  const arvore = useMemo(() => {
    const filtrados = (docs || []).filter(d => {
      if (!busca) return true;
      const q = busca.toLowerCase();
      return d.titulo.toLowerCase().includes(q)
        || (d.educador_nome || "").toLowerCase().includes(q)
        || (d.turma_nome || "").toLowerCase().includes(q);
    });
    const porAno = new Map<number, Map<number, Doc[]>>();
    filtrados.forEach(d => {
      if (!porAno.has(d.ano)) porAno.set(d.ano, new Map());
      const mesMap = porAno.get(d.ano)!;
      if (!mesMap.has(d.mes)) mesMap.set(d.mes, []);
      mesMap.get(d.mes)!.push(d);
    });
    return Array.from(porAno.entries()).sort((a, b) => b[0] - a[0]);
  }, [docs, busca]);

  const totalFiltrado = arvore.reduce((s, [, m]) => s + Array.from(m.values()).reduce((a, l) => a + l.length, 0), 0);

  function toggleSelecionado(id: string) {
    setSelecionados(prev => {
      const nv = new Set(prev);
      nv.has(id) ? nv.delete(id) : nv.add(id);
      return nv;
    });
  }

  function toggleMes(items: Doc[]) {
    const ids = items.map(i => i.id);
    const todosSelecionados = ids.every(id => selecionados.has(id));
    setSelecionados(prev => {
      const nv = new Set(prev);
      if (todosSelecionados) ids.forEach(id => nv.delete(id));
      else ids.forEach(id => nv.add(id));
      return nv;
    });
  }

  async function baixarUm(doc: Doc) {
    setBaixando(doc.id);
    try {
      const blob = await obterOuGerarDocx(doc);
      saveAs(blob, nomeArquivoDoc(doc));
      toast.success("Documento baixado");
    } catch (e: any) {
      console.error(e);
      toast.error("Falha ao gerar documento: " + (e.message || "erro"));
    } finally {
      setBaixando(null);
    }
  }

  async function baixarLote() {
    if (selecionados.size === 0) {
      toast.error("Selecione ao menos um documento");
      return;
    }
    setBaixandoLote(true);
    try {
      const zip = new JSZip();
      const escolhidos = (docs || []).filter(d => selecionados.has(d.id));
      let ok = 0, fail = 0;
      for (const doc of escolhidos) {
        try {
          const blob = await obterOuGerarDocx(doc);
          const ano = doc.ano;
          const mes = String(doc.mes).padStart(2, "0");
          const subpasta = `${doc.tipo === "relatorio" ? "Relatorios" : "Planejamentos"}/${ano}/${mes}`;
          zip.file(`${subpasta}/${nomeArquivoDoc(doc)}`, blob);
          ok++;
        } catch (e) {
          console.error(`Falha em ${doc.id}:`, e);
          fail++;
        }
      }
      const conteudo = await zip.generateAsync({ type: "blob" });
      const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
      saveAs(conteudo, `SysCFV_Biblioteca_${tab}_${ts}.zip`);
      toast.success(`${ok} documento(s) no ZIP${fail ? ` · ${fail} falha(s)` : ""}`);
      setSelecionados(new Set());
    } catch (e: any) {
      toast.error("Falha ao gerar ZIP: " + (e.message || "erro"));
    } finally {
      setBaixandoLote(false);
    }
  }

  if (authLoading) {
    return <div className="p-8 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  return (
    <div className="container mx-auto py-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FolderOpen className="h-6 w-6 text-primary" />
            Biblioteca de Documentos
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Relatórios e planejamentos em <strong>.docx</strong> no modelo padrão SysCFV. Organização por tipo, ano e mês. Geração automática ao salvar; download individual ou em lote (ZIP).
          </p>
        </div>
        <Button onClick={baixarLote} disabled={selecionados.size === 0 || baixandoLote} className="gap-2">
          {baixandoLote ? <Loader2 className="h-4 w-4 animate-spin" /> : <Package className="h-4 w-4" />}
          Baixar selecionados ({selecionados.size})
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <Tabs value={tab} onValueChange={v => { setTab(v as any); setSelecionados(new Set()); }}>
            <TabsList>
              <TabsTrigger value="relatorio" className="gap-2"><FileText className="h-4 w-4" />Relatórios de Atividade</TabsTrigger>
              <TabsTrigger value="planejamento" className="gap-2"><FileText className="h-4 w-4" />Planejamentos</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar por título, educador ou turma..." value={busca} onChange={e => setBusca(e.target.value)} className="pl-9" />
            </div>
            <Badge variant="secondary">{totalFiltrado} documento(s)</Badge>
          </div>

          {isLoading ? (
            <div className="py-12 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : arvore.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <FolderOpen className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Nenhum documento encontrado</p>
            </div>
          ) : (
            <div className="space-y-3">
              {arvore.map(([ano, mesMap]) => {
                const totalAno = Array.from(mesMap.values()).reduce((s, l) => s + l.length, 0);
                return (
                  <Accordion key={ano} title={`${ano}`} count={totalAno} defaultOpen>
                    <div className="space-y-2 pl-4 mt-2">
                      {Array.from(mesMap.entries()).sort((a, b) => b[0] - a[0]).map(([mes, items]) => {
                        const ids = items.map(i => i.id);
                        const todosSel = ids.every(id => selecionados.has(id));
                        const algunsSel = ids.some(id => selecionados.has(id));
                        return (
                          <AcordeonItem
                            key={mes}
                            title={`${MESES[mes - 1]} / ${ano}`}
                            count={items.length}
                            checked={todosSel}
                            indeterminate={algunsSel && !todosSel}
                            onToggleAll={() => toggleMes(items)}
                          >
                            <div className="divide-y border rounded-md mt-2">
                              {items.sort((a, b) => b.data_referencia.localeCompare(a.data_referencia)).map(doc => (
                                <div key={doc.id} className="flex items-center gap-3 p-2 hover:bg-muted/50">
                                  <Checkbox checked={selecionados.has(doc.id)} onCheckedChange={() => toggleSelecionado(doc.id)} />
                                  <div className="flex-1 min-w-0">
                                    <div className="font-medium truncate">{doc.titulo}</div>
                                    <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                                      <span>{new Date(doc.data_referencia + "T12:00:00").toLocaleDateString("pt-BR")}</span>
                                      {doc.educador_nome && <span>· {doc.educador_nome}</span>}
                                      {doc.turma_nome && <span>· {doc.turma_nome}</span>}
                                      {doc.status === "pendente" && (
                                        <Badge variant="outline" className="h-5 gap-1"><Clock className="h-3 w-3" />Sob demanda</Badge>
                                      )}
                                      {doc.status === "erro" && (
                                        <Badge variant="destructive" className="h-5 gap-1"><AlertCircle className="h-3 w-3" />Erro</Badge>
                                      )}
                                      {doc.status === "gerado" && (
                                        <Badge variant="secondary" className="h-5">Gerado</Badge>
                                      )}
                                    </div>
                                  </div>
                                  <Button size="sm" variant="ghost" onClick={() => baixarUm(doc)} disabled={baixando === doc.id} className="gap-1">
                                    {baixando === doc.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                                    .docx
                                  </Button>
                                </div>
                              ))}
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

      {!isGestao && (
        <p className="text-xs text-muted-foreground">
          Você está vendo apenas seus próprios documentos. Coordenação e Equipe Técnica veem todos.
        </p>
      )}
    </div>
  );
}