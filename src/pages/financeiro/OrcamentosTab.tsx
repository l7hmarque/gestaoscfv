import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Loader2, CheckCircle2, Download, Eye, ArrowLeft, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { exportOrcamentoXLSX, exportMapaComparativoXLSX } from "@/hooks/useOrcamentoExport";

interface Categoria { id: string; codigo: string; descricao: string; }
interface Orcamento { id: string; titulo: string; objeto: string | null; mes_referencia: string; status: string; fornecedor_vencedor: string | null; cnpj_vencedor: string | null; data_aprovacao: string | null; categoria_id: string | null; observacoes: string | null; created_at: string; }
interface OrcItem { id: string; orcamento_id: string; item_num: number; descricao: string; unidade_medida: string; quantidade: number; }
interface Cotacao { id: string; orcamento_id: string; fornecedor_nome: string; cnpj: string | null; data_emissao: string | null; data_validade: string | null; }
interface Preco { id: string; cotacao_id: string; item_id: string; preco_unitario: number; }

const STATUS_COLORS: Record<string, string> = {
  rascunho: "secondary", cotacao: "outline", aprovado: "default", cancelado: "destructive",
};
const STATUS_LABELS: Record<string, string> = {
  rascunho: "Rascunho", cotacao: "Em Cotação", aprovado: "Aprovado", cancelado: "Cancelado",
};

// Debounced input that only calls onSave on blur
function DebouncedInput({ value: externalValue, onSave, ...props }: { value: string | number; onSave: (v: string) => void } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "onBlur" | "value">) {
  const [val, setVal] = useState(String(externalValue ?? ""));
  const mounted = useRef(true);
  useEffect(() => { setVal(String(externalValue ?? "")); }, [externalValue]);
  useEffect(() => { return () => { mounted.current = false; }; }, []);
  return (
    <Input
      {...props}
      value={val}
      onChange={e => setVal(e.target.value)}
      onBlur={() => { if (String(externalValue) !== val) onSave(val); }}
    />
  );
}

export default function OrcamentosTab({ mesRef, categorias }: { mesRef: string; categorias: Categoria[] }) {
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [newForm, setNewForm] = useState({ titulo: "", objeto: "", categoria_id: "", observacoes: "" });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [items, setItems] = useState<OrcItem[]>([]);
  const [cotacoes, setCotacoes] = useState<Cotacao[]>([]);
  const [precos, setPrecos] = useState<Preco[]>([]);
  const [saving, setSaving] = useState(false);
  const [importingAI, setImportingAI] = useState(false);
  const aiFileInput = useRef<HTMLInputElement>(null);

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  // === IMPORTAR MAPA COMPARATIVO COM IA ===
  const handleAIImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportingAI(true);
    try {
      const buf = await file.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let bin = "";
      for (let i = 0; i < bytes.length; i += 8192) bin += String.fromCharCode(...bytes.subarray(i, i + 8192));
      const base64 = btoa(bin);

      const { data, error } = await supabase.functions.invoke("detect-orcamento-from-doc", {
        body: { file_base64: base64, mime_type: file.type },
      });
      if (error || !data?.orcamento) {
        toast.error("IA não conseguiu extrair o orçamento");
        return;
      }
      const o = data.orcamento;
      const itens: { descricao: string; unidade_medida: string; quantidade: number }[] = o.itens || [];
      const cotacoes: { fornecedor_nome: string; cnpj?: string; data_emissao?: string; data_validade?: string; precos: number[] }[] = o.cotacoes || [];

      // 1. Cria orçamento (rascunho — usuário aprova depois)
      const { data: orcInsert, error: orcErr } = await supabase
        .from("orcamentos")
        .insert({
          titulo: o.titulo || "Orçamento importado",
          objeto: o.objeto || null,
          mes_referencia: mesRef,
          status: "cotacao",
          fornecedor_vencedor: o.fornecedor_vencedor || null,
          cnpj_vencedor: o.cnpj_vencedor || null,
        } as any)
        .select("id")
        .single();
      if (orcErr || !orcInsert) throw orcErr || new Error("Falha ao criar orçamento");
      const orcamentoId = (orcInsert as any).id as string;

      // 2. Itens
      const itemRows = itens.map((it, idx) => ({
        orcamento_id: orcamentoId,
        item_num: idx + 1,
        descricao: it.descricao || `Item ${idx + 1}`,
        unidade_medida: it.unidade_medida || "UN",
        quantidade: Number(it.quantidade) || 1,
      }));
      const { data: itemRet } = await supabase.from("orcamento_itens").insert(itemRows).select("id, item_num");
      const itemIds: string[] = (itemRet || []).sort((a: any, b: any) => a.item_num - b.item_num).map((r: any) => r.id);

      // 3. Cotações + preços
      for (const c of cotacoes) {
        const { data: cotRet } = await supabase
          .from("orcamento_cotacoes")
          .insert({
            orcamento_id: orcamentoId,
            fornecedor_nome: c.fornecedor_nome,
            cnpj: c.cnpj || null,
            data_emissao: c.data_emissao || null,
            data_validade: c.data_validade || null,
          } as any)
          .select("id")
          .single();
        const cotacaoId = (cotRet as any)?.id;
        if (!cotacaoId) continue;
        const precoRows = (c.precos || [])
          .map((p, idx) => ({
            cotacao_id: cotacaoId,
            item_id: itemIds[idx],
            preco_unitario: Number(p),
          }))
          .filter((r) => r.item_id && Number.isFinite(r.preco_unitario) && r.preco_unitario > 0);
        if (precoRows.length) await supabase.from("orcamento_precos").insert(precoRows);
      }

      toast.success(`Orçamento "${o.titulo}" importado: ${itens.length} itens × ${cotacoes.length} fornecedores. Revise e aprove.`);
      load();
      loadDetail(orcamentoId);
    } catch (err: any) {
      console.error("Erro IA orçamento:", err);
      toast.error(`Erro ao importar: ${err?.message || err}`);
    } finally {
      setImportingAI(false);
      if (aiFileInput.current) aiFileInput.current.value = "";
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("orcamentos").select("*").eq("mes_referencia", mesRef).order("created_at", { ascending: false });
    setOrcamentos((data || []) as unknown as Orcamento[]);
    setLoading(false);
  }, [mesRef]);

  useEffect(() => { load(); }, [load]);

  const loadDetail = async (id: string) => {
    setSelectedId(id);
    const [{ data: it }, { data: co }] = await Promise.all([
      supabase.from("orcamento_itens").select("*").eq("orcamento_id", id).order("item_num"),
      supabase.from("orcamento_cotacoes").select("*").eq("orcamento_id", id).order("created_at"),
    ]);
    const itens = (it || []) as unknown as OrcItem[];
    const cots = (co || []) as unknown as Cotacao[];
    setItems(itens);
    setCotacoes(cots);
    if (cots.length > 0) {
      const cotIds = cots.map(c => c.id);
      const { data: pr } = await supabase.from("orcamento_precos").select("*").in("cotacao_id", cotIds);
      setPrecos((pr || []) as unknown as Preco[]);
    } else {
      setPrecos([]);
    }
  };

  const createOrcamento = async () => {
    if (!newForm.titulo.trim()) { toast.error("Título é obrigatório"); return; }
    setSaving(true);
    const { error } = await supabase.from("orcamentos").insert({
      titulo: newForm.titulo, objeto: newForm.objeto || null,
      mes_referencia: mesRef, categoria_id: newForm.categoria_id || null,
      observacoes: newForm.observacoes || null,
    } as any);
    setSaving(false);
    if (error) { toast.error("Erro: " + error.message); return; }
    setNewForm({ titulo: "", objeto: "", categoria_id: "", observacoes: "" });
    setShowNew(false);
    toast.success("Orçamento criado");
    load();
  };

  const addItem = async () => {
    if (!selectedId) return;
    const nextNum = items.length > 0 ? Math.max(...items.map(i => i.item_num)) + 1 : 1;
    const { error } = await supabase.from("orcamento_itens").insert({
      orcamento_id: selectedId, item_num: nextNum, descricao: "Novo item", quantidade: 1,
    } as any);
    if (error) { toast.error(error.message); return; }
    loadDetail(selectedId);
  };

  const updateItem = async (id: string, field: string, value: any) => {
    await supabase.from("orcamento_itens").update({ [field]: value } as any).eq("id", id);
    // Update local state without reloading
    setItems(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i));
  };

  const deleteItem = async (id: string) => {
    await supabase.from("orcamento_itens").delete().eq("id", id);
    setItems(prev => prev.filter(i => i.id !== id));
  };

  const addCotacao = async () => {
    if (!selectedId) return;
    const { error } = await supabase.from("orcamento_cotacoes").insert({
      orcamento_id: selectedId, fornecedor_nome: "Fornecedor",
    } as any);
    if (error) { toast.error(error.message); return; }
    await supabase.from("orcamentos").update({ status: "cotacao" } as any).eq("id", selectedId);
    loadDetail(selectedId);
    load();
  };

  const updateCotacao = async (id: string, field: string, value: any) => {
    await supabase.from("orcamento_cotacoes").update({ [field]: value } as any).eq("id", id);
    setCotacoes(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  const deleteCotacao = async (id: string) => {
    await supabase.from("orcamento_cotacoes").delete().eq("id", id);
    setCotacoes(prev => prev.filter(c => c.id !== id));
    setPrecos(prev => prev.filter(p => p.cotacao_id !== id));
  };

  const setPrecoVal = async (cotacaoId: string, itemId: string, valor: number) => {
    const existing = precos.find(p => p.cotacao_id === cotacaoId && p.item_id === itemId);
    if (existing) {
      await supabase.from("orcamento_precos").update({ preco_unitario: valor } as any).eq("id", existing.id);
      setPrecos(prev => prev.map(p => p.id === existing.id ? { ...p, preco_unitario: valor } : p));
    } else {
      const { data } = await supabase.from("orcamento_precos").insert({
        cotacao_id: cotacaoId, item_id: itemId, preco_unitario: valor,
      } as any).select().single();
      if (data) setPrecos(prev => [...prev, data as unknown as Preco]);
    }
  };

  const getPreco = (cotacaoId: string, itemId: string): number => {
    return precos.find(p => p.cotacao_id === cotacaoId && p.item_id === itemId)?.preco_unitario || 0;
  };

  const getTotalCotacao = (cotacaoId: string): number => {
    return items.reduce((sum, item) => sum + getPreco(cotacaoId, item.id) * item.quantidade, 0);
  };

  const getMenorPrecoItem = (itemId: string): { cotacaoId: string; valor: number } | null => {
    let menor: { cotacaoId: string; valor: number } | null = null;
    for (const cot of cotacoes) {
      const preco = getPreco(cot.id, itemId);
      if (preco > 0 && (!menor || preco < menor.valor)) {
        menor = { cotacaoId: cot.id, valor: preco };
      }
    }
    return menor;
  };

  const getVencedor = (): Cotacao | null => {
    if (cotacoes.length === 0) return null;
    let menor: { cot: Cotacao; total: number } | null = null;
    for (const cot of cotacoes) {
      const total = getTotalCotacao(cot.id);
      if (total > 0 && (!menor || total < menor.total)) {
        menor = { cot, total };
      }
    }
    return menor?.cot || null;
  };

  const aprovarOrcamento = async () => {
    if (!selectedId) return;
    const vencedor = getVencedor();
    if (!vencedor) { toast.error("Nenhuma cotação com preços preenchidos"); return; }
    const totalVencedor = getTotalCotacao(vencedor.id);
    const orc = orcamentos.find(o => o.id === selectedId);

    await supabase.from("orcamentos").update({
      status: "aprovado",
      fornecedor_vencedor: vencedor.fornecedor_nome,
      cnpj_vencedor: vencedor.cnpj,
      data_aprovacao: new Date().toISOString().slice(0, 10),
    } as any).eq("id", selectedId);

    await supabase.from("despesas").insert({
      descricao: `Orçamento: ${orc?.titulo || ""}`,
      valor: totalVencedor,
      data_lancamento: new Date().toISOString().slice(0, 10),
      mes_referencia: mesRef,
      fornecedor: vencedor.fornecedor_nome,
      cnpj_cpf: vencedor.cnpj || null,
      categoria_id: orc?.categoria_id || null,
      orcamento_id: selectedId,
      tipo_documento: "nota_fiscal",
    });

    toast.success(`Aprovado! Despesa de ${fmt(totalVencedor)} lançada automaticamente.`);
    load();
    loadDetail(selectedId);
  };

  const deleteOrcamento = async (id: string) => {
    if (!confirm("Excluir este orçamento?")) return;
    await supabase.from("orcamentos").delete().eq("id", id);
    if (selectedId === id) setSelectedId(null);
    toast.success("Orçamento excluído");
    load();
  };

  const selected = orcamentos.find(o => o.id === selectedId);

  // Detail view
  if (selectedId && selected) {
    const isApproved = selected.status === "aprovado";
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => setSelectedId(null)}><ArrowLeft className="h-4 w-4" /></Button>
            <div>
              <h3 className="text-sm font-semibold">{selected.titulo}</h3>
              <div className="flex gap-2 mt-0.5">
                <Badge variant={STATUS_COLORS[selected.status] as any} className="text-[10px]">{STATUS_LABELS[selected.status]}</Badge>
                {selected.fornecedor_vencedor && <Badge variant="secondary" className="text-[10px]">Vencedor: {selected.fornecedor_vencedor}</Badge>}
              </div>
            </div>
          </div>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={() => exportOrcamentoXLSX(selected, items, cotacoes, precos, categorias)}>
              <Download className="h-3 w-3" />Orçamento XLSX
            </Button>
            {cotacoes.length > 1 && (
              <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={() => exportMapaComparativoXLSX(selected, items, cotacoes, precos, categorias)}>
                <Download className="h-3 w-3" />Mapa Comparativo
              </Button>
            )}
            {!isApproved && (
              <Button size="sm" className="gap-1 text-xs" onClick={aprovarOrcamento} disabled={cotacoes.length === 0 || items.length === 0}>
                <CheckCircle2 className="h-3 w-3" />Aprovar
              </Button>
            )}
          </div>
        </div>

        {/* Items */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm">Itens</CardTitle>
            {!isApproved && <Button size="sm" variant="outline" onClick={addItem} className="gap-1 text-xs"><Plus className="h-3 w-3" />Item</Button>}
          </CardHeader>
          <CardContent>
            <Table><TableHeader><TableRow>
              <TableHead className="text-xs w-12">Nº</TableHead>
              <TableHead className="text-xs">Descrição</TableHead>
              <TableHead className="text-xs w-20">Unid.</TableHead>
              <TableHead className="text-xs w-16">Qtd.</TableHead>
              <TableHead className="w-8"></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {items.map(item => (
                <TableRow key={item.id}>
                  <TableCell className="text-xs">{item.item_num}</TableCell>
                  <TableCell>
                    <DebouncedInput className="h-7 text-xs" value={item.descricao} onSave={v => updateItem(item.id, "descricao", v)} disabled={isApproved} />
                  </TableCell>
                  <TableCell>
                    <DebouncedInput className="h-7 text-xs" value={item.unidade_medida} onSave={v => updateItem(item.id, "unidade_medida", v)} disabled={isApproved} />
                  </TableCell>
                  <TableCell>
                    <DebouncedInput className="h-7 text-xs" type="number" value={item.quantidade} onSave={v => updateItem(item.id, "quantidade", Number(v))} disabled={isApproved} />
                  </TableCell>
                  <TableCell>{!isApproved && <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => deleteItem(item.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>}</TableCell>
                </TableRow>
              ))}
              {items.length === 0 && <TableRow><TableCell colSpan={5} className="text-xs text-center text-muted-foreground py-4">Nenhum item. Clique em "+ Item".</TableCell></TableRow>}
            </TableBody></Table>
          </CardContent>
        </Card>

        {/* Cotações */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm">Cotações ({cotacoes.length}/3)</CardTitle>
            {!isApproved && cotacoes.length < 3 && <Button size="sm" variant="outline" onClick={addCotacao} className="gap-1 text-xs"><Plus className="h-3 w-3" />Fornecedor</Button>}
          </CardHeader>
          <CardContent className="space-y-4">
            {cotacoes.map((cot, ci) => (
              <div key={cot.id} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold">Fornecedor {ci + 1}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium">Total: {fmt(getTotalCotacao(cot.id))}</span>
                    {!isApproved && <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => deleteCotacao(cot.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>}
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <div><Label className="text-[10px]">Razão Social</Label>
                    <DebouncedInput className="h-7 text-xs" value={cot.fornecedor_nome} onSave={v => updateCotacao(cot.id, "fornecedor_nome", v)} disabled={isApproved} />
                  </div>
                  <div><Label className="text-[10px]">CNPJ</Label>
                    <DebouncedInput className="h-7 text-xs" value={cot.cnpj || ""} onSave={v => updateCotacao(cot.id, "cnpj", v)} disabled={isApproved} />
                  </div>
                  <div><Label className="text-[10px]">Data Emissão</Label>
                    <DebouncedInput className="h-7 text-xs" type="date" value={cot.data_emissao || ""} onSave={v => updateCotacao(cot.id, "data_emissao", v)} disabled={isApproved} />
                  </div>
                  <div><Label className="text-[10px]">Validade</Label>
                    <DebouncedInput className="h-7 text-xs" type="date" value={cot.data_validade || ""} onSave={v => updateCotacao(cot.id, "data_validade", v)} disabled={isApproved} />
                  </div>
                </div>
                {/* Preços por item */}
                {items.length > 0 && (
                  <div className="space-y-1">
                    {items.map(item => (
                      <div key={item.id} className="flex items-center gap-2">
                        <span className="text-[10px] w-8 text-right shrink-0">{item.item_num}.</span>
                        <span className="text-[10px] flex-1 truncate">{item.descricao}</span>
                        <DebouncedInput className="h-6 text-xs w-24" type="number" step="0.01" placeholder="R$ unit." value={getPreco(cot.id, item.id) || ""} onSave={v => setPrecoVal(cot.id, item.id, Number(v))} disabled={isApproved} />
                        <span className="text-[10px] w-20 text-right">{fmt(getPreco(cot.id, item.id) * item.quantidade)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {cotacoes.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Adicione até 3 fornecedores para cotação.</p>}
          </CardContent>
        </Card>

        {/* Mapa Comparativo */}
        {cotacoes.length >= 2 && items.length > 0 && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Mapa Comparativo</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-auto">
                <Table><TableHeader><TableRow>
                  <TableHead className="text-[10px]">Item</TableHead>
                  <TableHead className="text-[10px]">Descrição</TableHead>
                  <TableHead className="text-[10px]">Qtd.</TableHead>
                  {cotacoes.map((c, i) => <TableHead key={c.id} className="text-[10px] text-right">Forn. {i + 1}</TableHead>)}
                  <TableHead className="text-[10px] text-right">Menor</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {items.map(item => {
                    const menor = getMenorPrecoItem(item.id);
                    return (
                      <TableRow key={item.id}>
                        <TableCell className="text-[10px]">{item.item_num}</TableCell>
                        <TableCell className="text-[10px] max-w-[150px] truncate">{item.descricao}</TableCell>
                        <TableCell className="text-[10px]">{item.quantidade}</TableCell>
                        {cotacoes.map(c => {
                          const p = getPreco(c.id, item.id);
                          const isMenor = menor && menor.cotacaoId === c.id;
                          return <TableCell key={c.id} className={`text-[10px] text-right ${isMenor ? "font-bold text-emerald-600" : ""}`}>{p > 0 ? fmt(p * item.quantidade) : "—"}</TableCell>;
                        })}
                        <TableCell className="text-[10px] text-right font-bold">{menor ? fmt(menor.valor * item.quantidade) : "—"}</TableCell>
                      </TableRow>
                    );
                  })}
                  <TableRow className="border-t-2">
                    <TableCell colSpan={3} className="text-xs font-bold">TOTAL</TableCell>
                    {cotacoes.map(c => <TableCell key={c.id} className="text-xs text-right font-bold">{fmt(getTotalCotacao(c.id))}</TableCell>)}
                    <TableCell className="text-xs text-right font-bold text-emerald-600">
                      {(() => { const v = getVencedor(); return v ? fmt(getTotalCotacao(v.id)) : "—"; })()}
                    </TableCell>
                  </TableRow>
                </TableBody></Table>
              </div>
              {getVencedor() && <p className="text-xs text-emerald-600 font-medium mt-2">✓ Menor preço global: {getVencedor()!.fornecedor_nome}</p>}
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // List view
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm">Orçamentos — {mesRef}</CardTitle>
        <div className="flex gap-2">
          <input
            ref={aiFileInput}
            type="file"
            accept="application/pdf,image/*"
            className="hidden"
            onChange={handleAIImport}
          />
          <Button
            size="sm"
            variant="outline"
            className="gap-1"
            onClick={() => aiFileInput.current?.click()}
            disabled={importingAI}
            title="Importar mapa comparativo / orçamento via IA"
          >
            {importingAI ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
            Importar com IA
          </Button>
          <Button size="sm" className="gap-1" onClick={() => setShowNew(true)}><Plus className="h-3 w-3" />Novo</Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : orcamentos.length === 0 ? (
          <p className="text-xs text-center text-muted-foreground py-6">Nenhum orçamento neste mês.</p>
        ) : (
          <Table><TableHeader><TableRow>
            <TableHead className="text-xs">Título</TableHead>
            <TableHead className="text-xs">Status</TableHead>
            <TableHead className="text-xs">Fornecedor Vencedor</TableHead>
            <TableHead className="text-xs">Categoria</TableHead>
            <TableHead className="w-16"></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {orcamentos.map(o => (
              <TableRow key={o.id} className="cursor-pointer" onClick={() => loadDetail(o.id)}>
                <TableCell className="text-xs font-medium">{o.titulo}</TableCell>
                <TableCell><Badge variant={STATUS_COLORS[o.status] as any} className="text-[10px]">{STATUS_LABELS[o.status]}</Badge></TableCell>
                <TableCell className="text-xs">{o.fornecedor_vencedor || "—"}</TableCell>
                <TableCell className="text-xs">{o.categoria_id ? categorias.find(c => c.id === o.categoria_id)?.codigo || "—" : "—"}</TableCell>
                <TableCell className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={e => { e.stopPropagation(); loadDetail(o.id); }}><Eye className="h-3 w-3" /></Button>
                  {o.status !== "aprovado" && <Button variant="ghost" size="icon" className="h-6 w-6" onClick={e => { e.stopPropagation(); deleteOrcamento(o.id); }}><Trash2 className="h-3 w-3 text-destructive" /></Button>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody></Table>
        )}
      </CardContent>

      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo Orçamento</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">Título *</Label><Input value={newForm.titulo} onChange={e => setNewForm(f => ({ ...f, titulo: e.target.value }))} /></div>
            <div><Label className="text-xs">Objeto / Descrição</Label><Textarea value={newForm.objeto} onChange={e => setNewForm(f => ({ ...f, objeto: e.target.value }))} className="min-h-[60px]" /></div>
            <div><Label className="text-xs">Categoria Financeira</Label>
              <Select value={newForm.categoria_id} onValueChange={v => setNewForm(f => ({ ...f, categoria_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{categorias.map(c => <SelectItem key={c.id} value={c.id}>{c.codigo} — {c.descricao}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>Cancelar</Button>
            <Button onClick={createOrcamento} disabled={saving}>{saving ? "Salvando..." : "Criar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
