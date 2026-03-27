import { ArrowLeft } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";

const PlanejamentoDetalhePage = () => {
  const { id } = useParams();
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild><Link to="/planejamentos"><ArrowLeft className="h-4 w-4" /></Link></Button>
        <h1 className="text-xl font-semibold text-foreground">Planejamento</h1>
      </div>
      <div className="text-sm text-muted-foreground">ID: {id}</div>
    </div>
  );
};

export default PlanejamentoDetalhePage;
