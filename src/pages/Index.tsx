import { useState, useEffect } from "react";
import { Users, GraduationCap, ClipboardCheck, BookOpen, FileText, Pin, Bell, AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

const shortcuts = [
  { title: "Participantes", description: "Cadastrar e gerenciar", icon: Users, url: "/participantes", color: "text-primary" },
  { title: "Turmas", description: "Organizar turmas", icon: GraduationCap, url: "/turmas", color: "text-secondary" },
  { title: "Presença", description: "Registrar frequência", icon: ClipboardCheck, url: "/presenca", color: "text-primary" },
  { title: "Planejamento", description: "Planejar atividades", icon: BookOpen, url: "/planejamentos", color: "text-secondary" },
  { title: "Relatórios", description: "Registrar atividades", icon: FileText, url: "/relatorios", color: "text-primary" },
];

const Index = () => {
  const { user } = useAuth();
  const [pinnedPosts, setPinnedPosts] = useState<any[]>([]);
  const [pendentesCount, setPendentesCount] = useState(0);
  const [recadosCount, setRecadosCount] = useState(0);

  useEffect(() => {
    const load = async () => {
      const [{ data: pinned }, { data: pendentes }, { data: profs }] = await Promise.all([
        supabase.from("mural_posts").select("id, titulo, tipo, created_at").eq("fixado", true).order("created_at", { ascending: false }).limit(3),
        supabase.from("participantes").select("id").eq("status", "pendente"),
        supabase.from("profiles").select("id, user_id"),
      ]);
      setPinnedPosts(pinned || []);
      setPendentesCount((pendentes || []).length);

      const myProfile = (profs || []).find((p: any) => p.user_id === user?.id);
      if (myProfile) {
        const { count } = await supabase.from("recados").select("id", { count: "exact", head: true }).eq("destinatario_id", myProfile.id).eq("lido", false);
        setRecadosCount(count || 0);
      }
    };
    if (user) load();
  }, [user]);

  const tipoEmoji: Record<string, string> = { aviso: "📌", lembrete: "🔔", informativo: "💬" };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Bem-vindo ao SysELO</h1>
        <p className="text-sm text-muted-foreground mt-1">Sistema de Gestão do Serviço de Convivência e Fortalecimento de Vínculos</p>
      </div>

      {/* Alertas rápidos */}
      {(pendentesCount > 0 || recadosCount > 0) && (
        <div className="flex flex-wrap gap-3">
          {pendentesCount > 0 && (
            <Link to="/participantes?status=pendente">
              <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-sm hover:bg-amber-100 transition-colors">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <span className="text-amber-800 font-medium">{pendentesCount} matrícula{pendentesCount > 1 ? "s" : ""} pendente{pendentesCount > 1 ? "s" : ""}</span>
              </div>
            </Link>
          )}
          {recadosCount > 0 && (
            <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-sm">
              <Bell className="h-4 w-4 text-blue-600" />
              <span className="text-blue-800 font-medium">{recadosCount} recado{recadosCount > 1 ? "s" : ""} não lido{recadosCount > 1 ? "s" : ""}</span>
            </div>
          )}
        </div>
      )}

      {/* Atalhos */}
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

      {/* Avisos fixados do Mural */}
      {pinnedPosts.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Pin className="h-4 w-4 text-amber-600" />
            <h2 className="text-sm font-semibold text-foreground">Avisos Fixados</h2>
            <Link to="/mural" className="text-xs text-primary hover:underline ml-auto">Ver mural →</Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {pinnedPosts.map((post) => (
              <Link key={post.id} to="/mural">
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-sm">{tipoEmoji[post.tipo] || "💬"}</span>
                    <h3 className="text-xs font-semibold text-foreground truncate">{post.titulo}</h3>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    {formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: ptBR })}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Index;
