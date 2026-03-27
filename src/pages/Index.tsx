import { Users, GraduationCap, ClipboardCheck, BookOpen, FileText } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";

const shortcuts = [
  { title: "Participantes", description: "Cadastrar e gerenciar", icon: Users, url: "/participantes", color: "text-primary" },
  { title: "Turmas", description: "Organizar turmas", icon: GraduationCap, url: "/turmas", color: "text-secondary" },
  { title: "Presença", description: "Registrar frequência", icon: ClipboardCheck, url: "/presenca", color: "text-primary" },
  { title: "Planejamento", description: "Planejar atividades", icon: BookOpen, url: "/planejamentos", color: "text-secondary" },
  { title: "Relatórios", description: "Registrar atividades", icon: FileText, url: "/relatorios", color: "text-primary" },
];

const Index = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Bem-vindo ao SysELO</h1>
        <p className="text-sm text-muted-foreground mt-1">Sistema de Gestão do Serviço de Convivência e Fortalecimento de Vínculos</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {shortcuts.map((item) => (
          <Link key={item.title} to={item.url}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer border-border/60">
              <CardContent className="flex items-center gap-4 p-4">
                <div className={`${item.color} bg-muted rounded-lg p-2.5`}>
                  <item.icon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-foreground">{item.title}</h3>
                  <p className="text-xs text-muted-foreground">{item.description}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default Index;
