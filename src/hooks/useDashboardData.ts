import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/fetchAllRows";
import { calcFaixaFromDate, calcAge } from "@/lib/constants";

export interface DashboardData {
  totalParticipantesAtivos: number;
  totalTurmasAtivas: number;
  totalRelatorios: number;
  totalPlanejamentos: number;
  mediaELO: number;
  mediaAdesao: number;
  participantesPorFaixa: { faixa: string; count: number }[];
  participantesPorGenero: { genero: string; count: number }[];
  participantesPorBairro: { bairro: string; count: number }[];
  participantesPorPeriodo: { periodo: string; count: number }[];
  eloMensal: { mes: string; elo: number }[];
  adesaoMensal: { mes: string; adesao: number }[];
  competencias: { name: string; value: number }[];
  objetivos: { status: string; count: number }[];
  taxaFrequenciaGeral: number;
  topEducadores: { nome: string; count: number }[];
  totalParticipantesAlerta: number;
  presencaMensal: { mes: string; presentes: number; total: number; pct: number }[];
  deltaParticipantes: number;
}

function monthKey(d: string) {
  return d.slice(0, 7);
}

const PERIODO_LABELS: Record<string, string> = { manha: "Manhã", tarde: "Tarde", integral: "Integral" };

export function useDashboardData() {
  const { data, isLoading: loading } = useQuery({
    queryKey: ["dashboard-data"],
    queryFn: async (): Promise<DashboardData> => {
      const [parts_raw, turmas_raw, rels, plans, bairrosData, relPresenca] = await Promise.all([
        fetchAllRows("participantes", { select: "*" }),
        fetchAllRows("turmas", { select: "*" }),
        fetchAllRows("relatorios_atividade", { select: "*, profiles!relatorios_atividade_educador_id_fkey(nome)", order: { column: "data" } }),
        fetchAllRows("planejamentos", { select: "id" }),
        fetchAllRows("bairros", { select: "id, nome" }),
        fetchAllRows("relatorio_presenca", { select: "id, presente, participante_id, relatorio_id" }),
      ]);

      const parts = (parts_raw || []).filter((p: any) => p.status === "ativo");
      const turmas = (turmas_raw || []).filter((t: any) => t.ativa);
      const bairrosMap: Record<string, string> = {};
      (bairrosData || []).forEach((b: any) => { bairrosMap[b.id] = b.nome; });

      const faixaMap: Record<string, number> = {};
      parts.forEach((p: any) => {
        if (p.data_nascimento) {
          const f = calcFaixaFromDate(p.data_nascimento);
          if (f) faixaMap[f] = (faixaMap[f] || 0) + 1;
        }
      });

      const generoMap: Record<string, number> = {};
      parts.forEach((p: any) => {
        const g = p.genero || "Não informado";
        generoMap[g] = (generoMap[g] || 0) + 1;
      });

      const bairroMap: Record<string, number> = {};
      parts.forEach((p: any) => {
        const b = p.bairro_id ? (bairrosMap[p.bairro_id] || "Não informado") : "Não informado";
        bairroMap[b] = (bairroMap[b] || 0) + 1;
      });

      const periodoMap: Record<string, number> = {};
      parts.forEach((p: any) => {
        const per = p.periodo || "manha";
        const label = PERIODO_LABELS[per] || per;
        periodoMap[label] = (periodoMap[label] || 0) + 1;
      });

      const eloByMonth: Record<string, number[]> = {};
      const adesaoByMonth: Record<string, number[]> = {};
      const compTotals = { iniciativa: [] as number[], autonomia: [] as number[], colaboracao: [] as number[], comunicacao: [] as number[], respeito_mutuo: [] as number[] };
      const objMap: Record<string, number> = {};
      const educadorCount: Record<string, number> = {};

      rels.forEach((r: any) => {
        const mk = monthKey(r.data);
        if (r.score_elo != null) {
          if (!eloByMonth[mk]) eloByMonth[mk] = [];
          eloByMonth[mk].push(Number(r.score_elo));
        }
        if (r.pct_adesao != null) {
          if (!adesaoByMonth[mk]) adesaoByMonth[mk] = [];
          adesaoByMonth[mk].push(Number(r.pct_adesao));
        }
        if (r.iniciativa != null) compTotals.iniciativa.push(r.iniciativa);
        if (r.autonomia != null) compTotals.autonomia.push(r.autonomia);
        if (r.colaboracao != null) compTotals.colaboracao.push(r.colaboracao);
        if (r.comunicacao != null) compTotals.comunicacao.push(r.comunicacao);
        if (r.respeito_mutuo != null) compTotals.respeito_mutuo.push(r.respeito_mutuo);
        if (r.objetivo_alcancado) objMap[r.objetivo_alcancado] = (objMap[r.objetivo_alcancado] || 0) + 1;
        const edName = r.profiles?.nome || "Desconhecido";
        educadorCount[edName] = (educadorCount[edName] || 0) + 1;
      });

      const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
      const allElo = rels.filter((r: any) => r.score_elo != null).map((r: any) => Number(r.score_elo));
      const allAdesao = rels.filter((r: any) => r.pct_adesao != null).map((r: any) => Number(r.pct_adesao));

      // Taxa de frequência usando relatorio_presenca (dados reais)
      const totalPresencaRecords = relPresenca.length;
      const totalPresentes = relPresenca.filter((p: any) => p.presente).length;
      const taxaFrequencia = totalPresencaRecords > 0 ? (totalPresentes / totalPresencaRecords) * 100 : 0;

      // Calcular participantes em alerta (3+ faltas consecutivas recentes)
      const faltasPorParticipante: Record<string, number> = {};
      const presencaPorParticipante: Record<string, { presente: boolean; relatorio_id: string }[]> = {};
      relPresenca.forEach((rp: any) => {
        if (!rp.participante_id) return;
        if (!presencaPorParticipante[rp.participante_id]) presencaPorParticipante[rp.participante_id] = [];
        presencaPorParticipante[rp.participante_id].push(rp);
      });

      const activePartIds = new Set(parts.map((p: any) => p.id));
      let alertCount = 0;
      Object.entries(presencaPorParticipante).forEach(([pid, records]) => {
        if (!activePartIds.has(pid)) return;
        // Count consecutive absences from end
        let consecutive = 0;
        for (let i = records.length - 1; i >= 0; i--) {
          if (!records[i].presente) consecutive++;
          else break;
        }
        if (consecutive >= 3) alertCount++;
      });

      const topEd = Object.entries(educadorCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([nome, count]) => ({ nome, count }));

      // Presença mensal: agrupar relatorio_presenca por mês do relatório
      const relIdToMonth: Record<string, string> = {};
      rels.forEach((r: any) => { relIdToMonth[r.id] = monthKey(r.data); });

      const presencaByMonth: Record<string, { presentes: number; total: number }> = {};
      relPresenca.forEach((rp: any) => {
        const mk = relIdToMonth[rp.relatorio_id];
        if (!mk) return;
        if (!presencaByMonth[mk]) presencaByMonth[mk] = { presentes: 0, total: 0 };
        presencaByMonth[mk].total++;
        if (rp.presente) presencaByMonth[mk].presentes++;
      });

      const presencaMensal = Object.entries(presencaByMonth)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([mes, v]) => ({
          mes,
          presentes: v.presentes,
          total: v.total,
          pct: v.total > 0 ? Number(((v.presentes / v.total) * 100).toFixed(1)) : 0,
        }));

      // Delta participantes: comparar participantes únicos com presença no mês atual vs anterior
      const sortedMonths = Object.keys(presencaByMonth).sort();
      let deltaParticipantes = 0;
      if (sortedMonths.length >= 2) {
        const lastMonth = sortedMonths[sortedMonths.length - 1];
        const prevMonth = sortedMonths[sortedMonths.length - 2];
        const partsByMonth = (month: string) => {
          const pids = new Set<string>();
          relPresenca.forEach((rp: any) => {
            if (rp.presente && relIdToMonth[rp.relatorio_id] === month && rp.participante_id) {
              pids.add(rp.participante_id);
            }
          });
          return pids.size;
        };
        deltaParticipantes = partsByMonth(lastMonth) - partsByMonth(prevMonth);
      }

      return {
        totalParticipantesAtivos: parts.length,
        totalTurmasAtivas: turmas.length,
        totalRelatorios: rels.length,
        totalPlanejamentos: plans.length,
        mediaELO: avg(allElo),
        mediaAdesao: avg(allAdesao),
        participantesPorFaixa: Object.entries(faixaMap).map(([faixa, count]) => ({ faixa, count })),
        participantesPorGenero: Object.entries(generoMap).map(([genero, count]) => ({ genero, count })),
        participantesPorBairro: Object.entries(bairroMap).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([bairro, count]) => ({ bairro, count })),
        participantesPorPeriodo: Object.entries(periodoMap).map(([periodo, count]) => ({ periodo, count })),
        eloMensal: Object.entries(eloByMonth).sort().map(([mes, vals]) => ({ mes, elo: Number(avg(vals).toFixed(2)) })),
        adesaoMensal: Object.entries(adesaoByMonth).sort().map(([mes, vals]) => ({ mes, adesao: Number(avg(vals).toFixed(1)) })),
        competencias: [
          { name: "Iniciativa", value: Number(avg(compTotals.iniciativa).toFixed(2)) },
          { name: "Autonomia", value: Number(avg(compTotals.autonomia).toFixed(2)) },
          { name: "Colaboração", value: Number(avg(compTotals.colaboracao).toFixed(2)) },
          { name: "Comunicação", value: Number(avg(compTotals.comunicacao).toFixed(2)) },
          { name: "Respeito Mútuo", value: Number(avg(compTotals.respeito_mutuo).toFixed(2)) },
        ],
        objetivos: Object.entries(objMap).map(([status, count]) => ({ status, count })),
        taxaFrequenciaGeral: Number(taxaFrequencia.toFixed(1)),
        topEducadores: topEd,
        totalParticipantesAlerta: alertCount,
        presencaMensal,
        deltaParticipantes,
      };
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  return { data: data ?? null, loading };
}
