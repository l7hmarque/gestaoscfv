import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/fetchAllRows";
import { calcFaixaFromDate, calcAge, BAIRROS_SCFV } from "@/lib/constants";
import { sysEloFileName } from "@/lib/fileNaming";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx-js-style";
import { autoFitColumns } from "@/lib/xlsxAutoFit";
import { format } from "date-fns";

const MESES_NOMES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

const TIPO_ATENDIMENTO_LABELS: Record<string, string> = {
  atendimento_individual: "Atendimento Individual",
  visita_domiciliar: "Visita Domiciliar",
  encaminhamento: "Encaminhamento",
  busca_ativa: "Busca Ativa",
  acolhida: "Acolhida",
  desligamento: "Desligamento",
  atendimento_comunidade: "Atendimento Comunidade",
  atendimento_familiar: "Atendimento Familiares",
  atendimento_educador: "Atendimento Educadores",
  acao_social: "Ações Sociais/Eventos",
  reuniao_rede: "Reunião de Rede",
  visita_escolar: "Visita Escolar",
  aplicacao_grupo: "Aplicação de Grupos",
};

const TIPOS_ATIVIDADE_LABELS: Record<string, string> = {
  momento_educando: "Momento Educando",
  evento: "Evento / Data Comemorativa",
  socioeducativa_idosos: "Ativ. Socioeducativa (Idosos)",
  colonia_ferias: "Colônia de Férias",
  arte_cultura: "Oficina de Arte e Cultura",
  futebol_esportes: "Oficina de Futebol / Esportes",
  karate: "Oficina de Karatê",
  outra_oficina: "Outra Oficina",
};

function san(v: any): string {
  if (v === null || v === undefined || v === "Undefined" || v === "undefined") return "—";
  return String(v);
}

interface GestaoData {
  participantes: any[];
  turmas: any[];
  bairros: any[];
  profiles: any[];
  presencas: any[];
  relatorios: any[];
  planejamentos: any[];
  atendimentos: any[];
  buscaAtiva: any[];
  categorias: any[];
  despesas: any[];
  parcelas: any[];
  estornos: any[];
  pontosTransporte: any[];
  turmaParticipantes: any[];
  relatorioTurmas: any[];
  relatorioPresencas: any[];
  relatorioFotos: any[];
  transferencias: any[];
  userRoles: any[];
}

async function fetchGestaoData(startDate: string, endDate: string): Promise<GestaoData> {
  const [participantes, turmas, bairros, profiles, presencas_raw, relatorios, planejamentos,
    atendimentos, buscaAtiva, categorias, despesas, parcelas, estornos, pontosTransporte,
    turmaParticipantes, relatorioTurmas, relatorioPresencas, relatorioFotos, transferencias, userRoles] = await Promise.all([
    fetchAllRows("participantes", { select: "*" }),
    fetchAllRows("turmas", { select: "*" }),
    fetchAllRows("bairros", { select: "*" }),
    fetchAllRows("profiles", { select: "*" }),
    fetchAllRows("presenca", { select: "*" }),
    fetchAllRows("relatorios_atividade", { select: "*" }),
    fetchAllRows("planejamentos", { select: "*" }),
    fetchAllRows("atendimentos", { select: "*" }),
    fetchAllRows("busca_ativa_registros", { select: "*" }),
    fetchAllRows("categorias_financeiras", { select: "*" }),
    fetchAllRows("despesas", { select: "*" }),
    fetchAllRows("parcelas_financeiras", { select: "*" }),
    fetchAllRows("estornos", { select: "*" }),
    fetchAllRows("pontos_transporte", { select: "*" }),
    fetchAllRows("turma_participantes", { select: "*" }),
    fetchAllRows("relatorio_turmas", { select: "*" }),
    fetchAllRows("relatorio_presenca", { select: "*" }),
    fetchAllRows("relatorio_fotos", { select: "*" }),
    fetchAllRows("participante_transferencias", { select: "*" }),
    fetchAllRows("user_roles", { select: "*" }),
  ]);

  const presencas = (presencas_raw || []).filter((p: any) => p.data >= startDate && p.data < endDate);

  return {
    participantes: participantes || [],
    turmas: turmas || [],
    bairros: bairros || [],
    profiles: profiles || [],
    presencas,
    relatorios: (relatorios || []).filter((r: any) => r.data >= startDate && r.data < endDate),
    planejamentos: planejamentos || [],
    atendimentos: (atendimentos || []).filter((a: any) => a.data_atendimento >= startDate && a.data_atendimento < endDate),
    buscaAtiva: (buscaAtiva || []).filter((b: any) => b.data_registro >= startDate && b.data_registro < endDate),
    categorias: categorias || [],
    despesas: (despesas || []).filter((d: any) => d.data_lancamento >= startDate && d.data_lancamento < endDate),
    parcelas: parcelas || [],
    estornos: estornos || [],
    pontosTransporte: pontosTransporte || [],
    turmaParticipantes: turmaParticipantes || [],
    relatorioTurmas: relatorioTurmas || [],
    relatorioPresencas: relatorioPresencas || [],
    relatorioFotos: relatorioFotos || [],
    transferencias: (transferencias || []).filter((t: any) => t.data_transferencia >= startDate && t.data_transferencia < endDate),
    userRoles: userRoles || [],
  };
}

function computeMetrics(data: GestaoData, startDate: string) {
  const partMap = new Map(data.participantes.map(p => [p.id, p]));
  const bairroMap = new Map(data.bairros.map(b => [b.id, b]));
  const profileMap = new Map(data.profiles.map(p => [p.id, p]));
  const turmaMap = new Map(data.turmas.map(t => [t.id, t]));

  // Active participants (ativos or desligados after startDate)
  const activeParticipants = data.participantes.filter(p =>
    p.status === "ativo" || (p.status === "desligado" && p.data_desligamento && p.data_desligamento >= startDate)
  );

  // Demographics
  const byGender: Record<string, number> = {};
  const byRace: Record<string, number> = {};
  const byFaixa: Record<string, number> = {};
  const byBairro: Record<string, number> = {};
  const byPeriodo: Record<string, number> = {};
  const byMoradia: Record<string, number> = {};
  let laudoCount = 0;
  let remedioCount = 0;

  activeParticipants.forEach(p => {
    const g = p.genero || "N/I";
    byGender[g] = (byGender[g] || 0) + 1;
    const r = p.cor_raca || "N/I";
    byRace[r] = (byRace[r] || 0) + 1;
    if (p.data_nascimento) {
      const f = calcFaixaFromDate(p.data_nascimento);
      if (f) byFaixa[f] = (byFaixa[f] || 0) + 1;
    }
    const bairro = p.bairro_id ? (bairroMap.get(p.bairro_id)?.nome || "N/I") : "N/I";
    byBairro[bairro] = (byBairro[bairro] || 0) + 1;
    const per = p.periodo || "N/I";
    byPeriodo[per] = (byPeriodo[per] || 0) + 1;
    const mor = p.situacao_moradia || "N/I";
    byMoradia[mor] = (byMoradia[mor] || 0) + 1;
    if (p.laudo) laudoCount++;
    if (p.remedio_continuo) remedioCount++;
  });

  // Attendance
  const totalPresRecords = data.presencas.length;
  const totalPresent = data.presencas.filter(p => p.presente).length;
  const attendanceRate = totalPresRecords > 0 ? Math.round((totalPresent / totalPresRecords) * 100) : 0;

  // Activities
  const tipoAtivCount: Record<string, number> = {};
  data.relatorios.forEach(r => {
    (r.tipo_atividade || []).forEach((t: string) => {
      tipoAtivCount[t] = (tipoAtivCount[t] || 0) + 1;
    });
  });

  const eloScores = data.relatorios.filter(r => r.score_elo != null).map(r => r.score_elo);
  const avgElo = eloScores.length > 0 ? (eloScores.reduce((a: number, b: number) => a + b, 0) / eloScores.length).toFixed(1) : "—";

  const competencias = { iniciativa: 0, autonomia: 0, colaboracao: 0, comunicacao: 0, respeito_mutuo: 0, count: 0 };
  data.relatorios.forEach(r => {
    if (r.iniciativa != null) {
      competencias.iniciativa += r.iniciativa;
      competencias.autonomia += (r.autonomia || 0);
      competencias.colaboracao += (r.colaboracao || 0);
      competencias.comunicacao += (r.comunicacao || 0);
      competencias.respeito_mutuo += (r.respeito_mutuo || 0);
      competencias.count++;
    }
  });

  const avgAdesao = data.relatorios.length > 0
    ? Math.round(data.relatorios.reduce((a, r) => a + (r.pct_adesao || 0), 0) / data.relatorios.length)
    : 0;

  const objetivoCount: Record<string, number> = {};
  data.relatorios.forEach(r => {
    const o = r.objetivo_alcancado || "N/I";
    objetivoCount[o] = (objetivoCount[o] || 0) + 1;
  });

  // Technical services
  const atendByTipo: Record<string, number> = {};
  data.atendimentos.forEach(a => {
    const t = a.tipo || "atendimento_individual";
    atendByTipo[t] = (atendByTipo[t] || 0) + 1;
  });
  const sigilosoCount = data.atendimentos.filter(a => a.sigiloso).length;
  const encaminhamentoCount = data.atendimentos.filter(a => a.encaminhamento).length;

  // Busca ativa
  const buscaByTipo: Record<string, number> = {};
  data.buscaAtiva.forEach(b => {
    const t = b.tipo_contato || "telefone";
    buscaByTipo[t] = (buscaByTipo[t] || 0) + 1;
  });
  const buscaByResultado: Record<string, number> = {};
  data.buscaAtiva.forEach(b => {
    const r = b.resultado || "N/I";
    buscaByResultado[r] = (buscaByResultado[r] || 0) + 1;
  });

  // Financial
  const catMap = new Map(data.categorias.map(c => [c.id, c]));
  const despesasByCat: Record<string, { previsto: number; executado: number; codigo: string; descricao: string }> = {};
  data.categorias.forEach(c => {
    despesasByCat[c.id] = { previsto: c.valor_previsto || 0, executado: 0, codigo: c.codigo, descricao: c.descricao };
  });
  data.despesas.forEach(d => {
    if (d.categoria_id && despesasByCat[d.categoria_id]) {
      despesasByCat[d.categoria_id].executado += d.valor;
    }
  });
  const totalReceitas = data.parcelas.reduce((a, p) => a + p.valor, 0);
  const totalDespesas = data.despesas.reduce((a, d) => a + d.valor, 0);
  const totalEstornos = data.estornos.reduce((a, e) => a + e.valor, 0);

  // Transport
  const pontoParticipantes: Record<string, number> = {};
  activeParticipants.forEach(p => {
    if (p.ponto_transporte_id) {
      pontoParticipantes[p.ponto_transporte_id] = (pontoParticipantes[p.ponto_transporte_id] || 0) + 1;
    }
  });

  // Team
  const roleMap: Record<string, string[]> = {};
  data.userRoles.forEach(ur => {
    const prof = data.profiles.find(p => p.user_id === ur.user_id);
    if (prof) {
      if (!roleMap[prof.id]) roleMap[prof.id] = [];
      roleMap[prof.id].push(ur.role);
    }
  });
  const activeTeam = data.profiles.filter(p => p.ativo !== false);

  // Metas by bairro
  const bairroMetas: Record<string, { meta_manha: number; meta_tarde: number; meta_idosos: number; atendidos: number }> = {};
  data.bairros.forEach(b => {
    if (BAIRROS_SCFV.some(bs => bs.localeCompare(b.nome, "pt-BR", { sensitivity: "base" }) === 0)) {
      bairroMetas[b.nome] = {
        meta_manha: b.meta_criancas_manha || 0,
        meta_tarde: b.meta_criancas_tarde || 0,
        meta_idosos: b.meta_idosos || 0,
        atendidos: byBairro[b.nome] || 0,
      };
    }
  });

  // Ingressos e desligamentos
  const ingressos = data.participantes.filter(p => p.iniciou_em && p.iniciou_em >= startDate);
  const desligamentos = data.participantes.filter(p => p.data_desligamento && p.data_desligamento >= startDate);

  // Indicators
  const custoAtendido = activeParticipants.length > 0 ? totalDespesas / activeParticipants.length : 0;
  const taxaPermanencia = data.participantes.filter(p => p.status === "ativo").length > 0
    ? Math.round((data.participantes.filter(p => p.status === "ativo").length / (data.participantes.filter(p => p.status === "ativo").length + desligamentos.length)) * 100)
    : 0;

  return {
    activeParticipants, byGender, byRace, byFaixa, byBairro, byPeriodo, byMoradia,
    laudoCount, remedioCount, attendanceRate, totalPresRecords, totalPresent,
    tipoAtivCount, avgElo, competencias, avgAdesao, objetivoCount,
    atendByTipo, sigilosoCount, encaminhamentoCount,
    buscaByTipo, buscaByResultado,
    despesasByCat, totalReceitas, totalDespesas, totalEstornos,
    pontoParticipantes, activeTeam, roleMap, bairroMetas,
    ingressos, desligamentos, custoAtendido, taxaPermanencia,
    partMap, bairroMap, profileMap, turmaMap, catMap,
  };
}

export async function exportRelatorioGestaoPDF(mesInicio: number, anoInicio: number, mesFim: number, anoFim: number) {
  const startDate = `${anoInicio}-${String(mesInicio).padStart(2, "0")}-01`;
  const endMonth = mesFim === 12 ? 1 : mesFim + 1;
  const endYear = mesFim === 12 ? anoFim + 1 : anoFim;
  const endDate = `${endYear}-${String(endMonth).padStart(2, "0")}-01`;
  const periodoLabel = mesInicio === mesFim && anoInicio === anoFim
    ? `${MESES_NOMES[mesInicio - 1]} / ${anoInicio}`
    : `${MESES_NOMES[mesInicio - 1]}/${anoInicio} a ${MESES_NOMES[mesFim - 1]}/${anoFim}`;

  const data = await fetchGestaoData(startDate, endDate);
  const m = computeMetrics(data, startDate);

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pw = doc.internal.pageSize.getWidth();
  const gray50 = [50, 50, 50] as [number, number, number];
  const altRow = [245, 245, 245] as [number, number, number];
  let y = 0;

  function sectionTitle(title: string) {
    if (y > 260) { doc.addPage(); y = 15; }
    y += 4;
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(title, 14, y);
    y += 2;
    doc.setDrawColor(0);
    doc.line(14, y, pw - 14, y);
    y += 4;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
  }

  function addTable(head: string[][], body: string[][], opts?: any) {
    if (y > 250) { doc.addPage(); y = 15; }
    autoTable(doc, {
      startY: y,
      head,
      body,
      styles: { fontSize: 7, cellPadding: 1.5 },
      headStyles: { fillColor: gray50, fontSize: 7, textColor: [255, 255, 255] },
      alternateRowStyles: { fillColor: altRow },
      margin: { left: 14, right: 14 },
      ...opts,
    });
    y = (doc as any).lastAutoTable?.finalY || y + 20;
  }

  // === CAPA ===
  doc.setFontSize(10);
  doc.text("SOCIEDADE CIVIL NOSSA SENHORA APARECIDA", pw / 2, 40, { align: "center" });
  doc.text("CENTRO DE ATENÇÃO INTEGRAL AO ADOLESCENTE - MEDIANEIRA", pw / 2, 47, { align: "center" });
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("RELATÓRIO DE GESTÃO", pw / 2, 75, { align: "center" });
  doc.text("E PRESTAÇÃO DE CONTAS", pw / 2, 85, { align: "center" });
  doc.setFontSize(14);
  doc.text("SCFV / SCNSA", pw / 2, 100, { align: "center" });
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text(`Período: ${periodoLabel}`, pw / 2, 120, { align: "center" });
  doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")}`, pw / 2, 130, { align: "center" });

  // === 1. IDENTIFICAÇÃO INSTITUCIONAL ===
  doc.addPage();
  y = 15;
  sectionTitle("1. IDENTIFICAÇÃO INSTITUCIONAL");
  doc.setFontSize(8);
  doc.text("Sociedade Civil Nossa Senhora Aparecida — SCFV", 14, y); y += 5;
  doc.text("Centro de Atenção Integral ao Adolescente - Medianeira", 14, y); y += 8;

  doc.setFontSize(9);
  doc.text("Equipe Técnica", 14, y); y += 4;
  const teamRows = m.activeTeam.map(p => {
    const roles = m.roleMap[p.id] || [];
    return [san(p.nome), san(p.cargo), roles.join(", "), san(p.carga_horaria)];
  });
  addTable([["Nome", "Cargo", "Função", "Carga Horária"]], teamRows);

  // === 2. PÚBLICO ATENDIDO ===
  y += 4;
  sectionTitle("2. PÚBLICO ATENDIDO");
  doc.text(`Total de atendidos no período: ${m.activeParticipants.length}`, 14, y); y += 6;

  addTable([["Período", "Quantidade"]], Object.entries(m.byPeriodo).map(([k, v]) => [k === "manha" ? "Manhã" : k === "tarde" ? "Tarde" : k === "integral" ? "Integral" : k, String(v)]));
  y += 2;
  addTable([["Faixa Etária", "Quantidade"]], Object.entries(m.byFaixa).map(([k, v]) => [k, String(v)]));
  y += 2;
  addTable([["Gênero", "Quantidade"]], Object.entries(m.byGender).map(([k, v]) => [k, String(v)]));
  y += 2;
  addTable([["Cor/Raça", "Quantidade"]], Object.entries(m.byRace).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, String(v)]));
  y += 2;
  addTable([["Bairro/Núcleo", "Quantidade"]], Object.entries(m.byBairro).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, String(v)]));
  y += 2;
  addTable([["Situação de Moradia", "Quantidade"]], Object.entries(m.byMoradia).filter(([k]) => k !== "N/I").sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, String(v)]));
  y += 2;
  doc.text(`Participantes com laudo/condição de saúde: ${m.laudoCount}`, 14, y); y += 4;
  doc.text(`Participantes com medicação contínua: ${m.remedioCount}`, 14, y); y += 6;

  // Metas x Atendidos
  if (Object.keys(m.bairroMetas).length > 0) {
    addTable(
      [["Bairro", "Meta (M+T)", "Atendidos", "% Cobertura"]],
      Object.entries(m.bairroMetas).map(([nome, v]) => {
        const meta = v.meta_manha + v.meta_tarde;
        const pct = meta > 0 ? Math.round((v.atendidos / meta) * 100) : 0;
        return [nome, String(meta), String(v.atendidos), `${pct}%`];
      })
    );
  }
  y += 2;

  // Movimentação
  addTable([["Movimentação", "Quantidade"]], [
    ["Ingressos no período", String(m.ingressos.length)],
    ["Desligamentos no período", String(m.desligamentos.length)],
    ["Transferências no período", String(data.transferencias.length)],
  ]);

  // === 3. ATIVIDADES PEDAGÓGICAS ===
  y += 4;
  sectionTitle("3. ATIVIDADES PEDAGÓGICAS");
  doc.text(`Total de atividades realizadas: ${data.relatorios.length}`, 14, y); y += 4;
  doc.text(`Planejamentos no período: ${data.planejamentos.filter(p => p.data_aplicacao && p.data_aplicacao >= startDate && p.data_aplicacao < endDate).length}`, 14, y); y += 4;
  doc.text(`Score ELO médio: ${m.avgElo}`, 14, y); y += 4;
  doc.text(`Taxa de adesão média: ${m.avgAdesao}%`, 14, y); y += 6;

  if (Object.keys(m.tipoAtivCount).length > 0) {
    addTable(
      [["Tipo de Atividade", "Quantidade"]],
      Object.entries(m.tipoAtivCount).sort((a, b) => b[1] - a[1]).map(([k, v]) => [TIPOS_ATIVIDADE_LABELS[k] || k, String(v)])
    );
  }
  y += 2;

  if (m.competencias.count > 0) {
    const c = m.competencias;
    addTable(
      [["Competência", "Média (1-5)"]],
      [
        ["Iniciativa", (c.iniciativa / c.count).toFixed(1)],
        ["Autonomia", (c.autonomia / c.count).toFixed(1)],
        ["Colaboração", (c.colaboracao / c.count).toFixed(1)],
        ["Comunicação", (c.comunicacao / c.count).toFixed(1)],
        ["Respeito Mútuo", (c.respeito_mutuo / c.count).toFixed(1)],
      ]
    );
  }
  y += 2;

  if (Object.keys(m.objetivoCount).length > 0) {
    addTable(
      [["Objetivo Alcançado", "Quantidade"]],
      Object.entries(m.objetivoCount).map(([k, v]) => [k === "sim" ? "Sim" : k === "parcial" ? "Parcialmente" : k === "nao" ? "Não" : k, String(v)])
    );
  }

  // === 4. FREQUÊNCIA E BUSCA ATIVA ===
  y += 4;
  sectionTitle("4. FREQUÊNCIA E BUSCA ATIVA");
  doc.text(`Taxa de frequência geral: ${m.attendanceRate}% (${m.totalPresent}/${m.totalPresRecords} registros)`, 14, y); y += 6;

  if (data.buscaAtiva.length > 0) {
    doc.text(`Ações de Busca Ativa: ${data.buscaAtiva.length}`, 14, y); y += 4;
    if (Object.keys(m.buscaByTipo).length > 0) {
      addTable([["Tipo de Contato", "Quantidade"]], Object.entries(m.buscaByTipo).map(([k, v]) => [k, String(v)]));
    }
    y += 2;
    if (Object.keys(m.buscaByResultado).length > 0) {
      addTable([["Resultado", "Quantidade"]], Object.entries(m.buscaByResultado).map(([k, v]) => [k, String(v)]));
    }
  } else {
    doc.text("Nenhuma ação de busca ativa registrada no período.", 14, y); y += 6;
  }

  // === 5. ATENDIMENTOS TÉCNICOS ===
  y += 4;
  sectionTitle("5. ATENDIMENTOS TÉCNICOS");
  doc.text(`Total de atendimentos: ${data.atendimentos.length}`, 14, y); y += 4;
  doc.text(`Atendimentos sigilosos: ${m.sigilosoCount}`, 14, y); y += 4;
  doc.text(`Com encaminhamento: ${m.encaminhamentoCount}`, 14, y); y += 6;

  if (Object.keys(m.atendByTipo).length > 0) {
    addTable(
      [["Tipo", "Quantidade"]],
      Object.entries(m.atendByTipo).sort((a, b) => b[1] - a[1]).map(([k, v]) => [TIPO_ATENDIMENTO_LABELS[k] || k, String(v)])
    );
  }

  // === 6. EXECUÇÃO FINANCEIRA ===
  y += 4;
  sectionTitle("6. EXECUÇÃO FINANCEIRA");
  doc.text(`Receitas (parcelas recebidas): R$ ${m.totalReceitas.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, 14, y); y += 4;
  doc.text(`Despesas no período: R$ ${m.totalDespesas.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, 14, y); y += 4;
  doc.text(`Estornos/devoluções: R$ ${m.totalEstornos.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, 14, y); y += 4;
  const saldo = m.totalReceitas - m.totalDespesas + m.totalEstornos;
  doc.text(`Saldo: R$ ${saldo.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, 14, y); y += 6;

  const finRows = Object.values(m.despesasByCat).filter(c => c.previsto > 0 || c.executado > 0)
    .sort((a, b) => a.codigo.localeCompare(b.codigo))
    .map(c => {
      const saldoCat = c.previsto - c.executado;
      const pct = c.previsto > 0 ? Math.round((c.executado / c.previsto) * 100) : 0;
      return [c.codigo, c.descricao, `R$ ${c.previsto.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, `R$ ${c.executado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, `R$ ${saldoCat.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, `${pct}%`];
    });
  if (finRows.length > 0) {
    addTable([["Código", "Rubrica", "Previsto", "Executado", "Saldo", "% Exec."]], finRows);
  }

  // === 7. TRANSPORTE ===
  y += 4;
  sectionTitle("7. TRANSPORTE");
  const activePontos = data.pontosTransporte.filter(p => p.ativo !== false);
  if (activePontos.length > 0) {
    const pontoRows = activePontos.map(p => {
      const bairro = p.bairro_id ? (m.bairroMap.get(p.bairro_id)?.nome || "—") : "—";
      const count = m.pontoParticipantes[p.id] || 0;
      return [san(p.nome), bairro, san(p.horario_manha), san(p.horario_tarde), String(count)];
    });
    addTable([["Ponto", "Bairro", "Horário Manhã", "Horário Tarde", "Participantes"]], pontoRows);
  } else {
    doc.text("Nenhum ponto de transporte cadastrado.", 14, y); y += 6;
  }

  // === 8. INDICADORES ===
  y += 4;
  sectionTitle("8. INDICADORES DE RESULTADO");
  addTable(
    [["Indicador", "Valor"]],
    [
      ["Custo por atendido/mês", `R$ ${m.custoAtendido.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`],
      ["Taxa de permanência", `${m.taxaPermanencia}%`],
      ["Score ELO médio", String(m.avgElo)],
      ["Taxa de frequência", `${m.attendanceRate}%`],
      ["Razão equipe/atendidos", `1:${m.activeTeam.length > 0 ? Math.round(m.activeParticipants.length / m.activeTeam.length) : 0}`],
      ["Atividades realizadas", String(data.relatorios.length)],
      ["Atendimentos técnicos", String(data.atendimentos.length)],
    ]
  );

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    if (i > 1) {
      doc.setFontSize(7);
      doc.setTextColor(150);
      doc.text(`SCFV/SCNSA — Relatório de Gestão — ${periodoLabel}`, 14, 290);
      doc.text(`Página ${i} de ${pageCount}`, pw - 14, 290, { align: "right" });
      doc.setTextColor(0);
    }
  }

  doc.save(sysEloFileName("RelGestao", "pdf", periodoLabel.replace(/[/ ]/g, "-")));
}

export async function exportRelatorioGestaoXLSX(mesInicio: number, anoInicio: number, mesFim: number, anoFim: number) {
  const startDate = `${anoInicio}-${String(mesInicio).padStart(2, "0")}-01`;
  const endMonth = mesFim === 12 ? 1 : mesFim + 1;
  const endYear = mesFim === 12 ? anoFim + 1 : anoFim;
  const endDate = `${endYear}-${String(endMonth).padStart(2, "0")}-01`;
  const periodoLabel = mesInicio === mesFim && anoInicio === anoFim
    ? `${MESES_NOMES[mesInicio - 1]} / ${anoInicio}`
    : `${MESES_NOMES[mesInicio - 1]}/${anoInicio} a ${MESES_NOMES[mesFim - 1]}/${anoFim}`;

  const data = await fetchGestaoData(startDate, endDate);
  const m = computeMetrics(data, startDate);

  const wb = XLSX.utils.book_new();
  const border = { style: "thin" as const, color: { rgb: "000000" } };
  const headerStyle = { font: { bold: true }, fill: { fgColor: { rgb: "D9D9D9" } }, border: { top: border, bottom: border, left: border, right: border } };

  function makeSheet(title: string, headers: string[], rows: any[][]) {
    const instRows = [
      ["Sociedade Civil Nossa Senhora Aparecida"],
      ["Centro de Atenção Integral ao Adolescente - Medianeira"],
      [`Relatório de Gestão — ${periodoLabel}`],
      [],
      headers,
      ...rows,
    ];
    const ws = XLSX.utils.aoa_to_sheet(instRows);
    // Style inst header
    for (let r = 0; r < 3; r++) {
      const addr = XLSX.utils.encode_cell({ r, c: 0 });
      if (ws[addr]) ws[addr].s = { font: { bold: true, sz: 13 }, alignment: { horizontal: "center" } };
    }
    // Style column headers
    for (let c = 0; c < headers.length; c++) {
      const addr = XLSX.utils.encode_cell({ r: 4, c });
      if (ws[addr]) ws[addr].s = headerStyle;
    }
    autoFitColumns(ws);
    return ws;
  }

  // 1. Resumo
  const resumoRows = [
    ["Total de atendidos", String(m.activeParticipants.length)],
    ["Taxa de frequência", `${m.attendanceRate}%`],
    ["Score ELO médio", String(m.avgElo)],
    ["Atividades realizadas", String(data.relatorios.length)],
    ["Atendimentos técnicos", String(data.atendimentos.length)],
    ["Buscas ativas", String(data.buscaAtiva.length)],
    ["Ingressos", String(m.ingressos.length)],
    ["Desligamentos", String(m.desligamentos.length)],
    ["Transferências", String(data.transferencias.length)],
    ["Custo por atendido", `R$ ${m.custoAtendido.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`],
    ["Taxa de permanência", `${m.taxaPermanencia}%`],
  ];
  XLSX.utils.book_append_sheet(wb, makeSheet("Resumo", ["Indicador", "Valor"], resumoRows), "Resumo");

  // 2. Público
  const publicoRows = [
    ...Object.entries(m.byBairro).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, String(v), "Bairro"]),
    ...Object.entries(m.byFaixa).map(([k, v]) => [k, String(v), "Faixa Etária"]),
    ...Object.entries(m.byGender).map(([k, v]) => [k, String(v), "Gênero"]),
    ...Object.entries(m.byRace).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, String(v), "Cor/Raça"]),
    ...Object.entries(m.byPeriodo).map(([k, v]) => [k === "manha" ? "Manhã" : k === "tarde" ? "Tarde" : k, String(v), "Período"]),
    ...Object.entries(m.byMoradia).filter(([k]) => k !== "N/I").map(([k, v]) => [k, String(v), "Moradia"]),
  ];
  XLSX.utils.book_append_sheet(wb, makeSheet("Público", ["Categoria", "Quantidade", "Dimensão"], publicoRows), "Público");

  // 3. Equipe
  const equipeRows = m.activeTeam.map(p => [san(p.nome), san(p.cargo), (m.roleMap[p.id] || []).join(", "), san(p.carga_horaria)]);
  XLSX.utils.book_append_sheet(wb, makeSheet("Equipe", ["Nome", "Cargo", "Função", "CH"], equipeRows), "Equipe");

  // 4. Atividades
  const ativRows = [
    ...Object.entries(m.tipoAtivCount).sort((a, b) => b[1] - a[1]).map(([k, v]) => [TIPOS_ATIVIDADE_LABELS[k] || k, String(v)]),
    ["TOTAL", String(data.relatorios.length)],
  ];
  XLSX.utils.book_append_sheet(wb, makeSheet("Atividades", ["Tipo", "Quantidade"], ativRows), "Atividades");

  // 5. Atendimentos
  const atendRows = Object.entries(m.atendByTipo).sort((a, b) => b[1] - a[1]).map(([k, v]) => [TIPO_ATENDIMENTO_LABELS[k] || k, String(v)]);
  atendRows.push(["TOTAL", String(data.atendimentos.length)]);
  atendRows.push(["Sigilosos", String(m.sigilosoCount)]);
  atendRows.push(["Com encaminhamento", String(m.encaminhamentoCount)]);
  XLSX.utils.book_append_sheet(wb, makeSheet("Atendimentos", ["Tipo", "Quantidade"], atendRows), "Atendimentos");

  // 6. Financeiro
  const finRows = Object.values(m.despesasByCat).filter(c => c.previsto > 0 || c.executado > 0)
    .sort((a, b) => a.codigo.localeCompare(b.codigo))
    .map(c => [c.codigo, c.descricao, c.previsto, c.executado, c.previsto - c.executado, c.previsto > 0 ? Math.round((c.executado / c.previsto) * 100) : 0]);
  finRows.push(["", "TOTAL", m.totalReceitas, m.totalDespesas, m.totalReceitas - m.totalDespesas + m.totalEstornos, ""]);
  XLSX.utils.book_append_sheet(wb, makeSheet("Financeiro", ["Código", "Rubrica", "Previsto", "Executado", "Saldo", "% Exec."], finRows), "Financeiro");

  // 7. Transporte
  const transpRows = data.pontosTransporte.filter(p => p.ativo !== false).map(p => {
    const bairro = p.bairro_id ? (m.bairroMap.get(p.bairro_id)?.nome || "—") : "—";
    return [san(p.nome), bairro, san(p.horario_manha), san(p.horario_tarde), m.pontoParticipantes[p.id] || 0];
  });
  XLSX.utils.book_append_sheet(wb, makeSheet("Transporte", ["Ponto", "Bairro", "Manhã", "Tarde", "Participantes"], transpRows), "Transporte");

  // 8. Lista Nominal
  const nominalRows = m.activeParticipants
    .sort((a, b) => a.nome_completo.localeCompare(b.nome_completo))
    .map(p => {
      const bairro = p.bairro_id ? (m.bairroMap.get(p.bairro_id)?.nome || "—") : "—";
      const faixa = p.data_nascimento ? calcFaixaFromDate(p.data_nascimento) : "—";
      return [san(p.nome_completo), san(p.data_nascimento), faixa, san(p.genero), bairro, p.periodo === "manha" ? "Manhã" : p.periodo === "tarde" ? "Tarde" : san(p.periodo)];
    });
  XLSX.utils.book_append_sheet(wb, makeSheet("Lista Nominal", ["Nome", "Nascimento", "Faixa", "Gênero", "Bairro", "Período"], nominalRows), "Lista Nominal");

  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  saveAs(new Blob([buf]), sysEloFileName("RelGestao", "xlsx", periodoLabel.replace(/[/ ]/g, "-")));
}
