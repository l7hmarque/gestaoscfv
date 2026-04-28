import { useEffect, useMemo, useState } from "react";
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash2, Clock, ChevronDown, AlertTriangle, CheckCircle2 } from "lucide-react";
import {
  TIPOS_REGISTRO_COORD,
  STATUS_REGISTRO,
  STATUS_REGISTRO_COLORS,
  PRIORIDADE_REGISTRO,
  PRIORIDADE_REGISTRO_COLORS,
  tipoRegistroLabel,
} from "@/lib/constants";

const HOJE_ISO = () => new Date().toISOString().slice(0, 10);

export function RegistrosTab() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { log } = useAuditLog();
  const [profileId, setProfileId] = useState<string | null>(null);

  // filtros
  const [filtroCat, setFiltroCat] = useState<string>("todas");
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");
  const [filtroPrio, setFiltroPrio] = useState<string>("todas");
  const [filtroMes, setFiltroMes] = useState<string>(new Date().toISOString().slice(0, 7));

  // form
  const [data, setData] = useState(HOJE_ISO());
  const [categoria, setCategoria] = useState("reuniao");
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [duracao, setDuracao] = useState<string>("");
  const [prioridade, setPrioridade] = useState("media");
  const [statusForm, setStatusForm] = useState("aberto");
  const [prazo, setPrazo] = useState<string>("");
  const [tagsInput, setTagsInput] = useState("");
  const [openExtras, setOpenExtras] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    supabase.from("profiles").select("id").eq("user_id", user.id).maybeSingle().then(({ data }) => {
      if (data) setProfileId(data.id);
    });
  }, [user]);

  const { data: registros, isLoading } = useQuery({
    queryKey: ["coord-registros", filtroMes, filtroCat, filtroStatus, filtroPrio],
    queryFn: async () => {
      const inicio = `${filtroMes}-01`;
      const [y, m] = filtroMes.split("-").map(Number);
      const fim = new Date(y, m, 1).toISOString().slice(0, 10);
      let q = (supabase.from as any)("coordenacao_atividades")
        .select("*")
        .gte("data", inicio)
        .lt("data", fim)
        .order("data", { ascending: false });
      if (filtroCat !== "todas") q = q.eq("categoria", filtroCat);
      if (filtroStatus !== "todos") q = q.eq("status", filtroStatus);
      if (filtroPrio !== "todas") q = q.eq("prioridade", filtroPrio);
      const { data, error } = await q;
      if (error) throw error;
      const rows = (data ?? []) as any[];
      const ids = Array.from(new Set(rows.map(r => r.coordenador_id).filter(Boolean)));
      let nomeMap: Record<string, string> = {};
      if (ids.length) {
        const { data: profs } = await (supabase.from as any)("profiles").select("id, nome").in("id", ids);
        nomeMap = Object.fromEntries((profs ?? []).map((p: any) => [p.id, p.nome]));
      }
      return rows.map(r => ({ ...r, profiles: r.coordenador_id ? { nome: nomeMap[r.coordenador_id] ?? null } : null }));
    },
  });

  async function salvar() {
    if (!profileId) { toast({ title: "Perfil não encontrado", variant: "destructive" }); return; }
    if (!titulo.trim()) { toast({ title: "Informe um título", variant: "destructive" }); return; }
    setSaving(true);
    const tags = tagsInput.split(",").map(t => t.trim()).filter(Boolean);
    const payload: any = {
      coordenador_id: profileId,
      data,
      categoria,
      titulo: titulo.trim(),
      descricao: descricao.trim() || null,
      duracao_minutos: duracao ? parseInt(duracao, 10) : null,
      prioridade,
      status: statusForm,
      prazo: prazo || null,
      tags: tags.length ? tags : null,
    };
    const { data: inserted, error } = await (supabase.from as any)("coordenacao_atividades").insert(payload).select().single();
    setSaving(false);
    if (error) { toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" }); return; }
    await log({ acao: "registro_coordenacao_criado", tabela: "coordenacao_atividades", registro_id: inserted.id, detalhes: `${tipoRegistroLabel(categoria)} — ${titulo}` });
    toast({ title: "Registro criado" });
    // Garante que o registro recém-criado fique visível ajustando filtros se necessário
    const mesDoRegistro = (data || HOJE_ISO()).slice(0, 7);
    if (mesDoRegistro !== filtroMes) setFiltroMes(mesDoRegistro);
    if (filtroCat !== "todas" && filtroCat !== categoria) setFiltroCat("todas");
    if (filtroStatus !== "todos" && filtroStatus !== statusForm) setFiltroStatus("todos");
    if (filtroPrio !== "todas" && filtroPrio !== prioridade) setFiltroPrio("todas");
    setTitulo(""); setDescricao(""); setDuracao(""); setPrazo(""); setTagsInput("");
    setStatusForm("aberto"); setPrioridade("media"); setOpenExtras(false);
    qc.invalidateQueries({ queryKey: ["coord-registros"] });
    qc.invalidateQueries({ queryKey: ["coordenacao-stats"] });
  }

  async function alterarStatus(id: string, novo: string, label: string) {
    const { error } = await (supabase.from as any)("coordenacao_atividades").update({ status: novo }).eq("id", id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    await log({ acao: "registro_coordenacao_status", tabela: "coordenacao_atividades", registro_id: id, detalhes: `${label} → ${STATUS_REGISTRO[novo]}` });
    qc.invalidateQueries({ queryKey: ["coord-registros"] });
    qc.invalidateQueries({ queryKey: ["coordenacao-stats"] });
  }

  async function excluir(id: string, label: string) {
    if (!confirm("Excluir este registro?")) return;
    const { error } = await (supabase.from as any)("coordenacao_atividades").delete().eq("id", id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    await log({ acao: "registro_coordenacao_excluido", tabela: "coordenacao_atividades", registro_id: id, detalhes: label });
    qc.invalidateQueries({ queryKey: ["coord-registros"] });
    qc.invalidateQueries({ queryKey: ["coordenacao-stats"] });
  }

  const stats = useMemo(() => {
    const list = registros ?? [];
    const hoje = HOJE_ISO();
    const totalMin = list.reduce((s, a) => s + (a.duracao_minutos ?? 0), 0);
    return {
      total: list.length,
      abertos: list.filter(a => a.status === "aberto" || a.status === "em_andamento").length,
      concluidos: list.filter(a => a.status === "concluido").length,
      atrasados: list.filter(a => a.prazo && a.prazo < hoje && a.status !== "concluido" && a.status !== "cancelado").length,
      totalMin,
    };
  }, [registros]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Plus className="h-4 w-4" /> Novo registro</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label>Data</Label>
              <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
            </div>
            <div>
              <Label>Tipo</Label>
              <Select value={categoria} onValueChange={setCategoria}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TIPOS_REGISTRO_COORD.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Prioridade</Label>
              <Select value={prioridade} onValueChange={setPrioridade}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(PRIORIDADE_REGISTRO).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Título</Label>
            <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Reunião com CRAS Jardim Irene" />
          </div>

          <Collapsible open={openExtras} onOpenChange={setOpenExtras}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="px-2 text-xs">
                <ChevronDown className={`h-3 w-3 mr-1 transition-transform ${openExtras ? "rotate-180" : ""}`} />
                Mais detalhes (descrição, prazo, status, duração, tags)
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3 pt-2">
              <div>
                <Label>Descrição</Label>
                <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <Label>Status inicial</Label>
                  <Select value={statusForm} onValueChange={setStatusForm}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(STATUS_REGISTRO).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Prazo</Label>
                  <Input type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} />
                </div>
                <div>
                  <Label>Duração (min)</Label>
                  <Input type="number" min={0} value={duracao} onChange={(e) => setDuracao(e.target.value)} />
                </div>
              </div>
              <div>
                <Label>Tags (separadas por vírgula)</Label>
                <Input value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} placeholder="ex.: rede, urgente, jardim irene" />
              </div>
            </CollapsibleContent>
          </Collapsible>

          <div className="flex justify-end">
            <Button onClick={salvar} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
              Registrar
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 flex-wrap">
          <CardTitle className="text-base">Registros do período</CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            <Input type="month" value={filtroMes} onChange={(e) => setFiltroMes(e.target.value)} className="w-[150px]" />
            <Select value={filtroCat} onValueChange={setFiltroCat}>
              <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todos os tipos</SelectItem>
                {TIPOS_REGISTRO_COORD.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filtroStatus} onValueChange={setFiltroStatus}>
              <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos status</SelectItem>
                {Object.entries(STATUS_REGISTRO).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filtroPrio} onValueChange={setFiltroPrio}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Toda prioridade</SelectItem>
                {Object.entries(PRIORIDADE_REGISTRO).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : !registros?.length ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Nenhum registro no período.</p>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4 text-xs">
                <Mini label="Total" value={stats.total} />
                <Mini label="Abertos" value={stats.abertos} />
                <Mini label="Concluídos" value={stats.concluidos} />
                <Mini label="Atrasados" value={stats.atrasados} highlight={stats.atrasados > 0} />
                <Mini label="Tempo dedicado" value={`${Math.floor(stats.totalMin / 60)}h ${stats.totalMin % 60}m`} />
              </div>
              <div className="space-y-2">
                {registros.map((a) => {
                  const atrasado = a.prazo && a.prazo < HOJE_ISO() && a.status !== "concluido" && a.status !== "cancelado";
                  return (
                    <div key={a.id} className="p-3 rounded-md border hover:bg-accent/30 transition-colors">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className="text-xs">{tipoRegistroLabel(a.categoria)}</Badge>
                            <Badge className={`text-xs ${STATUS_REGISTRO_COLORS[a.status] ?? ""}`}>{STATUS_REGISTRO[a.status] ?? a.status}</Badge>
                            <Badge className={`text-xs ${PRIORIDADE_REGISTRO_COLORS[a.prioridade] ?? ""}`}>{PRIORIDADE_REGISTRO[a.prioridade] ?? a.prioridade}</Badge>
                            <span className="text-xs text-muted-foreground">{new Date(a.data).toLocaleDateString("pt-BR")}</span>
                            {a.prazo ? (
                              <span className={`text-xs flex items-center gap-1 ${atrasado ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                                {atrasado && <AlertTriangle className="h-3 w-3" />}
                                Prazo: {new Date(a.prazo).toLocaleDateString("pt-BR")}
                              </span>
                            ) : null}
                            {a.duracao_minutos ? <span className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" />{a.duracao_minutos}min</span> : null}
                            {a.profiles?.nome ? <span className="text-xs text-muted-foreground">· {a.profiles.nome}</span> : null}
                          </div>
                          <p className="font-medium mt-1">{a.titulo}</p>
                          {a.descricao ? <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{a.descricao}</p> : null}
                          {a.tags?.length ? (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {a.tags.map((t: string) => <Badge key={t} variant="secondary" className="text-[10px]">#{t}</Badge>)}
                            </div>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {a.status !== "concluido" ? (
                            <Button variant="ghost" size="icon" title="Marcar concluído" onClick={() => alterarStatus(a.id, "concluido", `${tipoRegistroLabel(a.categoria)} — ${a.titulo}`)}>
                              <CheckCircle2 className="h-4 w-4 text-green-600" />
                            </Button>
                          ) : null}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 px-2 text-xs">Status <ChevronDown className="h-3 w-3 ml-1" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                              {Object.entries(STATUS_REGISTRO).map(([v, l]) => (
                                <DropdownMenuItem key={v} onClick={() => alterarStatus(a.id, v, `${tipoRegistroLabel(a.categoria)} — ${a.titulo}`)}>{l}</DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                          <Button variant="ghost" size="icon" onClick={() => excluir(a.id, `${tipoRegistroLabel(a.categoria)} — ${a.titulo}`)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Mini({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div className={`p-2 rounded-md border ${highlight ? "border-destructive/50 bg-destructive/5" : ""}`}>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`text-lg font-bold ${highlight ? "text-destructive" : ""}`}>{value}</p>
    </div>
  );
}
