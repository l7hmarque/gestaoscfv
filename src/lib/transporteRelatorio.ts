import * as XLSX from "xlsx-js-style";
import { saveAs } from "file-saver";
import { supabase } from "@/integrations/supabase/client";
import { addInstitutionalHeader, applyInstitutionalStyle, applyTableHeaderStyle, applyAllBorders } from "@/lib/xlsxInstHeader";
import { autoFitColumns } from "@/lib/xlsxAutoFit";
import { sysCfvFileName } from "@/lib/fileNaming";

function fmtHora(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit", minute: "2-digit",
  });
}

function fmtData(d: string): string {
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

/**
 * Gera o Relatório Diário de Transporte (XLSX) seguindo o padrão SysCFV:
 * cabeçalho institucional, agrupamento por bairro, ordenação por ponto.
 * Mostra horário do check-in da família e horário do embarque do motorista.
 */
export async function gerarRelatorioTransporteDia(data: string, periodo: "manha" | "tarde") {
  // Carrega dados em paralelo
  const [{ data: bairros }, { data: pontos }, { data: parts }, { data: checkins }] = await Promise.all([
    supabase.from("bairros").select("id, nome"),
    supabase.from("pontos_transporte").select("id, nome, bairro_id, ordem, horario_manha, horario_tarde").eq("ativo", true),
    supabase.from("participantes").select("id, nome_completo, periodo, ponto_transporte_id").in("status", ["ativo", "busca_ativa"] as any),
    supabase.from("participante_checkins").select("*").eq("data", data).eq("periodo", periodo),
  ]);

  const bairroNome = (id: string | null) =>
    bairros?.find((b: any) => b.id === id)?.nome || "Sem bairro";

  const checkMap = new Map<string, any>();
  (checkins || []).forEach((c: any) => checkMap.set(c.participante_id, c));

  // Agrupa pontos por bairro
  const pontosOrdenados = (pontos || []).slice().sort((a: any, b: any) => {
    const bairroCmp = bairroNome(a.bairro_id).localeCompare(bairroNome(b.bairro_id), "pt-BR");
    if (bairroCmp !== 0) return bairroCmp;
    if ((a.ordem ?? 0) !== (b.ordem ?? 0)) return (a.ordem ?? 0) - (b.ordem ?? 0);
    return a.nome.localeCompare(b.nome, "pt-BR");
  });

  // Linhas: para cada bairro, para cada ponto, para cada participante daquele ponto
  const headers = ["Bairro", "Ponto", "Horário Parada", "Participante", "Confirmação Família", "Hora Check-in", "Embarque Motorista", "Hora Embarque", "Observação"];
  const dataRows: any[][] = [];

  let totalParticipantes = 0;
  let totalConfirmados = 0;
  let totalNaoVai = 0;
  let totalEmbarcou = 0;
  let totalNaoEmbarcou = 0;

  for (const pt of pontosOrdenados) {
    const ptParts = (parts || []).filter((p: any) =>
      p.ponto_transporte_id === pt.id && (p.periodo === periodo || p.periodo === "integral")
    );
    if (ptParts.length === 0) continue;
    ptParts.sort((a: any, b: any) => a.nome_completo.localeCompare(b.nome_completo, "pt-BR"));
    const horarioParada = periodo === "manha" ? (pt.horario_manha || "—") : (pt.horario_tarde || "—");

    for (const p of ptParts) {
      totalParticipantes++;
      const ck = checkMap.get(p.id);
      const conf = ck?.confirmado === true ? "Sim" : ck?.confirmado === false ? "Não" : "Pendente";
      const emb = ck?.embarcou === true ? "Sim" : ck?.embarcou === false ? "Não" : "—";
      if (ck?.confirmado === true) totalConfirmados++;
      if (ck?.confirmado === false) totalNaoVai++;
      if (ck?.embarcou === true) totalEmbarcou++;
      if (ck?.embarcou === false) totalNaoEmbarcou++;

      dataRows.push([
        bairroNome(pt.bairro_id),
        pt.nome,
        horarioParada,
        p.nome_completo,
        conf,
        fmtHora(ck?.confirmado_em ?? null),
        emb,
        fmtHora(ck?.embarcou_em ?? null),
        ck?.observacao || "",
      ]);
    }
  }

  // Linha-resumo no final
  dataRows.push([]);
  dataRows.push(["RESUMO", "", "", `Total: ${totalParticipantes}`, `Confirmados: ${totalConfirmados}`, "", `Embarcou: ${totalEmbarcou} · Não embarcou: ${totalNaoEmbarcou}`, `Não vai: ${totalNaoVai}`, ""]);

  const periodoLabel = periodo === "manha" ? "Manhã" : "Tarde";
  const titulo = "Relatório Diário de Transporte";
  const subInfo = `Data: ${fmtData(data)} · Período: ${periodoLabel}`;

  const { data: fullData, dataStartOffset } = addInstitutionalHeader(
    [headers, ...dataRows],
    titulo,
    subInfo,
  );

  const ws = XLSX.utils.aoa_to_sheet(fullData);
  const totalCols = headers.length;
  applyInstitutionalStyle(ws, totalCols, { hasTurmaInfo: true, hasSubInfo: false });
  applyTableHeaderStyle(ws, dataStartOffset, totalCols);
  applyAllBorders(ws);
  autoFitColumns(ws, { max: 40 });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, `Transporte ${periodoLabel}`);
  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  saveAs(blob, sysCfvFileName("Transporte", "xlsx", `${data}_${periodo}`));
}