import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAuditLog } from "@/hooks/useAuditLog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash2, Clock } from "lucide-react";

const CATEGORIAS = [
  { value: "reuniao", label: "Reunião" },
  { value: "visita_tecnica", label: "Visita técnica" },
  { value: "articulacao_rede", label: "Articulação de rede" },
  { value: "formacao_equipe", label: "Formação de equipe" },
  { value: "documento", label: "Elaboração de documento" },
  { value: "outro", label: "Outro" },
];

function categoriaLabel(v: string) {
  return CATEGORIAS.find((c) => c.value === v)?.label ?? v;
}

export function AtividadesTab() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { log } = useAuditLog();
  const [profileId, setProfileId] = useState<string | null>(null);
  const [filtroCat, setFiltroCat] = useState<string>("todas");
  const [filtroMes, setFiltroMes] = useState<string>(new Date().toISOString().slice(0, 7));

  // form
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [categoria, setCategoria] = useState("reuniao");
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [duracao, setDuracao] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    supabase.from("profiles").select("id").eq("user_id", user.id).maybeSingle().then(({ data }) => {
      if (data) setProfileId(data.id);
    });
  }, [user]);

  const { data: atividades, isLoading } = useQuery({
    queryKey: ["coordenacao-atividades", filtroMes, filtroCat],
    queryFn: async () => {
      const inicio = `${filtroMes}-01`;
      const [y, m] = filtroMes.split("-").map(Number);
      const fim = new Date(y, m, 1).toISOString().slice(0, 10);
      let q = (supabase.from as any)("coordenacao_atividades")
        .select("*, profiles:coordenador_id(nome)")
        .gte("data", inicio)
        .lt("data", fim)
        .order("data", { ascending: false });
      if (filtroCat !== "todas") q = q.eq("categoria", filtroCat);
      const { data, error } = await q;
      if (error) throw error;
      return data as any[];
    },
  });

  async function salvar() {
    if (!profileId) { toast({ title: "Perfil não encontrado", variant: "destructive" }); return; }
    if (!titulo.trim()) { toast({ title: "Informe um título", variant: "destructive" }); return; }
    setSaving(true);
    const payload: any = {
      coordenador_id: profileId,
      data,
      categoria,
      titulo: titulo.trim(),
      descricao: descricao.trim() || null,
      duracao_minutos: duracao ? parseInt(duracao, 10) : null,
    };
    const { data: inserted, error } = await (supabase.from as any)("coordenacao_atividades").insert(payload).select().single();
    setSaving(false);
    if (error) { toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" }); return; }
    await log({ acao: "atividade_coordenacao_criada", tabela: "coordenacao_atividades", registro_id: inserted.id, detalhes: `${categoriaLabel(categoria)} — ${titulo}` });
    toast({ title: "Atividade registrada" });
    setTitulo(""); setDescricao(""); setDuracao("");
    qc.invalidateQueries({ queryKey: ["coordenacao-atividades"] });
    qc.invalidateQueries({ queryKey: ["coordenacao-stats"] });
  }

  async function excluir(id: string, label: string) {
    if (!confirm("Excluir esta atividade?")) return;
    const { error } = await (supabase.from as any)("coordenacao_atividades").delete().eq("id", id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    await log({ acao: "atividade_coordenacao_excluida", tabela: "coordenacao_atividades", registro_id: id, detalhes: label });
    qc.invalidateQueries({ queryKey: ["coordenacao-atividades"] });
    qc.invalidateQueries({ queryKey: ["coordenacao-stats"] });
  }

  const totalMin = (atividades ?? []).reduce((s, a) => s + (a.duracao_minutos ?? 0), 0);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Plus className="h-4 w-4" /> Registrar atividade</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label>Data</Label>
            <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </div>
          <div>
            <Label>Categoria</Label>
            <Select value={categoria} onValueChange={setCategoria}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{CATEGORIAS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Label>Título</Label>
            <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Reunião com CRAS Jardim Irene" />
          </div>
          <div className="md:col-span-2">
            <Label>Descrição (opcional)</Label>
            <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} />
          </div>
          <div>
            <Label>Duração (minutos)</Label>
            <Input type="number" min={0} value={duracao} onChange={(e) => setDuracao(e.target.value)} />
          </div>
          <div className="flex items-end">
            <Button onClick={salvar} disabled={saving} className="w-full md:w-auto">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
              Registrar
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 flex-wrap">
          <CardTitle className="text-base">Atividades do período</CardTitle>
          <div className="flex items-center gap-2">
            <Input type="month" value={filtroMes} onChange={(e) => setFiltroMes(e.target.value)} className="w-[160px]" />
            <Select value={filtroCat} onValueChange={setFiltroCat}>
              <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas categorias</SelectItem>
                {CATEGORIAS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : !atividades?.length ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Nenhuma atividade registrada no período.</p>
          ) : (
            <>
              <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
                <span><strong className="text-foreground">{atividades.length}</strong> registros</span>
                <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> <strong className="text-foreground">{Math.floor(totalMin / 60)}h {totalMin % 60}min</strong> dedicados</span>
              </div>
              <div className="space-y-2">
                {atividades.map((a) => (
                  <div key={a.id} className="p-3 rounded-md border hover:bg-accent/30 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="secondary" className="text-xs">{categoriaLabel(a.categoria)}</Badge>
                          <span className="text-xs text-muted-foreground">{new Date(a.data).toLocaleDateString("pt-BR")}</span>
                          {a.duracao_minutos ? <span className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" />{a.duracao_minutos}min</span> : null}
                          {a.profiles?.nome ? <span className="text-xs text-muted-foreground">· {a.profiles.nome}</span> : null}
                        </div>
                        <p className="font-medium mt-1">{a.titulo}</p>
                        {a.descricao ? <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{a.descricao}</p> : null}
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => excluir(a.id, `${categoriaLabel(a.categoria)} — ${a.titulo}`)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}