import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { MapPin, Clock, BookOpen, CalendarCheck, MessageSquare, FileText, ArrowLeft, Users, Calendar, Percent, UserCheck, Lock, Bus, Flame, ChevronDown } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import confetti from "canvas-confetti";
import {
  isCheckinAberto, dataDefaultCheckin, proximosDiasUteis,
  diaSemanaKey, formatarBR, hojeSP, parseDataISO, nowSP,
} from "@/lib/checkinWindow";

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
  const [checkins, setCheckins] = useState<any[]>([]);
  const [dataAlvo, setDataAlvo] = useState<string>(dataDefaultCheckin());
  const [savingCheckin, setSavingCheckin] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [naoVaiDialog, setNaoVaiDialog] = useState<{ periodo: string; data: string } | null>(null);
  const [naoVaiMotivo, setNaoVaiMotivo] = useState("");
  const [respNome, setRespNome] = useState("");

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
      const token = sessionStorage.getItem("familia_token") || undefined;
      const [turmasRes, atividadesRes, presencaRes, recadosRes, formularioRes, checkinsRes] = await Promise.all([
        supabase.functions.invoke("public-familia-data", { body: { participante_id: participanteId, tipo: "turmas", token } }),
        supabase.functions.invoke("public-familia-data", { body: { participante_id: participanteId, tipo: "atividades", token } }),
        supabase.functions.invoke("public-familia-data", { body: { participante_id: participanteId, tipo: "presenca", token } }),
        supabase.functions.invoke("public-familia-data", { body: { participante_id: participanteId, tipo: "recados", token } }),
        supabase.functions.invoke("public-familia-data", { body: { participante_id: participanteId, tipo: "formularios", token } }),
        supabase.functions.invoke("public-familia-data", { body: { participante_id: participanteId, tipo: "checkins", token } }),
      ]);

      setTurmas(turmasRes.data?.turmas || []);
      setAtividades(atividadesRes.data?.atividades || []);
      setPresenca(presencaRes.data?.presenca || null);
      setRecados(recadosRes.data?.recados || []);
      setFormularios(formularioRes.data?.formularios || []);
      setCheckins(checkinsRes.data?.checkins || []);
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

  // ===== Check-in helpers (declarado antes de retornos para hooks consistentes) =====
  const periodosDoParticipante = useMemo(() => {
    if (!p?.periodo) return [];
    if (p.periodo === "integral") return ["manha", "tarde"];
    return [p.periodo];
  }, [p?.periodo]);

  const diasFrequenta = useMemo(() => {
    const set = new Set<string>();
    turmas.forEach((t: any) => (t.dias_semana || []).forEach((d: string) => set.add(String(d).toLowerCase().slice(0, 3))));
    return set;
  }, [turmas]);

  const temAtividadeNaData = (iso: string) => {
    if (!diasFrequenta.size) return true;
    return diasFrequenta.has(diaSemanaKey(iso));
  };

  const checkinDoDia = (iso: string, periodo: string) =>
    checkins.find((c: any) => c.data === iso && c.periodo === periodo) || null;

  const streak = useMemo(() => {
    // dias seguidos com pelo menos 1 confirmação true (a partir de ontem)
    const ordenados = [...checkins]
      .filter((c: any) => c.confirmado === true)
      .map((c: any) => c.data)
      .sort()
      .reverse();
    const set = new Set(ordenados);
    let count = 0;
    let cursor = parseDataISO(hojeSP());
    cursor.setDate(cursor.getDate() - 1);
    while (set.has(cursor.toISOString().slice(0, 10))) {
      count++;
      cursor.setDate(cursor.getDate() - 1);
    }
    return count;
  }, [checkins]);

  const ultimaConfirmacao = useMemo(() => {
    const ord = [...checkins].sort((a: any, b: any) => (b.confirmado_em || "").localeCompare(a.confirmado_em || ""));
    return ord[0] || null;
  }, [checkins]);

  const enviarCheckin = async (iso: string, periodo: string, confirmado: boolean, motivo?: string) => {
    if (!p) return;
    const key = `${iso}-${periodo}-${confirmado}`;
    setSavingCheckin(key);
    try {
      const token = sessionStorage.getItem("familia_token") || undefined;
      const res = await supabase.functions.invoke("public-familia-data", {
        body: {
          participante_id: p.id,
          tipo: "registrar_checkin",
          token,
          data: iso,
          periodo,
          confirmado,
          confirmado_por: respNome || null,
          observacao: motivo || null,
        },
      });
      if ((res.data as any)?.error || res.error) {
        toast.error((res.data as any)?.error || res.error?.message || "Erro ao salvar");
        return;
      }
      // Atualização local
      const novo = (res.data as any).checkin;
      setCheckins(prev => {
        const idx = prev.findIndex((c: any) => c.data === iso && c.periodo === periodo);
        if (idx >= 0) { const cp = [...prev]; cp[idx] = novo; return cp; }
        return [novo, ...prev];
      });
      if (confirmado) {
        confetti({ particleCount: 90, spread: 70, origin: { y: 0.6 } });
        toast.success("Obrigado! O motorista já foi avisado 🚐");
      } else {
        toast.success("Registrado: hoje a criança não vai");
      }
    } finally {
      setSavingCheckin(null);
    }
  };

  const handleNaoVaiConfirm = async () => {
    if (!naoVaiDialog) return;
    if (!naoVaiMotivo.trim() || naoVaiMotivo.trim().length < 5) {
      toast.error("Por favor, escreva o motivo (mínimo 5 caracteres) para que a equipe possa apoiar");
      return;
    }
    await enviarCheckin(naoVaiDialog.data, naoVaiDialog.periodo, false, naoVaiMotivo.trim());
    setNaoVaiDialog(null);
    setNaoVaiMotivo("");
  };

  if (!p) return null;

  const pctAtual = presenca?.mesAtual?.total
    ? Math.round((presenca.mesAtual.presentes / presenca.mesAtual.total) * 100)
    : null;

  const periodoLabel = p.periodo === "manha" ? "Manhã" : p.periodo === "tarde" ? "Tarde" : p.periodo === "integral" ? "Integral" : null;
  const grupoNome = turmas.length > 0 ? turmas.map((t: any) => t.nome_grupo || t.nome).join(", ") : null;

  // Dias de atividade (from turma dias_semana)
  const allDias = turmas.flatMap((t: any) => t.dias_semana || []);
  const diasUnicos = [...new Set(allDias)];
  const diasAtividade = diasUnicos.length > 0 ? diasUnicos.join(", ") : null;

  // Horário do ônibus
  const horarioOnibus = p.ponto_transporte
    ? [
        p.ponto_transporte.horario_manha ? `Manhã: ${p.ponto_transporte.horario_manha}` : null,
        p.ponto_transporte.horario_tarde ? `Tarde: ${p.ponto_transporte.horario_tarde}` : null,
      ].filter(Boolean).join(" · ") || null
    : null;

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
            {/* ===== CHECK-IN ===== */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                <Bus className="h-4 w-4" /> Confirmar presença
                {streak > 0 && (
                  <span className="ml-auto inline-flex items-center gap-1 text-xs font-bold text-orange-600">
                    <Flame className="h-3.5 w-3.5" /> {streak} dia{streak > 1 ? "s" : ""} confirmando
                  </span>
                )}
              </h3>
              {ultimaConfirmacao && (
                <p className="text-xs text-muted-foreground">
                  Última confirmação: {format(parseISO(ultimaConfirmacao.confirmado_em), "dd/MM HH:mm", { locale: ptBR })}
                </p>
              )}

              {(() => {
                const aberto = isCheckinAberto(dataAlvo);
                const temAtiv = temAtividadeNaData(dataAlvo);
                const titulo = (() => {
                  if (dataAlvo === hojeSP()) return `Vai hoje? (${formatarBR(dataAlvo)})`;
                  const amanhaISO = (() => { const d = parseDataISO(hojeSP()); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); })();
                  if (dataAlvo === amanhaISO) return `Vai amanhã? (${formatarBR(dataAlvo)})`;
                  return `Vai em ${formatarBR(dataAlvo)}?`;
                })();

                if (!temAtiv) {
                  return (
                    <Card><CardContent className="py-6 text-center text-sm text-muted-foreground">
                      🌿 Não há atividade em {formatarBR(dataAlvo)}
                    </CardContent></Card>
                  );
                }

                if (!aberto) {
                  return (
                    <Card className="bg-muted/40">
                      <CardContent className="py-5 text-center space-y-2">
                        <Lock className="h-6 w-6 mx-auto text-muted-foreground" />
                        <p className="text-sm font-medium">Janela encerrada às 06:00</p>
                        <p className="text-xs text-muted-foreground">Fale com a coordenação se a criança ainda for hoje</p>
                        <Button variant="outline" size="sm" onClick={() => {
                          const d = parseDataISO(hojeSP()); d.setDate(d.getDate() + 1);
                          setDataAlvo(d.toISOString().slice(0, 10));
                        }}>Confirmar para amanhã</Button>
                      </CardContent>
                    </Card>
                  );
                }

                const lembretePulsante = nowSP().getHours() >= 19 &&
                  periodosDoParticipante.some(per => !checkinDoDia(dataAlvo, per));

                return (
                  <div className="space-y-3">
                    <p className="text-base font-semibold text-foreground text-center">{titulo}</p>
                    {!respNome && (
                      <Input
                        placeholder="Seu nome (opcional, ajuda o motorista)"
                        value={respNome}
                        onChange={e => setRespNome(e.target.value)}
                        className="text-sm"
                      />
                    )}
                    {periodosDoParticipante.map(per => {
                      const c = checkinDoDia(dataAlvo, per);
                      const periodoLabel = per === "manha" ? "Manhã" : "Tarde";
                      const sk = `${dataAlvo}-${per}`;

                      if (c?.confirmado === true) {
                        return (
                          <Card key={per} className="border-l-4 border-l-green-500 bg-green-50/60 dark:bg-green-950/20">
                            <CardContent className="py-4 flex items-center justify-between gap-3">
                              <div>
                                <p className="font-semibold text-green-700 dark:text-green-400">✅ Confirmado — {periodoLabel}</p>
                                <p className="text-xs text-muted-foreground">
                                  {format(parseISO(c.confirmado_em), "dd/MM HH:mm", { locale: ptBR })}
                                  {c.confirmado_por ? ` · por ${c.confirmado_por}` : ""}
                                </p>
                              </div>
                              <Button size="sm" variant="ghost"
                                onClick={() => enviarCheckin(dataAlvo, per, false)}
                                disabled={savingCheckin === sk}>
                                Cancelar
                              </Button>
                            </CardContent>
                          </Card>
                        );
                      }
                      if (c?.confirmado === false) {
                        return (
                          <Card key={per} className="border-l-4 border-l-red-500 bg-red-50/60 dark:bg-red-950/20">
                            <CardContent className="py-4">
                              <p className="font-semibold text-red-700 dark:text-red-400">❌ Não vai — {periodoLabel}</p>
                              {c.observacao && <p className="text-xs text-muted-foreground mt-1">Motivo: {c.observacao}</p>}
                              <Button size="sm" variant="ghost" className="mt-2"
                                onClick={() => enviarCheckin(dataAlvo, per, true)}
                                disabled={savingCheckin === sk}>
                                Mudei de ideia — vai sim
                              </Button>
                            </CardContent>
                          </Card>
                        );
                      }
                      return (
                        <Card key={per} className={lembretePulsante ? "border-l-4 border-l-amber-500 animate-pulse" : ""}>
                          <CardContent className="py-4 space-y-3">
                            <p className="text-sm font-medium text-center text-muted-foreground">{periodoLabel}</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <Button
                                size="lg"
                                className="h-14 text-base bg-green-600 hover:bg-green-700 text-white"
                                onClick={() => enviarCheckin(dataAlvo, per, true)}
                                disabled={savingCheckin === sk}
                              >
                                ✅ SIM, vai
                              </Button>
                              <Button
                                size="lg"
                                variant="outline"
                                className="h-14 text-base border-red-300 text-red-700 hover:bg-red-50"
                                onClick={() => { setNaoVaiDialog({ data: dataAlvo, periodo: per }); setNaoVaiMotivo(""); }}
                                disabled={savingCheckin === sk}
                              >
                                ❌ Não vai
                              </Button>
                            </div>
                            {lembretePulsante && (
                              <p className="text-xs text-amber-700 text-center">⏰ Confirme agora — janela fecha às 06:00</p>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}

                    <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => setPickerOpen(o => !o)}>
                      <ChevronDown className="h-3 w-3 mr-1" /> Confirmar para outro dia
                    </Button>
                    {pickerOpen && (
                      <div className="flex flex-wrap gap-2 justify-center">
                        {proximosDiasUteis(7).map(d => (
                          <Button key={d} size="sm" variant={d === dataAlvo ? "default" : "outline"}
                            onClick={() => { setDataAlvo(d); setPickerOpen(false); }}>
                            {formatarBR(d)}
                          </Button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

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
