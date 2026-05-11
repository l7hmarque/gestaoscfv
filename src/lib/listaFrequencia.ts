/**
 * Módulo unificado de Listas de Frequência e Chamada.
 *
 * Centraliza a geração de:
 *  - Lista de Frequência (modo 'frequencia'): preenchida com presenças do
 *    sistema, para anexar a relatórios e prestação de contas.
 *  - Lista de Chamada (modo 'chamada'): em branco, para impressão e
 *    marcação manual durante a atividade.
 *
 * Em vez de reimplementar PDF/DOCX/XLSX, este módulo delega aos builders
 * existentes em `useDocumentExport.ts` e `exportListaPresenca.ts`,
 * garantindo uma única superfície pública (`buildLista`) e suporte a
 * múltiplos formatos em uma única chamada.
 *
 * Marcadores institucionais aplicados em TODOS os formatos:
 *   ■  presente
 *      vazio = ausente
 *   —  sem aula / desligado
 *  (BA) em busca ativa
 *  (D)  desligado (com data)
 *  (T)  transferido
 */
import { supabase } from "@/integrations/supabase/client";
import {
  exportMatrizFrequenciaDocx,
  exportMatrizFrequenciaPdf,
  exportListaPresencaPdf,
} from "@/hooks/useDocumentExport";
import {
  exportSingleListaPresenca,
  exportAllListasPresenca,
} from "@/lib/exportListaPresenca";

export type ListaFormato = "docx" | "pdf" | "xlsx";
export type ListaModo = "frequencia" | "chamada";
export type ListaEscopo = "turma" | "lote";

export interface ListaTurma {
  id: string;
  nome: string;
  periodo?: string | null;
  faixa_etaria?: string | null;
  dias_semana?: string[] | null;
  bairro_id?: string | null;
  bairros?: { nome: string } | null;
  profiles?: { nome: string } | null;
}

export interface ListaParticipante {
  participante_id: string;
  nome: string;
  status?: string | null;
  data_desligamento?: string | null;
  created_at?: string | null;
}

export interface BuildListaParams {
  modo: ListaModo;
  escopo: ListaEscopo;
  formatos: ListaFormato[];
  mes: number; // 1-12
  ano: number;
  turmas: ListaTurma[];
}

export interface BuildListaResult {
  ok: boolean;
  formatosGerados: ListaFormato[];
  formatosFalha: ListaFormato[];
  turmasProcessadas: number;
  turmasIgnoradas: number;
  mensagens: string[];
}

function periodoLabel(p?: string | null): string {
  if (!p) return "—";
  if (p === "manha") return "Manhã";
  if (p === "tarde") return "Tarde";
  if (p === "integral") return "Integral";
  return p;
}

function fmtDataShort(d: string | null | undefined): string {
  if (!d || d.length < 10) return "";
  return `${d.slice(8, 10)}/${d.slice(5, 7)}`;
}

/** Aplica marcadores institucionais ao nome do participante. */
function rotularNome(p: ListaParticipante): string {
  const isDesligado = p.status === "desligado";
  if (isDesligado) {
    const data = fmtDataShort(p.data_desligamento);
    return `${p.nome}${data ? ` (D ${data})` : " (D)"}`;
  }
  return p.nome;
}

/** Carrega vínculos turma↔participante e presenças, montando a estrutura
 * esperada pelos builders existentes. */
async function carregarDadosTurma(turma: ListaTurma, mes: number, ano: number) {
  const startDate = `${ano}-${String(mes).padStart(2, "0")}-01`;
  const endDate =
    mes === 12 ? `${ano + 1}-01-01` : `${ano}-${String(mes + 1).padStart(2, "0")}-01`;

  const { data: tpData } = await supabase
    .from("turma_participantes")
    .select(
      "participante_id, data_entrada, data_saida, participantes(nome_completo, status, data_desligamento, created_at)"
    )
    .eq("turma_id", turma.id);

  const { data: presData } = await supabase
    .from("presenca")
    .select("participante_id, data, presente")
    .eq("turma_id", turma.id)
    .order("data");

  const datasSet = new Set<string>();
  (presData || []).forEach((p: any) => datasSet.add(p.data));
  const datas = Array.from(datasSet).sort();

  const participantesRaw: ListaParticipante[] = (tpData || [])
    .filter((tp: any) =>
      (!tp.data_entrada || tp.data_entrada < endDate) &&
      (!tp.data_saida || tp.data_saida >= startDate)
    )
    .map((tp: any) => ({
      participante_id: tp.participante_id,
      nome: tp.participantes?.nome_completo || "",
      status: tp.participantes?.status,
      data_desligamento: tp.participantes?.data_desligamento || null,
      created_at: tp.participantes?.created_at || null,
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome));

  // Constrói matriz de presenças preservando regra de "D" pós-desligamento.
  const matriz = participantesRaw.map((p) => {
    const isDesligado = p.status === "desligado";
    const dataDeslig = p.data_desligamento || null;
    const presencas: Record<string, boolean | string> = {};
    (presData || [])
      .filter((x: any) => x.participante_id === p.participante_id)
      .forEach((x: any) => {
        if (isDesligado && dataDeslig && x.data > dataDeslig) presencas[x.data] = "D";
        else presencas[x.data] = x.presente || false;
      });
    if (isDesligado && dataDeslig) {
      datas.forEach((d) => {
        if (d > dataDeslig && presencas[d] === undefined) presencas[d] = "D";
      });
    }
    return { nome: rotularNome(p), presencas };
  });

  // Estrutura para builders XLSX (lista de chamada / frequência mensal)
  const membersXlsx = participantesRaw.map((p) => ({
    nome: p.nome,
    desligado: p.status === "desligado",
    data_desligamento: p.data_desligamento,
    transferido: false,
    busca_ativa: p.status === "busca_ativa",
  }));

  return { matriz, datas, membersXlsx, participantesRaw };
}

/**
 * API pública unificada. Gera a(s) lista(s) nos formatos solicitados.
 *
 * - modo 'frequencia' + formato 'docx'/'pdf' → matriz preenchida com ■
 * - modo 'frequencia' + formato 'xlsx' → planilha mensal preenchida
 * - modo 'chamada'    + formato 'pdf'  → lista em branco para impressão
 * - modo 'chamada'    + formato 'xlsx' → planilha mensal em branco
 * - modo 'chamada'    + formato 'docx' → matriz em branco no formato DOCX
 *
 * Quando `escopo='lote'` e formato é XLSX, todas as turmas vão num único
 * arquivo (uma aba por turma).
 */
export async function buildLista(params: BuildListaParams): Promise<BuildListaResult> {
  const { modo, escopo, formatos, mes, ano, turmas } = params;
  const result: BuildListaResult = {
    ok: false,
    formatosGerados: [],
    formatosFalha: [],
    turmasProcessadas: 0,
    turmasIgnoradas: 0,
    mensagens: [],
  };

  if (turmas.length === 0) {
    result.mensagens.push("Nenhuma turma selecionada.");
    return result;
  }

  // --- XLSX em LOTE (uma só planilha com todas as turmas) ---
  if (escopo === "lote" && formatos.includes("xlsx")) {
    try {
      const membersByTurma: Record<string, any[]> = {};
      for (const t of turmas) {
        const { membersXlsx } = await carregarDadosTurma(t, mes, ano);
        membersByTurma[t.id] = membersXlsx;
      }
      const r = exportAllListasPresenca(turmas as any, membersByTurma, mes, ano);
      if (r.success) {
        result.formatosGerados.push("xlsx");
        result.turmasProcessadas += r.sheetsAdded;
      } else {
        result.formatosFalha.push("xlsx");
        result.mensagens.push("Nenhuma turma com dias de atendimento cadastrados (XLSX).");
      }
    } catch (e: any) {
      result.formatosFalha.push("xlsx");
      result.mensagens.push(`XLSX: ${e?.message || "erro"}`);
    }
  }

  // --- Por turma: DOCX / PDF / XLSX individual ---
  const formatosPorTurma = formatos.filter(
    (f) => !(escopo === "lote" && f === "xlsx") // XLSX em lote já tratado acima
  );

  if (formatosPorTurma.length > 0) {
    for (const t of turmas) {
      try {
        const { matriz, datas, membersXlsx } = await carregarDadosTurma(t, mes, ano);

        // Lista de Chamada precisa de dias_semana cadastrados
        if (modo === "chamada" && (!t.dias_semana || t.dias_semana.length === 0)) {
          result.turmasIgnoradas++;
          continue;
        }

        for (const fmt of formatosPorTurma) {
          try {
            if (fmt === "docx") {
              await exportMatrizFrequenciaDocx(
                t,
                modo === "chamada" ? matriz.map((m) => ({ ...m, presencas: {} })) : matriz,
                datas,
                modo === "frequencia"
              );
            } else if (fmt === "pdf") {
              if (modo === "chamada") {
                await exportListaPresencaPdf(
                  t,
                  matriz.map((m) => ({ nome: m.nome })),
                  ano,
                  mes - 1
                );
              } else {
                await exportMatrizFrequenciaPdf(t, matriz, datas, true);
              }
            } else if (fmt === "xlsx") {
              const ok = exportSingleListaPresenca(t as any, membersXlsx, mes, ano);
              if (!ok) throw new Error("Turma sem dias de atendimento");
            }
            if (!result.formatosGerados.includes(fmt)) result.formatosGerados.push(fmt);
          } catch (e: any) {
            if (!result.formatosFalha.includes(fmt)) result.formatosFalha.push(fmt);
            result.mensagens.push(`${t.nome} (${fmt.toUpperCase()}): ${e?.message || "erro"}`);
          }
        }
        result.turmasProcessadas++;
      } catch (e: any) {
        result.turmasIgnoradas++;
        result.mensagens.push(`${t.nome}: ${e?.message || "erro ao carregar dados"}`);
      }
    }
  }

  result.ok = result.formatosGerados.length > 0;
  return result;
}
