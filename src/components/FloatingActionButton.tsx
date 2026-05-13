import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, FileText, ClipboardList, MapPin, Bus, Users, Megaphone } from "lucide-react";

type Action = { label: string; icon: React.ComponentType<{ className?: string }>; to: string };

const ACTIONS: Action[] = [
  { label: "Novo Relatório", icon: FileText, to: "/relatorios/novo" },
  { label: "Novo Planejamento", icon: ClipboardList, to: "/planejamentos/novo" },
  { label: "Novo Participante", icon: Users, to: "/participantes/novo" },
  { label: "Novo Roteiro Técnico", icon: MapPin, to: "/equipe-tecnica/roteiros/novo" },
  { label: "Embarques de Hoje", icon: Bus, to: "/dashboard?tab=transporte" },
  { label: "Mural / Recados", icon: Megaphone, to: "/mural" },
];

/**
 * Botão de ação flutuante global, sempre visível no canto inferior direito.
 * Acelera fluxos de criação (relatório, planejamento, participante, roteiro).
 * Oculto em rotas públicas e na tela de design.
 */
export function FloatingActionButton() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  // Esconde em rotas públicas, login e telas de criação (já está no contexto certo).
  const hidden =
    pathname.startsWith("/login") ||
    pathname.startsWith("/site") ||
    pathname.startsWith("/familia") ||
    pathname.startsWith("/matricula") ||
    pathname.startsWith("/preview-design") ||
    /\/(novo|exportar)$/.test(pathname);

  if (hidden) return null;

  return (
    <div className="fixed bottom-5 right-5 z-40 print:hidden">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="icon"
            className="h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-shadow bg-primary text-primary-foreground"
            aria-label="Ações rápidas"
          >
            <Plus className="h-6 w-6" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="top" className="w-60">
          <DropdownMenuLabel className="text-xs">Ações rápidas</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {ACTIONS.map((a) => (
            <DropdownMenuItem
              key={a.to}
              onClick={() => navigate(a.to)}
              className="gap-2 cursor-pointer"
            >
              <a.icon className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">{a.label}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}