import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { MapPin, Clock, BookOpen, CalendarCheck, MessageSquare, FileText, ArrowLeft, Users, Calendar, Percent, UserCheck } from "lucide-react";
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
  iniciou_em: string | null;
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

  const periodoLabel = p.periodo === "manha" ? "Manhã" : p.periodo === "tarde" ? "Tarde" : p.periodo === "integral" ? "Integral" : null;
  const grupoNome = turmas.length > 0 ? turmas.map((t: any) => t.nome_grupo || t.nome).join(", ") : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-blue-50">
      {/* Header */}
      <div className="bg-white border-b shadow-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/familia")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Users className="h-5 w-5 text-primary" />
          <h1 className="font-semibold text-foreground">Portal da Família</h1>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
        {/* Child selector */}
        {participantes.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
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

        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Carregando...</div>
        ) : (
          <>
            {/* ===== RESUMO DA CRIANÇA ===== */}
            <Card>
              <CardContent className="pt-6 pb-5">
                <div className="flex items-start gap-4">
                  {p.foto_url ? (
                    <img src={p.foto_url} alt="" className="w-16 h-16 rounded-full object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xl flex-shrink-0">
                      {p.nome_completo.charAt(0)}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h2 className="font-bold text-lg text-foreground leading-tight">{p.nome_completo}</h2>
                    <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                        <span>Bairro: <span className="text-foreground font-medium">{p.bairro_nome || "Sem dados"}</span></span>
                      </div>
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Users className="h-3.5 w-3.5 flex-shrink-0" />
                        <span>Grupo: <span className="text-foreground font-medium">{grupoNome || "Sem dados"}</span></span>
                      </div>
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Clock className="h-3.5 w-3.5 flex-shrink-0" />
                        <span>Período: <span className="text-foreground font-medium">{periodoLabel || "Sem dados"}</span></span>
                      </div>
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Calendar className="h-3.5 w-3.5 flex-shrink-0" />
                        <span>Início: <span className="text-foreground font-medium">{p.iniciou_em ? format(parseISO(p.iniciou_em), "dd/MM/yyyy") : "Sem dados"}</span></span>
                      </div>
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <CalendarCheck className="h-3.5 w-3.5 flex-shrink-0" />
                        <span>Última presença: <span className="text-foreground font-medium">{presenca?.ultima_presenca ? format(parseISO(presenca.ultima_presenca), "dd/MM/yyyy") : "Sem dados"}</span></span>
                      </div>
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Percent className="h-3.5 w-3.5 flex-shrink-0" />
                        <span>Frequência: {pctAtual !== null ? (
                          <><span className={`font-bold ${pctAtual >= 75 ? "text-green-600" : pctAtual >= 50 ? "text-amber-600" : "text-red-600"}`}>{pctAtual}%</span> <span className="text-xs">({presenca.mesAtual.presentes}/{presenca.mesAtual.total})</span></>
                        ) : <span className="text-foreground font-medium">Sem dados</span>}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-muted-foreground col-span-2">
                        <BookOpen className="h-3.5 w-3.5 flex-shrink-0" />
                        <span>Dias de atividade: <span className="text-foreground font-medium">{diasAtividade || "Sem dados"}</span></span>
                      </div>
                      <div className="flex items-center gap-1.5 text-muted-foreground col-span-2">
                        <Clock className="h-3.5 w-3.5 flex-shrink-0" />
                        <span>Horário do ônibus: <span className="text-foreground font-medium">{horarioOnibus || "Sem dados"}</span></span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* ===== TRANSPORTE ===== */}
            {p.ponto_transporte && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                  <MapPin className="h-4 w-4" /> Transporte
                </h3>
                <Card className="border-primary/30 bg-primary/5">
                  <CardContent className="pt-5 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-full bg-primary text-primary-foreground">
                        <MapPin className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">{p.ponto_transporte.nome}</p>
                        {p.ponto_transporte.bairro_nome && (
                          <p className="text-xs text-muted-foreground">{p.ponto_transporte.bairro_nome}</p>
                        )}
                      </div>
                      <div className="ml-auto flex gap-3 text-sm">
                        {p.ponto_transporte.horario_manha && (
                          <div className="text-center">
                            <p className="text-[10px] text-muted-foreground uppercase">Manhã</p>
                            <p className="font-semibold text-foreground">{p.ponto_transporte.horario_manha}</p>
                          </div>
                        )}
                        {p.ponto_transporte.horario_tarde && (
                          <div className="text-center">
                            <p className="text-[10px] text-muted-foreground uppercase">Tarde</p>
                            <p className="font-semibold text-foreground">{p.ponto_transporte.horario_tarde}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <p className="text-xs text-muted-foreground text-center">
                  Localize seu ponto no mapa: <strong className="text-primary">{p.ponto_transporte.nome}</strong>
                </p>
                <div className="rounded-xl overflow-hidden border shadow-sm">
                  <iframe
                    src="https://www.google.com/maps/d/embed?mid=16Zj-8IkR-08tLtP1LxhQouLxCmuDxYg&ehbc=2E312F&noprof=1"
                    width="100%"
                    height="350"
                    style={{ border: 0 }}
                    allowFullScreen
                    loading="lazy"
                    title="Mapa de pontos de transporte"
                  />
                </div>
              </div>
            )}

            {/* ===== ATIVIDADES RECENTES ===== */}
            {atividades.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                  <BookOpen className="h-4 w-4" /> Atividades Recentes
                </h3>
                <div className="grid gap-2">
                  {atividades.map((a: any, i: number) => (
                    <Card key={i}>
                      <CardContent className="py-3 px-4 flex justify-between items-center">
                        <div>
                          <p className="font-medium text-sm text-foreground">{a.nome_atividade || "Atividade"}</p>
                          {a.tipo_atividade?.length > 0 && (
                            <p className="text-xs text-muted-foreground">{a.tipo_atividade.join(", ")}</p>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap ml-3">
                          {a.data ? format(parseISO(a.data), "dd/MM", { locale: ptBR }) : ""}
                          {a.dia_semana ? ` · ${a.dia_semana}` : ""}
                        </span>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* ===== RECADOS ===== */}
            {recados.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" /> Recados
                </h3>
                <div className="grid gap-2">
                  {recados.map((r: any) => (
                    <Card key={r.id}>
                      <CardContent className="py-3 px-4">
                        <p className="text-sm text-foreground">{r.conteudo}</p>
                        <div className="flex justify-between mt-1.5">
                          <span className="text-xs text-muted-foreground">De: {r.remetente_nome}</span>
                          <span className="text-xs text-muted-foreground">
                            {format(parseISO(r.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* ===== FORMULÁRIOS ===== */}
            {formularios.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                  <FileText className="h-4 w-4" /> Formulários
                </h3>
                <div className="grid gap-2">
                  {formularios.map((f: any) => (
                    <Card key={f.id} className={f.respondido ? "opacity-60" : ""}>
                      <CardContent className="py-3 px-4 flex justify-between items-center">
                        <div>
                          <p className="font-medium text-sm text-foreground">{f.titulo}</p>
                          {f.descricao && <p className="text-xs text-muted-foreground">{f.descricao}</p>}
                        </div>
                        {f.respondido ? (
                          <Badge variant="secondary" className="text-xs">Respondido</Badge>
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
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        <p className="text-center text-xs text-muted-foreground pt-4 pb-8">
          CAIA Medianeira — Sociedade Civil Nossa Senhora Aparecida
        </p>
      </div>
    </div>
  );
}
