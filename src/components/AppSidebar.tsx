import { useState, useEffect } from "react";
import { SysCFVLogo } from "@/components/SysCFVLogo";
import {
  Users, GraduationCap, ClipboardCheck, BookOpen, FileText, LogOut, Database, LayoutDashboard, Newspaper, HeartHandshake, DollarSign, Globe, FileDown, Settings, User, UserX, CalendarDays, Briefcase, ChefHat, FolderOpen, Receipt, Bus,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";

const menuGroups = [
  {
    label: "Principal",
    items: [
      { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
      { title: "Participantes", url: "/participantes", icon: Users },
      { title: "Turmas", url: "/turmas", icon: GraduationCap },
    ],
  },
  {
    label: "Atividades",
    items: [
      { title: "Planejamento", url: "/planejamentos", icon: BookOpen },
      { title: "Relatórios", url: "/relatorios", icon: FileText },
      { title: "Exportar Relatórios", url: "/relatorios/exportar", icon: FileDown },
      { title: "Biblioteca .docx", url: "/biblioteca", icon: FolderOpen },
    ],
  },
  {
    label: "Comunicação",
    items: [
      { title: "Feed / Mural", url: "/feed", icon: Newspaper },
    ],
  },
  {
    label: "Gestão",
    items: [
      { title: "Equipe Técnica", url: "/equipe-tecnica", icon: HeartHandshake },
      { title: "Cronograma", url: "/cronograma", icon: CalendarDays },
      { title: "Transporte", url: "/transporte", icon: Bus },
      { title: "Financeiro", url: "/financeiro", icon: DollarSign },
      { title: "Arquivos Financeiros", url: "/financeiro/arquivos", icon: Receipt },
      { title: "Site Público", url: "/site-admin", icon: Globe },
      { title: "Banco de Dados", url: "/banco-de-dados", icon: Database },
      { title: "Desligamento", url: "/desligamento-admin", icon: UserX },
      { title: "Configurações", url: "/configuracoes", icon: Settings },
    ],
  },
];

export function AppSidebar() {
  const { state, isMobile, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [myProfileId, setMyProfileId] = useState<string | null>(null);
  const [isCoord, setIsCoord] = useState(false);
  const [isCozinheiro, setIsCozinheiro] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("id").eq("user_id", user.id).single().then(({ data }) => {
      if (data) setMyProfileId(data.id);
    });
    supabase.from("user_roles").select("role").eq("user_id", user.id).then(({ data }) => {
      setIsCoord((data ?? []).some((r: any) => r.role === "coordenacao"));
      setIsCozinheiro((data ?? []).some((r: any) => r.role === "cozinheiro"));
    });
  }, [user]);

  const visibleGroups = menuGroups.map((g) => {
    if (g.label !== "Gestão") return g;
    let items = g.items;
    if (isCoord || isCozinheiro) {
      items = [{ title: "Cozinha", url: "/cozinha", icon: ChefHat }, ...items];
    }
    if (isCoord) {
      items = [{ title: "Coordenação", url: "/coordenacao", icon: Briefcase }, ...items];
    }
    return { ...g, items };
  });

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border px-4 py-3">
        <SysCFVLogo collapsed={collapsed} />
      </SidebarHeader>

      <SidebarContent>
        {visibleGroups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel className="uppercase tracking-[0.1em] text-[10px] font-semibold text-muted-foreground">{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const active = location.pathname === item.url || (item.url !== "/" && location.pathname.startsWith(item.url));
                  return (
                    <SidebarMenuItem key={item.title}>
                       <SidebarMenuButton asChild isActive={active} className={isMobile ? "h-11 text-[15px]" : ""}>
                        <NavLink
                          to={item.url}
                          end={item.url === "/"}
                           className={`relative rounded-sm transition-colors hover:bg-sidebar-accent/60 ${active ? "bg-primary/8 text-primary font-medium before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-[3px] before:rounded-r-sm before:bg-primary" : ""}`}
                          activeClassName="text-primary font-medium"
                          onClick={() => { if (isMobile) setOpenMobile(false); }}
                        >
                           <item.icon className={`${isMobile ? "h-[18px] w-[18px]" : "h-4 w-4"} ${active ? "text-primary" : ""}`} />
                          {!collapsed && <span>{item.title}</span>}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-2">
        <SidebarMenu>
          {myProfileId && (
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={() => { if (isMobile) setOpenMobile(false); navigate(`/profissional/${myProfileId}`); }}
                className="text-muted-foreground hover:text-foreground"
                isActive={location.pathname === `/profissional/${myProfileId}`}
              >
                <User className="h-4 w-4" />
                {!collapsed && <span>Meu Perfil</span>}
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
          <SidebarMenuItem>
            <SidebarMenuButton onClick={() => signOut()} className="text-muted-foreground hover:text-destructive">
              <LogOut className="h-4 w-4" />
              {!collapsed && <span>Sair</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
