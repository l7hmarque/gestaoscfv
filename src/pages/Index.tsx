import { useState, useEffect } from "react";
import { Users, GraduationCap, BookOpen, FileText, Pin, Bell, AlertTriangle, CalendarDays, Newspaper, ClipboardCheck, LayoutDashboard, FileDown, HeartHandshake, Bus, DollarSign, MessageSquare } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

const shortcutGroups = [
  {
    label: "Principal",
    items: [
      { title: "Dashboard", description: "Visão geral e KPIs", icon: LayoutDashboard, url: "/dashboard", border: "border-l-primary" },
      { title: "Participantes", description: "Cadastrar e gerenciar", icon: Users, url: "/participantes", border: "border-l-[hsl(45,80%,55%)]" },
      { title: "Turmas", description: "Organizar turmas", icon: GraduationCap, url: "/turmas", border: "border-l-secondary" },
      { title: "Presença", description: "Registrar presença", icon: ClipboardCheck, url: "/presenca", border: "border-l-[hsl(280,40%,55%)]" },
    ],
  },
  {
    label: "Atividades",
    items: [
      { title: "Planejamento", description: "Planos pedagógicos", icon: BookOpen, url: "/planejamentos", border: "border-l-primary" },
      { title: "Relatórios", description: "Registrar atividades", icon: FileText, url: "/relatorios", border: "border-l-primary" },
      { title: "Exportar Relatórios em Lote", description: "Lote e formatos", icon: FileDown, url: "/relatorios/exportar", border: "border-l-secondary" },
      { title: "Exportar Chamada", description: "Lista física por turma", icon: FileDown, url: "/presenca/exportar", border: "border-l-[hsl(280,40%,55%)]" },
    ],
  },
  {
    label: "Comunicação",
    items: [
      { title: "Feed", description: "Novidades da equipe", icon: Newspaper, url: "/feed", border: "border-l-[hsl(150,45%,45%)]" },
      { title: "Mural", description: "Avisos fixados", icon: MessageSquare, url: "/mural", border: "border-l-[hsl(150,45%,45%)]" },
    ],
  },
  {
    label: "Gestão",
    items: [
      { title: "Equipe Técnica", description: "Acompanhamento social", icon: HeartHandshake, url: "/equipe-tecnica", border: "border-l-[hsl(280,40%,55%)]" },
      { title: "Cronograma", description: "Agenda semanal", icon: CalendarDays, url: "/cronograma", border: "border-l-secondary" },
      { title: "Transporte", description: "Embarques e rotas", icon: Bus, url: "/transporte", border: "border-l-primary" },
      { title: "Financeiro", description: "Orçamentos e despesas", icon: DollarSign, url: "/financeiro", border: "border-l-[hsl(150,45%,45%)]" },
    ],
  },
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
    <div className="space-y-6 sm:space-y-7">
      <div className="rounded-lg border bg-gradient-header p-4 sm:p-6 shadow-xs">
        <h1 className="page-title">Bem-vindo ao SysCFV</h1>
        <p className="page-subtitle">Sistema de Gestão do Serviço de Convivência e Fortalecimento de Vínculos</p>
      </div>

      {/* Alertas rápidos */}
      {(pendentesCount > 0 || recadosCount > 0) && (
        <div className="flex flex-wrap gap-2 sm:gap-3">
          {pendentesCount > 0 && (
            <Link to="/participantes?status=pendente">
              <div className="flex items-center gap-2 bg-[hsl(var(--warning)/0.12)] border border-[hsl(var(--warning)/0.35)] rounded-md px-3 py-2 text-sm hover:bg-[hsl(var(--warning)/0.2)] transition-colors">
                <AlertTriangle className="h-4 w-4 text-[hsl(var(--warning))]" />
                <span className="font-medium text-foreground">{pendentesCount} matrícula{pendentesCount > 1 ? "s" : ""} pendente{pendentesCount > 1 ? "s" : ""}</span>
              </div>
            </Link>
          )}
          {recadosCount > 0 && (
            <div className="flex items-center gap-2 bg-[hsl(var(--info)/0.12)] border border-[hsl(var(--info)/0.35)] rounded-md px-3 py-2 text-sm">
              <Bell className="h-4 w-4 text-[hsl(var(--info))]" />
              <span className="font-medium text-foreground">{recadosCount} recado{recadosCount > 1 ? "s" : ""} não lido{recadosCount > 1 ? "s" : ""}</span>
            </div>
          )}
        </div>
      )}

      {/* Atalhos por categoria */}
      <div className="space-y-6">
        {shortcutGroups.map((group) => (
          <div key={group.label}>
            <h2 className="section-title mb-2.5">{group.label}</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-3">
              {group.items.map((item) => (
                <Link key={item.title} to={item.url} className="group">
                  <Card className={`h-full hover:shadow-elevated hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer border-l-4 ${item.border} bg-card`}>
                    <CardContent className="flex items-start gap-3 p-3 sm:p-3.5">
                      <div className="rounded-md bg-muted/60 p-2 group-hover:bg-primary/10 transition-colors shrink-0">
                        <item.icon className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-foreground leading-tight">{item.title}</h3>
                        <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{item.description}</p>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Avisos fixados do Mural */}
      {pinnedPosts.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Pin className="h-4 w-4 text-[hsl(var(--warning))]" />
            <h2 className="text-sm font-semibold text-foreground">Avisos Fixados</h2>
            <Link to="/mural" className="text-xs text-primary hover:underline ml-auto">Ver mural →</Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {pinnedPosts.map((post) => (
              <Link key={post.id} to="/mural">
                <div className="bg-[hsl(var(--warning)/0.1)] border border-[hsl(var(--warning)/0.3)] rounded-md p-3 hover:shadow-soft transition-shadow">
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
