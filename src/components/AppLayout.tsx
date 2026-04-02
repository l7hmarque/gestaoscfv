import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Outlet } from "react-router-dom";
import { useSessionTimeout } from "@/hooks/useSessionTimeout";
import { NotificationBell } from "@/components/NotificationBell";
import { SendRecadoDialog } from "@/components/SendRecadoDialog";

export function AppLayout() {
  useSessionTimeout();

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-12 flex items-center justify-between border-b bg-card px-4 shrink-0 print:hidden">
            <SidebarTrigger />
            <div className="flex items-center gap-1">
              <SendRecadoDialog toTecnicos />
              <NotificationBell />
            </div>
          </header>
          <main className="flex-1 overflow-auto p-4 md:p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
