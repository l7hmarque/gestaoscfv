import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { MapPin, Clock, BookOpen, CalendarCheck, MessageSquare, FileText, ArrowLeft, Users } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Participante {
  id: string;
  nome_completo: string;
  data_nascimento: string;
  genero: string | null;
  foto_url: string | null;
  status: string;
  periodo: string | null;
  escola: string | null;
  serie: string | null;
  endereco_bairro: string | null;
  bairro_nome: string | null;
  ponto_transporte: {
    id: string;
    nome: string;
    horario_manha: string | null;
    horario_tarde: string | null;
    bairro_nome: string | null;
  } | null;
}

export default function FamiliaDashboardPage() {
  const navigate = useNavigate();
  const [participantes, setParticipantes] = useState<Participante[]>([]);
  const [selected, setSelected] = useState(0);
  const [turmas, setTurmas] = useState<any[]>([]);
  const [atividades, setAtividades] = useState<any[]>([]);
  const [presenca, setPresenca] = useState<any>(null);
  const [recados, setRecados] = useState<any[]>([]);
  const [formularios, setFormularios] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = sessionStorage.getItem("familia_participantes");
    if (!stored) {
      navigate("/familia");
      return;
    }
    const parsed = JSON.parse(stored);
    setParticipantes(parsed);
    if (parsed.length > 0) loadData(parsed[0].id);
  }, []);

  const loadData = async (participanteId: string) => {
    setLoading(true);
    try {
      const [turmasRes, atividadesRes, presencaRes, recadosRes, formularioRes] = await Promise.all([
        supabase.functions.invoke("public-familia-data", { body: { participante_id: participanteId, tipo: "turmas" } }),
        supabase.functions.invoke("public-familia-data", { body: { participante_id: participanteId, tipo: "atividades" } }),
        supabase.functions.invoke("public-familia-data", { body: { participante_id: participanteId, tipo: "presenca" } }),
        supabase.functions.invoke("public-familia-data", { body: { participante_id: participanteId, tipo: "recados" } }),
        supabase.functions.invoke("public-familia-data", { body: { participante_id: participanteId, tipo: "formularios" } }),
      ]);

      setTurmas(turmasRes.data?.turmas || []);
      setAtividades(atividadesRes.data?.atividades || []);
      setPresenca(presencaRes.data?.presenca || null);
      setRecados(recadosRes.data?.recados || []);
      setFormularios(formularioRes.data?.formularios || []);
    } catch {
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  const selectChild = (idx: number) => {
    setSelected(idx);
    loadData(participantes[idx].id);
  };

  const p = participantes[selected];
  if (!p) return null;

  const pctAtual = presenca?.mesAtual?.total
    ? Math.round((presenca.mesAtual.presentes / presenca.mesAtual.total) * 100)
    : null;
  const pctAnterior = presenca?.mesAnterior?.total
    ? Math.round((presenca.mesAnterior.presentes / presenca.mesAnterior.total) * 100)
    : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-blue-50">
      {/* Header */}
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/familia")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Users className="h-5 w-5 text-primary" />
          <h1 className="font-semibold text-foreground">Portal da Família</h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Child selector */}
        {participantes.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-2">
            {participantes.map((child, idx) => (
              <Button
                key={child.id}
                variant={idx === selected ? "default" : "outline"}
                size="sm"
                onClick={() => selectChild(idx)}
                className="whitespace-nowrap"
              >
                {child.nome_completo.split(" ").slice(0, 2).join(" ")}
              </Button>
            ))}
          </div>
        )}

        {/* Summary card */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              {p.foto_url ? (
                <img src={p.foto_url} alt="" className="w-16 h-16 rounded-full object-cover" />
              ) : (
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xl">
                  {p.nome_completo.charAt(0)}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h2 className="font-bold text-lg text-foreground truncate">{p.nome_completo}</h2>
                <div className="flex flex-wrap gap-2 mt-1">
                  <Badge variant={p.status === "ativo" ? "default" : "secondary"}>
                    {p.status}
                  </Badge>
                  {p.periodo && <Badge variant="outline">{p.periodo === "manha" ? "Manhã" : p.periodo === "tarde" ? "Tarde" : "Integral"}</Badge>}
                  {p.escola && <Badge variant="outline">{p.escola}</Badge>}
                </div>
                {turmas.length > 0 && (
                  <p className="text-sm text-muted-foreground mt-2">
                    Turma(s): {turmas.map((t: any) => t.nome).join(", ")}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Carregando...</div>
        ) : (
          <Tabs defaultValue="transporte" className="space-y-4">
            <TabsList className="w-full grid grid-cols-5">
              <TabsTrigger value="transporte" className="text-xs"><MapPin className="h-3 w-3 mr-1" />Transporte</TabsTrigger>
              <TabsTrigger value="atividades" className="text-xs"><BookOpen className="h-3 w-3 mr-1" />Atividades</TabsTrigger>
              <TabsTrigger value="presenca" className="text-xs"><CalendarCheck className="h-3 w-3 mr-1" />Presença</TabsTrigger>
              <TabsTrigger value="recados" className="text-xs"><MessageSquare className="h-3 w-3 mr-1" />Recados</TabsTrigger>
              <TabsTrigger value="formularios" className="text-xs"><FileText className="h-3 w-3 mr-1" />Formulários</TabsTrigger>
            </TabsList>

            {/* Transporte */}
            <TabsContent value="transporte" className="space-y-4">
              {p.ponto_transporte ? (
                <>
                  <Card className="border-[hsl(var(--primary))] bg-primary/5">
                    <CardContent className="pt-6">
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-full bg-primary text-primary-foreground">
                          <MapPin className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Ponto de embarque</p>
                          <p className="font-bold text-lg text-foreground">{p.ponto_transporte.nome}</p>
                          {p.ponto_transporte.bairro_nome && (
                            <p className="text-sm text-muted-foreground">{p.ponto_transporte.bairro_nome}</p>
                          )}
                          <div className="flex gap-4 mt-2">
                            {p.ponto_transporte.horario_manha && (
                              <div className="flex items-center gap-1 text-sm">
                                <Clock className="h-3 w-3 text-muted-foreground" />
                                <span>Manhã: <strong>{p.ponto_transporte.horario_manha}</strong></span>
                              </div>
                            )}
                            {p.ponto_transporte.horario_tarde && (
                              <div className="flex items-center gap-1 text-sm">
                                <Clock className="h-3 w-3 text-muted-foreground" />
                                <span>Tarde: <strong>{p.ponto_transporte.horario_tarde}</strong></span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <p className="text-sm text-muted-foreground text-center">
                    Localize seu ponto no mapa: <strong className="text-primary">{p.ponto_transporte.nome}</strong>
                  </p>
                </>
              ) : (
                <Card>
                  <CardContent className="pt-6 text-center text-muted-foreground">
                    Nenhum ponto de transporte cadastrado
                  </CardContent>
                </Card>
              )}
              <div className="rounded-xl overflow-hidden border shadow-sm">
                <iframe
                  src="https://www.google.com/maps/d/embed?mid=16Zj-8IkR-08tLtP1LxhQouLxCmuDxYg&ehbc=2E312F&noprof=1"
                  width="100%"
                  height="400"
                  style={{ border: 0 }}
                  allowFullScreen
                  loading="lazy"
                  title="Mapa de pontos de transporte"
                />
              </div>
            </TabsContent>

            {/* Atividades */}
            <TabsContent value="atividades" className="space-y-3">
              {atividades.length === 0 ? (
                <Card><CardContent className="pt-6 text-center text-muted-foreground">Nenhuma atividade recente</CardContent></Card>
              ) : (
                atividades.map((a: any, i: number) => (
                  <Card key={i}>
                    <CardContent className="pt-4 pb-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium text-foreground">{a.nome_atividade || "Atividade"}</p>
                          {a.tipo_atividade?.length > 0 && (
                            <p className="text-xs text-muted-foreground">{a.tipo_atividade.join(", ")}</p>
                          )}
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {a.data ? format(parseISO(a.data), "dd/MM", { locale: ptBR }) : ""}
                          {a.dia_semana ? ` (${a.dia_semana})` : ""}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>

            {/* Presença */}
            <TabsContent value="presenca" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">Mês Atual</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {pctAtual !== null ? (
                      <>
                        <p className="text-3xl font-bold text-foreground">{pctAtual}%</p>
                        <p className="text-xs text-muted-foreground">
                          {presenca.mesAtual.presentes}/{presenca.mesAtual.total} dias
                        </p>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">Sem dados</p>
                    )}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">Mês Anterior</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {pctAnterior !== null ? (
                      <>
                        <p className="text-3xl font-bold text-foreground">{pctAnterior}%</p>
                        <p className="text-xs text-muted-foreground">
                          {presenca.mesAnterior.presentes}/{presenca.mesAnterior.total} dias
                        </p>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">Sem dados</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Recados */}
            <TabsContent value="recados" className="space-y-3">
              {recados.length === 0 ? (
                <Card><CardContent className="pt-6 text-center text-muted-foreground">Nenhum recado</CardContent></Card>
              ) : (
                recados.map((r: any) => (
                  <Card key={r.id}>
                    <CardContent className="pt-4 pb-4">
                      <p className="text-sm text-foreground">{r.conteudo}</p>
                      <div className="flex justify-between items-center mt-2">
                        <span className="text-xs text-muted-foreground">De: {r.remetente_nome}</span>
                        <span className="text-xs text-muted-foreground">
                          {format(parseISO(r.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>

            {/* Formulários */}
            <TabsContent value="formularios" className="space-y-3">
              {formularios.length === 0 ? (
                <Card><CardContent className="pt-6 text-center text-muted-foreground">Nenhum formulário disponível</CardContent></Card>
              ) : (
                formularios.map((f: any) => (
                  <Card key={f.id} className={f.respondido ? "opacity-70" : ""}>
                    <CardContent className="pt-4 pb-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium text-foreground">{f.titulo}</p>
                          {f.descricao && <p className="text-xs text-muted-foreground mt-1">{f.descricao}</p>}
                        </div>
                        {f.respondido ? (
                          <Badge variant="secondary">Respondido</Badge>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => {
                              sessionStorage.setItem("familia_formulario", JSON.stringify(f));
                              sessionStorage.setItem("familia_participante_id", p.id);
                              sessionStorage.setItem("familia_responsavel_nome", "");
                              navigate(`/familia/formulario/${f.id}`);
                            }}
                          >
                            Responder
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}
