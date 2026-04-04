import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Mail, Phone, MapPin, Send, Loader2 } from "lucide-react";

export default function SiteContatoPage() {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [assunto, setAssunto] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [sending, setSending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim() || !email.trim() || !assunto.trim() || !mensagem.trim()) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }
    setSending(true);
    try {
      await supabase.from("site_leads" as any).insert({
        nome,
        email,
        interesse: `Contato: ${assunto} | Tel: ${telefone} | Msg: ${mensagem}`,
      });
      toast.success("Mensagem enviada com sucesso! Entraremos em contato.");
      setNome(""); setEmail(""); setTelefone(""); setAssunto(""); setMensagem("");
    } catch {
      toast.error("Erro ao enviar mensagem");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div className="text-center mb-12">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
          Entre em <span className="text-[#3B8FC2]">Contato</span>
        </h1>
        <p className="text-gray-500 max-w-lg mx-auto">
          Tem dúvidas, sugestões ou quer conhecer nosso trabalho? Envie uma mensagem.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-12">
        {/* Info */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-gradient-to-br from-[#E5541B]/5 to-[#3B8FC2]/5 rounded-xl p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Informações</h3>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-[#E5541B] mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-gray-900">Endereço</p>
                  <p className="text-sm text-gray-500">Medianeira — PR, Brasil</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Mail className="h-5 w-5 text-[#3B8FC2] mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-gray-900">Email</p>
                  <p className="text-sm text-gray-500">contato@scnsa.org.br</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Phone className="h-5 w-5 text-[#E5541B] mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-gray-900">Telefone</p>
                  <p className="text-sm text-gray-500">(45) 0000-0000</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-[#3B8FC2]/5 rounded-xl p-6">
            <h3 className="font-semibold text-gray-900 mb-2">Agendar Reunião</h3>
            <p className="text-sm text-gray-500 mb-3">
              Para agendar uma reunião por videoconferência, entre em contato conosco pelo formulário ou email informando data e horário de sua preferência.
            </p>
          </div>
        </div>

        {/* Formulário */}
        <div className="lg:col-span-3">
          <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Nome *</label>
                <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Seu nome completo" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Email *</label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Telefone</label>
                <Input value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(00) 00000-0000" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Assunto *</label>
                <Input value={assunto} onChange={(e) => setAssunto(e.target.value)} placeholder="Sobre o que deseja falar?" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Mensagem *</label>
              <Textarea value={mensagem} onChange={(e) => setMensagem(e.target.value)} placeholder="Escreva sua mensagem..." rows={5} />
            </div>
            <Button type="submit" disabled={sending} className="w-full bg-[#E5541B] hover:bg-[#E5541B]/90 text-white gap-2">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Enviar Mensagem
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
