import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChefHat } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import PainelTab from "./PainelTab";
import EstoqueTab from "./EstoqueTab";
import CardapioTab from "./CardapioTab";
import RestricoesTab from "./RestricoesTab";
import MovimentacoesTab from "./MovimentacoesTab";

export default function CozinhaPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState("painel");
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from("user_roles").select("role").eq("user_id", user.id).then(({ data }) => {
      const roles = (data ?? []).map((r: any) => r.role);
      const ok = roles.includes("cozinheiro") || roles.includes("coordenacao");
      setAllowed(ok);
      if (!ok) {
        toast({ title: "Acesso negado", description: "Módulo restrito à cozinha e coordenação.", variant: "destructive" });
        navigate("/dashboard");
      }
    });
  }, [user, navigate]);

  if (allowed !== true) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
          <ChefHat className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Cozinha</h1>
          <p className="text-sm text-muted-foreground">Gestão de insumos, cardápio e restrições alimentares</p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 md:grid-cols-5 h-auto">
          <TabsTrigger value="painel">Painel</TabsTrigger>
          <TabsTrigger value="estoque">Estoque</TabsTrigger>
          <TabsTrigger value="cardapio">Cardápio</TabsTrigger>
          <TabsTrigger value="restricoes">Restrições</TabsTrigger>
          <TabsTrigger value="movimentacoes">Movimentações</TabsTrigger>
        </TabsList>
        <TabsContent value="painel" className="mt-6"><PainelTab onGoToRestricoes={() => setTab("restricoes")} /></TabsContent>
        <TabsContent value="estoque" className="mt-6"><EstoqueTab /></TabsContent>
        <TabsContent value="cardapio" className="mt-6"><CardapioTab /></TabsContent>
        <TabsContent value="restricoes" className="mt-6"><RestricoesTab /></TabsContent>
        <TabsContent value="movimentacoes" className="mt-6"><MovimentacoesTab /></TabsContent>
      </Tabs>
    </div>
  );
}