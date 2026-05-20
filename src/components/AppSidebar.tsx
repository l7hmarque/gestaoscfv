import { useState, useEffect } from "react";
import { SysCFVLogo } from "@/components/SysCFVLogo";
import {
  Users, GraduationCap, ClipboardCheck, BookOpen, FileText, LogOut, Database, LayoutDashboard, Newspaper, HeartHandshake, Globe, FileDown, Settings, User, CalendarDays, Briefcase, ChefHat, Bus, Camera, FolderDown, ShieldAlert, Lock, ShieldCheck, History,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useCapabilities, ModuleKey } from "@/hooks/useCapabilities";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";

type Item = { title: string; url: string; icon: any; module: ModuleKey };
type Group = { label: string; items: Item[]; restricted?: boolean };

const menuGroups: Group[] = [
  {
    label: "Principal",
    items: [
      { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, module: "dashboard" },
      { title: "Participantes", url: "/participantes", icon: Users, module: "participantes" },
      { title: "Turmas", url: "/turmas", icon: GraduationCap, module: "turmas" },
      { title: "Presença", url: "/presenca", icon: ClipboardCheck, module: "presenca" },
      { title: "Registros Fotográficos", url: "/registros-fotograficos", icon: Camera, module: "registros_fotograficos" },
    ],
  },
  {
    label: "Atividades",
    items: [
      { title: "Planejamento", url: "/planejamentos", icon: BookOpen, module: "planejamentos" },
      { title: "Relatórios", url: "/relatorios", icon: FileText, module: "relatorios" },
      { title: "Hub de Exportações", url: "/relatorios/hub", icon: FolderDown, module: "relatorios" },
      { title: "Cronograma", url: "/cronograma", icon: CalendarDays, module: "cronograma" },
    ],
  },
  {
    label: "Operação",
    items: [
      { title: "Transporte", url: "/transporte", icon: Bus, module: "transporte" },
      { title: "Cozinha", url: "/cozinha", icon: ChefHat, module: "cozinha" },
    ],
  },
  {
    label: "Equipe & Comunicação",
    items: [
      { title: "Feed / Mural", url: "/feed", icon: Newspaper, module: "feed" },
      { title: "Equipe Técnica", url: "/equipe-tecnica", icon: HeartHandshake, module: "equipe_tecnica" },
    ],
  },
  {
    label: "Coordenação",
    restricted: true,
    items: [
      { title: "Painel da Coordenação", url: "/coordenacao", icon: Briefcase, module: "coordenacao" },
      { title: "Integridade", url: "/integridade", icon: ShieldCheck, module: "integridade" },
      { title: "Banco de Dados", url: "/banco-de-dados", icon: Database, module: "banco_dados" },
      { title: "Site Público", url: "/site-admin", icon: Globe, module: "site_publico" },
      { title: "Configurações", url: "/configuracoes", icon: Settings, module: "configuracoes" },
    ],
  },
];

export function AppSidebar() {
  const { state, isMobile, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { can, loading: capsLoading } = useCapabilities();
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
        <SysCFVLogo collapsed={collapsed} />
      </SidebarHeader>

      <SidebarContent>
        {menuGroups.map((group) => (
          <SidebarGroup key={group.label} className={group.restricted ? "border-t border-destructive/20 mt-2 pt-2" : ""}>
            <SidebarGroupLabel className={`uppercase tracking-[0.1em] text-[10px] font-semibold flex items-center gap-1.5 ${group.restricted ? "text-destructive" : "text-muted-foreground"}`}>
              {group.restricted && <ShieldAlert className="h-3 w-3" />}
              {group.label}
              {group.restricted && !collapsed && (
                <Badge variant="outline" className="ml-1 h-4 px-1 text-[9px] border-destructive/40 text-destructive">Restrito</Badge>
              )}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const active = location.pathname === item.url || (item.url !== "/" && location.pathname.startsWith(item.url));
                  const allowed = capsLoading ? true : can(item.module);
                  return (
                    <SidebarMenuItem key={item.title}>
                      {allowed ? (
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
                      ) : (
                        <SidebarMenuButton
                          disabled
                          className={`relative rounded-sm opacity-40 cursor-not-allowed ${isMobile ? "h-11 text-[15px]" : ""}`}
                          title="Sem permissão de acesso"
                        >
                          <item.icon className={isMobile ? "h-[18px] w-[18px]" : "h-4 w-4"} />
                          {!collapsed && (
                            <span className="flex-1 flex items-center justify-between">
                              <span>{item.title}</span>
                              <Lock className="h-3 w-3 opacity-70" />
                            </span>
                          )}
                        </SidebarMenuButton>
                      )}
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
