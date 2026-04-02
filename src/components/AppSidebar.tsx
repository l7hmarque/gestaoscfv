import {
  Home, Users, GraduationCap, ClipboardCheck, BookOpen, FileText, LogOut, Database, LayoutDashboard, MessageSquare, Newspaper,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";

const menuItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Participantes", url: "/participantes", icon: Users },
  { title: "Turmas", url: "/turmas", icon: GraduationCap },
  { title: "Presença", url: "/presenca", icon: ClipboardCheck },
  { title: "Planejamento", url: "/planejamentos", icon: BookOpen },
  { title: "Relatórios", url: "/relatorios", icon: FileText },
  { title: "Mural", url: "/mural", icon: MessageSquare },
  { title: "Feed", url: "/feed", icon: Newspaper },
  { title: "Banco de Dados", url: "/banco-de-dados", icon: Database },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { signOut } = useAuth();

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
        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
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
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-2">
        <SidebarMenu>
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
