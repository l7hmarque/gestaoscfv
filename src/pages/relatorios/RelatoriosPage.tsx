import { Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const RelatoriosPage = () => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Relatórios de Atividade</h1>
          <p className="text-sm text-muted-foreground">Registrar e acompanhar atividades realizadas</p>
        </div>
        <Button size="sm" asChild>
          <Link to="/relatorios/novo"><Plus className="h-4 w-4 mr-1" />Novo</Link>
        </Button>
      </div>
      <div className="text-sm text-muted-foreground border border-dashed rounded-lg p-8 text-center">
        Nenhum relatório cadastrado.
      </div>
    </div>
  );
};

export default RelatoriosPage;
