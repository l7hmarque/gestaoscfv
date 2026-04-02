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
];

async function awardConquista(perfilId: string, tipo: string, nivel: number = 1): Promise<string | null> {
  const { data: existing } = await supabase
    .from("conquistas")
    .select("id")
    .eq("perfil_id", perfilId)
    .eq("tipo", tipo)
    .eq("nivel", nivel)
    .maybeSingle();

  if (existing) return null; // Already earned

  const { error } = await supabase.from("conquistas").insert({
    perfil_id: perfilId,
    tipo,
    nivel,
  });
  if (error) { console.warn("Erro ao criar conquista:", error); return null; }

  const def = CONQUISTAS.find(c => c.tipo === tipo);
  return def ? `${def.label} — ${def.desc}` : tipo;
}

async function postConquistaToFeed(perfilId: string, text: string) {
  await supabase.from("feed_posts").insert({
    autor_id: perfilId,
    conteudo: `🏆 Conquista desbloqueada!\n\n${text}`,
    tipo: "conquista" as any,
  });
}

export async function checkConquistas(check: ConquistaCheck) {
  const { educadorProfileId: pid, scoreElo, pctAdesao, iniciativa, autonomia, colaboracao, comunicacao, respeito_mutuo } = check;
  const earned: string[] = [];

  // Count total reports by this educator
  const { count } = await supabase
    .from("relatorios_atividade")
    .select("id", { count: "exact", head: true })
    .eq("educador_id", pid);
  const total = count || 0;

  // First report
  if (total === 1) {
    const r = await awardConquista(pid, "primeiro_relatorio");
    if (r) earned.push(r);
  }

  // Progressive writer
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

  // ELO de Ouro
  if (scoreElo >= 4.0) {
    const r = await awardConquista(pid, "elo_ouro");
    if (r) earned.push(r);
  }

  // 100% Adesão
  if (pctAdesao >= 100) {
    const r = await awardConquista(pid, "adesao_100");
    if (r) earned.push(r);
  }

  // Engajamento Total (all indicators >= 4)
  if (iniciativa >= 4 && autonomia >= 4 && colaboracao >= 4 && comunicacao >= 4 && respeito_mutuo >= 4) {
    const r = await awardConquista(pid, "engajamento_total");
    if (r) earned.push(r);
  }

  // Turma Completa
  if (pctAdesao >= 100) {
    const r = await awardConquista(pid, "turma_completa");
    if (r) earned.push(r);
  }

  // Post conquistas to feed
  for (const text of earned) {
    await postConquistaToFeed(pid, text);
  }

  return earned;
}
