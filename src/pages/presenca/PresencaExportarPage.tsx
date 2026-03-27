import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const PresencaExportarPage = () => {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild><Link to="/presenca"><ArrowLeft className="h-4 w-4" /></Link></Button>
        <h1 className="text-xl font-semibold text-foreground">Exportar Lista de Chamada</h1>
      </div>
      <div className="text-sm text-muted-foreground">Exportação XLSX/PDF será implementada.</div>
    </div>
  );
};

export default PresencaExportarPage;
