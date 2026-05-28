import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { SysCFVLogo } from "@/components/SysCFVLogo";
import {
  Users, GraduationCap, ClipboardCheck, BookOpen, FileText, LogOut, Database, LayoutDashboard, Newspaper, HeartHandshake, Globe, Settings, User, CalendarDays, Briefcase, ChefHat, Bus, Camera, FolderDown, ShieldAlert, Lock, ShieldCheck, Wrench,
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

type Item = { i18nKey: string; url: string; icon: any; module: ModuleKey };
type Group = { i18nKey: string; items: Item[]; restricted?: boolean };

const MENU_GROUPS: Group[] = [
  {
    i18nKey: "main",
    items: [
      { i18nKey: "dashboard", url: "/dashboard", icon: LayoutDashboard, module: "dashboard" },
      { i18nKey: "participants", url: "/participantes", icon: Users, module: "participantes" },
      { i18nKey: "classes", url: "/turmas", icon: GraduationCap, module: "turmas" },
      { i18nKey: "attendance", url: "/presenca", icon: ClipboardCheck, module: "presenca" },
      { i18nKey: "photos", url: "/registros-fotograficos", icon: Camera, module: "registros_fotograficos" },
    ],
  },
  {
    i18nKey: "activities",
    items: [
      { i18nKey: "planning", url: "/planejamentos", icon: BookOpen, module: "planejamentos" },
      { i18nKey: "reports", url: "/relatorios", icon: FileText, module: "relatorios" },
      { i18nKey: "schedule", url: "/cronograma", icon: CalendarDays, module: "cronograma" },
    ],
  },
  {
    i18nKey: "operations",
    items: [
      { i18nKey: "transport", url: "/transporte", icon: Bus, module: "transporte" },
      { i18nKey: "kitchen", url: "/cozinha", icon: ChefHat, module: "cozinha" },
      { i18nKey: "technical_team", url: "/equipe-tecnica", icon: HeartHandshake, module: "equipe_tecnica" },
    ],
  },
  {
    i18nKey: "communication",
    items: [
      { i18nKey: "feed", url: "/feed", icon: Newspaper, module: "feed" },
    ],
  },
  {
    i18nKey: "coordination",
    restricted: true,
    items: [
      { i18nKey: "coordination_panel", url: "/coordenacao", icon: Briefcase, module: "coordenacao" },
      { i18nKey: "documents", url: "/documentos", icon: FolderDown, module: "relatorios" },
      { i18nKey: "integrity", url: "/integridade", icon: ShieldCheck, module: "integridade" },
      { i18nKey: "database", url: "/banco-de-dados", icon: Database, module: "banco_dados" },
      { i18nKey: "public_site", url: "/site-admin", icon: Globe, module: "site_publico" },
      { i18nKey: "settings", url: "/configuracoes", icon: Settings, module: "configuracoes" },
    ],
  },
];

export function AppSidebar() {
  const { t } = useTranslation();
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
        {MENU_GROUPS.map((group) => (
          <SidebarGroup key={group.i18nKey} className={group.restricted ? "border-t border-destructive/20 mt-2 pt-2" : ""}>
            <SidebarGroupLabel className={`uppercase tracking-[0.1em] text-[10px] font-semibold flex items-center gap-1.5 ${group.restricted ? "text-destructive" : "text-muted-foreground"}`}>
              {group.restricted && <ShieldAlert className="h-3 w-3" />}
              {t(`sidebar.groups.${group.i18nKey}`)}
              {group.restricted && !collapsed && (
                <Badge variant="outline" className="ml-1 h-4 px-1 text-[9px] border-destructive/40 text-destructive">{t("sidebar.restricted")}</Badge>
              )}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const active = location.pathname === item.url || (item.url !== "/" && location.pathname.startsWith(item.url));
                  const allowed = capsLoading ? true : can(item.module);
                  const label = t(`sidebar.items.${item.i18nKey}`);
                  return (
                    <SidebarMenuItem key={item.i18nKey}>
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
                            {!collapsed && <span>{label}</span>}
                          </NavLink>
                        </SidebarMenuButton>
                      ) : (
                        <SidebarMenuButton
                          disabled
                          className={`relative rounded-sm opacity-40 cursor-not-allowed ${isMobile ? "h-11 text-[15px]" : ""}`}
                          title={t("sidebar.no_permission")}
                        >
                          <item.icon className={isMobile ? "h-[18px] w-[18px]" : "h-4 w-4"} />
                          {!collapsed && (
                            <span className="flex-1 flex items-center justify-between">
                              <span>{label}</span>
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
                {!collapsed && <span>{t("sidebar.my_profile")}</span>}
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
          <SidebarMenuItem>
            <SidebarMenuButton onClick={() => signOut()} className="text-muted-foreground hover:text-destructive">
              <LogOut className="h-4 w-4" />
              {!collapsed && <span>{t("sidebar.sign_out")}</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
