import { Plus, Upload } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const ParticipantesPage = () => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Participantes</h1>
          <p className="text-sm text-muted-foreground">Gerenciar participantes do SCFV</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to="/participantes/importar"><Upload className="h-4 w-4 mr-1" />Importar</Link>
          </Button>
          <Button size="sm" asChild>
            <Link to="/participantes/novo"><Plus className="h-4 w-4 mr-1" />Novo</Link>
          </Button>
        </div>
      </div>
      <div className="text-sm text-muted-foreground border border-dashed rounded-lg p-8 text-center">
        Nenhum participante cadastrado. Comece importando ou cadastrando manualmente.
      </div>
    </div>
  );
};

export default ParticipantesPage;
