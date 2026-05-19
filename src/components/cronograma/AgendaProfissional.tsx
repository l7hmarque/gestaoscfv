import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Users, User, Music, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const DIAS = ["Seg", "Ter", "Qua", "Qui", "Sex"] as const;
const PERIODOS = ["manha", "tarde"] as const;
const PERIODO_LBL: Record<string, string> = { manha: "Manhã", tarde: "Tarde" };

interface Props { profileId: string; }

export function AgendaProfissional({ profileId }: Props) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [cenario, setCenario] = useState<any>(null);
  const [slots, setSlots] = useState<any[]>([]);
  const [slotProfs, setSlotProfs] = useState<any[]>([]);
  const [atividades, setAtividades] = useState<any[]>([]);
  const [bairros, setBairros] = useState<any[]>([]);
  const [turmas, setTurmas] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [intervencoes, setIntervencoes] = useState<any[]>([]);
  const [cientes, setCientes] = useState<any[]>([]);

  const load = async () => {
    setLoading(true);
    const { data: cen } = await supabase.from("cronograma_cenarios")
      .select("*").eq("ativo", true).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!cen) { setLoading(false); return; }
    setCenario(cen);

    const [b, t, p, sl, sp, at, iv, ci] = await Promise.all([
      supabase.from("bairros").select("id, nome"),
      supabase.from("turmas").select("id, nome, periodo"),
      supabase.from("profiles").select("id, nome, cargo"),
      supabase.from("cronograma_slots").select("*").eq("cenario_id", cen.id),
      supabase.from("cronograma_slot_profissionais").select("*"),
      supabase.from("cronograma_atividades_manuais").select("*").eq("cenario_id", cen.id),
      supabase.from("cronograma_intervencoes").select("*").or(`profissionais.cs.{${profileId}},profissionais.eq.{}`),
      supabase.from("cronograma_intervencao_cientes").select("*").eq("profile_id", profileId),
    ]);
    setBairros(b.data || []);
    setTurmas(t.data || []);
    setProfiles(p.data || []);
    setSlots(sl.data || []);
    setSlotProfs(sp.data || []);
    setAtividades(at.data || []);
    setIntervencoes(iv.data || []);
    setCientes(ci.data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [profileId]);

  // Índices para evitar filter() por célula no grid (5 dias × 2 períodos)
  const slotProfsBySlot = useMemo(() => {
    const m = new Map<string, any[]>();
    slotProfs.forEach(sp => {
      const arr = m.get(sp.slot_id); if (arr) arr.push(sp); else m.set(sp.slot_id, [sp]);
    });
    return m;
  }, [slotProfs]);
  const profileById = useMemo(() => new Map(profiles.map(p => [p.id, p])), [profiles]);
  const bairroById = useMemo(() => new Map(bairros.map(b => [b.id, b])), [bairros]);
  const turmaById = useMemo(() => new Map(turmas.map(t => [t.id, t])), [turmas]);

  const meusSlots = useMemo(() => slots.filter(s => {
    const sps = slotProfsBySlot.get(s.id) || [];
    return sps.some(x => x.profile_id === profileId)
      || s.educador_id === profileId || s.oficineiro_id === profileId;
  }), [slots, slotProfsBySlot, profileId]);

  const slotsByCell = useMemo(() => {
    const m = new Map<string, any[]>();
    meusSlots.forEach(s => {
      const k = `${s.dia_semana}|${s.periodo}`;
      const arr = m.get(k); if (arr) arr.push(s); else m.set(k, [s]);
    });
    return m;
  }, [meusSlots]);

  const atividadesByCell = useMemo(() => {
    const m = new Map<string, any[]>();
    atividades.forEach(a => {
      const k = `${a.dia_semana}|${a.periodo}`;
      const arr = m.get(k); if (arr) arr.push(a); else m.set(k, [a]);
    });
    return m;
  }, [atividades]);

  const meuNome = profileById.get(profileId)?.nome;

  const intervencoesPendentes = intervencoes.filter(iv => {
    const visivelPraMim = !iv.profissionais?.length || iv.profissionais.includes(profileId);
    if (!visivelPraMim) return false;
    const jaCiente = cientes.some(c => c.intervencao_id === iv.id);
    return !jaCiente;
  });

  const marcarCiente = async (intervencaoId: string) => {
    const { error } = await supabase.from("cronograma_intervencao_cientes")
      .insert({ intervencao_id: intervencaoId, profile_id: profileId });
    if (error) { toast.error(error.message); return; }
    toast.success("Ciência registrada!");
    load();
  };

  if (loading) return <div className="text-xs text-muted-foreground">Carregando agenda...</div>;
  if (!cenario) return <div className="text-xs text-muted-foreground">Nenhum cronograma ativo.</div>;

  return (
    <div className="space-y-3">
      {intervencoesPendentes.length > 0 && (
        <div className="border-2 border-destructive bg-destructive/5 rounded p-3 space-y-2 animate-pulse-once">
          <div className="flex items-center gap-2 text-destructive font-semibold text-sm">
            <AlertCircle className="h-4 w-4" /> {intervencoesPendentes.length} intervenção(ões) pendente(s) de ciência
          </div>
          {intervencoesPendentes.map(iv => (
            <div key={iv.id} className="border border-destructive/30 rounded p-2 bg-background space-y-1">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <p className="text-sm font-medium">{iv.titulo}</p>
                  {iv.descricao && <p className="text-xs text-muted-foreground whitespace-pre-wrap">{iv.descricao}</p>}
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {new Date(iv.data_inicio).toLocaleDateString("pt-BR")}
                    {iv.data_fim ? ` — ${new Date(iv.data_fim).toLocaleDateString("pt-BR")}` : ""}
                  </p>
                </div>
                <Button size="sm" onClick={() => marcarCiente(iv.id)} className="h-7 text-xs">
                  Marcar ciente
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="overflow-x-auto">
        <div className="grid grid-cols-[80px_repeat(5,minmax(120px,1fr))] gap-px text-xs min-w-[700px]">
          <div className="bg-muted/50 px-2 py-1 font-semibold">Período</div>
          {DIAS.map(d => <div key={d} className="bg-muted/60 px-2 py-1 font-bold text-center">{d}</div>)}
          {PERIODOS.map(per => (
            <>
              <div key={per} className="bg-muted/30 px-2 py-2 font-medium">{PERIODO_LBL[per]}</div>
              {DIAS.map(dia => {
                const cellSlots = slotsByCell.get(`${dia}|${per}`) || [];
                const cellAtv = atividadesByCell.get(`${dia}|${per}`) || [];
                return (
                  <div key={`${dia}-${per}`} className="border border-border/40 rounded-sm bg-background p-1 min-h-[60px] space-y-0.5">
                    {cellSlots.map(s => {
                      const bairro = s.bairro_id ? bairroById.get(s.bairro_id) : undefined;
                      const turma = s.turma_id ? turmaById.get(s.turma_id) : undefined;
                      const sps = slotProfsBySlot.get(s.id) || [];
                      const colegas = sps
                        .map((x: any) => profileById.get(x.profile_id)?.nome)
                        .filter(Boolean)
                        .filter((n: string) => n !== meuNome);
                      return (
                        <div key={s.id} className="bg-blue-50 border border-blue-200 rounded p-1">
                          {bairro && <p className="text-[10px] font-semibold text-blue-900">{bairro.nome}</p>}
                          {turma && <p className="text-[10px] text-blue-700 flex items-center gap-0.5"><Users className="h-2.5 w-2.5"/>{turma.nome}</p>}
                          {colegas.length > 0 && <p className="text-[9px] text-muted-foreground">c/ {colegas.join(", ")}</p>}
                          {s.notas && <p className="text-[9px] italic">{s.notas}</p>}
                        </div>
                      );
                    })}
                    {cellAtv.map(a => (
                      <div key={a.id} className="bg-amber-50 border border-amber-200 rounded p-1 text-[10px]">
                        <span className="font-medium">{a.titulo}</span>
                        {(a.horario_inicio || a.horario_fim) && <span className="text-muted-foreground ml-1">{a.horario_inicio}{a.horario_fim ? `–${a.horario_fim}` : ""}</span>}
                      </div>
                    ))}
                    {!cellSlots.length && !cellAtv.length && <span className="text-[9px] text-muted-foreground/40 italic">—</span>}
                  </div>
                );
              })}
            </>
          ))}
        </div>
      </div>
    </div>
  );
}
