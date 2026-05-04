import { supabase } from "@/integrations/supabase/client";

export type IndicadorId =
  | "participantes"
  | "frequencia"
  | "turmas"
  | "relatorios"
  | "planejamentos"
  | "elo"
  | "adesao"
  | "educadores";

export interface ContextoLinha {
  campo: string;
  valor: string;
  link?: string;
}

export interface EventoTecnico {
  data: string; // ISO
  tipo: string; // matricula | desligamento | abertura | encerramento | mes | ...
  delta?: number;
  valorApos?: number;
  titulo: string;
  contexto: ContextoLinha[];
  autor?: string;
}

export interface PontoSerie {
  label: string;
  value: number;
  date: string; // ISO
}

export interface TimelineResult {
  pontos: PontoSerie[];
  eventos: EventoTecnico[];
  stats: { min: number; max: number; media: number; mediana: number };
  unidade?: string;
}

function calcStats(values: number[]) {
  if (!values.length) return { min: 0, max: 0, media: 0, mediana: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const media = values.reduce((a, b) => a + b, 0) / values.length;
  const mid = Math.floor(sorted.length / 2);
  const mediana = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  return { min, max, media: +media.toFixed(2), mediana: +mediana.toFixed(2) };
}

function calcAge(birth: string | null | undefined): number | null {
  if (!birth) return null;
  const d = new Date(birth + "T12:00:00");
  if (isNaN(d.getTime())) return null;
  const diff = Date.now() - d.getTime();
  return Math.floor(diff / (365.25 * 24 * 3600 * 1000));
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function monthKey(d: Date): string {
  return d.toISOString().slice(0, 7);
}

function monthLabel(key: string): string {
  const [y, m] = key.split("-");
  const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${meses[Number(m) - 1]}/${y.slice(2)}`;
}

/* ─────── PARTICIPANTES ─────── */
async function fetchParticipantes(): Promise<TimelineResult> {
  const since = new Date();
  since.setDate(since.getDate() - 60);
  const sinceISO = ymd(since);

  // Total ativo HOJE (ponto âncora para reconstruir a série retroativa)
  const { count: ativosHojeCount } = await supabase
    .from("participantes")
    .select("id", { count: "exact", head: true })
    .is("data_desligamento", null)
    .neq("status", "desligado")
    .eq("is_teste", false);

  // 1) Matrículas com iniciou_em no período
  const { data: matriculasA } = await supabase
    .from("participantes")
    .select("id, nome_completo, data_nascimento, iniciou_em, created_at, periodo, bairros(nome), origem_encaminhamento, status, data_desligamento")
    .gte("iniciou_em", sinceISO)
    .eq("is_teste", false)
    .order("iniciou_em", { ascending: false })
    .limit(400);

  // 2) Fallback: cadastros recentes sem iniciou_em (registros incompletos),
  //    usar created_at como data efetiva da matrícula.
  const { data: matriculasB } = await supabase
    .from("participantes")
    .select("id, nome_completo, data_nascimento, iniciou_em, created_at, periodo, bairros(nome), origem_encaminhamento, status, data_desligamento")
    .is("iniciou_em", null)
    .gte("created_at", since.toISOString())
    .eq("is_teste", false)
    .order("created_at", { ascending: false })
    .limit(400);

  // Une e deduplica por id
  const mapMatriculas = new Map<string, any>();
  [...(matriculasA || []), ...(matriculasB || [])].forEach((m: any) => {
    if (!mapMatriculas.has(m.id)) mapMatriculas.set(m.id, m);
  });
  const matriculas = Array.from(mapMatriculas.values());

  // Desligamentos no período
  const { data: desligamentos } = await supabase
    .from("participantes")
    .select("id, nome_completo, data_nascimento, data_desligamento, motivo_desligamento, justificativa_desligamento, periodo, bairros(nome), iniciou_em")
    .gte("data_desligamento", sinceISO)
    .eq("is_teste", false)
    .order("data_desligamento", { ascending: false })
    .limit(400);

  // Transferências aprovadas (movimentação, delta 0)
  const { data: transferencias } = await supabase
    .from("participante_transferencias" as any)
    .select("id, participante_id, data_transferencia, motivo, turma_origem:turma_origem_id(nome), turma_destino:turma_destino_id(nome), participantes:participante_id(nome_completo, data_nascimento)")
    .gte("data_transferencia", sinceISO)
    .order("data_transferencia", { ascending: false })
    .limit(200);

  type Ev = { dataISO: string; delta: number; ev: EventoTecnico };
  const evs: Ev[] = [];

  matriculas.forEach((p: any) => {
    const idade = calcAge(p.data_nascimento);
    const dataEfetiva: string = p.iniciou_em || (p.created_at ? String(p.created_at).slice(0, 10) : ymd(new Date()));
    const inferida = !p.iniciou_em;
    const ctx: ContextoLinha[] = [
      { campo: "Participante", valor: `${p.nome_completo}${idade != null ? ` (${idade}a)` : ""}`, link: `/participantes/${p.id}` },
      { campo: "Bairro", valor: p.bairros?.nome || "—" },
      { campo: "Período", valor: p.periodo || "—" },
      { campo: "Origem", valor: p.origem_encaminhamento || "—" },
      { campo: "Status atual", valor: p.status || "—" },
    ];
    if (inferida) {
      ctx.push({ campo: "Data efetiva", valor: "Inferida do cadastro (sem iniciou_em registrado)" });
    }
    evs.push({
      dataISO: dataEfetiva,
      delta: 1,
      ev: {
        data: dataEfetiva,
        tipo: "matricula",
        delta: 1,
        titulo: "MATRÍCULA",
        contexto: ctx,
      },
    });
  });

  (desligamentos || []).forEach((p: any) => {
    const idade = calcAge(p.data_nascimento);
    let permanencia = "—";
    if (p.iniciou_em && p.data_desligamento) {
      const meses = Math.max(
        0,
        Math.round(
          (new Date(p.data_desligamento).getTime() - new Date(p.iniciou_em).getTime()) /
            (30 * 24 * 3600 * 1000)
        )
      );
      permanencia = `${meses} ${meses === 1 ? "mês" : "meses"}`;
    }
    evs.push({
      dataISO: p.data_desligamento,
      delta: -1,
      ev: {
        data: p.data_desligamento,
        tipo: "desligamento",
        delta: -1,
        titulo: "DESLIGAMENTO",
        contexto: [
          { campo: "Participante", valor: `${p.nome_completo}${idade != null ? ` (${idade}a)` : ""}`, link: `/participantes/${p.id}` },
          { campo: "Bairro", valor: p.bairros?.nome || "—" },
          { campo: "Período", valor: p.periodo || "—" },
          { campo: "Motivo", valor: p.motivo_desligamento || "—" },
          ...(p.justificativa_desligamento ? [{ campo: "Justificativa", valor: p.justificativa_desligamento }] : []),
          { campo: "Permanência no SCFV", valor: permanencia },
        ],
      },
    });
  });

  (transferencias || []).forEach((t: any) => {
    const idade = calcAge(t.participantes?.data_nascimento);
    evs.push({
      dataISO: t.data_transferencia,
      delta: 0,
      ev: {
        data: t.data_transferencia,
        tipo: "transferencia",
        titulo: "TRANSFERÊNCIA",
        contexto: [
          {
            campo: "Participante",
            valor: `${t.participantes?.nome_completo || "—"}${idade != null ? ` (${idade}a)` : ""}`,
            link: t.participante_id ? `/participantes/${t.participante_id}` : undefined,
          },
          { campo: "Origem", valor: t.turma_origem?.nome || "—" },
          { campo: "Destino", valor: t.turma_destino?.nome || "—" },
          { campo: "Motivo", valor: t.motivo || "—" },
        ],
      },
    });
  });

  // Reconstrói série diária reversa
  evs.sort((a, b) => (a.dataISO < b.dataISO ? 1 : -1));
  const totalHoje = ativosHojeCount ?? 0;

  // Mapa data -> delta acumulado
  const deltaPorDia = new Map<string, number>();
  evs.forEach((e) => {
    deltaPorDia.set(e.dataISO, (deltaPorDia.get(e.dataISO) ?? 0) + e.delta);
  });

  const pontos: PontoSerie[] = [];
  let valor = totalHoje;
  for (let i = 0; i <= 60; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = ymd(d);
    pontos.unshift({ label: key.slice(5), value: valor, date: key });
    valor -= deltaPorDia.get(key) ?? 0;
  }

  // Atribui valorApos a cada evento
  let acumulado = totalHoje;
  const eventosOrdenados = [...evs];
  eventosOrdenados.forEach((e) => {
    e.ev.valorApos = acumulado;
    acumulado -= e.delta;
  });

  return {
    pontos,
    eventos: eventosOrdenados.map((e) => e.ev),
    stats: calcStats(pontos.map((p) => p.value)),
  };
}

/* ─────── FREQUÊNCIA (% mensal) ─────── */
async function fetchFrequencia(): Promise<TimelineResult> {
  const since = new Date();
  since.setMonth(since.getMonth() - 12);
  const { data } = await supabase
    .from("relatorios_atividade")
    .select("data, num_participantes, num_matriculados, nome_atividade, id")
    .gte("data", ymd(since))
    .order("data", { ascending: true });

  const meses = new Map<string, { presentes: number; esperados: number; relatorios: number }>();
  (data || []).forEach((r: any) => {
    const k = (r.data as string).slice(0, 7);
    const m = meses.get(k) || { presentes: 0, esperados: 0, relatorios: 0 };
    m.presentes += Number(r.num_participantes || 0);
    m.esperados += Number(r.num_matriculados || 0);
    m.relatorios += 1;
    meses.set(k, m);
  });

  const keys = Array.from(meses.keys()).sort();
  const pontos: PontoSerie[] = keys.map((k) => {
    const m = meses.get(k)!;
    const pct = m.esperados > 0 ? (m.presentes / m.esperados) * 100 : 0;
    return { label: monthLabel(k), value: +pct.toFixed(1), date: k + "-01" };
  });

  const eventos: EventoTecnico[] = keys
    .slice()
    .reverse()
    .map((k) => {
      const m = meses.get(k)!;
      const pct = m.esperados > 0 ? (m.presentes / m.esperados) * 100 : 0;
      return {
        data: k + "-01",
        tipo: "mes",
        valorApos: +pct.toFixed(1),
        titulo: `FREQUÊNCIA — ${monthLabel(k)}`,
        contexto: [
          { campo: "% Presença", valor: `${pct.toFixed(1)}%` },
          { campo: "Presentes", valor: String(m.presentes) },
          { campo: "Esperados", valor: String(m.esperados) },
          { campo: "Relatórios computados", valor: String(m.relatorios) },
        ],
      };
    });

  return { pontos, eventos, stats: calcStats(pontos.map((p) => p.value)), unidade: "%" };
}

/* ─────── TURMAS ─────── */
async function fetchTurmas(): Promise<TimelineResult> {
  const since = new Date();
  since.setMonth(since.getMonth() - 12);

  const { data: turmas } = await supabase
    .from("turmas")
    .select("id, nome, faixa_etaria, periodo, ativa, created_at, bairros:bairro_id(nome), profiles:educador_id(nome)")
    .gte("created_at", since.toISOString())
    .order("created_at", { ascending: false })
    .limit(100);

  const eventos: EventoTecnico[] = (turmas || []).map((t: any) => ({
    data: t.created_at,
    tipo: t.ativa ? "abertura" : "encerramento",
    delta: t.ativa ? 1 : -1,
    titulo: t.ativa ? "TURMA ABERTA" : "TURMA ENCERRADA",
    contexto: [
      { campo: "Turma", valor: t.nome, link: `/turmas/${t.id}` },
      { campo: "Faixa", valor: t.faixa_etaria || "—" },
      { campo: "Bairro", valor: t.bairros?.nome || "—" },
      { campo: "Período", valor: t.periodo || "—" },
      { campo: "Educador", valor: t.profiles?.nome || "—" },
    ],
  }));

  // Série mensal: turmas ativas no fim de cada mês (aproximação por created_at + ativa)
  const meses = new Map<string, number>();
  (turmas || []).forEach((t: any) => {
    const k = (t.created_at as string).slice(0, 7);
    meses.set(k, (meses.get(k) ?? 0) + 1);
  });
  const keys = Array.from(meses.keys()).sort();
  const pontos: PontoSerie[] = keys.map((k) => ({
    label: monthLabel(k),
    value: meses.get(k)!,
    date: k + "-01",
  }));

  return { pontos, eventos, stats: calcStats(pontos.map((p) => p.value)) };
}

/* ─────── RELATÓRIOS ─────── */
async function fetchRelatorios(): Promise<TimelineResult> {
  const since = new Date();
  since.setMonth(since.getMonth() - 12);
  const { data } = await supabase
    .from("relatorios_atividade")
    .select("id, data, score_elo, pct_adesao, nome_atividade, profiles:educador_id(nome)")
    .gte("data", ymd(since))
    .order("data", { ascending: true });

  const meses = new Map<
    string,
    { count: number; eloSum: number; eloN: number; adeSum: number; adeN: number; porEdu: Map<string, number>; porAtiv: Map<string, number> }
  >();
  (data || []).forEach((r: any) => {
    const k = (r.data as string).slice(0, 7);
    const m = meses.get(k) || {
      count: 0,
      eloSum: 0,
      eloN: 0,
      adeSum: 0,
      adeN: 0,
      porEdu: new Map(),
      porAtiv: new Map(),
    };
    m.count++;
    if (r.score_elo != null) {
      m.eloSum += Number(r.score_elo);
      m.eloN++;
    }
    if (r.pct_adesao != null) {
      m.adeSum += Number(r.pct_adesao);
      m.adeN++;
    }
    const edu = r.profiles?.nome || "—";
    m.porEdu.set(edu, (m.porEdu.get(edu) ?? 0) + 1);
    const ativ = r.nome_atividade || "—";
    m.porAtiv.set(ativ, (m.porAtiv.get(ativ) ?? 0) + 1);
    meses.set(k, m);
  });

  const keys = Array.from(meses.keys()).sort();
  const pontos: PontoSerie[] = keys.map((k) => ({
    label: monthLabel(k),
    value: meses.get(k)!.count,
    date: k + "-01",
  }));

  const eventos: EventoTecnico[] = keys
    .slice()
    .reverse()
    .map((k) => {
      const m = meses.get(k)!;
      const topEdu = Array.from(m.porEdu.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([n, c]) => `${n} (${c})`)
        .join(", ");
      const topAtiv = Array.from(m.porAtiv.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 1)
        .map(([n, c]) => `${n} (${c})`)
        .join(", ");
      return {
        data: k + "-01",
        tipo: "mes",
        valorApos: m.count,
        titulo: `RELATÓRIOS — ${monthLabel(k)}`,
        contexto: [
          { campo: "Total", valor: String(m.count) },
          { campo: "Média ELO", valor: m.eloN ? (m.eloSum / m.eloN).toFixed(2) : "—" },
          { campo: "Média Adesão", valor: m.adeN ? `${(m.adeSum / m.adeN).toFixed(0)}%` : "—" },
          { campo: "Top educadores", valor: topEdu || "—" },
          { campo: "Atividade destaque", valor: topAtiv || "—" },
        ],
      };
    });

  return { pontos, eventos, stats: calcStats(pontos.map((p) => p.value)) };
}

/* ─────── PLANEJAMENTOS ─────── */
async function fetchPlanejamentos(): Promise<TimelineResult> {
  const since = new Date();
  since.setMonth(since.getMonth() - 12);
  const { data } = await supabase
    .from("planejamentos")
    .select("id, titulo, tema, tipo_atividade, created_at, profiles:educador_id(nome), objetivos")
    .gte("created_at", since.toISOString())
    .order("created_at", { ascending: false })
    .limit(150);

  const eventos: EventoTecnico[] = (data || []).map((p: any) => ({
    data: p.created_at,
    tipo: "registro",
    delta: 1,
    titulo: "PLANEJAMENTO",
    contexto: [
      { campo: "Título", valor: p.titulo || "—", link: `/planejamentos/${p.id}` },
      { campo: "Tema", valor: p.tema || "—" },
      { campo: "Tipo", valor: p.tipo_atividade || "—" },
      { campo: "Autor", valor: p.profiles?.nome || "—" },
      { campo: "Objetivos", valor: String(Array.isArray(p.objetivos) ? p.objetivos.length : 0) },
    ],
  }));

  const meses = new Map<string, number>();
  (data || []).forEach((p: any) => {
    const k = (p.created_at as string).slice(0, 7);
    meses.set(k, (meses.get(k) ?? 0) + 1);
  });
  const keys = Array.from(meses.keys()).sort();
  const pontos: PontoSerie[] = keys.map((k) => ({
    label: monthLabel(k),
    value: meses.get(k)!,
    date: k + "-01",
  }));

  return { pontos, eventos, stats: calcStats(pontos.map((p) => p.value)) };
}

/* ─────── ELO MENSAL ─────── */
async function fetchELO(): Promise<TimelineResult> {
  const since = new Date();
  since.setMonth(since.getMonth() - 12);
  const { data } = await supabase
    .from("relatorios_atividade")
    .select("id, data, score_elo, nome_atividade, profiles:educador_id(nome)")
    .gte("data", ymd(since))
    .not("score_elo", "is", null)
    .order("data", { ascending: true });

  type Item = { id: string; nome: string; edu: string; score: number };
  const meses = new Map<string, { sum: number; n: number; itens: Item[] }>();
  (data || []).forEach((r: any) => {
    const k = (r.data as string).slice(0, 7);
    const m = meses.get(k) || { sum: 0, n: 0, itens: [] };
    m.sum += Number(r.score_elo);
    m.n++;
    m.itens.push({ id: r.id, nome: r.nome_atividade || "—", edu: r.profiles?.nome || "—", score: Number(r.score_elo) });
    meses.set(k, m);
  });

  const keys = Array.from(meses.keys()).sort();
  const pontos: PontoSerie[] = keys.map((k) => {
    const m = meses.get(k)!;
    return { label: monthLabel(k), value: +(m.sum / m.n).toFixed(2), date: k + "-01" };
  });

  const eventos: EventoTecnico[] = keys
    .slice()
    .reverse()
    .map((k) => {
      const m = meses.get(k)!;
      const ord = [...m.itens].sort((a, b) => b.score - a.score);
      const top = ord.slice(0, 3).map((i) => `${i.nome} — ${i.edu} (${i.score})`).join(" · ");
      const bot = ord.slice(-3).reverse().map((i) => `${i.nome} — ${i.edu} (${i.score})`).join(" · ");
      return {
        data: k + "-01",
        tipo: "mes",
        valorApos: +(m.sum / m.n).toFixed(2),
        titulo: `ELO — ${monthLabel(k)}`,
        contexto: [
          { campo: "Score médio", valor: (m.sum / m.n).toFixed(2) },
          { campo: "Relatórios", valor: String(m.n) },
          { campo: "Top 3", valor: top || "—" },
          { campo: "Bottom 3", valor: bot || "—" },
        ],
      };
    });

  return { pontos, eventos, stats: calcStats(pontos.map((p) => p.value)) };
}

/* ─────── ADESÃO MENSAL ─────── */
async function fetchAdesao(): Promise<TimelineResult> {
  const since = new Date();
  since.setMonth(since.getMonth() - 12);
  const { data } = await supabase
    .from("relatorios_atividade")
    .select("id, data, pct_adesao, num_participantes, num_matriculados, nome_atividade")
    .gte("data", ymd(since))
    .not("pct_adesao", "is", null)
    .order("data", { ascending: true });

  type Item = { id: string; nome: string; pct: number; pres: number; mat: number };
  const meses = new Map<string, { sum: number; n: number; itens: Item[] }>();
  (data || []).forEach((r: any) => {
    const k = (r.data as string).slice(0, 7);
    const m = meses.get(k) || { sum: 0, n: 0, itens: [] };
    m.sum += Number(r.pct_adesao);
    m.n++;
    m.itens.push({
      id: r.id,
      nome: r.nome_atividade || "—",
      pct: Number(r.pct_adesao),
      pres: Number(r.num_participantes || 0),
      mat: Number(r.num_matriculados || 0),
    });
    meses.set(k, m);
  });

  const keys = Array.from(meses.keys()).sort();
  const pontos: PontoSerie[] = keys.map((k) => {
    const m = meses.get(k)!;
    return { label: monthLabel(k), value: +(m.sum / m.n).toFixed(1), date: k + "-01" };
  });

  const eventos: EventoTecnico[] = keys
    .slice()
    .reverse()
    .map((k) => {
      const m = meses.get(k)!;
      const altas = m.itens.filter((i) => i.pct >= 90).length;
      const baixas = m.itens.filter((i) => i.pct < 50).length;
      const totPres = m.itens.reduce((a, b) => a + b.pres, 0);
      const totMat = m.itens.reduce((a, b) => a + b.mat, 0);
      return {
        data: k + "-01",
        tipo: "mes",
        valorApos: +(m.sum / m.n).toFixed(1),
        titulo: `ADESÃO — ${monthLabel(k)}`,
        contexto: [
          { campo: "% Adesão média", valor: `${(m.sum / m.n).toFixed(1)}%` },
          { campo: "Presentes / Esperados", valor: `${totPres} / ${totMat}` },
          { campo: "Atividades com adesão > 90%", valor: String(altas) },
          { campo: "Atividades com adesão < 50%", valor: String(baixas) },
        ],
      };
    });

  return { pontos, eventos, stats: calcStats(pontos.map((p) => p.value)), unidade: "%" };
}

/* ─────── EDUCADORES ATIVOS ─────── */
async function fetchEducadores(): Promise<TimelineResult> {
  const since = new Date();
  since.setMonth(since.getMonth() - 12);
  const { data } = await supabase
    .from("relatorios_atividade")
    .select("data, educador_id, profiles:educador_id(nome)")
    .gte("data", ymd(since))
    .order("data", { ascending: true });

  const meses = new Map<string, Map<string, { nome: string; count: number }>>();
  (data || []).forEach((r: any) => {
    if (!r.educador_id) return;
    const k = (r.data as string).slice(0, 7);
    const m = meses.get(k) || new Map();
    const cur = m.get(r.educador_id) || { nome: r.profiles?.nome || "—", count: 0 };
    cur.count++;
    m.set(r.educador_id, cur);
    meses.set(k, m);
  });

  const keys = Array.from(meses.keys()).sort();
  const pontos: PontoSerie[] = keys.map((k) => ({
    label: monthLabel(k),
    value: meses.get(k)!.size,
    date: k + "-01",
  }));

  const eventos: EventoTecnico[] = [];
  for (let i = keys.length - 1; i >= 0; i--) {
    const k = keys[i];
    const cur = meses.get(k)!;
    const prev = i > 0 ? meses.get(keys[i - 1])! : new Map();
    const entraram = Array.from(cur.keys()).filter((id) => !prev.has(id));
    const sairam = Array.from(prev.keys()).filter((id) => !cur.has(id));
    const top = Array.from(cur.values()).sort((a, b) => b.count - a.count).slice(0, 3);
    eventos.push({
      data: k + "-01",
      tipo: "mes",
      valorApos: cur.size,
      titulo: `EDUCADORES — ${monthLabel(k)}`,
      contexto: [
        { campo: "Ativos no mês", valor: String(cur.size) },
        { campo: "Entraram", valor: entraram.map((id) => cur.get(id)!.nome).join(", ") || "—" },
        { campo: "Saíram", valor: sairam.map((id) => prev.get(id)!.nome).join(", ") || "—" },
        { campo: "Top 3 produtivos", valor: top.map((t) => `${t.nome} (${t.count})`).join(" · ") || "—" },
      ],
    });
  }

  return { pontos, eventos, stats: calcStats(pontos.map((p) => p.value)) };
}

export async function fetchIndicadorTimeline(id: IndicadorId): Promise<TimelineResult> {
  switch (id) {
    case "participantes": return fetchParticipantes();
    case "frequencia": return fetchFrequencia();
    case "turmas": return fetchTurmas();
    case "relatorios": return fetchRelatorios();
    case "planejamentos": return fetchPlanejamentos();
    case "elo": return fetchELO();
    case "adesao": return fetchAdesao();
    case "educadores": return fetchEducadores();
  }
}

export const INDICADOR_LABELS: Record<IndicadorId, string> = {
  participantes: "Participantes Ativos",
  frequencia: "Frequência Geral",
  turmas: "Turmas Ativas",
  relatorios: "Relatórios",
  planejamentos: "Planejamentos",
  elo: "Média ELO",
  adesao: "Média Adesão",
  educadores: "Educadores Ativos",
};