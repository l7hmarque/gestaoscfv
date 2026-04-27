import { supabase } from "@/integrations/supabase/client";

/**
 * Geração de DOCX em formato padrão para a Biblioteca de Documentos.
 *
 * Estratégia: reusa os builders `buildRelatorioDocxBlob` /
 * `buildPlanejamentoDocxBlob` em `useDocumentExport.ts`, que retornam um
 * Blob diretamente (sem disparar download). Isso evita o monkey-patch de
 * `file-saver`, que falha em build ESM (exports são read-only).
 */

async function carregarRelatorioCompleto(id: string) {
  const { data: rel, error } = await supabase
    .from("relatorios_atividade")
    .select("*, profiles!relatorios_atividade_educador_id_fkey(nome)")
    .eq("id", id)
    .maybeSingle();
  if (error || !rel) throw new Error(error?.message || "Relatório não encontrado");

  const { data: turmas } = await supabase
    .from("relatorio_turmas")
    .select("turmas(nome)")
    .eq("relatorio_id", id);
  const turmaNames = (turmas || []).map((t: any) => t.turmas?.nome).filter(Boolean);

  const { data: presenca } = await supabase
    .from("relatorio_presenca")
    .select("presente, justificativa, participantes(nome_completo)")
    .eq("relatorio_id", id);

  const { data: fotos } = await supabase
    .from("relatorio_fotos")
    .select("foto_url")
    .eq("relatorio_id", id);

  return { rel, turmaNames, presenca: presenca || [], fotos: fotos || [] };
}

async function carregarPlanejamentoCompleto(id: string) {
  const { data: pl, error } = await supabase
    .from("planejamentos")
    .select("*, profiles!planejamentos_educador_id_fkey(nome)")
    .eq("id", id)
    .maybeSingle();
  if (error || !pl) throw new Error(error?.message || "Planejamento não encontrado");

  const { data: turmas } = await supabase
    .from("planejamento_turmas")
    .select("turmas(nome)")
    .eq("planejamento_id", id);
  const turmaNames = (turmas || []).map((t: any) => t.turmas?.nome).filter(Boolean);

  return { pl, turmaNames };
}

export async function gerarDocxRelatorioBlob(id: string): Promise<Blob> {
  const { buildRelatorioDocxBlob } = await import("@/hooks/useDocumentExport");
  const { rel, turmaNames, presenca, fotos } = await carregarRelatorioCompleto(id);
  return buildRelatorioDocxBlob(rel, turmaNames, presenca, fotos);
}

export async function gerarDocxPlanejamentoBlob(id: string): Promise<Blob> {
  const { buildPlanejamentoDocxBlob } = await import("@/hooks/useDocumentExport");
  const { pl, turmaNames } = await carregarPlanejamentoCompleto(id);
  return buildPlanejamentoDocxBlob(pl, turmaNames);
}

/**
 * Garante que o documento exista no Storage. Se não, gera, faz upload
 * e atualiza o registro `biblioteca_documentos`. Retorna o Blob.
 */
export async function obterOuGerarDocx(doc: {
  id: string;
  tipo: "relatorio" | "planejamento";
  origem_id: string;
  storage_path: string;
  status: string;
}): Promise<Blob> {
  // 1. Tenta baixar do Storage se já gerado
  if (doc.status === "gerado") {
    const { data, error } = await supabase.storage
      .from("biblioteca-docx")
      .download(doc.storage_path);
    if (!error && data) return data;
  }

  // 2. Gera sob demanda
  const blob = doc.tipo === "relatorio"
    ? await gerarDocxRelatorioBlob(doc.origem_id)
    : await gerarDocxPlanejamentoBlob(doc.origem_id);

  // 3. Faz upload e marca como gerado (best-effort; ignora erros de RLS/perm)
  try {
    await supabase.storage
      .from("biblioteca-docx")
      .upload(doc.storage_path, blob, {
        upsert: true,
        contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });
    await supabase
      .from("biblioteca_documentos")
      .update({
        status: "gerado",
        gerado_em: new Date().toISOString(),
        file_size_bytes: blob.size,
      })
      .eq("id", doc.id);
  } catch (e) {
    console.warn("[biblioteca] upload/update falhou:", e);
  }

  return blob;
}

/**
 * Garante o registro na tabela `biblioteca_documentos` para a origem dada.
 * Chamado após salvar relatório/planejamento.
 */
export async function enfileirarDocBiblioteca(
  tipo: "relatorio" | "planejamento",
  origemId: string
): Promise<void> {
  try {
    await supabase.rpc("enqueue_biblioteca_doc", {
      _tipo: tipo,
      _origem_id: origemId,
    });
  } catch (e) {
    console.warn("[biblioteca] enqueue falhou:", e);
  }
}

export function nomeArquivoDoc(doc: {
  tipo: string;
  titulo: string;
  data_referencia: string;
  educador_nome: string | null;
}): string {
  const safe = (s: string) =>
    s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\w\s-]/g, "").replace(/\s+/g, "_").slice(0, 60);
  const tipoLabel = doc.tipo === "relatorio" ? "Relatorio" : "Planejamento";
  const data = doc.data_referencia.replace(/-/g, "");
  const titulo = safe(doc.titulo);
  const educador = doc.educador_nome ? `_${safe(doc.educador_nome)}` : "";
  return `SysCFV_${tipoLabel}_${data}_${titulo}${educador}.docx`;
}