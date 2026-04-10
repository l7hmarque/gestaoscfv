import { useState, useEffect } from "react";
import {
  Users, GraduationCap, ClipboardCheck, BookOpen, FileText, LogOut, Database, LayoutDashboard, Newspaper, HeartHandshake, DollarSign, Globe, FileDown, Settings, User,
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
      { title: "Financeiro", url: "/financeiro", icon: DollarSign },
      { title: "Site Público", url: "/site-admin", icon: Globe },
      { title: "Banco de Dados", url: "/banco-de-dados", icon: Database },
      { title: "Configurações", url: "/configuracoes", icon: Settings },
    ],
  },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [myProfileId, setMyProfileId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("id").eq("user_id", user.id).single().then(({ data }) => {
      if (data) setMyProfileId(data.id);
    });
  }, [user]);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border px-4 py-3">
        {!collapsed ? (
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
              <span className="text-primary-foreground font-bold text-sm">S</span>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-sidebar-foreground">SysELO</h2>
              <p className="text-[10px] text-muted-foreground">Gestão SCFV</p>
            </div>
          </div>
        ) : (
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center mx-auto">
            <span className="text-primary-foreground font-bold text-sm">S</span>
          </div>
        )}
      </SidebarHeader>

      <SidebarContent>
        {menuGroups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={location.pathname === item.url || (item.url !== "/" && location.pathname.startsWith(item.url))}>
                      <NavLink to={item.url} end={item.url === "/"} className="hover:bg-sidebar-accent/50" activeClassName="bg-sidebar-accent text-primary font-medium">
                        <item.icon className="h-4 w-4" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
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
                onClick={() => navigate(`/profissional/${myProfileId}`)}
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
