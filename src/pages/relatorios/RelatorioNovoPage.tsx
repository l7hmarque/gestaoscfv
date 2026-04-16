import { useState, useEffect, useMemo } from "react";
import { ArrowLeft, Save, Loader2, Upload, X, Check, ChevronsUpDown, AlertTriangle, Plus, Trash2 } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useIsDemo, guardDemo } from "@/hooks/useIsDemo";
import { TIPOS_ATIVIDADE } from "@/lib/constants";
import { checkConquistas } from "@/hooks/useConquistas";

const MOTIVOS_RELATO = [
  "Conflito entre participantes",
  "Vulnerabilidade identificada",
  "Comportamento preocupante",
  "Encaminhamento necessário",
  "Outro",
];

const LIKERT_LABELS = ["Muito Baixo", "Baixo", "Moderado", "Alto", "Excepcional"];
const ENGAJAMENTO_OPT = ["Grupo participativo", "Grupo disperso", "Boa interação entre participantes", "Necessitou intervenção do educador"];
const SITUACOES_OPT = ["Nenhuma ocorrência", "Conflito entre participantes", "Situação de vulnerabilidade identificada", "Encaminhamento necessário", "Comunicação com família/responsável"];
const DIAS_SEMANA = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

function LikertField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map(n => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={cn(
              "flex-1 py-1.5 rounded text-xs font-medium transition-colors border",
              value === n
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-muted/50 text-muted-foreground border-border hover:bg-muted"
            )}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground px-1">
        <span>{LIKERT_LABELS[0]}</span>
        <span>{LIKERT_LABELS[4]}</span>
      </div>
    </div>
  );
}

const RelatorioNovoPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [turmas, setTurmas] = useState<any[]>([]);
  const [educadores, setEducadores] = useState<any[]>([]);
  const [planejamentos, setPlanejamentos] = useState<any[]>([]);
  const [participantesTurma, setParticipantesTurma] = useState<any[]>([]);
  const [fotos, setFotos] = useState<File[]>([]);
  const [educadorOpen, setEducadorOpen] = useState(false);
  const [apoioOpen, setApoioOpen] = useState(false);

  const [form, setForm] = useState({
    data: null as Date | null,
    dia_semana: "",
    nome_atividade: "",
    tipo_atividade: [] as string[],
    tipo_atividade_detalhe: "",
    educador_id: "",
    educador_apoio_id: "",
    planejamento_id: "",
    turma_ids: [] as string[],
    periodo_atividade: "" as string,
    iniciativa: 3,
    autonomia: 3,
    colaboracao: 3,
    comunicacao: 3,
    respeito_mutuo: 3,
    engajamento: [] as string[],
    situacoes_relevantes: [] as string[],
    objetivo_alcancado: "" as string,
    intervencoes: "",
    observacoes: "",
    presenca: {} as Record<string, boolean>,
    justificativas: {} as Record<string, string>,
  });

  // Relato equipe técnica state
  const [relatos, setRelatos] = useState<Array<{ motivo: string; participante_ids: string[]; descricao: string }>>([]);
  const [relatoForm, setRelatoForm] = useState({ motivo: "", participante_ids: [] as string[], descricao: "" });

  const scoreElo = useMemo(() => {
    const s = (form.iniciativa + form.autonomia + form.colaboracao + form.comunicacao + form.respeito_mutuo) / 5;
    return s.toFixed(2);
  }, [form.iniciativa, form.autonomia, form.colaboracao, form.comunicacao, form.respeito_mutuo]);

  // Load base data
  useEffect(() => {
    const fetchBase = async () => {
      const [t, e, r] = await Promise.all([
        supabase.from("turmas").select("id, nome, educador_id, oficina, periodo").eq("ativa", true).order("nome"),
        supabase.from("profiles").select("id, nome, user_id"),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      if (t.data) setTurmas(t.data);
      // Filter to only educators and coordenacao
      const educadorUserIds = new Set(
        (r.data || [])
          .filter((ur: any) => ur.role === "educador" || ur.role === "coordenacao")
          .map((ur: any) => ur.user_id)
      );
      if (e.data) {
        // profiles.user_id matches user_roles.user_id
        setEducadores(e.data.filter((p: any) => educadorUserIds.has(p.user_id)));
      }

      // Pre-populate from query params (e.g. from TurmaDetalhePage)
      const turmaId = searchParams.get("turma");
      if (turmaId && t.data) {
        const turma = t.data.find((x: any) => x.id === turmaId);
        if (turma) {
          setForm(f => ({
            ...f,
            turma_ids: [turmaId],
            educador_id: turma.educador_id || f.educador_id,
            tipo_atividade: turma.oficina ? [turma.oficina] : f.tipo_atividade,
          }));
        }
      }
    };
    fetchBase();
  }, [searchParams]);

  // Load planejamentos filtered by educador
  useEffect(() => {
    const fetchPlans = async () => {
      let query = supabase.from("planejamentos").select("id, titulo, educador_id, tipo_atividade, tipo_atividade_detalhe").order("created_at", { ascending: false }).limit(50);
      if (form.educador_id) {
        query = query.eq("educador_id", form.educador_id);
      }
      const { data } = await query;
      setPlanejamentos(data || []);
      // Clear planejamento if educador changed and current plan doesn't belong to new educador
      if (form.planejamento_id && data && !data.find((p: any) => p.id === form.planejamento_id)) {
        setForm(f => ({ ...f, planejamento_id: "", nome_atividade: f.nome_atividade }));
      }
    };
    fetchPlans();
  }, [form.educador_id]);

  // Load participantes when turmas change
  useEffect(() => {
    if (form.turma_ids.length === 0) {
      setParticipantesTurma([]);
      setForm(f => ({ ...f, presenca: {}, justificativas: {} }));
      return;
    }
    const fetchParts = async () => {
      const { data } = await supabase
        .from("turma_participantes")
        .select("participante_id, data_saida, participantes(id, nome_completo, status, periodo)")
        .in("turma_id", form.turma_ids)
        .is("data_saida" as any, null);
      if (data) {
        const unique = new Map<string, { nome: string; status: string; periodo: string | null }>();
        data.forEach((d: any) => {
          if (d.participantes && !unique.has(d.participantes.id)) {
            unique.set(d.participantes.id, { nome: d.participantes.nome_completo, status: d.participantes.status, periodo: d.participantes.periodo });
          }
        });
        // Filter: only ativo and busca_ativa
        const ALLOWED_STATUS = new Set(["ativo", "busca_ativa"]);
        const list = Array.from(unique, ([id, info]) => ({ id, nome: info.nome, status: info.status, periodo: info.periodo }))
          .filter(p => ALLOWED_STATUS.has(p.status || "ativo"))
          .sort((a, b) => a.nome.localeCompare(b.nome));
        setParticipantesTurma(list);
        setForm(f => {
          const activeIds = new Set(list.map(p => p.id));
          const pres: Record<string, boolean> = {};
          const justs: Record<string, string> = {};
          list.forEach(p => { pres[p.id] = p.id in f.presenca ? f.presenca[p.id] : true; });
          Object.entries(f.justificativas).forEach(([id, v]) => { if (activeIds.has(id)) justs[id] = v; });
          return { ...f, presenca: pres, justificativas: justs };
        });
      }
    };
    fetchParts();
  }, [form.turma_ids]);

  const toggleTurma = (id: string) => setForm(f => ({ ...f, turma_ids: f.turma_ids.includes(id) ? f.turma_ids.filter(x => x !== id) : [...f.turma_ids, id] }));
  const toggleEng = (v: string) => setForm(f => ({ ...f, engajamento: f.engajamento.includes(v) ? f.engajamento.filter(x => x !== v) : [...f.engajamento, v] }));
  const toggleSit = (v: string) => setForm(f => ({ ...f, situacoes_relevantes: f.situacoes_relevantes.includes(v) ? f.situacoes_relevantes.filter(x => x !== v) : [...f.situacoes_relevantes, v] }));
  const toggleTipoAtividade = (v: string) => setForm(f => ({ ...f, tipo_atividade: f.tipo_atividade.includes(v) ? f.tipo_atividade.filter(x => x !== v) : [...f.tipo_atividade, v] }));

  const handlePlanejamentoChange = (planId: string) => {
    const plan = planejamentos.find((p: any) => p.id === planId);
    setForm(f => ({
      ...f,
      planejamento_id: planId,
      nome_atividade: plan?.titulo || f.nome_atividade,
      educador_id: plan?.educador_id || f.educador_id,
      tipo_atividade: (plan?.tipo_atividade && plan.tipo_atividade.length > 0) ? plan.tipo_atividade : f.tipo_atividade,
      tipo_atividade_detalhe: plan?.tipo_atividade_detalhe || f.tipo_atividade_detalhe,
    }));
  };

  const addRelato = () => {
    if (!relatoForm.motivo) { toast.error("Selecione um motivo"); return; }
    if (relatoForm.participante_ids.length === 0) { toast.error("Selecione ao menos um participante"); return; }
    if (!relatoForm.descricao.trim()) { toast.error("Descreva brevemente a situação"); return; }
    setRelatos(prev => [...prev, { ...relatoForm }]);
    setRelatoForm({ motivo: "", participante_ids: [], descricao: "" });
    toast.success("Relato adicionado");
  };

  const handleFotos = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (fotos.length + files.length > 5) { toast.error("Máximo 5 fotos"); return; }
    setFotos(prev => [...prev, ...files]);
  };

  const activeParticipantIds = new Set(participantesTurma.map(p => p.id));
  const numParticipantes = Object.entries(form.presenca).filter(([id, v]) => v && activeParticipantIds.has(id)).length;
  const numAusentes = participantesTurma.length - numParticipantes;
  const pctAdesao = participantesTurma.length > 0 ? ((numParticipantes / participantesTurma.length) * 100) : 0;

  const needsDetail = form.tipo_atividade.some(v => TIPOS_ATIVIDADE.find(t => t.value === v && 'hasDetail' in t && t.hasDetail));

  const isDemo = useIsDemo();

  const handleSave = async () => {
    if (guardDemo(isDemo)) return;
    if (!form.data) { toast.error("Data é obrigatória"); return; }
    if (!form.nome_atividade.trim()) { toast.error("Nome da atividade é obrigatório"); return; }
    setSaving(true);
    try {
      const { data: rel, error } = await supabase.from("relatorios_atividade").insert({
        data: format(form.data, "yyyy-MM-dd"),
        dia_semana: form.dia_semana || null,
        nome_atividade: form.nome_atividade,
        tipo_atividade: form.tipo_atividade,
        tipo_atividade_detalhe: form.tipo_atividade_detalhe || null,
        educador_id: form.educador_id || null,
        planejamento_id: form.planejamento_id || null,
        periodo_atividade: form.periodo_atividade || null,
        iniciativa: form.iniciativa,
        autonomia: form.autonomia,
        colaboracao: form.colaboracao,
        comunicacao: form.comunicacao,
        respeito_mutuo: form.respeito_mutuo,
        score_elo: parseFloat(scoreElo),
        engajamento: form.engajamento,
        situacoes_relevantes: form.situacoes_relevantes,
        objetivo_alcancado: (form.objetivo_alcancado || null) as any,
        intervencoes: form.intervencoes || null,
        observacoes: form.observacoes || null,
        num_matriculados: participantesTurma.length,
        num_participantes: numParticipantes,
        num_ausentes: numAusentes,
        pct_adesao: Math.round(pctAdesao * 100) / 100,
      } as any).select("id").single();

      if (error) throw error;
      const relId = rel.id;

      // turmas
      if (form.turma_ids.length > 0) {
        await supabase.from("relatorio_turmas").insert(form.turma_ids.map(turma_id => ({ relatorio_id: relId, turma_id })));
      }

      // presença no relatório
      const presRows = participantesTurma.map(p => ({
        relatorio_id: relId,
        participante_id: p.id,
        presente: form.presenca[p.id] ?? false,
        justificativa: !(form.presenca[p.id] ?? false) ? (form.justificativas[p.id] || null) : null,
      }));
      if (presRows.length > 0) {
        await supabase.from("relatorio_presenca").insert(presRows);
      }

      // salvar também na tabela presenca (frequência oficial) — apenas membros de cada turma
      if (form.turma_ids.length > 0) {
        const dataStr = format(form.data, "yyyy-MM-dd");
        for (const turmaId of form.turma_ids) {
          const { data: turmaMembers } = await supabase
            .from("turma_participantes")
            .select("participante_id")
            .eq("turma_id", turmaId);
          const memberIds = new Set((turmaMembers || []).map((m: any) => m.participante_id));

          await supabase.from("presenca").delete().eq("turma_id", turmaId).eq("data", dataStr);
          const presencaRows = participantesTurma
            .filter(p => memberIds.has(p.id))
            .map(p => ({
              turma_id: turmaId,
              participante_id: p.id,
              data: dataStr,
              presente: form.presenca[p.id] ?? false,
              justificativa: !(form.presenca[p.id] ?? false) ? (form.justificativas[p.id] || null) : null,
              registrado_por: user?.id || null,
            }));
          if (presencaRows.length > 0) {
            await supabase.from("presenca").insert(presencaRows);
          }
        }
      }

      // Auto-transfer de período: participantes presentes com período diferente do relatório
      if (form.periodo_atividade && form.periodo_atividade !== "integral") {
        const presenteIds = participantesTurma
          .filter(p => form.presenca[p.id] && p.periodo && p.periodo !== form.periodo_atividade)
          .map(p => p.id);

        if (presenteIds.length > 0) {
          const transferWarnings: string[] = [];
          for (const pid of presenteIds) {
            const part = participantesTurma.find(p => p.id === pid);
            if (!part) continue;
            try {
              // 1. Update participantes.periodo
              await supabase.from("participantes").update({ periodo: form.periodo_atividade as any }).eq("id", pid);

              // 2. Find current turma_participantes links and set data_saida
              const { data: currentLinks } = await supabase
                .from("turma_participantes")
                .select("id, turma_id")
                .eq("participante_id", pid)
                .is("data_saida", null);

              const oldTurmaIds = (currentLinks || []).map((l: any) => l.turma_id);

              // Find destination turmas matching new period
              const { data: destTurmas } = await supabase
                .from("turmas")
                .select("id, nome, periodo")
                .eq("ativa", true)
                .eq("periodo", form.periodo_atividade as any);

              if (destTurmas && destTurmas.length > 0) {
                // Close old links
                for (const link of (currentLinks || [])) {
                  await supabase.from("turma_participantes").update({
                    data_saida: format(form.data!, "yyyy-MM-dd"),
                    motivo_saida: `Transferência automática de período (${part.periodo} → ${form.periodo_atividade})`,
                  } as any).eq("id", link.id);
                }

                // Find best matching turma (same bairro if possible)
                const { data: partData } = await supabase.from("participantes").select("bairro_id").eq("id", pid).single();
                let destTurma = destTurmas[0];
                if (partData?.bairro_id) {
                  const { data: bairroTurmas } = await supabase
                    .from("turmas")
                    .select("id, nome, periodo")
                    .eq("ativa", true)
                    .eq("periodo", form.periodo_atividade as any)
                    .contains("bairro_ids", [partData.bairro_id]);
                  if (bairroTurmas && bairroTurmas.length > 0) destTurma = bairroTurmas[0];
                }

                // Check if already linked to dest turma
                const alreadyLinked = oldTurmaIds.includes(destTurma.id);
                if (!alreadyLinked) {
                  await supabase.from("turma_participantes").insert({
                    participante_id: pid,
                    turma_id: destTurma.id,
                  } as any);
                }

                // Register transfer
                await supabase.from("participante_transferencias").insert({
                  participante_id: pid,
                  turma_origem_id: oldTurmaIds[0] || null,
                  turma_destino_id: destTurma.id,
                  motivo: `Transferência automática: período ${part.periodo} → ${form.periodo_atividade} (relatório de atividade)`,
                } as any);
              } else {
                transferWarnings.push(part.nome);
              }
            } catch (e) {
              console.warn(`Erro ao transferir participante ${pid}:`, e);
              transferWarnings.push(part.nome);
            }
          }
          if (transferWarnings.length > 0) {
            toast.warning(`Não foi possível transferir: ${transferWarnings.join(", ")} — sem turma destino compatível`);
          } else if (presenteIds.length > 0) {
            toast.success(`${presenteIds.length} participante(s) transferido(s) para o período ${form.periodo_atividade === "manha" ? "Manhã" : "Tarde"}`);
          }
        }
      }

      for (let i = 0; i < fotos.length; i++) {
        const file = fotos[i];
        const ext = file.name.split(".").pop();
        const path = `${relId}/${i}.${ext}`;
        const { error: upErr } = await supabase.storage.from("fotos-relatorios").upload(path, file);
        if (!upErr) {
          const { data: urlData } = supabase.storage.from("fotos-relatorios").getPublicUrl(path);
          await supabase.from("relatorio_fotos").insert({ relatorio_id: relId, foto_url: urlData.publicUrl, ordem: i });
        }
      }

      // Save relatos for equipe técnica
      if (relatos.length > 0) {
        const { data: profileData } = await supabase.from("profiles").select("id").eq("user_id", user!.id).single();
        const criadorId = profileData?.id || null;

        for (const relato of relatos) {
          const { data: relatoData } = await supabase.from("relato_equipe_tecnica").insert({
            relatorio_id: relId,
            motivo: relato.motivo,
            descricao: relato.descricao,
            criado_por: criadorId,
          } as any).select("id").single();

          if (relatoData) {
            // Insert participantes
            await supabase.from("relato_equipe_participantes").insert(
              relato.participante_ids.map(pid => ({ relato_id: relatoData.id, participante_id: pid })) as any
            );

            // Send recados to tecnico/coordenacao
            const { data: tecRoles } = await supabase.from("user_roles").select("user_id").in("role", ["tecnico", "coordenacao"]);
            if (tecRoles) {
              const { data: tecProfiles } = await supabase.from("profiles").select("id, user_id").in("user_id", tecRoles.map((r: any) => r.user_id));
              if (tecProfiles && criadorId) {
                const nomesParts = relato.participante_ids.map(pid => participantesTurma.find(p => p.id === pid)?.nome || "").filter(Boolean).join(", ");
                for (const tec of tecProfiles) {
                  if (tec.id !== criadorId) {
                    await supabase.from("recados").insert({
                      remetente_id: criadorId,
                      destinatario_id: tec.id,
                      conteudo: `⚠️ Relato técnico: ${relato.motivo}\nParticipantes: ${nomesParts}\n${relato.descricao}`,
                      tipo_recado: "tecnico",
                    } as any);
                  }
                }
              }
            }

            // Append to participantes observacoes_sigilosas
            const dataStr = format(form.data!, "dd/MM/yyyy");
            for (const pid of relato.participante_ids) {
              const { data: part } = await supabase.from("participantes").select("observacoes_sigilosas").eq("id", pid).single();
              const existing = part?.observacoes_sigilosas || "";
              const newEntry = `\n[${dataStr}] ${relato.motivo}: ${relato.descricao}`;
              await supabase.from("participantes").update({ observacoes_sigilosas: existing + newEntry }).eq("id", pid);
            }
          }
        }
      }

      toast.success("Relatório salvo!");

      // Fire-and-forget: generate AI results + auto-post to feed + check conquistas
      (async () => {
        try {
          let planData = null;
          if (form.planejamento_id) {
            const { data: p } = await supabase.from("planejamentos").select("titulo, tema, objetivos").eq("id", form.planejamento_id).single();
            planData = p;
          }
          const { data: aiData, error: aiErr } = await supabase.functions.invoke("generate-resultados-alcancados", {
            body: {
              relatorio: {
                nome_atividade: form.nome_atividade,
                tipo_atividade: form.tipo_atividade,
                objetivo_alcancado: form.objetivo_alcancado,
                score_elo: scoreElo,
                engajamento: form.engajamento,
                intervencoes: form.intervencoes,
                observacoes: form.observacoes,
                situacoes_relevantes: form.situacoes_relevantes,
              },
              planejamento: planData,
            },
          });
          if (!aiErr && aiData?.resultado) {
            await supabase.from("relatorios_atividade").update({ analise_ia: aiData.resultado }).eq("id", relId);
          }

          // Auto-post to feed with photos and AI Instagram text
          if (form.educador_id) {
            try {
              // Generate Instagram text
              const { data: igData } = await supabase.functions.invoke("generate-instagram-post", {
                body: {
                  relatorio: {
                    nome_atividade: form.nome_atividade,
                    tipo_atividade: form.tipo_atividade,
                    data: format(form.data!, "dd/MM/yyyy"),
                    observacoes: form.observacoes,
                    engajamento: form.engajamento,
                    score_elo: scoreElo,
                  },
                },
              });
              const feedContent = igData?.text || `📝 ${form.nome_atividade}\n\nRelatório de atividade registrado.`;

              const { data: feedPost } = await supabase.from("feed_posts").insert({
                autor_id: form.educador_id,
                conteudo: feedContent,
                tipo: "relatorio_auto" as any,
                relatorio_id: relId,
              }).select("id").single();

              // Copy report photos to feed
              if (feedPost) {
                const { data: relFotos } = await supabase.from("relatorio_fotos").select("foto_url, ordem").eq("relatorio_id", relId);
                if (relFotos && relFotos.length > 0) {
                  await supabase.from("feed_fotos").insert(
                    relFotos.map((f: any) => ({ feed_post_id: feedPost.id, foto_url: f.foto_url, ordem: f.ordem }))
                  );
                }

                // Check conquistas and append inline to the feed post
                try {
                  const earned = await checkConquistas({
                    educadorProfileId: form.educador_id,
                    relatorioId: relId,
                    scoreElo: parseFloat(scoreElo),
                    pctAdesao: Math.round(pctAdesao * 100) / 100,
                    iniciativa: form.iniciativa,
                    autonomia: form.autonomia,
                    colaboracao: form.colaboracao,
                    comunicacao: form.comunicacao,
                    respeito_mutuo: form.respeito_mutuo,
                  });
                  if (earned.length > 0) {
                    const conquText = `\n\n🏆 Conquistas desbloqueadas:\n${earned.map(e => `• ${e}`).join("\n")}`;
                    await supabase.from("feed_posts").update({
                      conteudo: feedContent + conquText,
                    }).eq("id", feedPost.id);
                  }
                } catch (e) {
                  console.warn("Falha ao verificar conquistas:", e);
                }
              }
            } catch (e) {
              console.warn("Falha ao criar post no feed:", e);
            }
          }
        } catch (e) {
          console.warn("Falha ao gerar análise IA:", e);
        }
      })();

      navigate("/relatorios");
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/relatorios"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <h1 className="text-xl font-semibold text-foreground">Novo Relatório de Atividade</h1>
      </div>

      {/* Info Geral */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Informações Gerais</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Data *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal text-sm", !form.data && "text-muted-foreground")}>
                    {form.data ? format(form.data, "dd/MM/yyyy") : "Selecionar"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={form.data || undefined} onSelect={d => {
                    if (d) {
                      const dias = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
                      setForm(f => ({ ...f, data: d, dia_semana: dias[d.getDay()] }));
                    }
                  }} defaultMonth={new Date()} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Dia da Semana</Label>
              <Input value={form.dia_semana} readOnly className="bg-muted/50 text-sm" />
            </div>
          </div>

          {/* Tipo de Atividade - multi-select */}
          <div className="space-y-1">
            <Label className="text-xs">Tipo de Atividade</Label>
            <div className="grid grid-cols-2 gap-2">
              {TIPOS_ATIVIDADE.map(ta => (
                <label key={ta.value} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={form.tipo_atividade.includes(ta.value)} onCheckedChange={() => toggleTipoAtividade(ta.value)} />
                  {ta.label}
                </label>
              ))}
            </div>
            {needsDetail && (
              <Input
                value={form.tipo_atividade_detalhe}
                onChange={e => setForm(f => ({ ...f, tipo_atividade_detalhe: e.target.value }))}
                placeholder="Especifique o nome do evento ou oficina"
                className="mt-2 text-sm"
              />
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Nome da Atividade *</Label>
              <Input value={form.nome_atividade} onChange={e => setForm(f => ({ ...f, nome_atividade: e.target.value }))} placeholder="Nome da atividade realizada" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Educador</Label>
              <Popover open={educadorOpen} onOpenChange={setEducadorOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" aria-expanded={educadorOpen} className="w-full justify-between text-sm font-normal">
                    {form.educador_id ? educadores.find(e => e.id === form.educador_id)?.nome || "Selecionar" : "Selecionar educador..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Buscar educador..." />
                    <CommandList>
                      <CommandEmpty>Nenhum educador encontrado.</CommandEmpty>
                      <CommandGroup>
                        {educadores.map(e => (
                          <CommandItem
                            key={e.id}
                            value={e.nome}
                            onSelect={() => {
                              setForm(f => ({ ...f, educador_id: e.id }));
                              setEducadorOpen(false);
                            }}
                          >
                            <Check className={cn("mr-2 h-4 w-4", form.educador_id === e.id ? "opacity-100" : "opacity-0")} />
                            {e.nome}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Planejamento Vinculado {form.educador_id ? "" : "(selecione educador para filtrar)"}</Label>
            <Select value={form.planejamento_id} onValueChange={handlePlanejamentoChange}>
              <SelectTrigger><SelectValue placeholder="Nenhum (opcional)" /></SelectTrigger>
              <SelectContent>{planejamentos.map(p => <SelectItem key={p.id} value={p.id}>{p.titulo}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Turmas */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Turmas e Período {form.educador_id && <span className="text-xs font-normal text-muted-foreground ml-2">★ = turmas do educador selecionado</span>}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {turmas.length === 0 ? <p className="text-xs text-muted-foreground">Nenhuma turma ativa</p> : (
            <>
              {/* Group by periodo */}
              {(["manha", "tarde", "integral"] as const).map(per => {
                const perTurmas = [...turmas].filter(t => (t.periodo || "manha") === per).sort((a, b) => {
                  if (!form.educador_id) return 0;
                  return (a.educador_id === form.educador_id ? 0 : 1) - (b.educador_id === form.educador_id ? 0 : 1);
                });
                if (perTurmas.length === 0) return null;
                const label = per === "manha" ? "Manhã" : per === "tarde" ? "Tarde" : "Integral";
                return (
                  <div key={per}>
                    <p className="text-xs font-medium text-muted-foreground mb-1">{label}</p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {perTurmas.map(t => {
                        const isLinked = form.educador_id && t.educador_id === form.educador_id;
                        return (
                          <label key={t.id} className={cn("flex items-center gap-2 text-sm cursor-pointer rounded-md px-2 py-1 transition-colors", isLinked && "bg-primary/10 ring-1 ring-primary/30 font-medium")}>
                            <Checkbox checked={form.turma_ids.includes(t.id)} onCheckedChange={() => toggleTurma(t.id)} />
                            {isLinked && <span className="text-primary text-xs">★</span>}
                            {t.nome}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </>
          )}

          {/* Período da Atividade */}
          {form.turma_ids.length > 0 && (
            <div className="space-y-1 pt-2 border-t">
              <Label className="text-xs">Período da Atividade {(() => {
                const selectedPeriodos = new Set(form.turma_ids.map(id => turmas.find(t => t.id === id)?.periodo || "manha"));
                return selectedPeriodos.size > 1 ? <span className="text-destructive">*</span> : null;
              })()}</Label>
              <Select value={form.periodo_atividade} onValueChange={v => setForm(f => ({ ...f, periodo_atividade: v }))}>
                <SelectTrigger className="text-sm"><SelectValue placeholder="Selecionar período" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="manha">Manhã</SelectItem>
                  <SelectItem value="tarde">Tarde</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">
                Participantes presentes com período diferente serão automaticamente transferidos.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Competências Likert */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Competências (Likert 1-5)</CardTitle>
            <div className="text-sm font-semibold text-primary">Score ELO: {scoreElo}</div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <LikertField label="Iniciativa" value={form.iniciativa} onChange={v => setForm(f => ({ ...f, iniciativa: v }))} />
          <LikertField label="Autonomia" value={form.autonomia} onChange={v => setForm(f => ({ ...f, autonomia: v }))} />
          <LikertField label="Colaboração" value={form.colaboracao} onChange={v => setForm(f => ({ ...f, colaboracao: v }))} />
          <LikertField label="Comunicação" value={form.comunicacao} onChange={v => setForm(f => ({ ...f, comunicacao: v }))} />
          <LikertField label="Respeito Mútuo" value={form.respeito_mutuo} onChange={v => setForm(f => ({ ...f, respeito_mutuo: v }))} />
        </CardContent>
      </Card>

      {/* Engajamento e Situações */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Observações da Atividade</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Engajamento dos Participantes</Label>
            <div className="grid grid-cols-2 gap-2">
              {ENGAJAMENTO_OPT.map(o => (
                <label key={o} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={form.engajamento.includes(o)} onCheckedChange={() => toggleEng(o)} />
                  {o}
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Situações Relevantes</Label>
            <div className="grid grid-cols-2 gap-2">
              {SITUACOES_OPT.map(o => (
                <label key={o} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={form.situacoes_relevantes.includes(o)} onCheckedChange={() => toggleSit(o)} />
                  {o}
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Objetivo Alcançado</Label>
            <Select value={form.objetivo_alcancado} onValueChange={v => setForm(f => ({ ...f, objetivo_alcancado: v }))}>
              <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="alcancado">Alcançado</SelectItem>
                <SelectItem value="parcial">Parcialmente</SelectItem>
                <SelectItem value="nao_alcancado">Não Alcançado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Atividades Realizadas</Label>
            <Textarea value={form.intervencoes} onChange={e => setForm(f => ({ ...f, intervencoes: e.target.value }))} rows={2} placeholder="Descreva as atividades realizadas" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Observações Gerais</Label>
            <Textarea value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} rows={2} placeholder="Observações adicionais" />
          </div>
        </CardContent>
      </Card>

      {/* Relato para Equipe Técnica */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" /> Relato para Equipe Técnica
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {relatos.length > 0 && (
            <div className="space-y-2 mb-3">
              {relatos.map((r, i) => (
                <div key={i} className="border rounded-md p-2 bg-amber-50 dark:bg-amber-950/20 text-sm">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="text-xs">{r.motivo}</Badge>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setRelatos(prev => prev.filter((_, j) => j !== i))}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{r.participante_ids.length} participante(s) • {r.descricao.slice(0, 80)}{r.descricao.length > 80 ? "..." : ""}</p>
                </div>
              ))}
            </div>
          )}
          <div className="space-y-2 border rounded-md p-3">
            <div className="space-y-1">
              <Label className="text-xs">Motivo</Label>
              <Select value={relatoForm.motivo} onValueChange={v => setRelatoForm(f => ({ ...f, motivo: v }))}>
                <SelectTrigger className="text-sm"><SelectValue placeholder="Selecione o motivo" /></SelectTrigger>
                <SelectContent>
                  {MOTIVOS_RELATO.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Participantes envolvidos</Label>
              {participantesTurma.length === 0 ? (
                <p className="text-xs text-muted-foreground">Selecione turmas primeiro</p>
              ) : (
                <div className="max-h-32 overflow-y-auto border rounded-md p-2 space-y-0.5">
                  {participantesTurma.map(p => (
                    <label key={p.id} className="flex items-center gap-2 text-xs cursor-pointer py-0.5">
                      <Checkbox
                        checked={relatoForm.participante_ids.includes(p.id)}
                        onCheckedChange={c => setRelatoForm(f => ({
                          ...f,
                          participante_ids: c ? [...f.participante_ids, p.id] : f.participante_ids.filter(x => x !== p.id),
                        }))}
                      />
                      {p.nome}
                    </label>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Descrição breve</Label>
              <Textarea value={relatoForm.descricao} onChange={e => setRelatoForm(f => ({ ...f, descricao: e.target.value }))} rows={2} placeholder="Descreva brevemente a situação" className="text-sm" />
            </div>
            <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={addRelato} type="button">
              <Plus className="h-3 w-3" /> Adicionar Relato
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Presença */}
      {participantesTurma.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Presença ({numParticipantes}/{participantesTurma.length})</CardTitle>
              <span className="text-xs text-muted-foreground">{pctAdesao.toFixed(0)}% adesão</span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 max-h-72 overflow-y-auto">
              {participantesTurma.map((p, idx) => {
                const presente = form.presenca[p.id] ?? false;
                return (
                  <div key={p.id} className="flex items-center gap-2 py-1.5 border-b border-border/50 last:border-0">
                    <span className="text-xs text-muted-foreground w-6 text-right">{idx + 1}.</span>
                    <Checkbox
                      checked={presente}
                      onCheckedChange={c => {
                        setForm(f => ({
                          ...f,
                          presenca: { ...f.presenca, [p.id]: !!c },
                          justificativas: c ? (() => { const j = { ...f.justificativas }; delete j[p.id]; return j; })() : f.justificativas,
                        }));
                      }}
                    />
                    <span className={cn("text-sm flex-1", !presente && "text-muted-foreground line-through")}>{p.nome}</span>
                    {form.periodo_atividade && p.periodo && p.periodo !== form.periodo_atividade && (
                      <Badge variant="outline" className="text-[9px] shrink-0 border-amber-400 text-amber-600">
                        {p.periodo === "manha" ? "Manhã" : "Tarde"} → {form.periodo_atividade === "manha" ? "Manhã" : "Tarde"}
                      </Badge>
                    )}
                    {!presente && (
                      <Input
                        value={form.justificativas[p.id] || ""}
                        onChange={e => setForm(f => ({ ...f, justificativas: { ...f.justificativas, [p.id]: e.target.value.slice(0, 60) } }))}
                        placeholder="Justificativa (opcional)"
                        className="max-w-[200px] h-7 text-xs"
                        maxLength={60}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Fotos */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Fotos (máx. 5)</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <div className="flex gap-2 flex-wrap">
            {fotos.map((f, i) => (
              <div key={i} className="relative w-20 h-20 rounded border overflow-hidden">
                <img src={URL.createObjectURL(f)} alt="" className="w-full h-full object-cover" />
                <button onClick={() => setFotos(prev => prev.filter((_, j) => j !== i))} className="absolute top-0 right-0 bg-destructive text-destructive-foreground rounded-bl p-0.5">
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
          {fotos.length < 5 && (
            <label className="inline-flex items-center gap-1 text-sm text-primary cursor-pointer hover:underline">
              <Upload className="h-4 w-4" /> Adicionar foto
              <input type="file" accept="image/*" onChange={handleFotos} className="hidden" />
            </label>
          )}
        </CardContent>
      </Card>

      <div className="flex gap-2 pb-4">
        <Button onClick={handleSave} disabled={saving} className="gap-1">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar Relatório
        </Button>
        <Button variant="outline" asChild><Link to="/relatorios">Cancelar</Link></Button>
      </div>
    </div>
  );
};

export default RelatorioNovoPage;
