import { supabase } from "@/integrations/supabase/client";

interface ConquistaCheck {
  educadorProfileId: string;
  relatorioId: string;
  scoreElo: number;
  pctAdesao: number;
  iniciativa: number;
  autonomia: number;
  colaboracao: number;
  comunicacao: number;
  respeito_mutuo: number;
}

const CONQUISTAS = [
  { tipo: "primeiro_relatorio", label: "🎯 Primeiro Relatório!", desc: "Salvou seu primeiro relatório de atividade" },
  { tipo: "escritor_10", label: "📝 Escritor Dedicado", desc: "10 relatórios registrados", nivel: 1 },
  { tipo: "escritor_25", label: "📝 Escritor Dedicado II", desc: "25 relatórios registrados", nivel: 2 },
  { tipo: "escritor_50", label: "📝 Escritor Dedicado III", desc: "50 relatórios registrados", nivel: 3 },
  { tipo: "escritor_100", label: "📝 Mestre dos Relatórios", desc: "100 relatórios registrados", nivel: 4 },
  { tipo: "elo_ouro", label: "⭐ ELO de Ouro", desc: "Score ELO ≥ 4.0 em um relatório" },
  { tipo: "adesao_100", label: "📊 100% Adesão", desc: "Adesão de 100% em um relatório" },
  { tipo: "engajamento_total", label: "🤝 Engajamento Total", desc: "Todos indicadores ELO ≥ 4 em um relatório" },
  { tipo: "turma_completa", label: "👥 Turma Completa", desc: "Todos os matriculados presentes" },
  { tipo: "primeiro_post_feed", label: "📢 Primeira Publicação!", desc: "Postou no feed pela primeira vez" },
  { tipo: "comunicador_10", label: "💬 Comunicador Ativo", desc: "10 posts no feed" },
  { tipo: "recado_respondido", label: "✅ Responsável", desc: "Respondeu/concluiu 10 recados técnicos" },
  { tipo: "streak_7", label: "🔥 Semana de Fogo!", desc: "7 dias consecutivos de atividade no feed" },
  { tipo: "streak_30", label: "🔥 Mês Imparável!", desc: "30 dias consecutivos de atividade no feed" },
];

async function awardConquista(perfilId: string, tipo: string, nivel: number = 1): Promise<string | null> {
  const { data: existing } = await supabase
    .from("conquistas")
    .select("id")
    .eq("perfil_id", perfilId)
    .eq("tipo", tipo)
    .eq("nivel", nivel)
    .maybeSingle();

  if (existing) return null;

  const { error } = await supabase.from("conquistas").insert({
    perfil_id: perfilId,
    tipo,
    nivel,
  });
  if (error) { console.warn("Erro ao criar conquista:", error); return null; }

  const def = CONQUISTAS.find(c => c.tipo === tipo);
  return def ? `${def.label} — ${def.desc}` : tipo;
}

export async function checkConquistas(check: ConquistaCheck): Promise<string[]> {
  const { educadorProfileId: pid, scoreElo, pctAdesao, iniciativa, autonomia, colaboracao, comunicacao, respeito_mutuo } = check;
  const earned: string[] = [];

  const { count } = await supabase
    .from("relatorios_atividade")
    .select("id", { count: "exact", head: true })
    .eq("educador_id", pid);
  const total = count || 0;

  if (total === 1) {
    const r = await awardConquista(pid, "primeiro_relatorio");
    if (r) earned.push(r);
  }

  const thresholds = [
    { count: 10, tipo: "escritor_10", nivel: 1 },
    { count: 25, tipo: "escritor_25", nivel: 2 },
    { count: 50, tipo: "escritor_50", nivel: 3 },
    { count: 100, tipo: "escritor_100", nivel: 4 },
  ];
  for (const t of thresholds) {
    if (total >= t.count) {
      const r = await awardConquista(pid, t.tipo, t.nivel);
      if (r) earned.push(r);
    }
  }

  if (scoreElo >= 4.0) {
    const r = await awardConquista(pid, "elo_ouro");
    if (r) earned.push(r);
  }

  if (pctAdesao >= 100) {
    const r = await awardConquista(pid, "adesao_100");
    if (r) earned.push(r);
  }

  if (iniciativa >= 4 && autonomia >= 4 && colaboracao >= 4 && comunicacao >= 4 && respeito_mutuo >= 4) {
    const r = await awardConquista(pid, "engajamento_total");
    if (r) earned.push(r);
  }

  if (pctAdesao >= 100) {
    const r = await awardConquista(pid, "turma_completa");
    if (r) earned.push(r);
  }

  // No longer creates separate feed posts — earned conquistas are returned
  // and appended inline to the activity's auto-post
  return earned;
}

/** Check communication-based conquistas (feed posts, recados) */
export async function checkCommunicationConquistas(profileId: string): Promise<string[]> {
  const earned: string[] = [];

  // Count feed posts
  const { count: feedCount } = await supabase
    .from("feed_posts")
    .select("id", { count: "exact", head: true })
    .eq("autor_id", profileId);
  const totalPosts = feedCount || 0;

  if (totalPosts === 1) {
    const r = await awardConquista(profileId, "primeiro_post_feed");
    if (r) earned.push(r);
  }
  if (totalPosts >= 10) {
    const r = await awardConquista(profileId, "comunicador_10");
    if (r) earned.push(r);
  }

  // Count concluded recados
  const { count: recadoCount } = await supabase
    .from("recados")
    .select("id", { count: "exact", head: true })
    .eq("destinatario_id", profileId)
    .eq("status", "concluido");
  if ((recadoCount || 0) >= 10) {
    const r = await awardConquista(profileId, "recado_respondido");
    if (r) earned.push(r);
  }

  // Calculate streak from feed_posts and feed_comentarios
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 30);
  const { data: recentPosts } = await supabase
    .from("feed_posts")
    .select("created_at")
    .eq("autor_id", profileId)
    .gte("created_at", sevenDaysAgo.toISOString());
  const { data: recentComments } = await supabase
    .from("feed_comentarios")
    .select("created_at")
    .eq("autor_id", profileId)
    .gte("created_at", sevenDaysAgo.toISOString());

  const activeDays = new Set<string>();
  [...(recentPosts || []), ...(recentComments || [])].forEach((item: any) => {
    activeDays.add(item.created_at.slice(0, 10));
  });

  // Count consecutive days ending today
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 31; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    if (activeDays.has(key)) streak++;
    else break;
  }

  if (streak >= 7) {
    const r = await awardConquista(profileId, "streak_7");
    if (r) earned.push(r);
  }
  if (streak >= 30) {
    const r = await awardConquista(profileId, "streak_30");
    if (r) earned.push(r);
  }

  return earned;
}
