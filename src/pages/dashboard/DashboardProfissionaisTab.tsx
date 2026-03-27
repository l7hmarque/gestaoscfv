import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const CARGOS = ["ADM", "Educador", "Psicólogo(a)", "Assistente Social", "Motorista", "Cozinheiro", "Oficineiro"];

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
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [fotoFile, setFotoFile] = useState<File | null>(null);

  useEffect(() => { loadProfs(); }, []);

  const loadProfs = async () => {
    const { data } = await supabase.from("profiles").select("*") as any;
    setProfs(data || []);
    setLoading(false);
  };

  const handleOpen = (prof?: Profissional) => {
    if (prof) {
      setEditId(prof.id);
      setForm({
        nome: prof.nome || "", cargo: prof.cargo || "", cpf: (prof as any).cpf || "",
        rg: (prof as any).rg || "", rg_data_expedicao: (prof as any).rg_data_expedicao || "",
        rg_orgao_expedidor: (prof as any).rg_orgao_expedidor || "",
        email: (prof as any).email || "", registro_profissional: (prof as any).registro_profissional || "",
        endereco: (prof as any).endereco || "", telefone: (prof as any).telefone || "",
        data_inicio: (prof as any).data_inicio || "",
      });
    } else {
      setEditId(null);
      setForm(emptyForm);
    }
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

    if (editId) {
      const { error } = await supabase.from("profiles").update(payload).eq("id", editId);
      if (error) { toast.error("Erro ao atualizar: " + error.message); return; }
      toast.success("Profissional atualizado");
    } else {
      toast.info("Para cadastrar novos profissionais, crie uma conta de usuário e o perfil será criado automaticamente.");
      return;
    }
    setOpen(false);
    loadProfs();
  };

  if (loading) return <p className="text-sm text-muted-foreground p-4">Carregando...</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Profissionais</h2>
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {profs.map(p => (
          <Card key={p.id} className="relative">
            <CardContent className="p-4 flex gap-3">
              <Avatar className="h-12 w-12 shrink-0">
                <AvatarImage src={p.foto_url || undefined} />
                <AvatarFallback className="bg-primary/10 text-primary text-sm">{p.nome?.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm text-foreground truncate">{p.nome}</p>
                <p className="text-xs text-muted-foreground">{p.cargo || "Sem cargo"}</p>
                {(p as any).telefone && <p className="text-xs text-muted-foreground">{(p as any).telefone}</p>}
                {(p as any).email && <p className="text-xs text-muted-foreground truncate">{(p as any).email}</p>}
              </div>
              <Button size="icon" variant="ghost" className="shrink-0" onClick={() => handleOpen(p)}>
                <Pencil className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? "Editar Profissional" : "Novo Profissional"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label>Nome *</Label>
              <Input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} />
            </div>
            <div>
              <Label>Cargo</Label>
              <Select value={form.cargo} onValueChange={v => setForm({ ...form, cargo: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {CARGOS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
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
    </div>
  );
}
