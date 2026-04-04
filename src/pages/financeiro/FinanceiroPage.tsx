import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, DollarSign, Receipt, Undo2, Layers } from "lucide-react";
import { toast } from "sonner";

type Categoria = { id: string; codigo: string; descricao: string; valor_previsto: number; created_at: string };
type Parcela = { id: string; numero_parcela: number; valor: number; data_recebimento: string; created_at: string };
type Despesa = { id: string; codigo_lancamento: string | null; descricao: string; valor: number; data_lancamento: string; categoria_id: string | null; mes_referencia: string; created_at: string };
type Estorno = { id: string; categoria_id: string | null; valor: number; mes_referencia: string; created_at: string };

const MESES_NOMES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

function mesAtual() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function FinanceiroPage() {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [parcelas, setParcelas] = useState<Parcela[]>([]);
  const [despesas, setDespesas] = useState<Despesa[]>([]);
  const [estornos, setEstornos] = useState<Estorno[]>([]);
  const [loading, setLoading] = useState(true);
  const [mesRef, setMesRef] = useState(mesAtual());

  // Form states
  const [catForm, setCatForm] = useState({ codigo: "", descricao: "", valor_previsto: "" });
  const [parForm, setParForm] = useState({ numero_parcela: "", valor: "", data_recebimento: "" });
  const [despForm, setDespForm] = useState({ codigo_lancamento: "", descricao: "", valor: "", data_lancamento: "", categoria_id: "" });
  const [estForm, setEstForm] = useState({ categoria_id: "", valor: "" });
  const [dialogOpen, setDialogOpen] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [c, p, d, e] = await Promise.all([
      supabase.from("categorias_financeiras").select("*").order("codigo"),
      supabase.from("parcelas_financeiras").select("*").order("numero_parcela"),
      supabase.from("despesas").select("*").eq("mes_referencia", mesRef).order("data_lancamento"),
      supabase.from("estornos").select("*").eq("mes_referencia", mesRef).order("created_at"),
    ]);
    setCategorias((c.data as Categoria[]) || []);
    setParcelas((p.data as Parcela[]) || []);
    setDespesas((d.data as Despesa[]) || []);
    setEstornos((e.data as Estorno[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [mesRef]);

  const catMap = new Map(categorias.map(c => [c.id, c]));

  const totalRecebido = parcelas.reduce((s, p) => s + Number(p.valor), 0);
  const totalPrevisto = categorias.reduce((s, c) => s + Number(c.valor_previsto), 0);
  const totalDespesas = despesas.reduce((s, d) => s + Number(d.valor), 0);
  const totalEstornos = estornos.reduce((s, e) => s + Number(e.valor), 0);
  const saldo = totalRecebido - totalDespesas + totalEstornos;

  const addCategoria = async () => {
    if (!catForm.codigo || !catForm.descricao) return;
    const { error } = await supabase.from("categorias_financeiras").insert({
      codigo: catForm.codigo, descricao: catForm.descricao, valor_previsto: Number(catForm.valor_previsto) || 0,
    });
    if (error) { toast.error("Erro ao salvar"); return; }
    setCatForm({ codigo: "", descricao: "", valor_previsto: "" });
    setDialogOpen(null);
    toast.success("Categoria adicionada");
    load();
  };

  const addParcela = async () => {
    if (!parForm.numero_parcela || !parForm.valor || !parForm.data_recebimento) return;
    const { error } = await supabase.from("parcelas_financeiras").insert({
      numero_parcela: Number(parForm.numero_parcela), valor: Number(parForm.valor), data_recebimento: parForm.data_recebimento,
    });
    if (error) { toast.error("Erro ao salvar"); return; }
    setParForm({ numero_parcela: "", valor: "", data_recebimento: "" });
    setDialogOpen(null);
    toast.success("Parcela adicionada");
    load();
  };

  const addDespesa = async () => {
    if (!despForm.descricao || !despForm.valor || !despForm.data_lancamento) return;
    const { error } = await supabase.from("despesas").insert({
      codigo_lancamento: despForm.codigo_lancamento || null,
      descricao: despForm.descricao,
      valor: Number(despForm.valor),
      data_lancamento: despForm.data_lancamento,
      categoria_id: despForm.categoria_id || null,
      mes_referencia: mesRef,
    });
    if (error) { toast.error("Erro ao salvar"); return; }
    setDespForm({ codigo_lancamento: "", descricao: "", valor: "", data_lancamento: "", categoria_id: "" });
    setDialogOpen(null);
    toast.success("Despesa adicionada");
    load();
  };

  const addEstorno = async () => {
    if (!estForm.valor) return;
    const { error } = await supabase.from("estornos").insert({
      categoria_id: estForm.categoria_id || null,
      valor: Number(estForm.valor),
      mes_referencia: mesRef,
    });
    if (error) { toast.error("Erro ao salvar"); return; }
    setEstForm({ categoria_id: "", valor: "" });
    setDialogOpen(null);
    toast.success("Estorno adicionado");
    load();
  };

  const deleteRow = async (table: string, id: string) => {
    await (supabase.from as any)(table).delete().eq("id", id);
    toast.success("Removido");
    load();
  };

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  // Build month options
  const now = new Date();
  const monthOptions: { value: string; label: string }[] = [];
  for (let y = now.getFullYear() - 1; y <= now.getFullYear() + 1; y++) {
    for (let m = 0; m < 12; m++) {
      const val = `${y}-${String(m + 1).padStart(2, "0")}`;
      monthOptions.push({ value: val, label: `${MESES_NOMES[m]} ${y}` });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">Financeiro</h1>
        <div className="flex items-center gap-2">
          <Label className="text-xs">Mês referência:</Label>
          <Select value={mesRef} onValueChange={setMesRef}>
            <SelectTrigger className="w-[180px] h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {monthOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="pt-4 text-center">
          <p className="text-xs text-muted-foreground">Total Recebido</p>
          <p className="text-lg font-bold text-green-600">{fmt(totalRecebido)}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 text-center">
          <p className="text-xs text-muted-foreground">Despesas ({mesRef})</p>
          <p className="text-lg font-bold text-red-600">{fmt(totalDespesas)}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 text-center">
          <p className="text-xs text-muted-foreground">Estornos ({mesRef})</p>
          <p className="text-lg font-bold text-amber-600">{fmt(totalEstornos)}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 text-center">
          <p className="text-xs text-muted-foreground">Saldo</p>
          <p className={`text-lg font-bold ${saldo >= 0 ? "text-green-600" : "text-red-600"}`}>{fmt(saldo)}</p>
        </CardContent></Card>
      </div>

      <Tabs defaultValue="despesas">
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="despesas" className="text-xs gap-1"><Receipt className="h-3 w-3" />Despesas</TabsTrigger>
          <TabsTrigger value="parcelas" className="text-xs gap-1"><DollarSign className="h-3 w-3" />Parcelas</TabsTrigger>
          <TabsTrigger value="categorias" className="text-xs gap-1"><Layers className="h-3 w-3" />Categorias</TabsTrigger>
          <TabsTrigger value="estornos" className="text-xs gap-1"><Undo2 className="h-3 w-3" />Estornos</TabsTrigger>
        </TabsList>

        {/* DESPESAS */}
        <TabsContent value="despesas">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm">Despesas — {mesRef}</CardTitle>
              <Dialog open={dialogOpen === "despesa"} onOpenChange={v => setDialogOpen(v ? "despesa" : null)}>
                <DialogTrigger asChild><Button size="sm" className="gap-1"><Plus className="h-3 w-3" />Nova</Button></DialogTrigger>
                <DialogContent><DialogHeader><DialogTitle>Nova Despesa</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <div><Label className="text-xs">Código</Label><Input value={despForm.codigo_lancamento} onChange={e => setDespForm(f => ({ ...f, codigo_lancamento: e.target.value }))} /></div>
                    <div><Label className="text-xs">Descrição *</Label><Input value={despForm.descricao} onChange={e => setDespForm(f => ({ ...f, descricao: e.target.value }))} /></div>
                    <div className="grid grid-cols-2 gap-2">
                      <div><Label className="text-xs">Valor *</Label><Input type="number" step="0.01" value={despForm.valor} onChange={e => setDespForm(f => ({ ...f, valor: e.target.value }))} /></div>
                      <div><Label className="text-xs">Data *</Label><Input type="date" value={despForm.data_lancamento} onChange={e => setDespForm(f => ({ ...f, data_lancamento: e.target.value }))} /></div>
                    </div>
                    <div><Label className="text-xs">Categoria</Label>
                      <Select value={despForm.categoria_id} onValueChange={v => setDespForm(f => ({ ...f, categoria_id: v }))}>
                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>{categorias.map(c => <SelectItem key={c.id} value={c.id}>{c.codigo} — {c.descricao}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <Button onClick={addDespesa} className="w-full">Salvar</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <Table><TableHeader><TableRow>
                <TableHead className="text-xs">Cód.</TableHead><TableHead className="text-xs">Descrição</TableHead>
                <TableHead className="text-xs">Categoria</TableHead><TableHead className="text-xs text-right">Valor</TableHead>
                <TableHead className="text-xs">Data</TableHead><TableHead className="w-8"></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {despesas.map(d => (
                  <TableRow key={d.id}>
                    <TableCell className="text-xs">{d.codigo_lancamento || "—"}</TableCell>
                    <TableCell className="text-xs">{d.descricao}</TableCell>
                    <TableCell className="text-xs">{d.categoria_id ? (catMap.get(d.categoria_id)?.descricao || "—") : "—"}</TableCell>
                    <TableCell className="text-xs text-right font-medium">{fmt(Number(d.valor))}</TableCell>
                    <TableCell className="text-xs">{d.data_lancamento}</TableCell>
                    <TableCell><Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => deleteRow("despesas", d.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button></TableCell>
                  </TableRow>
                ))}
                {despesas.length === 0 && <TableRow><TableCell colSpan={6} className="text-xs text-center text-muted-foreground py-6">Nenhuma despesa neste mês</TableCell></TableRow>}
              </TableBody></Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* PARCELAS */}
        <TabsContent value="parcelas">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm">Parcelas Recebidas</CardTitle>
              <Dialog open={dialogOpen === "parcela"} onOpenChange={v => setDialogOpen(v ? "parcela" : null)}>
                <DialogTrigger asChild><Button size="sm" className="gap-1"><Plus className="h-3 w-3" />Nova</Button></DialogTrigger>
                <DialogContent><DialogHeader><DialogTitle>Nova Parcela</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <div><Label className="text-xs">Nº da Parcela *</Label><Input type="number" value={parForm.numero_parcela} onChange={e => setParForm(f => ({ ...f, numero_parcela: e.target.value }))} /></div>
                    <div><Label className="text-xs">Valor *</Label><Input type="number" step="0.01" value={parForm.valor} onChange={e => setParForm(f => ({ ...f, valor: e.target.value }))} /></div>
                    <div><Label className="text-xs">Data de Recebimento *</Label><Input type="date" value={parForm.data_recebimento} onChange={e => setParForm(f => ({ ...f, data_recebimento: e.target.value }))} /></div>
                    <Button onClick={addParcela} className="w-full">Salvar</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <Table><TableHeader><TableRow>
                <TableHead className="text-xs">Nº</TableHead><TableHead className="text-xs text-right">Valor</TableHead>
                <TableHead className="text-xs">Data</TableHead><TableHead className="w-8"></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {parcelas.map(p => (
                  <TableRow key={p.id}>
                    <TableCell className="text-xs">{p.numero_parcela}</TableCell>
                    <TableCell className="text-xs text-right font-medium">{fmt(Number(p.valor))}</TableCell>
                    <TableCell className="text-xs">{p.data_recebimento}</TableCell>
                    <TableCell><Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => deleteRow("parcelas_financeiras", p.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button></TableCell>
                  </TableRow>
                ))}
                {parcelas.length === 0 && <TableRow><TableCell colSpan={4} className="text-xs text-center text-muted-foreground py-6">Nenhuma parcela cadastrada</TableCell></TableRow>}
              </TableBody></Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* CATEGORIAS */}
        <TabsContent value="categorias">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm">Categorias Econômicas</CardTitle>
              <Dialog open={dialogOpen === "categoria"} onOpenChange={v => setDialogOpen(v ? "categoria" : null)}>
                <DialogTrigger asChild><Button size="sm" className="gap-1"><Plus className="h-3 w-3" />Nova</Button></DialogTrigger>
                <DialogContent><DialogHeader><DialogTitle>Nova Categoria</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <div><Label className="text-xs">Código *</Label><Input value={catForm.codigo} onChange={e => setCatForm(f => ({ ...f, codigo: e.target.value }))} placeholder="Ex: 3.3.90.30" /></div>
                    <div><Label className="text-xs">Descrição *</Label><Input value={catForm.descricao} onChange={e => setCatForm(f => ({ ...f, descricao: e.target.value }))} /></div>
                    <div><Label className="text-xs">Valor Previsto</Label><Input type="number" step="0.01" value={catForm.valor_previsto} onChange={e => setCatForm(f => ({ ...f, valor_previsto: e.target.value }))} /></div>
                    <Button onClick={addCategoria} className="w-full">Salvar</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <Table><TableHeader><TableRow>
                <TableHead className="text-xs">Código</TableHead><TableHead className="text-xs">Descrição</TableHead>
                <TableHead className="text-xs text-right">Previsto</TableHead><TableHead className="w-8"></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {categorias.map(c => (
                  <TableRow key={c.id}>
                    <TableCell className="text-xs font-mono">{c.codigo}</TableCell>
                    <TableCell className="text-xs">{c.descricao}</TableCell>
                    <TableCell className="text-xs text-right">{fmt(Number(c.valor_previsto))}</TableCell>
                    <TableCell><Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => deleteRow("categorias_financeiras", c.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button></TableCell>
                  </TableRow>
                ))}
                {categorias.length === 0 && <TableRow><TableCell colSpan={4} className="text-xs text-center text-muted-foreground py-6">Nenhuma categoria cadastrada</TableCell></TableRow>}
              </TableBody></Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ESTORNOS */}
        <TabsContent value="estornos">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm">Estornos — {mesRef}</CardTitle>
              <Dialog open={dialogOpen === "estorno"} onOpenChange={v => setDialogOpen(v ? "estorno" : null)}>
                <DialogTrigger asChild><Button size="sm" className="gap-1"><Plus className="h-3 w-3" />Nova</Button></DialogTrigger>
                <DialogContent><DialogHeader><DialogTitle>Novo Estorno</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <div><Label className="text-xs">Categoria</Label>
                      <Select value={estForm.categoria_id} onValueChange={v => setEstForm(f => ({ ...f, categoria_id: v }))}>
                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>{categorias.map(c => <SelectItem key={c.id} value={c.id}>{c.codigo} — {c.descricao}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div><Label className="text-xs">Valor *</Label><Input type="number" step="0.01" value={estForm.valor} onChange={e => setEstForm(f => ({ ...f, valor: e.target.value }))} /></div>
                    <Button onClick={addEstorno} className="w-full">Salvar</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <Table><TableHeader><TableRow>
                <TableHead className="text-xs">Categoria</TableHead><TableHead className="text-xs text-right">Valor</TableHead><TableHead className="w-8"></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {estornos.map(e => (
                  <TableRow key={e.id}>
                    <TableCell className="text-xs">{e.categoria_id ? (catMap.get(e.categoria_id)?.descricao || "—") : "—"}</TableCell>
                    <TableCell className="text-xs text-right font-medium">{fmt(Number(e.valor))}</TableCell>
                    <TableCell><Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => deleteRow("estornos", e.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button></TableCell>
                  </TableRow>
                ))}
                {estornos.length === 0 && <TableRow><TableCell colSpan={3} className="text-xs text-center text-muted-foreground py-6">Nenhum estorno neste mês</TableCell></TableRow>}
              </TableBody></Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
