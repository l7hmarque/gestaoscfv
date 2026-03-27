import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Eye, Loader2 } from "lucide-react";
import { toast } from "sonner";

const LoginPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) {
      toast.error("Erro ao entrar: " + error.message);
    } else {
      navigate("/");
    }
  };

  const handleDemoLogin = async () => {
    setDemoLoading(true);
    const { error } = await signIn("visitante@syselo.demo", "visitantecaia");
    setDemoLoading(false);
    if (error) {
      toast.error("Conta de visitante não disponível. Contate o administrador.");
    } else {
      toast.info("Modo demonstração ativo — alterações não serão salvas");
      navigate("/");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto h-12 w-12 rounded-xl bg-primary flex items-center justify-center mb-2">
            <span className="text-primary-foreground font-bold text-lg">S</span>
          </div>
          <CardTitle className="text-lg">SysELO</CardTitle>
          <p className="text-xs text-muted-foreground">Gestão SCFV</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs">Senha</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
            </div>
            <Button type="submit" className="w-full" disabled={loading || demoLoading}>
              {loading ? "Entrando..." : "Entrar"}
            </Button>
          </form>
          <div className="mt-3 pt-3 border-t">
            <Button
              variant="outline"
              className="w-full gap-2 text-muted-foreground"
              disabled={loading || demoLoading}
              onClick={handleDemoLogin}
            >
              {demoLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
              Experimentar como Visitante
            </Button>
            <p className="text-[10px] text-muted-foreground text-center mt-1.5">
              Navegue pelo sistema sem alterar dados reais
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default LoginPage;
