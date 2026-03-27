import { useState, useEffect } from "react";
import { ArrowLeft, UserPlus, Trash2, Pencil, Save, X } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

const periodoLabel: Record<string, string> = { manha: "Manhã", tarde: "Tarde", integral: "Integral" };
const faixaLabel: Record<string, string> = { "6-8": "6-8 anos", "9-11": "9-11 anos", "12-17": "12-17 anos", idosos: "Idosos" };
const diasLabel: Record<string, string> = { seg: "Seg", ter: "Ter", qua: "Qua", qui: "Qui", sex: "Sex", sab: "Sáb" };
const diasOptions = [
  { value: "seg", label: "Segunda" }, { value: "ter", label: "Terça" }, { value: "qua", label: "Quarta" },
  { value: "qui", label: "Quinta" }, { value: "sex", label: "Sexta" }, { value: "sab", label: "Sábado" },
];

interface MemberRow { tp_id: string; participante_id: string; nome: string; periodo: string | null; }

const TurmaDetalhePage = () => {
  const { id } = useParams();
  const [turma, setTurma] = useState<any>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [allParticipantes, setAllParticipantes] = useState<{ id: string; nome_completo: string; periodo: string | null }[]>([]);
  const [bairros, setBairros] = useState<Tables<"bairros">[]>([]);
  const [educadores, setEducadores] = useState<Tables<"profiles">[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [addSearch, setAddSearch] = useState("");
  const [form, setForm] = useState<Record<string, any>>({});

  useEffect(() => { fetchAll(); }, [id]);

  const fetchAll = async () => {
    setLoading(true);
    const [{ data: t }, { data: tp }, { data: ap }, { data: b }, { data: e }] = await Promise.all([
      supabase.from("turmas").select("*, profiles(nome), bairros(nome)").eq("id", id!).single(),
      supabase.from("turma_participantes").select("id, participante_id, participantes(nome_completo, periodo)").eq("turma_id", id!),
      supabase.from("participantes").select("id, nome_completo, periodo").eq("status", "ativo").order("nome_completo"),
      supabase.from("bairros").select("*").order("nome"),
      supabase.from("profiles").select("*").order("nome"),
    ]);
    setTurma(t);
    setMembers((tp || []).map((r: any) => ({ tp_id: r.id, participante_id: r.participante_id, nome: r.participantes?.nome_completo || "", periodo: r.participantes?.periodo })));
    setAllParticipantes(ap || []);
    setBairros(b || []);
    setEducadores(e || []);
    if (t) setForm({ nome: t.nome, periodo: t.periodo, faixa_etaria: t.faixa_etaria || "", tipo: t.tipo, bairro_id: t.bairro_id || "", educador_id: t.educador_id || "", dias_semana: t.dias_semana || [], ativa: t.ativa });
    setLoading(false);
  };

  const addParticipante = async (pId: string) => {
    const { error } = await supabase.from("turma_participantes").insert({ turma_id: id!, participante_id: pId });
    if (error) { toast.error(error.message.includes("duplicate") ? "Já está na turma" : error.message); return; }
    toast.success("Adicionado!");
    fetchAll();
  };

  const removeParticipante = async (tpId: string) => {
    await supabase.from("turma_participantes").delete().eq("id", tpId);
    toast.success("Removido");
    fetchAll();
  };

  const handleSave = async () => {
    setSaving(true);
    const payload: Record<string, unknown> = { ...form };
    if (!payload.bairro_id) payload.bairro_id = null;
    if (!payload.educador_id) payload.educador_id = null;
    if (!payload.faixa_etaria) payload.faixa_etaria = null;
    const { error } = await supabase.from("turmas").update(payload as any).eq("id", id!);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Turma atualizada!");
    setEditing(false);
    fetchAll();
  };

  const toggleDia = (dia: string) => {
    setForm((f) => ({ ...f, dias_semana: f.dias_semana.includes(dia) ? f.dias_semana.filter((d: string) => d !== dia) : [...f.dias_semana, dia] }));
  };

  const memberIds = new Set(members.map((m) => m.participante_id));
  const availableParticipantes = allParticipantes.filter((p) => !memberIds.has(p.id) && p.nome_completo.toLowerCase().includes(addSearch.toLowerCase()));

  if (loading) return <div className="flex justify-center py-12"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;
  if (!turma) return <div className="text-center py-12 text-muted-foreground">Turma não encontrada.</div>;

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" asChild><Link to="/turmas"><ArrowLeft className="h-4 w-4" /></Link></Button>
          <div>
            <h1 className="text-xl font-semibold text-foreground">{turma.nome}</h1>
            <div className="flex gap-1.5 mt-0.5">
              <Badge variant={turma.ativa ? "default" : "secondary"} className="text-xs">{turma.ativa ? "Ativa" : "Inativa"}</Badge>
              {turma.periodo && <Badge variant="outline" className="text-xs">{periodoLabel[turma.periodo]}</Badge>}
              {turma.faixa_etaria && <Badge variant="outline" className="text-xs">{faixaLabel[turma.faixa_etaria]}</Badge>}
            </div>
          </div>
        </div>
        {!editing ? (
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}><Pencil className="h-3.5 w-3.5 mr-1" />Editar</Button>
        ) : (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditing(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleSave} disabled={saving}><Save className="h-3.5 w-3.5 mr-1" />{saving ? "Salvando..." : "Salvar"}</Button>
          </div>
        )}
      </div>

      {editing && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm">Editar Turma</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Label className="text-xs">Nome</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} className="h-9 text-sm mt-1" /></div>
            <div><Label className="text-xs">Período</Label>
              <Select value={form.periodo || ""} onValueChange={(v) => setForm({ ...form, periodo: v })}>
                <SelectTrigger className="h-9 text-sm mt-1"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="manha">Manhã</SelectItem><SelectItem value="tarde">Tarde</SelectItem><SelectItem value="integral">Integral</SelectItem></SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Faixa Etária</Label>
              <Select value={form.faixa_etaria || ""} onValueChange={(v) => setForm({ ...form, faixa_etaria: v })}>
                <SelectTrigger className="h-9 text-sm mt-1"><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent><SelectItem value="6-8">6-8</SelectItem><SelectItem value="9-11">9-11</SelectItem><SelectItem value="12-17">12-17</SelectItem><SelectItem value="idosos">Idosos</SelectItem></SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Tipo</Label>
              <Select value={form.tipo || "ordinaria"} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                <SelectTrigger className="h-9 text-sm mt-1"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="ordinaria">Ordinária</SelectItem><SelectItem value="extraordinaria">Extraordinária</SelectItem></SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Bairro</Label>
              <Select value={form.bairro_id || ""} onValueChange={(v) => setForm({ ...form, bairro_id: v })}>
                <SelectTrigger className="h-9 text-sm mt-1"><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>{bairros.filter(b => isBairroSCFV(b.nome)).map((b) => <SelectItem key={b.id} value={b.id}>{b.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="col-span-2"><Label className="text-xs">Educador</Label>
              <Select value={form.educador_id || ""} onValueChange={(v) => setForm({ ...form, educador_id: v })}>
                <SelectTrigger className="h-9 text-sm mt-1"><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>{educadores.map((e) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label className="text-xs mb-2 block">Dias da Semana</Label>
              <div className="flex flex-wrap gap-3">
                {diasOptions.map((d) => (
                  <label key={d.value} className="flex items-center gap-1.5 cursor-pointer">
                    <Checkbox checked={form.dias_semana?.includes(d.value)} onCheckedChange={() => toggleDia(d.value)} />
                    <span className="text-sm">{d.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="col-span-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox checked={form.ativa} onCheckedChange={(v) => setForm({ ...form, ativa: !!v })} />
                <span className="text-sm">Turma ativa</span>
              </label>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Info resumida */}
      {!editing && (
        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
          {turma.dias_semana?.length > 0 && <span>📅 {turma.dias_semana.map((d: string) => diasLabel[d] || d).join(", ")}</span>}
          {turma.profiles?.nome && <span>👤 {turma.profiles.nome}</span>}
          {turma.bairros?.nome && <span>📍 {turma.bairros.nome}</span>}
          {turma.tipo === "extraordinaria" && <span>⭐ Extraordinária</span>}
        </div>
      )}

      {/* Participantes da turma */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Participantes ({members.length})</CardTitle>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline"><UserPlus className="h-3.5 w-3.5 mr-1" />Adicionar</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle className="text-base">Adicionar Participante</DialogTitle></DialogHeader>
              <Input placeholder="Buscar por nome..." value={addSearch} onChange={(e) => setAddSearch(e.target.value)} className="h-9 text-sm" />
              <div className="max-h-[300px] overflow-y-auto space-y-1">
                {availableParticipantes.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Nenhum participante disponível</p>
                ) : availableParticipantes.slice(0, 50).map((p) => (
                  <button key={p.id} onClick={() => addParticipante(p.id)} className="w-full flex items-center justify-between p-2 rounded hover:bg-muted text-left">
                    <span className="text-sm">{p.nome_completo}</span>
                    <Badge variant="outline" className="text-[10px]">{periodoLabel[p.periodo || ""] || "—"}</Badge>
                  </button>
                ))}
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {members.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum participante nesta turma.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="text-xs">Nome</TableHead>
                  <TableHead className="text-xs">Período</TableHead>
                  <TableHead className="text-xs w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((m) => (
                  <TableRow key={m.tp_id}>
                    <TableCell className="text-sm">
                      <Link to={`/participantes/${m.participante_id}`} className="hover:underline text-foreground">{m.nome}</Link>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{periodoLabel[m.periodo || ""] || "—"}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => removeParticipante(m.tp_id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default TurmaDetalhePage;
