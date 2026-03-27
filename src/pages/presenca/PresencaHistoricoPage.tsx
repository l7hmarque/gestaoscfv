import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const PresencaHistoricoPage = () => {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild><Link to="/presenca"><ArrowLeft className="h-4 w-4" /></Link></Button>
        <h1 className="text-xl font-semibold text-foreground">Histórico de Presença</h1>
      </div>
      <div className="text-sm text-muted-foreground">Histórico mensal será carregado do banco de dados.</div>
    </div>
  );
};

export default PresencaHistoricoPage;
