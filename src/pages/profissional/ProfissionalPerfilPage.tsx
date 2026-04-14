import { useEffect, useState } from "react";
import { ArrowLeft, Printer, Calendar, Users, FileText, ClipboardList, CheckSquare, Bell, Send } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";

const DIAS_SEMANA = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta"];

const ProfissionalPerfilPage = () => {
  const { id } = useParams();
  const [profile, setProfile] = useState<any>(null);
  const [turmas, setTurmas] = useState<any[]>([]);
  const [planejamentos, setPlanejamentos] = useState<any[]>([]);
  const [relatorios, setRelatorios] = useState<any[]>([]);
  const [presencas, setPresencas] = useState<any[]>([]);
  const [recadosCount, setRecadosCount] = useState(0);
  const [recadosEnviados, setRecadosEnviados] = useState<any[]>([]);
  const [profilesMap, setProfilesMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [streak, setStreak] = useState(0);
  const [conquistas, setConquistas] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      const [profRes, turmasRes, planRes, relRes, presRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", id!).single(),
        supabase.from("turmas").select("*, bairros(nome)").eq("educador_id", id!).order("nome"),
        supabase.from("planejamentos").select("*, planejamento_turmas(turma_id, turmas(nome))").eq("educador_id", id!).order("data_aplicacao", { ascending: false }),
        supabase.from("relatorios_atividade").select("*, relatorio_turmas(turma_id, turmas(nome)), planejamento_id").eq("educador_id", id!).order("data", { ascending: false }),
        supabase.from("presenca").select("data, turma_id, turmas(nome)").eq("registrado_por", id!).order("data", { ascending: false }),
      ]);
      setProfile(profRes.data);
      setTurmas(turmasRes.data || []);
      setPlanejamentos(planRes.data || []);
      setRelatorios(relRes.data || []);
      // Group presencas by date+turma
      const grouped = new Map<string, any>();
      (presRes.data || []).forEach((p: any) => {
        const key = `${p.data}_${p.turma_id}`;
        if (!grouped.has(key)) grouped.set(key, { data: p.data, turma_nome: p.turmas?.nome || "", count: 0 });
        grouped.get(key)!.count++;
      });
      setPresencas(Array.from(grouped.values()));

      // Count unread recados for this profile
      const { count } = await supabase.from("recados").select("id", { count: "exact", head: true }).eq("destinatario_id", id!).eq("lido", false);
      setRecadosCount(count || 0);

      // Recados enviados por este profissional
      const { data: enviados } = await supabase.from("recados").select("*").eq("remetente_id", id!).order("created_at", { ascending: false });
      setRecadosEnviados(enviados || []);

      // Profiles map for names
      const { data: allProfiles } = await supabase.from("profiles").select("id, nome");
      const pMap: Record<string, string> = {};
      (allProfiles || []).forEach((p: any) => { pMap[p.id] = p.nome; });
      setProfilesMap(pMap);

      // Streak calculation
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 31);
      const [{ data: sPosts }, { data: sComments }] = await Promise.all([
        supabase.from("feed_posts").select("created_at").eq("autor_id", id!).gte("created_at", thirtyDaysAgo.toISOString()),
        supabase.from("feed_comentarios").select("created_at").eq("autor_id", id!).gte("created_at", thirtyDaysAgo.toISOString()),
      ]);
      const activeDays = new Set<string>();
      [...(sPosts || []), ...(sComments || [])].forEach((item: any) => {
        activeDays.add(item.created_at.slice(0, 10));
      });
      let s = 0;
      const today = new Date();
      for (let i = 0; i < 31; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        if (activeDays.has(d.toISOString().slice(0, 10))) s++;
        else break;
      }
      setStreak(s);

      // Conquistas
      const { data: conqus } = await supabase.from("conquistas").select("*").eq("perfil_id", id!).order("created_at", { ascending: false });
      setConquistas(conqus || []);

      setLoading(false);
    };
    fetchData();
  }, [id]);

  if (loading) return <div className="flex justify-center py-12"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;
  if (!profile) return <div className="text-center py-12 text-muted-foreground">Profissional não encontrado.</div>;

  // Build weekly schedule from turmas
  const schedule: Record<string, { turma: string; periodo: string }[]> = {};
  DIAS_SEMANA.forEach(d => { schedule[d] = []; });
  turmas.forEach(t => {
    (t.dias_semana || []).forEach((dia: string) => {
      const normalized = DIAS_SEMANA.find(d => dia.toLowerCase().startsWith(d.toLowerCase().slice(0, 3)));
      if (normalized) schedule[normalized].push({ turma: t.nome, periodo: t.periodo || "" });
    });
  });

  return (
    <div className="space-y-4 max-w-4xl print:max-w-none">
      <div className="flex items-center justify-between print:hidden">
        <Button variant="ghost" size="icon" asChild><Link to="/dashboard"><ArrowLeft className="h-4 w-4" /></Link></Button>
        <Button variant="outline" size="sm" className="gap-1" onClick={() => window.print()}>
          <Printer className="h-3.5 w-3.5" />Imprimir
        </Button>
      </div>

      {/* Profile Header */}
      <Card>
        <CardContent className="p-6 flex flex-col sm:flex-row items-center gap-4">
          <Avatar className="h-20 w-20">
            <AvatarImage src={profile.foto_url || undefined} />
            <AvatarFallback className="bg-primary/10 text-primary text-xl">{profile.nome?.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="text-center sm:text-left flex-1">
            <h1 className="text-xl font-bold text-foreground">{profile.nome}</h1>
            <p className="text-sm text-muted-foreground">{profile.cargo || "Sem cargo"}</p>
            <div className="flex gap-2 mt-1 justify-center sm:justify-start flex-wrap">
              <Badge variant={profile.ativo ? "default" : "secondary"}>{profile.ativo ? "Ativo" : "Inativo"}</Badge>
              {streak > 0 && (
                <Badge variant="outline" className="gap-1 text-orange-600 border-orange-300">
                  🔥 {streak} dia{streak > 1 ? "s" : ""} de streak
                </Badge>
              )}
              {recadosCount > 0 && (
                <Badge variant="destructive" className="gap-1">
                  <Bell className="h-3 w-3" />{recadosCount} recado{recadosCount > 1 ? "s" : ""} não lido{recadosCount > 1 ? "s" : ""}
                </Badge>
              )}
              {profile.email && <span className="text-xs text-muted-foreground">{profile.email}</span>}
              {profile.telefone && <span className="text-xs text-muted-foreground">📞 {profile.telefone}</span>}
            </div>
            {profile.data_inicio && <p className="text-xs text-muted-foreground mt-1">Desde {format(new Date(profile.data_inicio + "T12:00:00"), "dd/MM/yyyy")}</p>}
          </div>
        </CardContent>
      </Card>

      {/* Weekly Schedule */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Calendar className="h-4 w-4" />Cronograma Semanal</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-5 gap-1 text-xs">
            {DIAS_SEMANA.map(dia => (
              <div key={dia} className="space-y-1">
                <div className="font-medium text-center bg-muted rounded px-1 py-1.5">{dia.slice(0, 3)}</div>
                {schedule[dia].length > 0 ? schedule[dia].map((s, i) => (
                  <div key={i} className="bg-primary/10 text-primary rounded px-1.5 py-1 text-[10px] text-center">
                    <p className="font-medium truncate">{s.turma}</p>
                    <p className="text-primary/70">{s.periodo}</p>
                  </div>
                )) : (
                  <div className="text-muted-foreground text-center py-2">—</div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Conquistas */}
      {conquistas.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">🏆 Conquistas ({conquistas.length})</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {conquistas.map((c: any) => (
                <Badge key={c.id} variant="outline" className="text-xs">
                  {c.tipo}
                  {c.nivel > 1 && ` (nível ${c.nivel})`}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs defaultValue="turmas">
        <TabsList className="h-8">
          <TabsTrigger value="turmas" className="text-xs h-7 gap-1"><Users className="h-3 w-3" />Turmas ({turmas.length})</TabsTrigger>
          <TabsTrigger value="planejamentos" className="text-xs h-7 gap-1"><ClipboardList className="h-3 w-3" />Planejamentos ({planejamentos.length})</TabsTrigger>
          <TabsTrigger value="relatorios" className="text-xs h-7 gap-1"><FileText className="h-3 w-3" />Relatórios ({relatorios.length})</TabsTrigger>
          <TabsTrigger value="presencas" className="text-xs h-7 gap-1"><CheckSquare className="h-3 w-3" />Presenças ({presencas.length})</TabsTrigger>
          <TabsTrigger value="recados-enviados" className="text-xs h-7 gap-1"><Send className="h-3 w-3" />Recados ({recadosEnviados.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="turmas">
          <div className="grid gap-2">
            {turmas.map(t => (
              <Link key={t.id} to={`/turmas/${t.id}`}>
                <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
                  <CardContent className="p-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{t.nome}</p>
                      <p className="text-xs text-muted-foreground">{t.bairros?.nome} · {t.periodo} · {t.faixa_etaria} · {t.dias_semana?.join(", ")}</p>
                    </div>
                    <Badge variant={t.ativa ? "default" : "secondary"} className="text-[10px]">{t.ativa ? "Ativa" : "Inativa"}</Badge>
                  </CardContent>
                </Card>
              </Link>
            ))}
            {turmas.length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma turma vinculada.</p>}
          </div>
        </TabsContent>

        <TabsContent value="planejamentos">
          <div className="grid gap-2">
            {planejamentos.map(p => (
              <Link key={p.id} to={`/planejamentos/${p.id}`}>
                <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
                  <CardContent className="p-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{p.titulo}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.data_aplicacao && format(new Date(p.data_aplicacao + "T12:00:00"), "dd/MM/yyyy")}
                        {p.tema && ` · ${p.tema}`}
                        {p.planejamento_turmas?.length > 0 && ` · ${p.planejamento_turmas.map((pt: any) => pt.turmas?.nome).filter(Boolean).join(", ")}`}
                      </p>
                    </div>
                    {relatorios.some(r => r.planejamento_id === p.id) && (
                      <Badge variant="default" className="text-[10px]">Relatório ✓</Badge>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}
            {planejamentos.length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">Nenhum planejamento registrado.</p>}
          </div>
        </TabsContent>

        <TabsContent value="relatorios">
          <div className="grid gap-2">
            {relatorios.map(r => (
              <Link key={r.id} to={`/relatorios/${r.id}`}>
                <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
                  <CardContent className="p-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{r.nome_atividade || "Relatório"}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(r.data + "T12:00:00"), "dd/MM/yyyy")}
                        {r.relatorio_turmas?.length > 0 && ` · ${r.relatorio_turmas.map((rt: any) => rt.turmas?.nome).filter(Boolean).join(", ")}`}
                        {r.planejamento_id && (() => {
                          const plan = planejamentos.find(p => p.id === r.planejamento_id);
                          return plan ? ` · 📋 ${plan.titulo}` : "";
                        })()}
                      </p>
                    </div>
                    {r.score_elo != null && <Badge variant="outline" className="text-xs">ELO: {Number(r.score_elo).toFixed(1)}</Badge>}
                  </CardContent>
                </Card>
              </Link>
            ))}
            {relatorios.length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">Nenhum relatório registrado.</p>}
          </div>
        </TabsContent>

        <TabsContent value="presencas">
          <div className="grid gap-2">
            {presencas.map((p, i) => (
              <Card key={i}>
                <CardContent className="p-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{p.turma_nome}</p>
                    <p className="text-xs text-muted-foreground">{format(new Date(p.data + "T12:00:00"), "dd/MM/yyyy")}</p>
                  </div>
                  <Badge variant="outline" className="text-xs">{p.count} registros</Badge>
                </CardContent>
              </Card>
            ))}
            {presencas.length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma presença registrada.</p>}
          </div>
        </TabsContent>

        <TabsContent value="recados-enviados">
          <div className="grid gap-2">
            {recadosEnviados.map(r => {
              const status = (r as any).status || "pendente";
              const statusLabel = status === "concluido" ? "Concluído" : status === "em_andamento" ? "Em andamento" : "Pendente";
              const statusVariant = status === "concluido" ? "default" : status === "em_andamento" ? "secondary" : "outline";
              return (
                <Card key={r.id}>
                  <CardContent className="p-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">
                        <span className="font-mono text-muted-foreground">#{r.numero}</span>
                        {" → "}
                        {profilesMap[r.destinatario_id] || "—"}
                      </p>
                      <p className="text-xs text-muted-foreground line-clamp-1">{r.conteudo}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {format(new Date(r.created_at), "dd/MM/yyyy HH:mm")}
                      </p>
                    </div>
                    <Badge variant={statusVariant as any} className="text-[10px] shrink-0">{statusLabel}</Badge>
                  </CardContent>
                </Card>
              );
            })}
            {recadosEnviados.length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">Nenhum recado enviado.</p>}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ProfissionalPerfilPage;
