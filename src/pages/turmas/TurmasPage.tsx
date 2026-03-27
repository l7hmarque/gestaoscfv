import { Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const TurmasPage = () => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Turmas</h1>
          <p className="text-sm text-muted-foreground">Gerenciar turmas do SCFV</p>
        </div>
        <Button size="sm" asChild>
          <Link to="/turmas/nova"><Plus className="h-4 w-4 mr-1" />Nova Turma</Link>
        </Button>
      </div>
      <div className="text-sm text-muted-foreground border border-dashed rounded-lg p-8 text-center">
        Nenhuma turma cadastrada.
      </div>
    </div>
  );
};

export default TurmasPage;
