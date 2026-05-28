import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { AppSidebar } from "@/components/AppSidebar";
import { Outlet, useNavigate } from "react-router-dom";
import { useSessionTimeout } from "@/hooks/useSessionTimeout";
import { useActivityPing } from "@/hooks/useActivityPing";
import { NotificationBell } from "@/components/NotificationBell";
import { SendRecadoDialog } from "@/components/SendRecadoDialog";
import { Button } from "@/components/ui/button";
import { User } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { SystemBanner } from "@/components/SystemBanner";
import { FloatingActionButton } from "@/components/FloatingActionButton";
import { CienteRequiredModal } from "@/components/cronograma/CienteRequiredModal";

export function AppLayout() {
  useSessionTimeout();
  useActivityPing();
  const { profileId } = useAuth();
  const navigate = useNavigate();

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <SystemBanner />
          <header className="sticky top-0 z-30 h-14 flex items-center justify-between border-b bg-gradient-header backdrop-blur supports-[backdrop-filter]:bg-card/85 px-3 sm:px-4 shrink-0 print:hidden">
            <SidebarTrigger className="h-10 w-10 [&_svg]:h-5 [&_svg]:w-5" />
            <div className="flex items-center gap-1 sm:gap-1.5">
              <SendRecadoDialog toTecnicos />
              <NotificationBell />
              <LanguageSwitcher />
              {profileId && (
                <Button variant="ghost" size="icon" className="h-10 w-10" onClick={() => navigate(`/profissional/${profileId}`)} title="Meu Perfil">
                  <User className="h-5 w-5" />
                </Button>
              )}
            </div>
          </header>
          <main className="flex-1 overflow-auto px-3 py-4 sm:px-5 sm:py-5 lg:px-8 lg:py-6">
            <div className="mx-auto w-full max-w-[1400px] animate-fade-in">
              <Outlet />
            </div>
          </main>
          <FloatingActionButton />
        </div>
      </div>
      <CienteRequiredModal />
    </SidebarProvider>
  );
}
