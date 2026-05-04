import { useState, useEffect } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAuditLog } from "@/hooks/useAuditLog";
import { toast } from "sonner";
import { useIsDemo, guardDemo } from "@/hooks/useIsDemo";

interface Props {
  toTecnicos?: boolean;
  paraFamilia?: boolean;
  trigger?: React.ReactNode;
  participanteIdFixo?: string;
}

export function SendRecadoDialog({ toTecnicos, paraFamilia, trigger, participanteIdFixo }: Props) {
  const { user } = useAuth();
  const { log: auditLog } = useAuditLog();
  const isDemo = useIsDemo();
  const [open, setOpen] = useState(false);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [participantes, setParticipantes] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [myProfileId, setMyProfileId] = useState("");
  const [form, setForm] = useState({ destinatario_id: "", participante_id: participanteIdFixo || "", conteudo: "" });

  useEffect(() => {
    if (!open) return;
    loadData();
  }, [open]);

  const loadData = async () => {
    const [{ data: prof }, { data: parts }, { data: rl }] = await Promise.all([
      supabase.from("profiles").select("id, nome, cargo, user_id").eq("ativo", true),
      supabase.from("participantes").select("id, nome_completo, status").in("status", ["ativo", "busca_ativa"] as any).order("nome_completo"),
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
    if (paraFamilia) {
      if (!form.participante_id || form.participante_id === "__none__" || !form.conteudo.trim()) {
        toast.error("Selecione o participante e escreva o recado");
        return;
      }
    } else if (!form.destinatario_id || !form.conteudo.trim()) {
      toast.error("Preencha destinatário e conteúdo"); return;
    }
    const partId = form.participante_id === "__none__" ? null : (form.participante_id || null);

    if (paraFamilia) {
      const { data, error } = await supabase.from("recados_familia").insert({
        remetente_id: myProfileId,
        participante_id: partId,
        conteudo: form.conteudo,
      } as any).select("*").single();
      if (error) { toast.error("Erro: " + error.message); return; }
      const partName = participantes.find(p => p.id === partId)?.nome_completo || "—";
      await auditLog({
        acao: "criação",
        tabela: "recados_familia",
        registro_id: data?.id,
        detalhes: `Recado para a família de ${partName}`,
      });
      toast.success("Recado enviado à família!");
      setOpen(false);
      setForm({ destinatario_id: "", participante_id: participanteIdFixo || "", conteudo: "" });
      return;
    }

    const { data, error } = await supabase.from("recados").insert({
      remetente_id: myProfileId,
      destinatario_id: form.destinatario_id,
      participante_id: partId,
      conteudo: form.conteudo,
      ...(toTecnicos ? { tipo_recado: "tecnico" } : {}),
    } as any).select("*").single();
    if (error) { toast.error("Erro: " + error.message); return; }

    // Audit log
    const destName = profiles.find(p => p.id === form.destinatario_id)?.nome || "—";
    await auditLog({
      acao: "criação",
      tabela: "recados",
      registro_id: data?.id,
      detalhes: `Recado #${(data as any)?.numero || "—"} enviado para ${destName}${partId ? ` sobre participante` : ""}`,
    });

    toast.success("Recado enviado!");
    setOpen(false);
    setForm({ destinatario_id: "", participante_id: "", conteudo: "" });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || <Button variant="ghost" size="icon" className="h-10 w-10" title="Enviar recado"><Send className="h-5 w-5" /></Button>}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>
          {paraFamilia ? "Recado para a Família" : toTecnicos ? "Recado para Equipe Técnica" : "Enviar Recado"}
        </DialogTitle></DialogHeader>
        <div className="space-y-3">
          {!paraFamilia && <div>
            <Label className="text-xs">Destinatário</Label>
            <Select value={form.destinatario_id} onValueChange={v => setForm(f => ({ ...f, destinatario_id: v }))}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {destinatarios.map(p => <SelectItem key={p.id} value={p.id}>{p.nome} {p.cargo ? `(${p.cargo})` : ""}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>}
          {!participanteIdFixo && <div>
            <Label className="text-xs">{paraFamilia ? "Participante (família destinatária)" : "Sobre participante (opcional)"}</Label>
            <Select value={form.participante_id} onValueChange={v => setForm(f => ({ ...f, participante_id: v }))}>
              <SelectTrigger className="mt-1"><SelectValue placeholder={paraFamilia ? "Selecione..." : "Nenhum"} /></SelectTrigger>
              <SelectContent>
                {!paraFamilia && <SelectItem value="__none__">Nenhum</SelectItem>}
                {participantes.map(p => <SelectItem key={p.id} value={p.id}>{p.nome_completo}{p.status === "busca_ativa" ? " (BA)" : ""}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>}
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
