import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { toast } from "sonner";
import { MapPin, Clock, BookOpen, CalendarCheck, MessageSquare, FileText, ArrowLeft, Users, Calendar as CalendarIcon, Percent, UserCheck, Lock, Bus, Flame, CalendarDays, Camera, Image as ImageIcon, Upload, Loader2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import confetti from "canvas-confetti";
import { cn } from "@/lib/utils";
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
  const [fotoDialogOpen, setFotoDialogOpen] = useState(false);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [fotoUploading, setFotoUploading] = useState(false);
  const fotoFileRef = useRef<File | null>(null);

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

  // Heartbeat: mantém o registro de acesso vivo enquanto a aba estiver aberta
  useEffect(() => {
    const acesso_id = sessionStorage.getItem("familia_acesso_id");
    const token = sessionStorage.getItem("familia_token");
    if (!acesso_id || !token || participantes.length === 0) return;
    const ping = () => {
      const pid = participantes[selected]?.id;
      if (!pid) return;
      supabase.functions.invoke("public-familia-data", {
        body: { participante_id: pid, tipo: "heartbeat", token, acesso_id },
      }).catch(() => {});
    };
    const interval = window.setInterval(ping, 60_000);
    return () => window.clearInterval(interval);
  }, [participantes, selected]);

  // Polling leve dos check-ins: detecta quando o motorista confirma embarque
  useEffect(() => {
    if (participantes.length === 0) return;
    const refresh = async () => {
      const pid = participantes[selected]?.id;
      if (!pid || document.hidden) return;
      const token = sessionStorage.getItem("familia_token") || undefined;
      const acesso_id = sessionStorage.getItem("familia_acesso_id") || undefined;
      try {
        const res = await supabase.functions.invoke("public-familia-data", {
          body: { participante_id: pid, tipo: "checkins", token, acesso_id },
        });
        const lista = (res.data as any)?.checkins;
        if (Array.isArray(lista)) setCheckins(lista);
      } catch {/* ignore */}
    };
    const interval = window.setInterval(refresh, 45_000);
    const onVisible = () => { if (!document.hidden) refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [participantes, selected]);

  const loadData = async (participanteId: string) => {
    setLoading(true);
    try {
      const token = sessionStorage.getItem("familia_token") || undefined;
      const acesso_id = sessionStorage.getItem("familia_acesso_id") || undefined;
      const [turmasRes, atividadesRes, presencaRes, recadosRes, formularioRes, checkinsRes] = await Promise.all([
        supabase.functions.invoke("public-familia-data", { body: { participante_id: participanteId, tipo: "turmas", token, acesso_id } }),
        supabase.functions.invoke("public-familia-data", { body: { participante_id: participanteId, tipo: "atividades", token, acesso_id } }),
        supabase.functions.invoke("public-familia-data", { body: { participante_id: participanteId, tipo: "presenca", token, acesso_id } }),
        supabase.functions.invoke("public-familia-data", { body: { participante_id: participanteId, tipo: "recados", token, acesso_id } }),
        supabase.functions.invoke("public-familia-data", { body: { participante_id: participanteId, tipo: "formularios", token, acesso_id } }),
        supabase.functions.invoke("public-familia-data", { body: { participante_id: participanteId, tipo: "checkins", token, acesso_id } }),
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
    // Optimistic UI: feedback instantâneo, rede em background
    const optimistic = {
      data: iso,
      periodo,
      confirmado,
      confirmado_em: new Date().toISOString(),
      confirmado_por: null,
      observacao: motivo || null,
    };
    const prevSnapshot = checkins;
    setCheckins(prev => {
      const idx = prev.findIndex((c: any) => c.data === iso && c.periodo === periodo);
      if (idx >= 0) {
        const cp = [...prev];
        cp[idx] = { ...cp[idx], ...optimistic };
        return cp;
      }
      return [optimistic, ...prev];
    });
    if (confirmado) {
      // confetti em microtarefa pra não bloquear o paint do estado novo
      setTimeout(() => confetti({ particleCount: 90, spread: 70, origin: { y: 0.6 } }), 0);
      toast.success("Obrigado! O motorista já foi avisado 🚐");
    } else {
      toast.success("Registrado: hoje a criança não vai");
    }
    try {
      const token = sessionStorage.getItem("familia_token") || undefined;
      const acesso_id = sessionStorage.getItem("familia_acesso_id") || undefined;
      const res = await supabase.functions.invoke("public-familia-data", {
        body: {
          participante_id: p.id,
          tipo: "registrar_checkin",
          token,
          acesso_id,
          data: iso,
          periodo,
          confirmado,
          confirmado_por: null,
          observacao: motivo || null,
        },
      });
      if ((res.data as any)?.error || res.error) {
        // rollback
        setCheckins(prevSnapshot);
        toast.error((res.data as any)?.error || res.error?.message || "Erro ao salvar");
        return;
      }
      // Reconcilia com servidor (mantém embarcou se já existir)
      const novo = (res.data as any).checkin;
      setCheckins(prev => {
        const idx = prev.findIndex((c: any) => c.data === iso && c.periodo === periodo);
        if (idx >= 0) {
          const cp = [...prev];
          cp[idx] = { ...cp[idx], ...novo };
          return cp;
        }
        return [novo, ...prev];
      });
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

  // ===== Upload da foto do participante (família) =====
  const comprimirImagem = (file: File): Promise<{ blob: Blob; dataUrl: string }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const MAX = 800;
          let { width, height } = img;
          if (width > height && width > MAX) { height = Math.round((height * MAX) / width); width = MAX; }
          else if (height > MAX) { width = Math.round((width * MAX) / height); height = MAX; }
          const canvas = document.createElement("canvas");
          canvas.width = width; canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) return reject(new Error("Canvas não suportado"));
          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob((blob) => {
            if (!blob) return reject(new Error("Falha ao gerar imagem"));
            const r2 = new FileReader();
            r2.onload = () => resolve({ blob, dataUrl: r2.result as string });
            r2.onerror = () => reject(new Error("Falha ao ler imagem"));
            r2.readAsDataURL(blob);
          }, "image/jpeg", 0.85);
        };
        img.onerror = () => reject(new Error("Imagem inválida"));
        img.src = reader.result as string;
      };
      reader.onerror = () => reject(new Error("Falha ao ler arquivo"));
      reader.readAsDataURL(file);
    });
  };

  const escolherFoto = (capture: boolean) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/jpeg,image/png,image/webp";
    if (capture) input.setAttribute("capture", "user");
    input.onchange = async (ev: any) => {
      const file: File | undefined = ev.target?.files?.[0];
      if (!file) return;
      try {
        const { blob, dataUrl } = await comprimirImagem(file);
        fotoFileRef.current = new File([blob], "foto.jpg", { type: "image/jpeg" });
        setFotoPreview(dataUrl);
      } catch (e: any) {
        toast.error(e.message || "Não foi possível processar a imagem");
      }
    };
    input.click();
  };

  const enviarFoto = async () => {
    if (!p || !fotoFileRef.current || !fotoPreview) return;
    setFotoUploading(true);
    try {
      const token = sessionStorage.getItem("familia_token") || undefined;
      const acesso_id = sessionStorage.getItem("familia_acesso_id") || undefined;
      const res = await supabase.functions.invoke("public-familia-data", {
        body: {
          participante_id: p.id,
          tipo: "upload_foto",
          token,
          acesso_id,
          foto_base64: fotoPreview,
          content_type: "image/jpeg",
        },
      });
      const data: any = res.data;
      if (data?.error || res.error) {
        toast.error(data?.error || res.error?.message || "Falha ao enviar foto");
        return;
      }
      // Atualiza lista local + sessionStorage
      const novoUrl: string = data.foto_url;
      setParticipantes(prev => {
        const cp = [...prev];
        cp[selected] = { ...cp[selected], foto_url: novoUrl };
        sessionStorage.setItem("familia_participantes", JSON.stringify(cp));
        return cp;
      });
      toast.success("Foto atualizada com sucesso 📸");
      setFotoDialogOpen(false);
      setFotoPreview(null);
      fotoFileRef.current = null;
    } catch (e: any) {
      toast.error(e.message || "Erro inesperado");
    } finally {
      setFotoUploading(false);
    }
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
                  <button
                    type="button"
                    onClick={() => { setFotoPreview(null); fotoFileRef.current = null; setFotoDialogOpen(true); }}
                    className="relative group flex-shrink-0 rounded-full focus:outline-none focus:ring-2 focus:ring-primary"
                    title="Alterar foto"
                  >
                    {p.foto_url ? (
                      <img src={p.foto_url} alt="" className="w-16 h-16 rounded-full object-cover" />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xl">
                        {p.nome_completo.charAt(0)}
                      </div>
                    )}
                    <span className="absolute -bottom-1 -right-1 bg-primary text-primary-foreground rounded-full p-1.5 shadow ring-2 ring-background group-hover:scale-110 transition-transform">
                      <Camera className="h-3 w-3" />
                    </span>
                  </button>
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
                        <CalendarIcon className="h-3.5 w-3.5 flex-shrink-0" />
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
              (() => {
                const bairroNome = (p.ponto_transporte.bairro_nome || "").toLowerCase();
                const bairroColor = bairroNome.includes("independ")
                  ? { bg: "bg-red-600", text: "text-red-600", border: "border-red-600/40", soft: "bg-red-50" }
                  : bairroNome.includes("alvorada")
                  ? { bg: "bg-purple-600", text: "text-purple-600", border: "border-purple-600/40", soft: "bg-purple-50" }
                  : bairroNome.includes("irene")
                  ? { bg: "bg-green-600", text: "text-green-600", border: "border-green-600/40", soft: "bg-green-50" }
                  : { bg: "bg-primary", text: "text-primary", border: "border-primary/30", soft: "bg-primary/5" };
                return (
                <div className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                  <MapPin className="h-4 w-4" /> Transporte
                </h3>
                <Card className={`${bairroColor.border} ${bairroColor.soft}`}>
                  <CardContent className="pt-5 pb-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-full ${bairroColor.bg} text-white`}>
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
                  Localize seu ponto no mapa: <strong className={bairroColor.text}>{p.ponto_transporte.nome}</strong>
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
                );
              })()
            )}

            {/* ===== ATIVIDADES RECENTES ===== */}
            {/* ===== CHECK-IN ===== */}
            <Card className="border-2 border-primary/40 bg-gradient-to-br from-primary/5 via-background to-background shadow-md ring-1 ring-primary/10">
              <CardContent className="pt-5 pb-5 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-full bg-primary text-primary-foreground shadow-sm">
                    <Bus className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-bold text-foreground leading-tight">Confirmar presença</h3>
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                        Ação rápida
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Avise se o(a) {p.nome_completo.split(" ")[0]} vai ou não no transporte
                    </p>
                  </div>
                  {streak > 0 && (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-orange-600 bg-orange-100 dark:bg-orange-950/40 px-2 py-1 rounded-full whitespace-nowrap">
                      <Flame className="h-3.5 w-3.5" /> {streak} dia{streak > 1 ? "s" : ""}
                    </span>
                  )}
                </div>
                {ultimaConfirmacao && (
                  <p className="text-xs text-muted-foreground">
                    Última confirmação:{" "}
                    <span className={`font-semibold ${ultimaConfirmacao.confirmado ? "text-green-600" : "text-red-600"}`}>
                      {ultimaConfirmacao.confirmado ? "✓ Embarcou!" : "✗ Não Embarcou"}
                    </span>{" "}
                    em {format(parseISO(ultimaConfirmacao.confirmado_em), "dd/MM 'às' HH:mm", { locale: ptBR })}
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
                    {/* Seletor de data — calendário shadcn no popover */}
                    <div className="flex items-center justify-between gap-2 bg-primary/10 rounded-md px-3 py-2">
                      <p className="text-base sm:text-lg font-bold text-foreground flex-1 text-center">{titulo}</p>
                      <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                        <PopoverTrigger asChild>
                          <Button variant="outline" size="sm" className="gap-1 shrink-0">
                            <CalendarDays className="h-4 w-4" />
                            <span className="hidden sm:inline">Outro dia</span>
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="end">
                          <Calendar
                            mode="single"
                            locale={ptBR}
                            selected={parseDataISO(dataAlvo)}
                            onSelect={(d) => {
                              if (!d) return;
                              const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
                              setDataAlvo(iso);
                              setPickerOpen(false);
                            }}
                            disabled={(date) => {
                              const hoje = parseDataISO(hojeSP());
                              hoje.setHours(0, 0, 0, 0);
                              const max = new Date(hoje);
                              max.setDate(max.getDate() + 14);
                              return date < hoje || date > max;
                            }}
                            initialFocus
                            className={cn("p-3 pointer-events-auto")}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
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
                                {c.embarcou === true && c.embarcou_em && (
                                  <p className="mt-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                                    🚐 Motorista confirmou embarque às {format(parseISO(c.embarcou_em), "HH:mm", { locale: ptBR })}
                                  </p>
                                )}
                                {c.embarcou === false && c.embarcou_em && (
                                  <p className="mt-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1">
                                    ⚠️ Motorista marcou Não Embarcou às {format(parseISO(c.embarcou_em), "HH:mm", { locale: ptBR })}
                                  </p>
                                )}
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
                        <Card key={per} className={`border-2 ${lembretePulsante ? "border-amber-400 animate-pulse" : "border-dashed border-primary/30"}`}>
                          <CardContent className="py-4 space-y-3">
                            <p className="text-sm font-bold text-center text-foreground uppercase tracking-wide">{periodoLabel} — pendente</p>
                            <div className="grid grid-cols-2 gap-2">
                              <Button
                                size="lg"
                                className="h-16 text-base font-bold bg-green-600 hover:bg-green-700 text-white shadow-md"
                                onClick={() => enviarCheckin(dataAlvo, per, true)}
                                disabled={savingCheckin === sk}
                              >
                                ✅ SIM, vai
                              </Button>
                              <Button
                                size="lg"
                                variant="outline"
                                className="h-16 text-base font-bold border-2 border-red-300 text-red-700 hover:bg-red-50"
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
                  </div>
                );
              })()}
              </CardContent>
            </Card>

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

      <Dialog open={!!naoVaiDialog} onOpenChange={(o) => { if (!o) { setNaoVaiDialog(null); setNaoVaiMotivo(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Por que hoje não vai?</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Sua resposta ajuda nossa equipe a apoiar a família — pode ser doença, viagem, compromisso etc.
            </p>
            <Label className="text-xs">Motivo (obrigatório)</Label>
            <Textarea
              value={naoVaiMotivo}
              onChange={(e) => setNaoVaiMotivo(e.target.value)}
              placeholder="Ex.: está com febre, vai ao médico, viagem em família..."
              className="min-h-[80px]"
            />
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => { setNaoVaiDialog(null); setNaoVaiMotivo(""); }}>
                Voltar
              </Button>
              <Button className="flex-1" onClick={handleNaoVaiConfirm}>
                Confirmar ausência
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={fotoDialogOpen} onOpenChange={(o) => { if (!o && !fotoUploading) { setFotoDialogOpen(false); setFotoPreview(null); fotoFileRef.current = null; } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Camera className="h-5 w-5" /> Foto do(a) {p.nome_completo.split(" ")[0]}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/20 px-3 py-2.5 text-xs text-amber-900 dark:text-amber-200 space-y-1.5">
              <p className="font-semibold flex items-center gap-1">📋 Antes de enviar, confira:</p>
              <ul className="list-disc pl-5 space-y-0.5">
                <li>Foto do <strong>rosto da criança</strong> bem visível</li>
                <li>Ambiente <strong>bem iluminado</strong></li>
                <li>Fundo de preferência uma <strong>parede branca</strong></li>
                <li>Se tiver, usar a <strong>camiseta do CAIA</strong></li>
              </ul>
            </div>

            {fotoPreview ? (
              <div className="space-y-3">
                <div className="flex justify-center">
                  <img src={fotoPreview} alt="Pré-visualização" className="w-40 h-40 rounded-full object-cover border-4 border-primary/30 shadow" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" onClick={() => { setFotoPreview(null); fotoFileRef.current = null; }} disabled={fotoUploading}>
                    Trocar
                  </Button>
                  <Button onClick={enviarFoto} disabled={fotoUploading} className="gap-2">
                    {fotoUploading ? <><Loader2 className="h-4 w-4 animate-spin" /> Enviando...</> : <><Upload className="h-4 w-4" /> Confirmar</>}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Button onClick={() => escolherFoto(true)} variant="outline" className="h-20 flex-col gap-1.5">
                  <Camera className="h-6 w-6 text-primary" />
                  <span className="text-xs font-medium">Tirar foto</span>
                </Button>
                <Button onClick={() => escolherFoto(false)} variant="outline" className="h-20 flex-col gap-1.5">
                  <ImageIcon className="h-6 w-6 text-primary" />
                  <span className="text-xs font-medium">Da galeria</span>
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
