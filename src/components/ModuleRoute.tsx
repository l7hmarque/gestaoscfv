import { ReactNode, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useCapabilities, ModuleKey, ModuleLevel } from "@/hooks/useCapabilities";
import { toast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface Props {
  module: ModuleKey;
  level?: ModuleLevel;
  children: ReactNode;
  fallback?: string;
}

export function ModuleRoute({ module, level = "read", children, fallback = "/dashboard" }: Props) {
  const { can, loading } = useCapabilities();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !can(module, level)) {
      toast({
        title: "Acesso não autorizado",
        description: `Você não tem permissão de ${level === "read" ? "visualização" : "edição"} para este módulo.`,
        variant: "destructive",
      });
      navigate(fallback, { replace: true });
    }
  }, [loading, module, level, can, navigate, fallback]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!can(module, level)) return null;
  return <>{children}</>;
}