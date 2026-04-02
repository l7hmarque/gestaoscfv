import { useState, useEffect } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useIsDemo, guardDemo } from "@/hooks/useIsDemo";

interface Props {
  /** If set, pre-fills the destinatario filter to tecnico roles only */
  toTecnicos?: boolean;
  trigger?: React.ReactNode;
}

export function SendRecadoDialog({ toTecnicos, trigger }: Props) {
  const { user } = useAuth();
  const isDemo = useIsDemo();
  const [open, setOpen] = useState(false);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [participantes, setParticipantes] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [myProfileId, setMyProfileId] = useState("");
  const [form, setForm] = useState({ destinatario_id: "", participante_id: "", conteudo: "" });

  useEffect(() => {
    if (!open) return;
    loadData();
  }, [open]);

  const loadData = async () => {
    const [{ data: prof }, { data: parts }, { data: rl }] = await Promise.all([
      supabase.from("profiles").select("id, nome, cargo, user_id").eq("ativo", true),
      supabase.from("participantes").select("id, nome_completo").eq("status", "ativo").order("nome_completo"),
      supabase.from("user_roles").select("user_id, role"),
    ]);
    setProfiles(prof || []);
    setParticipantes(parts || []);
    setRoles(rl || []);
    if (user) {
      const me = (prof || []).find((p: any) => p.user_id === user.id);
      if (me) setMyProfileId(me.id);
    }
  };

  const destinatarios = profiles.filter(p => {
    if (p.id === myProfileId) return false;
    if (toTecnicos) {
      const userRoles = roles.filter((r: any) => r.user_id === p.user_id).map((r: any) => r.role);
      return userRoles.includes("tecnico") || userRoles.includes("coordenacao");
    }
    return true;
  });

  const handleSend = async () => {
    if (guardDemo(isDemo)) return;
    if (!form.destinatario_id || !form.conteudo.trim()) { toast.error("Preencha destinatário e conteúdo"); return; }
    const partId = form.participante_id === "__none__" ? null : (form.participante_id || null);
    const { error } = await supabase.from("recados").insert({
      remetente_id: myProfileId,
      destinatario_id: form.destinatario_id,
      participante_id: form.participante_id || null,
      conteudo: form.conteudo,
    } as any);
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success("Recado enviado!");
    setOpen(false);
    setForm({ destinatario_id: "", participante_id: "", conteudo: "" });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || <Button variant="ghost" size="icon" title="Enviar recado"><Send className="h-4 w-4" /></Button>}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{toTecnicos ? "Recado para Equipe Técnica" : "Enviar Recado"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Destinatário</Label>
            <Select value={form.destinatario_id} onValueChange={v => setForm(f => ({ ...f, destinatario_id: v }))}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {destinatarios.map(p => <SelectItem key={p.id} value={p.id}>{p.nome} {p.cargo ? `(${p.cargo})` : ""}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Sobre participante (opcional)</Label>
            <Select value={form.participante_id} onValueChange={v => setForm(f => ({ ...f, participante_id: v }))}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Nenhum" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Nenhum</SelectItem>
                {participantes.map(p => <SelectItem key={p.id} value={p.id}>{p.nome_completo}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Mensagem</Label>
            <Textarea value={form.conteudo} onChange={e => setForm(f => ({ ...f, conteudo: e.target.value }))} className="mt-1 min-h-[80px]" placeholder="Escreva seu recado..." />
          </div>
          <Button onClick={handleSend} className="w-full gap-1"><Send className="h-4 w-4" />Enviar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
