import { useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Pencil, CheckCircle2, AlertCircle } from "lucide-react";
import { useCardapio, useInsumos, DIAS_SEMANA, REFEICOES } from "@/hooks/useCozinhaData";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

function getMonday(d: Date) { const x = new Date(d); const day = x.getDay() || 7; if (day !== 1) x.setHours(-24 * (day - 1)); x.setHours(0,0,0,0); return x; }
function fmt(d: Date) { return d.toISOString().slice(0,10); }

export default function CardapioTab() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [semana, setSemana] = useState<Date>(getMonday(new Date()));
  const semanaStr = fmt(semana);
  const { data: itens = [] } = useCardapio(semanaStr);
  const { data: insumos = [] } = useInsumos();
  const [editing, setEditing] = useState<{ dia: number; refeicao: string; existing: any | null } | null>(null);

  const grade = useMemo(() => {
    const map: Record<string, any> = {};
    itens.forEach((i: any) => { map[`${i.dia_semana}-${i.refeicao}`] = i; });
    return map;
  }, [itens]);

  const insumosMap = useMemo(() => {
    const m: Record<string, any> = {};
    insumos.forEach((i: any) => { m[i.id] = i; });
    return m;
  }, [insumos]);

  function viabilidade(prev: { insumo_id: string; quantidade: number }[] | undefined) {
    if (!prev || prev.length === 0) return null;
    const falta = prev.some(p => {
      const i = insumosMap[p.insumo_id];
      return !i || Number(i.quantidade_atual) < Number(p.quantidade);
    });
    return falta ? "falta" : "ok";
  }

  function navSemana(dir: number) { const d = new Date(semana); d.setDate(d.getDate() + dir * 7); setSemana(getMonday(d)); }

  async function replicar() {
    const ant = new Date(semana); ant.setDate(ant.getDate() - 7);
    const { data: prev } = await (supabase as any).from("cozinha_cardapio").select("*").eq("semana_inicio", fmt(ant));
    if (!prev || prev.length === 0) { toast({ title: "Sem cardápio na semana anterior", variant: "destructive" }); return; }
    const { data: profile } = await supabase.from("profiles").select("id").eq("user_id", user?.id ?? "").single();
    const rows = prev.map((p: any) => ({
      semana_inicio: semanaStr, dia_semana: p.dia_semana, refeicao: p.refeicao,
      prato: p.prato, insumos_previstos: p.insumos_previstos, criado_por: profile?.id ?? null,
    }));
    const { error } = await (supabase as any).from("cozinha_cardapio").upsert(rows, { onConflict: "semana_inicio,dia_semana,refeicao" });
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Semana replicada" });
    qc.invalidateQueries({ queryKey: ["cozinha-cardapio", semanaStr] });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => navSemana(-1)}><ChevronLeft className="h-4 w-4"/></Button>
          <span className="font-medium">Semana de {semana.toLocaleDateString("pt-BR")}</span>
          <Button variant="outline" size="sm" onClick={() => navSemana(1)}><ChevronRight className="h-4 w-4"/></Button>
        </div>
        <Button variant="outline" size="sm" onClick={replicar}>Replicar semana anterior</Button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="text-left p-2 text-xs uppercase text-muted-foreground w-32">Refeição</th>
              {DIAS_SEMANA.map(d => <th key={d.num} className="text-left p-2 text-xs uppercase text-muted-foreground">{d.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {REFEICOES.map(ref => (
              <tr key={ref.key}>
                <td className="p-2 font-medium text-sm border-t">{ref.label}</td>
                {DIAS_SEMANA.map(d => {
                  const item = grade[`${d.num}-${ref.key}`];
                  const v = viabilidade(item?.insumos_previstos);
                  return (
                    <td key={d.num} className="p-2 border-t align-top">
                      <Card className={`min-h-24 cursor-pointer hover:shadow-md transition-shadow ${v === "falta" ? "border-l-4 border-l-destructive" : v === "ok" ? "border-l-4 border-l-emerald-500" : ""}`} onClick={() => setEditing({ dia: d.num, refeicao: ref.key, existing: item ?? null })}>
                        <CardContent className="p-3">
                          {item ? (
                            <>
                              <p className="text-sm font-medium">{item.prato || <span className="text-muted-foreground italic">Sem prato</span>}</p>
                              {v && (
                                <Badge variant={v === "falta" ? "destructive" : "default"} className="mt-1 text-[10px]">
                                  {v === "falta" ? <><AlertCircle className="h-3 w-3 mr-1"/>Falta insumo</> : <><CheckCircle2 className="h-3 w-3 mr-1"/>OK</>}
                                </Badge>
                              )}
                            </>
                          ) : (
                            <p className="text-xs text-muted-foreground flex items-center gap-1"><Pencil className="h-3 w-3"/> Adicionar</p>
                          )}
                        </CardContent>
                      </Card>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <CardapioDialog
          ctx={editing} semana={semanaStr} userId={user?.id ?? ""} insumos={insumos}
          onClose={() => setEditing(null)}
          onSaved={() => { qc.invalidateQueries({ queryKey: ["cozinha-cardapio", semanaStr] }); qc.invalidateQueries({ queryKey: ["cozinha-stats"] }); }}
        />
      )}
    </div>
  );
}

function CardapioDialog({ ctx, semana, userId, insumos, onClose, onSaved }: any) {
  const [prato, setPrato] = useState(ctx.existing?.prato ?? "");
  const [prevText, setPrevText] = useState(
    (ctx.existing?.insumos_previstos ?? []).map((p: any) => {
      const i = insumos.find((x: any) => x.id === p.insumo_id);
      return `${i?.nome ?? p.insumo_id}|${p.quantidade}`;
    }).join("\n")
  );
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const { data: prof } = await supabase.from("profiles").select("id").eq("user_id", userId).single();
    const previstos = prevText.split("\n").map((l: string) => l.trim()).filter(Boolean).map((l: string) => {
      const [nome, qtd] = l.split("|").map(s => s.trim());
      const ins = insumos.find((i: any) => i.nome.toLowerCase() === (nome ?? "").toLowerCase()) ?? insumos.find((i: any) => i.id === nome);
      return ins ? { insumo_id: ins.id, quantidade: Number(qtd) || 0 } : null;
    }).filter(Boolean);

    const payload: any = {
      semana_inicio: semana, dia_semana: ctx.dia, refeicao: ctx.refeicao,
      prato: prato.trim(), insumos_previstos: previstos, criado_por: prof?.id ?? null,
    };
    const { error } = await (supabase as any).from("cozinha_cardapio")
      .upsert(payload, { onConflict: "semana_inicio,dia_semana,refeicao" });
    setSaving(false);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Cardápio salvo" });
    onSaved(); onClose();
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Editar refeição</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Prato</Label><Input value={prato} onChange={e => setPrato(e.target.value)} placeholder="Ex.: Arroz com frango e salada"/></div>
          <div>
            <Label>Insumos previstos</Label>
            <p className="text-xs text-muted-foreground mb-1">Um por linha, no formato <code>Nome do insumo|quantidade</code></p>
            <Textarea rows={6} value={prevText} onChange={e => setPrevText(e.target.value)} placeholder="Arroz|2&#10;Frango|3"/>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Salvando…" : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}