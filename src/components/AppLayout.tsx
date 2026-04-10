import { useState, useEffect } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Outlet, useNavigate } from "react-router-dom";
import { useSessionTimeout } from "@/hooks/useSessionTimeout";
import { NotificationBell } from "@/components/NotificationBell";
import { SendRecadoDialog } from "@/components/SendRecadoDialog";
import { Button } from "@/components/ui/button";
import { User } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export function AppLayout() {
  useSessionTimeout();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [myProfileId, setMyProfileId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("id").eq("user_id", user.id).single().then(({ data }) => {
      if (data) setMyProfileId(data.id);
    });
  }, [user]);


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
              {myProfileId && (
                <Button variant="ghost" size="icon" onClick={() => navigate(`/profissional/${myProfileId}`)} title="Meu Perfil">
                  <User className="h-4 w-4" />
                </Button>
              )}
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
