import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import * as XLSX from "npm:xlsx-js-style";

const DIAS_MAP: Record<string, number> = { dom: 0, seg: 1, ter: 2, qua: 3, qui: 4, sex: 5, sab: 6 };
const MESES_NOMES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const BAIRROS_SCFV = ["JARDIM IRENE", "PARQUE INDEPENDENCIA", "ALVORADA"];
const METAS_BAIRRO: Record<string, { criancasManha: number; criancasTarde: number; idosos: number | null }> = {
  "JARDIM IRENE": { criancasManha: 100, criancasTarde: 100, idosos: 30 },
  "PARQUE INDEPENDENCIA": { criancasManha: 60, criancasTarde: 60, idosos: 30 },
  "ALVORADA": { criancasManha: 60, criancasTarde: 60, idosos: null },
};
const TIPO_ATENDIMENTO_LABELS: Record<string, string> = {
  atendimento_individual: "Atendimento Individual", visita_domiciliar: "Visita Domiciliar",
  encaminhamento: "Encaminhamento", busca_ativa: "Busca Ativa", acolhida: "Acolhida", desligamento: "Desligamento",
};

function getDatasAtividade(ano: number, mes: number, diasSemana: string[]): string[] {
  const diasNum = diasSemana.map(d => DIAS_MAP[d.toLowerCase()]).filter(n => n !== undefined);
  if (!diasNum.length) return [];
  const datas: string[] = [];
  const dt = new Date(ano, mes - 1, 1);
  while (dt.getMonth() === mes - 1) {
    if (diasNum.includes(dt.getDay())) datas.push(dt.toISOString().slice(0, 10));
    dt.setDate(dt.getDate() + 1);
  }
  return datas;
}

function calcAge(dob: string): number {
  const b = new Date(dob); const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  if (now.getMonth() < b.getMonth() || (now.getMonth() === b.getMonth() && now.getDate() < b.getDate())) age--;
  return age;
}

function calcFaixaFromDate(dob: string): string | null {
  const age = calcAge(dob);
  if (age >= 60) return "idosos";
  if (age >= 12) return "12-17";
  if (age >= 9) return "9-11";
  if (age >= 6) return "6-8";
  return null;
}

function applyBorders(ws: any) {
  const range = XLSX.utils.decode_range(ws["!ref"] || "A1");
  const border = { style: "thin", color: { rgb: "000000" } };
  for (let r = range.s.r; r <= range.e.r; r++) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      if (!ws[addr]) ws[addr] = { v: "", t: "s" };
      ws[addr].s = { ...(ws[addr].s || {}), border: { top: border, bottom: border, left: border, right: border } };
    }
  }
}

function applyHeaderStyle(ws: any, row: number, colCount: number) {
  const border = { style: "thin", color: { rgb: "000000" } };
  for (let c = 0; c < colCount; c++) {
    const addr = XLSX.utils.encode_cell({ r: row, c });
    if (!ws[addr]) ws[addr] = { v: "", t: "s" };
    ws[addr].s = {
      font: { bold: true }, fill: { fgColor: { rgb: "D9D9D9" } },
      border: { top: border, bottom: border, left: border, right: border },
      alignment: { wrapText: true, vertical: "center" },
    };
  }
}

async function fetchAll(supabase: any, table: string) {
  const all: any[] = [];
  let from = 0;
  const size = 1000;
  while (true) {
    const { data, error } = await supabase.from(table).select("*").range(from, from + size - 1);
    if (error) throw error;
    all.push(...(data || []));
    if (!data || data.length < size) break;
    from += size;
  }
  return all;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Verify user
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: claims, error: claimsErr } = await supabaseUser.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (claimsErr || !claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const { mes, ano } = await req.json();
    const mesNum = parseInt(mes);
    const anoNum = parseInt(ano);
    const mesStr = String(mesNum).padStart(2, "0");
    const startDate = `${anoNum}-${mesStr}-01`;
    const endDate = mesNum === 12 ? `${anoNum + 1}-01-01` : `${anoNum}-${String(mesNum + 1).padStart(2, "0")}-01`;

    const [presencas_raw, participantes, turmas, bairros, relatorios, planejamentos, turmaParticipantes, relatorioTurmas, atendimentos_raw, profilesData, relatorioPresencas] = await Promise.all([
      fetchAll(supabaseAdmin, "presenca"),
      fetchAll(supabaseAdmin, "participantes"),
      fetchAll(supabaseAdmin, "turmas"),
      fetchAll(supabaseAdmin, "bairros"),
      fetchAll(supabaseAdmin, "relatorios_atividade"),
      fetchAll(supabaseAdmin, "planejamentos"),
      fetchAll(supabaseAdmin, "turma_participantes"),
      fetchAll(supabaseAdmin, "relatorio_turmas"),
      fetchAll(supabaseAdmin, "atendimentos"),
      fetchAll(supabaseAdmin, "profiles"),
      fetchAll(supabaseAdmin, "relatorio_presenca"),
    ]);

    const presencas = presencas_raw.filter((p: any) => p.data >= startDate && p.data < endDate);
    const filteredRelatorios = relatorios.filter((r: any) => r.data >= startDate && r.data < endDate);
    const filteredPlanejamentos = planejamentos.filter((p: any) => p.data_aplicacao && p.data_aplicacao >= startDate && p.data_aplicacao < endDate);
    const filteredAtendimentos = atendimentos_raw.filter((a: any) => a.data_atendimento >= startDate && a.data_atendimento < endDate);

    const partMap = new Map(participantes.map((p: any) => [p.id, p]));
    const bairroMap = new Map(bairros.map((b: any) => [b.id, b.nome]));
    const profileMap = new Map(profilesData.map((p: any) => [p.id, p]));
    const turmaMap = new Map(turmas.map((t: any) => [t.id, t]));
    const planMap = new Map(planejamentos.map((p: any) => [p.id, p]));

    const wb = XLSX.utils.book_new();

    // --- Sheet 1: Resumo ---
    const atendidosIds = new Set(presencas.filter((p: any) => p.presente).map((p: any) => p.participante_id));
    const atendidos = [...atendidosIds].map(id => partMap.get(id)).filter(Boolean);

    const byBairro: Record<string, number> = {};
    atendidos.forEach((p: any) => { const b = p.bairro_id ? (bairroMap.get(p.bairro_id) || "N/I") : "N/I"; byBairro[b] = (byBairro[b] || 0) + 1; });

    const byFaixa: Record<string, number> = {};
    atendidos.forEach((p: any) => { if (p.data_nascimento) { const f = calcFaixaFromDate(p.data_nascimento); if (f) byFaixa[f] = (byFaixa[f] || 0) + 1; } });

    const byPeriodo: Record<string, number> = {};
    atendidos.forEach((p: any) => { const per = p.periodo || "N/I"; byPeriodo[per] = (byPeriodo[per] || 0) + 1; });

    const novasInsercoes = participantes.filter((p: any) => p.iniciou_em && p.iniciou_em >= startDate && p.iniciou_em < endDate);

    const atendByTipo: Record<string, number> = {};
    filteredAtendimentos.forEach((a: any) => { const t = a.tipo || "atendimento_individual"; atendByTipo[t] = (atendByTipo[t] || 0) + 1; });

    const resumoData = [
      ["RELATÓRIO MENSAL — SysELO SCFV"],
      [`Mês: ${MESES_NOMES[mesNum - 1]} / ${anoNum}`],
      [`Data de geração: ${new Date().toLocaleString("pt-BR")}`],
      [],
      ["ATENDIDOS NO MÊS", atendidosIds.size],
      [], ["POR BAIRRO"],
      ...Object.entries(byBairro).sort((a, b) => b[1] - a[1]).map(([b, c]) => [b, c]),
      [], ["POR FAIXA ETÁRIA"],
      ...Object.entries(byFaixa).map(([f, c]) => [f, c]),
      [], ["POR PERÍODO"],
      ...Object.entries(byPeriodo).map(([p, c]) => [p, c]),
      [], ["NOVAS INSERÇÕES NO MÊS", novasInsercoes.length],
      ...novasInsercoes.map((p: any) => [p.nome_completo, p.iniciou_em]),
      [], ["ATENDIMENTOS TÉCNICOS NO MÊS", filteredAtendimentos.length],
      ...Object.entries(atendByTipo).map(([t, c]) => [TIPO_ATENDIMENTO_LABELS[t] || t, c]),
    ];
    const wsResumo = XLSX.utils.aoa_to_sheet(resumoData);
    wsResumo["!cols"] = [{ wch: 40 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(wb, wsResumo, "Resumo");

    // --- Sheet 2: Atividades ---
    const relByPlan = new Map();
    filteredRelatorios.forEach((r: any) => { if (r.planejamento_id) relByPlan.set(r.planejamento_id, r); });
    const atividadesRows: any[][] = [];
    filteredPlanejamentos.forEach((p: any) => {
      const rel = relByPlan.get(p.id);
      atividadesRows.push([p.titulo + (p.tema ? ` — ${p.tema}` : ""), rel ? (rel.nome_atividade || "") : "", rel ? (rel.analise_ia || "") : "", rel ? "" : "Atividade não realizada no período"]);
      if (rel) relByPlan.delete(p.id);
    });
    filteredRelatorios.filter((r: any) => !r.planejamento_id).forEach((r: any) => {
      atividadesRows.push(["", r.nome_atividade || "", r.analise_ia || "", ""]);
    });
    const atividadesData = [["ATIVIDADES PROPOSTAS x DESENVOLVIDAS"], [`Mês: ${MESES_NOMES[mesNum - 1]} / ${anoNum}`], [], ["Atividades Propostas", "Atividades Desenvolvidas", "Resultados Alcançados", "Justificativas"], ...atividadesRows];
    const wsAtiv = XLSX.utils.aoa_to_sheet(atividadesData);
    wsAtiv["!cols"] = [{ wch: 35 }, { wch: 35 }, { wch: 40 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, wsAtiv, "Atividades");

    // --- Sheet 3: Metas ---
    const bairroStats: Record<string, { criancasManha: Set<string>; criancasTarde: Set<string>; idosos: Set<string> }> = {};
    BAIRROS_SCFV.forEach(bn => { bairroStats[bn] = { criancasManha: new Set(), criancasTarde: new Set(), idosos: new Set() }; });
    const relIdToAnalise = new Map(filteredRelatorios.map((r: any) => [r.id, r.analise_ia || ""]));
    const bairroRelResultados: Record<string, Set<string>> = {};
    BAIRROS_SCFV.forEach(bn => { bairroRelResultados[bn] = new Set(); });
    relatorioTurmas.forEach((rt: any) => {
      const turma = turmaMap.get(rt.turma_id);
      if (!turma) return;
      const bairroNome = bairroMap.get(turma.bairro_id) || "";
      if (BAIRROS_SCFV.includes(bairroNome)) { const analise = relIdToAnalise.get(rt.relatorio_id); if (analise) bairroRelResultados[bairroNome].add(analise); }
    });
    presencas.filter((p: any) => p.presente).forEach((pres: any) => {
      const turma = turmaMap.get(pres.turma_id);
      if (!turma) return;
      const bairroNome = bairroMap.get(turma.bairro_id) || "";
      if (!BAIRROS_SCFV.includes(bairroNome)) return;
      const part = partMap.get(pres.participante_id);
      if (!part) return;
      const age = part.data_nascimento ? calcAge(part.data_nascimento) : 0;
      const isIdoso = age >= 60;
      const periodo = turma.periodo || "manha";
      if (isIdoso) { bairroStats[bairroNome].idosos.add(pres.participante_id); }
      else if (periodo === "manha" || periodo === "integral") { bairroStats[bairroNome].criancasManha.add(pres.participante_id); }
      if (!isIdoso && (periodo === "tarde" || periodo === "integral")) { bairroStats[bairroNome].criancasTarde.add(pres.participante_id); }
    });
    const metasRows: any[][] = [];
    let totalCriancas = 0, totalMeta = 0, totalIdosos = 0, totalMetaIdosos = 0;
    BAIRROS_SCFV.forEach(bn => {
      const meta = METAS_BAIRRO[bn]; if (!meta) return;
      const stats = bairroStats[bn];
      const cm = stats.criancasManha.size, ct = stats.criancasTarde.size;
      const totalBairro = cm + ct, metaBairro = meta.criancasManha + meta.criancasTarde;
      const pct = metaBairro > 0 ? Math.round((totalBairro / metaBairro) * 100) : 0;
      const resultados = [...bairroRelResultados[bn]].filter(Boolean).join("; ").slice(0, 500);
      metasRows.push([bn, "", "", ""], [`  Crianças/adolescentes — Manhã (meta: ${meta.criancasManha})`, `${cm} atendidos`, resultados, ""], [`  Crianças/adolescentes — Tarde (meta: ${meta.criancasTarde})`, `${ct} atendidos`, "", ""], [`  Total crianças: ${pct}% da meta (${totalBairro}/${metaBairro})`, `${pct}% de atendidos em relação à meta`, "", ""]);
      if (meta.idosos !== null) { const idCount = stats.idosos.size; const pctId = meta.idosos > 0 ? Math.round((idCount / meta.idosos) * 100) : 0; metasRows.push([`  Idosos (meta: ${meta.idosos})`, `${idCount} atendidos — ${pctId}% da meta`, "", ""]); totalIdosos += idCount; totalMetaIdosos += meta.idosos; }
      metasRows.push([]); totalCriancas += totalBairro; totalMeta += metaBairro;
    });
    const pctGeral = totalMeta > 0 ? Math.round((totalCriancas / totalMeta) * 100) : 0;
    const pctIdosos = totalMetaIdosos > 0 ? Math.round((totalIdosos / totalMetaIdosos) * 100) : 0;
    metasRows.push(["TOTAL GERAL", "", "", ""], [`  Crianças/adolescentes: ${totalCriancas} (${pctGeral}% da meta de ${totalMeta})`, `${totalCriancas}`, "", ""], [`  Idosos: ${totalIdosos} (${pctIdosos}% da meta de ${totalMetaIdosos})`, `${totalIdosos}`, "", ""]);
    const metasData = [["METAS PROPOSTAS — ACOMPANHAMENTO MENSAL"], [`Mês: ${MESES_NOMES[mesNum - 1]} / ${anoNum}`], [], ["Metas Propostas", "Quant.", "Resultados Alcançados", "Justificativa"], ...metasRows];
    const wsMetas = XLSX.utils.aoa_to_sheet(metasData);
    wsMetas["!cols"] = [{ wch: 55 }, { wch: 35 }, { wch: 50 }, { wch: 25 }];
    applyHeaderStyle(wsMetas, 3, 4);
    applyBorders(wsMetas);
    XLSX.utils.book_append_sheet(wb, wsMetas, "Metas");

    // --- Sheet 4: Monitoramento ---
    const totalPresencasRegistros = presencas.length;
    const totalPresentes = presencas.filter((p: any) => p.presente).length;
    const pctPresencaGeral = totalPresencasRegistros > 0 ? Math.round((totalPresentes / totalPresencasRegistros) * 100) : 0;
    const partFreq: Record<string, { total: number; presentes: number }> = {};
    presencas.forEach((p: any) => { if (!partFreq[p.participante_id]) partFreq[p.participante_id] = { total: 0, presentes: 0 }; partFreq[p.participante_id].total++; if (p.presente) partFreq[p.participante_id].presentes++; });
    const partComFreq = Object.values(partFreq);
    const partBomFreq = partComFreq.filter(pf => pf.total > 0 && (pf.presentes / pf.total) >= 0.75).length;
    const pctBomFreq = partComFreq.length > 0 ? Math.round((partBomFreq / partComFreq.length) * 100) : 0;
    const monitorRows = [
      ["Assegurar espaços de referência para o convívio grupal, comunitário e social e o desenvolvimento de relações de afetividade, solidariedade e respeito mútuo", "Participação nas atividades sócio educacionais", "100%", `${pctPresencaGeral}%`],
      ["Possibilitar o reconhecimento do trabalho e a ampliação do universo informacional, artístico e cultural, bem como o desenvolvimento de potencialidades, habilidades, talentos e propiciar sua formação cidadã", "Participação nas atividades culturais, esportivas e sócio educacionais", "100%", `${pctPresencaGeral}%`],
      ["Contribuir para a inserção, reinserção e permanência no sistema educacional", "Matrícula, rendimento e frequência escolar", "100%", `${pctBomFreq}%`],
      ["Promover o acesso aos benefícios e serviços socioassistenciais, fortalecendo a função protetiva das famílias", "Quantidade de beneficiários encaminhados para a proteção social básica", "100%", "100%"],
    ];
    const monitorData = [["MONITORAMENTO E AVALIAÇÃO"], [`Mês: ${MESES_NOMES[mesNum - 1]} / ${anoNum}`], [], ["Objetivo", "Indicador", "Meta Prevista", "Meta Atingida"], ...monitorRows];
    const wsMonitor = XLSX.utils.aoa_to_sheet(monitorData);
    wsMonitor["!cols"] = [{ wch: 60 }, { wch: 45 }, { wch: 15 }, { wch: 15 }];
    applyHeaderStyle(wsMonitor, 3, 4);
    applyBorders(wsMonitor);
    XLSX.utils.book_append_sheet(wb, wsMonitor, "Monitoramento");

    // --- Sheet 5: Atendimentos ---
    if (filteredAtendimentos.length > 0) {
      const atendRows = filteredAtendimentos.map((a: any) => {
        const part = partMap.get(a.participante_id);
        const prof = profileMap.get(a.profissional_id);
        return [a.data_atendimento, TIPO_ATENDIMENTO_LABELS[a.tipo] || a.tipo, part?.nome_completo || "—", prof?.nome || "—", (a.descricao || "").slice(0, 200), a.encaminhamento || ""];
      });
      const atendData = [["ATENDIMENTOS TÉCNICOS"], [`Mês: ${MESES_NOMES[mesNum - 1]} / ${anoNum}`], [], ["Data", "Tipo", "Participante", "Profissional", "Descrição", "Encaminhamento"], ...atendRows];
      const wsAtend = XLSX.utils.aoa_to_sheet(atendData);
      wsAtend["!cols"] = [{ wch: 12 }, { wch: 22 }, { wch: 30 }, { wch: 20 }, { wch: 50 }, { wch: 30 }];
      applyHeaderStyle(wsAtend, 3, 6);
      applyBorders(wsAtend);
      XLSX.utils.book_append_sheet(wb, wsAtend, "Atendimentos");
    }

    // --- Sheets: Matrizes de frequência por turma ---
    const turmasAtivas = turmas.filter((t: any) => t.ativa);
    const usedSheetNames = new Set(["Resumo", "Atividades", "Metas", "Monitoramento", "Atendimentos"]);
    const border = { style: "thin", color: { rgb: "000000" } };
    const borderObj = { top: border, bottom: border, left: border, right: border };

    for (const t of turmasAtivas) {
      const tpIds = turmaParticipantes.filter((tp: any) => tp.turma_id === t.id).map((tp: any) => tp.participante_id);
      const tParts = tpIds.map((id: string) => partMap.get(id)).filter(Boolean) as any[];
      const tPresencas = presencas.filter((p: any) => p.turma_id === t.id);
      const diasSemana = t.dias_semana || [];
      const datasAtividade = getDatasAtividade(anoNum, mesNum, diasSemana);
      const datas = datasAtividade.length > 0 ? datasAtividade : [...new Set(tPresencas.map((p: any) => p.data))].sort();
      if (!datas.length && !tParts.length) continue;

      const bairroNome = bairroMap.get(t.bairro_id) || "N/I";
      let sheetName = (t.nome || "Turma").slice(0, 28).replace(/[\\\/\*\?\[\]:]/g, "_");
      let suffix = 2;
      while (usedSheetNames.has(sheetName)) { sheetName = sheetName.slice(0, 25) + `_${suffix++}`; }
      usedSheetNames.add(sheetName);

      const header1 = [`SCFV — CAIA Medianeira — Matriz de Frequência`];
      const header2 = [`Turma: ${t.nome} | Bairro: ${bairroNome} | Faixa: ${t.faixa_etaria || "N/I"} | Período: ${t.periodo || "N/I"}`];
      const header3 = [`Mês: ${MESES_NOMES[mesNum - 1]} / ${anoNum} | Exportado em: ${new Date().toLocaleString("pt-BR")}`];
      const colHeaders = ["Nº", "Nome do Participante", ...datas.map(d => d.slice(5))];
      const rows = tParts.map((p: any, idx: number) => {
        const row: any[] = [idx + 1, p.nome_completo];
        datas.forEach(() => row.push(""));
        return row;
      });

      const sheetData = [header1, header2, header3, [], colHeaders, ...rows, [], [`Assinatura do Educador: _______________________`]];
      const ws = XLSX.utils.aoa_to_sheet(sheetData);
      ws["!cols"] = [{ wch: 5 }, { wch: 30 }, ...datas.map(() => ({ wch: 6 }))];
      applyHeaderStyle(ws, 4, colHeaders.length);

      const dataStartRow = 5;
      tParts.forEach((p: any, pIdx: number) => {
        const excelRow = dataStartRow + pIdx;
        for (let c = 0; c < 2; c++) {
          const addr = XLSX.utils.encode_cell({ r: excelRow, c });
          if (!ws[addr]) ws[addr] = { v: "", t: "s" };
          ws[addr].s = { ...(ws[addr].s || {}), border: borderObj };
        }
        datas.forEach((d: string, dIdx: number) => {
          const col = 2 + dIdx;
          const addr = XLSX.utils.encode_cell({ r: excelRow, c: col });
          if (!ws[addr]) ws[addr] = { v: "", t: "s" };
          const rec = tPresencas.find((pr: any) => pr.participante_id === p.id && pr.data === d);
          if (rec && rec.presente) {
            ws[addr].s = { fill: { fgColor: { rgb: "000000" } }, border: borderObj };
          } else {
            ws[addr].s = { border: borderObj };
          }
        });
      });

      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    }

    // Write XLSX to buffer
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "buffer" });

    // Upload to storage
    const fileName = `relatorios-mensais/${anoNum}-${mesStr}_${Date.now()}.xlsx`;
    const { error: uploadError } = await supabaseAdmin.storage.from("documentos").upload(fileName, buf, {
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      upsert: true,
    });
    if (uploadError) throw uploadError;

    const { data: signed } = await supabaseAdmin.storage.from("documentos").createSignedUrl(fileName, 3600);
    if (!signed?.signedUrl) throw new Error("Failed to create signed URL");

    return new Response(JSON.stringify({ url: signed.signedUrl, fileName }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Error generating report:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
