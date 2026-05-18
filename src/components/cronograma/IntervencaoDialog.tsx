import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const DIAS = ["Seg","Ter","Qua","Qui","Sex"] as const;
const PERIODOS = [{v:"manha",l:"Manhã"},{v:"tarde",l:"Tarde"}];

interface Props {
  cenarioId: string;
  bairros: any[];
  profiles: any[];
  onCreated: () => void;
}

export function IntervencaoDialog({ cenarioId, bairros, profiles, onCreated }: Props) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    titulo: "", descricao: "", prioridade: "alta",
    data_inicio: new Date().toISOString().slice(0,10), data_fim: "",
    dias_semana: [] as string[], periodos: [] as string[],
    bairros: [] as string[], profissionais: [] as string[],
  });
  const [saving, setSaving] = useState(false);

  const toggle = (arr: string[], v: string) => arr.includes(v) ? arr.filter(x=>x!==v) : [...arr, v];

  const submit = async () => {
    if (!form.titulo.trim()) { toast.error("Título obrigatório"); return; }
    setSaving(true);
    const { error } = await supabase.from("cronograma_intervencoes").insert({
      cenario_id: cenarioId,
      titulo: form.titulo,
      descricao: form.descricao || null,
      prioridade: form.prioridade,
      data_inicio: form.data_inicio,
      data_fim: form.data_fim || null,
      dias_semana: form.dias_semana,
      periodos: form.periodos,
      bairros: form.bairros,
      profissionais: form.profissionais,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Intervenção criada! Notificação enviada.");
    setOpen(false);
    setForm({ titulo:"", descricao:"", prioridade:"alta", data_inicio:new Date().toISOString().slice(0,10), data_fim:"", dias_semana:[], periodos:[], bairros:[], profissionais:[] });
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="h-7 text-xs gap-1 px-2 border-amber-400 text-amber-700 hover:bg-amber-50">
          <Sparkles className="h-3 w-3" /> Intervenção
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova ação / intervenção</DialogTitle>
          <DialogDescription>Aparecerá como sobreposição nos dias selecionados e notificará os profissionais com ciência obrigatória.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Título *</Label>
            <Input value={form.titulo} onChange={e=>setForm(f=>({...f,titulo:e.target.value}))} className="h-8 text-sm" />
          </div>
          <div>
            <Label className="text-xs">Descrição</Label>
            <Textarea value={form.descricao} onChange={e=>setForm(f=>({...f,descricao:e.target.value}))} rows={3} className="text-sm" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-xs">Prioridade</Label>
              <Select value={form.prioridade} onValueChange={v=>setForm(f=>({...f,prioridade:v}))}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="urgente">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Data início</Label>
              <Input type="date" value={form.data_inicio} onChange={e=>setForm(f=>({...f,data_inicio:e.target.value}))} className="h-8 text-xs" />
            </div>
            <div>
              <Label className="text-xs">Data fim</Label>
              <Input type="date" value={form.data_fim} onChange={e=>setForm(f=>({...f,data_fim:e.target.value}))} className="h-8 text-xs" />
            </div>
          </div>
          <div>
            <Label className="text-xs">Dias da semana (opcional — vazio = todos)</Label>
            <div className="flex gap-1 mt-1">
              {DIAS.map(d => (
                <button key={d} type="button" onClick={()=>setForm(f=>({...f,dias_semana:toggle(f.dias_semana,d)}))}
                  className={`px-2 py-1 rounded border text-xs ${form.dias_semana.includes(d) ? "bg-primary text-primary-foreground" : "bg-background"}`}>{d}</button>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-xs">Períodos</Label>
            <div className="flex gap-2 mt-1">
              {PERIODOS.map(p => (
                <label key={p.v} className="flex items-center gap-1 text-xs">
                  <Checkbox checked={form.periodos.includes(p.v)} onCheckedChange={()=>setForm(f=>({...f,periodos:toggle(f.periodos,p.v)}))} />
                  {p.l}
                </label>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-xs">Bairros alvo (vazio = todos)</Label>
            <div className="flex flex-wrap gap-1 mt-1">
              {bairros.map(b => (
                <button key={b.id} type="button" onClick={()=>setForm(f=>({...f,bairros:toggle(f.bairros,b.id)}))}
                  className={`px-2 py-1 rounded border text-xs ${form.bairros.includes(b.id) ? "bg-primary text-primary-foreground" : "bg-background"}`}>{b.nome}</button>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-xs">Profissionais alvo (vazio = todos os do bairro)</Label>
            <div className="flex flex-wrap gap-1 mt-1 max-h-32 overflow-y-auto">
              {profiles.map(p => (
                <button key={p.id} type="button" onClick={()=>setForm(f=>({...f,profissionais:toggle(f.profissionais,p.id)}))}
                  className={`px-2 py-1 rounded border text-[10px] ${form.profissionais.includes(p.id) ? "bg-primary text-primary-foreground" : "bg-background"}`}>{p.nome}</button>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button size="sm" onClick={submit} disabled={saving}>{saving ? "Salvando..." : "Criar intervenção"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
