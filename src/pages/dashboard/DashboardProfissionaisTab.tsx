import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Pencil, Plus, UserPlus, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

const CARGOS = ["ADM", "Educador", "Psicólogo(a)", "Assistente Social", "Motorista", "Cozinheiro", "Oficineiro"];
const ROLES: { value: string; label: string; description: string }[] = [
  { value: "coordenacao", label: "Coordenação", description: "Acesso total ao sistema" },
  { value: "educador", label: "Educador", description: "Planejamentos, relatórios e presença" },
  { value: "tecnico", label: "Equipe Técnica", description: "Prontuários e encaminhamentos" },
  { value: "motorista", label: "Motorista", description: "Transporte e rotas" },
  { value: "cozinheiro", label: "Cozinheiro", description: "Alimentação" },
];

const ROLE_COLORS: Record<string, string> = {
  coordenacao: "default",
  educador: "secondary",
  tecnico: "outline",
  motorista: "secondary",
  cozinheiro: "secondary",
};

interface Profissional {
  id: string;
  user_id: string;
  nome: string;
  cargo: string | null;
  cpf: string | null;
  rg: string | null;
  rg_data_expedicao: string | null;
  rg_orgao_expedidor: string | null;
  email: string | null;
  registro_profissional: string | null;
  foto_url: string | null;
  endereco: string | null;
  telefone: string | null;
  data_inicio: string | null;
  ativo: boolean | null;
}

const emptyForm = {
  nome: "", cargo: "", cpf: "", rg: "", rg_data_expedicao: "", rg_orgao_expedidor: "",
  email: "", registro_profissional: "", endereco: "", telefone: "", data_inicio: "",
};

export default function DashboardProfissionaisTab() {
  const [profs, setProfs] = useState<Profissional[]>([]);
  const [profRoles, setProfRoles] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [fotoFile, setFotoFile] = useState<File | null>(null);

  // New professional form
  const [newForm, setNewForm] = useState({ ...emptyForm, password: "", role: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => { loadProfs(); }, []);

  const loadProfs = async () => {
    const [{ data: profiles }, { data: roles }] = await Promise.all([
      // RPC com SECURITY DEFINER — apenas coordenação retorna linhas; demais recebem vazio.
      supabase.rpc("list_profiles_rh") as any,
      supabase.from("user_roles").select("*"),
    ]);
    setProfs(profiles || []);
    const roleMap: Record<string, string[]> = {};
    (roles || []).forEach((r: any) => {
      if (!roleMap[r.user_id]) roleMap[r.user_id] = [];
      roleMap[r.user_id].push(r.role);
    });
    setProfRoles(roleMap);
    setLoading(false);
  };

  const handleOpen = (prof: Profissional) => {
    setEditId(prof.id);
    setForm({
      nome: prof.nome || "", cargo: prof.cargo || "", cpf: prof.cpf || "",
      rg: prof.rg || "", rg_data_expedicao: prof.rg_data_expedicao || "",
      rg_orgao_expedidor: prof.rg_orgao_expedidor || "",
      email: prof.email || "", registro_profissional: prof.registro_profissional || "",
      endereco: prof.endereco || "", telefone: prof.telefone || "",
      data_inicio: prof.data_inicio || "",
    });
    setFotoFile(null);
    setOpen(true);
  };

  const handleSave = async () => {
    if (!form.nome.trim()) { toast.error("Nome é obrigatório"); return; }
    let foto_url: string | undefined;
    if (fotoFile) {
      const ext = fotoFile.name.split(".").pop();
      const path = `profissionais/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from("fotos-participantes").upload(path, fotoFile);
      if (!error) {
        const { data: urlData } = supabase.storage.from("fotos-participantes").getPublicUrl(path);
        foto_url = urlData.publicUrl;
      }
    }
    const payload: any = {
      nome: form.nome, cargo: form.cargo || null, cpf: form.cpf || null,
      rg: form.rg || null, rg_data_expedicao: form.rg_data_expedicao || null,
      rg_orgao_expedidor: form.rg_orgao_expedidor || null, email: form.email || null,
      registro_profissional: form.registro_profissional || null, endereco: form.endereco || null,
      telefone: form.telefone || null, data_inicio: form.data_inicio || null,
    };
    if (foto_url) payload.foto_url = foto_url;
    const { error } = await supabase.from("profiles").update(payload).eq("id", editId);
    if (error) { toast.error("Erro ao atualizar: " + error.message); return; }
    toast.success("Profissional atualizado");
    setOpen(false);
    loadProfs();
  };

  const handleCreate = async () => {
    if (!newForm.nome.trim() || !newForm.email.trim() || !newForm.password.trim() || !newForm.role) {
      toast.error("Nome, email, senha e permissão são obrigatórios");
      return;
    }
    if (newForm.password.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres");
      return;
    }
    setCreating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke("create-professional", {
        body: {
          email: newForm.email,
          password: newForm.password,
          nome: newForm.nome,
          cargo: newForm.cargo || null,
          role: newForm.role,
          cpf: newForm.cpf || null,
          rg: newForm.rg || null,
          rg_data_expedicao: newForm.rg_data_expedicao || null,
          rg_orgao_expedidor: newForm.rg_orgao_expedidor || null,
          registro_profissional: newForm.registro_profissional || null,
          endereco: newForm.endereco || null,
          telefone: newForm.telefone || null,
          data_inicio: newForm.data_inicio || null,
        },
      });
      if (res.error) {
        toast.error("Erro: " + (res.error.message || "Falha ao criar profissional"));
      } else if (res.data?.error) {
        toast.error("Erro: " + res.data.error);
      } else {
        toast.success(`Profissional ${newForm.nome} cadastrado com sucesso!`);
        setNewOpen(false);
        setNewForm({ ...emptyForm, password: "", role: "" });
        loadProfs();
      }
    } catch (err: any) {
      toast.error("Erro: " + err.message);
    }
    setCreating(false);
  };

  if (loading) return <p className="text-sm text-muted-foreground p-4">Carregando...</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Profissionais</h2>
        <Button size="sm" className="gap-1.5" onClick={() => { setNewForm({ ...emptyForm, password: "", role: "" }); setNewOpen(true); }}>
          <UserPlus className="h-4 w-4" />Cadastrar Profissional
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {profs.map(p => {
          const roles = profRoles[p.user_id] || [];
          return (
            <Card key={p.id} className="relative group">
              <Link to={`/profissional/${p.id}`}>
                <CardContent className="p-4 flex gap-3 cursor-pointer hover:bg-accent/50 transition-colors rounded-lg">
                  <Avatar className="h-12 w-12 shrink-0">
                    <AvatarImage src={p.foto_url || undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary text-sm">{p.nome?.slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm text-foreground truncate">{p.nome}</p>
                    <p className="text-xs text-muted-foreground">{p.cargo || "Sem cargo"}</p>
                    {roles.length > 0 && (
                      <div className="flex gap-1 flex-wrap mt-1">
                        {roles.map(r => (
                          <Badge key={r} variant={ROLE_COLORS[r] as any || "secondary"} className="text-[10px] px-1.5 py-0">
                            {ROLES.find(x => x.value === r)?.label || r}
                          </Badge>
                        ))}
                      </div>
                    )}
                    {p.email && <p className="text-xs text-muted-foreground truncate mt-0.5">{p.email}</p>}
                  </div>
                </CardContent>
              </Link>
              <Button size="icon" variant="ghost" className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => { e.preventDefault(); handleOpen(p); }}>
                <Pencil className="h-4 w-4" />
              </Button>
            </Card>
          );
        })}
      </div>

      {/* Edit Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Profissional</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div><Label>Nome *</Label><Input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} /></div>
            <div>
              <Label>Cargo</Label>
              <Select value={form.cargo} onValueChange={v => setForm({ ...form, cargo: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{CARGOS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>CPF</Label><Input value={form.cpf} onChange={e => setForm({ ...form, cpf: e.target.value })} /></div>
              <div><Label>RG</Label><Input value={form.rg} onChange={e => setForm({ ...form, rg: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Data Expedição RG</Label><Input type="date" value={form.rg_data_expedicao} onChange={e => setForm({ ...form, rg_data_expedicao: e.target.value })} /></div>
              <div><Label>Órgão Expedidor</Label><Input value={form.rg_orgao_expedidor} onChange={e => setForm({ ...form, rg_orgao_expedidor: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Email</Label><Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
              <div><Label>Registro Profissional</Label><Input value={form.registro_profissional} onChange={e => setForm({ ...form, registro_profissional: e.target.value })} /></div>
            </div>
            <div><Label>Endereço</Label><Input value={form.endereco} onChange={e => setForm({ ...form, endereco: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Telefone</Label><Input value={form.telefone} onChange={e => setForm({ ...form, telefone: e.target.value })} /></div>
              <div><Label>Data Início</Label><Input type="date" value={form.data_inicio} onChange={e => setForm({ ...form, data_inicio: e.target.value })} /></div>
            </div>
            <div>
              <Label>Foto de Perfil</Label>
              <Input type="file" accept="image/*" onChange={e => setFotoFile(e.target.files?.[0] || null)} />
            </div>
            <Button onClick={handleSave}>Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* New Professional Dialog */}
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><UserPlus className="h-5 w-5" />Cadastrar Novo Profissional</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="rounded-lg border border-border bg-muted/50 p-3 space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Acesso ao Sistema</p>
              <div><Label>Email de Acesso *</Label><Input type="email" value={newForm.email} onChange={e => setNewForm({ ...newForm, email: e.target.value })} placeholder="profissional@email.com" /></div>
              <div className="relative">
                <Label>Senha Inicial *</Label>
                <div className="relative">
                  <Input type={showPassword ? "text" : "password"} value={newForm.password} onChange={e => setNewForm({ ...newForm, password: e.target.value })} placeholder="Mínimo 6 caracteres" />
                  <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-0 h-full" onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div>
                <Label>Permissão *</Label>
                <Select value={newForm.role} onValueChange={v => setNewForm({ ...newForm, role: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione a permissão" /></SelectTrigger>
                  <SelectContent>
                    {ROLES.map(r => (
                      <SelectItem key={r.value} value={r.value}>
                        <div className="flex flex-col">
                          <span>{r.label}</span>
                          <span className="text-xs text-muted-foreground">{r.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="rounded-lg border border-border p-3 space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Dados Pessoais</p>
              <div><Label>Nome Completo *</Label><Input value={newForm.nome} onChange={e => setNewForm({ ...newForm, nome: e.target.value })} /></div>
              <div>
                <Label>Cargo</Label>
                <Select value={newForm.cargo} onValueChange={v => setNewForm({ ...newForm, cargo: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{CARGOS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>CPF</Label><Input value={newForm.cpf} onChange={e => setNewForm({ ...newForm, cpf: e.target.value })} /></div>
                <div><Label>RG</Label><Input value={newForm.rg} onChange={e => setNewForm({ ...newForm, rg: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Data Expedição RG</Label><Input type="date" value={newForm.rg_data_expedicao} onChange={e => setNewForm({ ...newForm, rg_data_expedicao: e.target.value })} /></div>
                <div><Label>Órgão Expedidor</Label><Input value={newForm.rg_orgao_expedidor} onChange={e => setNewForm({ ...newForm, rg_orgao_expedidor: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Registro Profissional</Label><Input value={newForm.registro_profissional} onChange={e => setNewForm({ ...newForm, registro_profissional: e.target.value })} /></div>
                <div><Label>Telefone</Label><Input value={newForm.telefone} onChange={e => setNewForm({ ...newForm, telefone: e.target.value })} /></div>
              </div>
              <div><Label>Endereço</Label><Input value={newForm.endereco} onChange={e => setNewForm({ ...newForm, endereco: e.target.value })} /></div>
              <div><Label>Data Início</Label><Input type="date" value={newForm.data_inicio} onChange={e => setNewForm({ ...newForm, data_inicio: e.target.value })} /></div>
            </div>

            <Button onClick={handleCreate} disabled={creating} className="gap-1.5">
              {creating ? "Cadastrando..." : <><UserPlus className="h-4 w-4" />Cadastrar Profissional</>}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
