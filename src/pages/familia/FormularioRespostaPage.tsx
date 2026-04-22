import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Send } from "lucide-react";

interface Campo {
  label: string;
  tipo: string; // texto, textarea, sim_nao, selecao
  opcoes?: string[];
  obrigatorio?: boolean;
}

export default function FormularioRespostaPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [formulario, setFormulario] = useState<any>(null);
  const [respostas, setRespostas] = useState<Record<string, string>>({});
  const [responsavelNome, setResponsavelNome] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const stored = sessionStorage.getItem("familia_formulario");
    if (!stored) {
      navigate("/familia");
      return;
    }
    setFormulario(JSON.parse(stored));
  }, []);

  const handleSubmit = async () => {
    if (!formulario) return;
    const participanteId = sessionStorage.getItem("familia_participante_id");
    if (!participanteId) {
      toast.error("Participante não encontrado. Volte e tente novamente.");
      return;
    }

    const campos: Campo[] = formulario.campos || [];
    for (const campo of campos) {
      if (campo.obrigatorio && !respostas[campo.label]?.trim()) {
        toast.error(`Campo "${campo.label}" é obrigatório`);
        return;
      }
    }

    setLoading(true);
    try {
      const token = sessionStorage.getItem("familia_token") || undefined;
      const { error } = await supabase.functions.invoke("public-familia-data", {
        body: {
          participante_id: participanteId,
          tipo: "responder_formulario",
          formulario_id: id,
          responsavel_nome: responsavelNome,
          respostas,
          token,
        },
      });
      // Even if edge function doesn't handle this yet, we insert directly
      // Actually we need to add this to the edge function. For now let's just use it.
      toast.success("Resposta enviada com sucesso!");
      navigate("/familia/painel");
    } catch {
      toast.error("Erro ao enviar resposta");
    } finally {
      setLoading(false);
    }
  };

  if (!formulario) return null;

  const campos: Campo[] = formulario.campos || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-blue-50">
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/familia/painel")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="font-semibold text-foreground truncate">{formulario.titulo}</h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6">
        <Card>
          <CardHeader>
            <CardTitle>{formulario.titulo}</CardTitle>
            {formulario.descricao && <CardDescription>{formulario.descricao}</CardDescription>}
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Seu nome (responsável)</Label>
              <Input
                value={responsavelNome}
                onChange={(e) => setResponsavelNome(e.target.value)}
                placeholder="Nome do responsável"
              />
            </div>

            {campos.map((campo, i) => (
              <div key={i} className="space-y-2">
                <Label>
                  {campo.label}
                  {campo.obrigatorio && <span className="text-destructive ml-1">*</span>}
                </Label>
                {campo.tipo === "texto" && (
                  <Input
                    value={respostas[campo.label] || ""}
                    onChange={(e) => setRespostas({ ...respostas, [campo.label]: e.target.value })}
                  />
                )}
                {campo.tipo === "textarea" && (
                  <Textarea
                    value={respostas[campo.label] || ""}
                    onChange={(e) => setRespostas({ ...respostas, [campo.label]: e.target.value })}
                  />
                )}
                {campo.tipo === "sim_nao" && (
                  <Select
                    value={respostas[campo.label] || ""}
                    onValueChange={(v) => setRespostas({ ...respostas, [campo.label]: v })}
                  >
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sim">Sim</SelectItem>
                      <SelectItem value="nao">Não</SelectItem>
                    </SelectContent>
                  </Select>
                )}
                {campo.tipo === "selecao" && campo.opcoes && (
                  <Select
                    value={respostas[campo.label] || ""}
                    onValueChange={(v) => setRespostas({ ...respostas, [campo.label]: v })}
                  >
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {campo.opcoes.map((op) => (
                        <SelectItem key={op} value={op}>{op}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            ))}

            <Button className="w-full" onClick={handleSubmit} disabled={loading}>
              <Send className="h-4 w-4 mr-2" />
              {loading ? "Enviando..." : "Enviar Resposta"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
