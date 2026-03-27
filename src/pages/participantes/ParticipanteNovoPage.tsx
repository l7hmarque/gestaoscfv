import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const ParticipanteNovoPage = () => {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild><Link to="/participantes"><ArrowLeft className="h-4 w-4" /></Link></Button>
        <h1 className="text-xl font-semibold text-foreground">Novo Participante</h1>
      </div>
      <div className="text-sm text-muted-foreground">Formulário em construção — será implementado com o banco de dados.</div>
    </div>
  );
};

export default ParticipanteNovoPage;
