import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Users, Search } from "lucide-react";

export default function FamiliaLoginPage() {
  const [nome, setNome] = useState("");
  const [dataNascimento, setDataNascimento] = useState("");
  const [loading, setLoading] = useState(false);
  const [fuzzyMatch, setFuzzyMatch] = useState<any>(null);
  const navigate = useNavigate();

  const handleSearch = async () => {
    if (!nome.trim() || !dataNascimento) {
      toast.error("Preencha nome e data de nascimento");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("public-familia-auth", {
        body: { nome_completo: nome, data_nascimento: dataNascimento },
      });

      if (error) throw error;

      if (!data.found) {
        toast.error("Participante não encontrado. Verifique o nome e a data de nascimento.");
        return;
      }

      if (data.needs_confirmation) {
        setFuzzyMatch(data);
        return;
      }

      sessionStorage.setItem("familia_participantes", JSON.stringify(data.participantes));
      navigate("/familia/painel");
    } catch (err: any) {
      toast.error("Erro ao buscar participante");
    } finally {
      setLoading(false);
    }
  };

  const confirmFuzzy = () => {
    if (fuzzyMatch) {
      sessionStorage.setItem("familia_participantes", JSON.stringify(fuzzyMatch.participantes));
      navigate("/familia/painel");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-2">
            <Users className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Portal da Família</h1>
          <p className="text-muted-foreground text-sm">
            Acompanhe as atividades, presença e recados do(a) seu(sua) filho(a)
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Acesse com os dados da criança</CardTitle>
            <CardDescription>
              Insira o nome completo e a data de nascimento do participante
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome completo da criança</Label>
              <Input
                id="nome"
                placeholder="Ex: João da Silva Santos"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="data">Data de nascimento</Label>
              <Input
                id="data"
                type="date"
                value={dataNascimento}
                onChange={(e) => setDataNascimento(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
            </div>
            <Button className="w-full" onClick={handleSearch} disabled={loading}>
              <Search className="h-4 w-4 mr-2" />
              {loading ? "Buscando..." : "Acessar"}
            </Button>
          </CardContent>
        </Card>

        {fuzzyMatch && (
          <Card className="border-amber-300 bg-amber-50">
            <CardContent className="pt-6 space-y-3">
              <p className="text-sm font-medium text-amber-800">
                Encontramos um nome similar. Este é seu filho(a)?
              </p>
              <p className="font-semibold text-foreground">
                {fuzzyMatch.participantes[0]?.nome_completo}
              </p>
              <div className="flex gap-2">
                <Button onClick={confirmFuzzy} size="sm">Sim, é ele(a)</Button>
                <Button variant="outline" size="sm" onClick={() => setFuzzyMatch(null)}>
                  Não
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <p className="text-center text-xs text-muted-foreground">
          CAIA Medianeira — Sociedade Civil Nossa Senhora Aparecida
        </p>
      </div>
    </div>
  );
}
