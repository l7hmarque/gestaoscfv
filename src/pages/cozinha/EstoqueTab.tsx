import { useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { DataTable, Column } from "@/components/DataTable";
import { Plus, Minus, Pencil, PackagePlus } from "lucide-react";
import { useInsumos } from "@/hooks/useCozinhaData";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

const CATEGORIAS = ["Hortifruti","Carnes","Grãos","Laticínios","Mercearia","Limpeza","Outros"];
const UNIDADES = ["kg","g","L","mL","un","pct","cx","dz"];

function statusInsumo(i: any): { label: string; cor: string } {
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  if (i.validade) {
    const v = new Date(i.validade + "T00:00:00");
    if (v < hoje) return { label: "Vencido", cor: "bg-destructive text-destructive-foreground" };
    const diff = (v.getTime() - hoje.getTime()) / 86400000;
    if (diff <= 7) return { label: "Vencendo", cor: "bg-amber-500 text-white" };
  }
  if (Number(i.quantidade_atual) <= Number(i.estoque_minimo) && Number(i.estoque_minimo) > 0)
    return { label: "Baixo", cor: "bg-destructive text-destructive-foreground" };
  return { label: "OK", cor: "bg-emerald-500 text-white" };
}

export default function EstoqueTab() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: insumos = [], isLoading } = useInsumos();
  const [filtroCat, setFiltroCat] = useState<string>("todas");
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");
  const [editing, setEditing] = useState<any | null>(null);
  const [movDialog, setMovDialog] = useState<{ insumo: any; tipo: "entrada"|"saida" } | null>(null);
  const [showNew, setShowNew] = useState(false);

  const filtered = useMemo(() => {
    return insumos.filter((i: any) => {
      if (filtroCat !== "todas" && i.categoria !== filtroCat) return false;
      if (filtroStatus !== "todos" && statusInsumo(i).label.toLowerCase() !== filtroStatus) return false;
      return true;
    });
  }, [insumos, filtroCat, filtroStatus]);

  const cols: Column<any>[] = [
    { key: "nome", label: "Nome", sortable: true },
    { key: "categoria", label: "Categoria", sortable: true },
    { key: "quantidade_atual", label: "Qtd", render: r => `${Number(r.quantidade_atual).toLocaleString("pt-BR")} ${r.unidade}` },
    { key: "estoque_minimo", label: "Mínimo", render: r => `${Number(r.estoque_minimo).toLocaleString("pt-BR")} ${r.unidade}` },
    { key: "validade", label: "Validade", render: r => r.validade ? new Date(r.validade + "T00:00:00").toLocaleDateString("pt-BR") : "—" },
    { key: "status", label: "Status", render: r => { const s = statusInsumo(r); return <Badge className={s.cor}>{s.label}</Badge>; } },
    { key: "acoes", label: "Ações", render: r => (
      <div className="flex gap-1">
        <Button size="sm" variant="outline" onClick={() => setMovDialog({ insumo: r, tipo: "entrada" })}><Plus className="h-3 w-3"/></Button>
        <Button size="sm" variant="outline" onClick={() => setMovDialog({ insumo: r, tipo: "saida" })}><Minus className="h-3 w-3"/></Button>
        <Button size="sm" variant="ghost" onClick={() => setEditing(r)}><Pencil className="h-3 w-3"/></Button>
      </div>
    )},
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-end">
        <div className="w-48">
          <Label className="text-xs">Categoria</Label>
          <Select value={filtroCat} onValueChange={setFiltroCat}>
            <SelectTrigger><SelectValue/></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem>
              {CATEGORIAS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="w-40">
          <Label className="text-xs">Status</Label>
          <Select value={filtroStatus} onValueChange={setFiltroStatus}>
            <SelectTrigger><SelectValue/></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="ok">OK</SelectItem>
              <SelectItem value="baixo">Baixo</SelectItem>
              <SelectItem value="vencendo">Vencendo</SelectItem>
              <SelectItem value="vencido">Vencido</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="ml-auto">
          <Button onClick={() => setShowNew(true)}><PackagePlus className="h-4 w-4 mr-2"/>Novo insumo</Button>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? <p className="text-sm text-muted-foreground">Carregando…</p> : (
            <DataTable data={filtered} columns={cols} searchPlaceholder="Buscar insumo..." totalLabel="insumos"/>
          )}
        </CardContent>
      </Card>

      {(showNew || editing) && (
        <InsumoDialog insumo={editing} onClose={() => { setShowNew(false); setEditing(null); }} onSaved={() => { qc.invalidateQueries({ queryKey: ["cozinha-insumos"] }); qc.invalidateQueries({ queryKey: ["cozinha-stats"] }); }}/>
      )}
      {movDialog && (
        <MovDialog ctx={movDialog} userId={user?.id ?? ""} onClose={() => setMovDialog(null)} onSaved={() => { qc.invalidateQueries({ queryKey: ["cozinha-insumos"] }); qc.invalidateQueries({ queryKey: ["cozinha-stats"] }); qc.invalidateQueries({ queryKey: ["cozinha-movimentacoes"] }); }}/>
      )}
    </div>
  );
}

function InsumoDialog({ insumo, onClose, onSaved }: { insumo: any | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    nome: insumo?.nome ?? "",
    categoria: insumo?.categoria ?? "Outros",
    unidade: insumo?.unidade ?? "un",
    quantidade_atual: insumo?.quantidade_atual ?? 0,
    estoque_minimo: insumo?.estoque_minimo ?? 0,
    validade: insumo?.validade ?? "",
    valor_unitario: insumo?.valor_unitario ?? "",
    observacao: insumo?.observacao ?? "",
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!form.nome.trim()) { toast({ title: "Informe o nome", variant: "destructive" }); return; }
    setSaving(true);
    const payload: any = {
      nome: form.nome.trim(), categoria: form.categoria, unidade: form.unidade,
      quantidade_atual: Number(form.quantidade_atual) || 0, estoque_minimo: Number(form.estoque_minimo) || 0,
      validade: form.validade || null,
      valor_unitario: form.valor_unitario === "" ? null : Number(form.valor_unitario),
      observacao: form.observacao || null,
    };
    const { error } = insumo
      ? await (supabase as any).from("cozinha_insumos").update(payload).eq("id", insumo.id)
      : await (supabase as any).from("cozinha_insumos").insert(payload);
    setSaving(false);
    if (error) { toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" }); return; }
    toast({ title: insumo ? "Insumo atualizado" : "Insumo cadastrado" });
    onSaved(); onClose();
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{insumo ? "Editar insumo" : "Novo insumo"}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><Label>Nome *</Label><Input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })}/></div>
          <div><Label>Categoria</Label>
            <Select value={form.categoria} onValueChange={v => setForm({ ...form, categoria: v })}>
              <SelectTrigger><SelectValue/></SelectTrigger>
              <SelectContent>{CATEGORIAS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Unidade</Label>
            <Select value={form.unidade} onValueChange={v => setForm({ ...form, unidade: v })}>
              <SelectTrigger><SelectValue/></SelectTrigger>
              <SelectContent>{UNIDADES.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Qtd atual</Label><Input type="number" step="0.01" value={form.quantidade_atual} onChange={e => setForm({ ...form, quantidade_atual: e.target.value as any })}/></div>
          <div><Label>Estoque mínimo</Label><Input type="number" step="0.01" value={form.estoque_minimo} onChange={e => setForm({ ...form, estoque_minimo: e.target.value as any })}/></div>
          <div><Label>Validade</Label><Input type="date" value={form.validade ?? ""} onChange={e => setForm({ ...form, validade: e.target.value })}/></div>
          <div><Label>Valor unitário (R$)</Label><Input type="number" step="0.01" value={form.valor_unitario as any} onChange={e => setForm({ ...form, valor_unitario: e.target.value as any })}/></div>
          <div className="col-span-2"><Label>Observação</Label><Textarea rows={2} value={form.observacao} onChange={e => setForm({ ...form, observacao: e.target.value })}/></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Salvando…" : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MovDialog({ ctx, userId, onClose, onSaved }: { ctx: { insumo: any; tipo: "entrada"|"saida" }; userId: string; onClose: () => void; onSaved: () => void }) {
  const [qtd, setQtd] = useState("");
  const [motivo, setMotivo] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    const n = Number(qtd);
    if (!n || n <= 0) { toast({ title: "Informe a quantidade", variant: "destructive" }); return; }
    setSaving(true);
    const { data: prof } = await supabase.from("profiles").select("id").eq("user_id", userId).single();
    if (!prof) { setSaving(false); toast({ title: "Perfil não encontrado", variant: "destructive" }); return; }
    const { error } = await (supabase as any).from("cozinha_movimentacoes").insert({
      insumo_id: ctx.insumo.id, tipo: ctx.tipo, quantidade: n, motivo: motivo || null, responsavel_id: prof.id,
    });
    setSaving(false);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: ctx.tipo === "entrada" ? "Entrada registrada" : "Saída registrada" });
    onSaved(); onClose();
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>{ctx.tipo === "entrada" ? "Entrada" : "Saída"} — {ctx.insumo.nome}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Quantidade ({ctx.insumo.unidade}) *</Label><Input type="number" step="0.01" value={qtd} onChange={e => setQtd(e.target.value)}/></div>
          <div><Label>Motivo</Label><Textarea rows={2} value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="ex.: compra, consumo da semana, ajuste por inventário…"/></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Salvando…" : "Confirmar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}