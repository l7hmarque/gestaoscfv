// Normalização + validação de despesas extraídas (IA / lote) antes do INSERT
// Centraliza limites do schema SIT e gera avisos de truncamento/conversão
// para que o usuário possa revisar antes de salvar.
import {
  normalizeSitTipoDocDespesa,
  normalizeSitTipoDocPagamento,
  normalizeSitTipoDocFavorecido,
  normalizeSitTipoTransferencia,
  normalizeSitModalidadeCompra,
  describeSitTipoDocDespesa,
  describeSitTipoDocPagamento,
} from "./sitCodeMappings";

export interface DespesaWarning {
  field: string;
  label: string;
  severity: "info" | "warn" | "error";
  message: string;
  original?: string;
  applied?: string;
  /** Identificador estável da regra disparada (ex: truncate.sit_numero_doc_despesa, map.tipo_doc_despesa.alias). */
  rule: string;
  /** Procedência do valor original. */
  source?: string;
  /** Quando vier de mapeamento label->código, qual alias casou. */
  matchedAlias?: string;
}

export interface ValidatedDespesa {
  row: Record<string, any>;
  warnings: DespesaWarning[];
  missing: string[]; // campos obrigatórios ausentes
}

const FIELD_LIMITS: Record<string, number> = {
  sit_tipo_doc_favorecido: 4,
  sit_nome_favorecido: 250,
  sit_numero_doc_despesa: 10,
  sit_numero_doc_pagamento: 15,
  sit_numero_instrumento: 20,
  sit_numero_empenho: 15,
  sit_numero_processo: 10,
  sit_placa_veiculo: 7,
};

const FIELD_LABELS: Record<string, string> = {
  sit_tipo_doc_favorecido: "Tipo doc favorecido",
  sit_nome_favorecido: "Nome do favorecido",
  sit_numero_doc_despesa: "Nº doc despesa",
  sit_numero_doc_pagamento: "Nº doc pagamento",
  sit_numero_instrumento: "Nº instrumento",
  sit_numero_empenho: "Nº empenho",
  sit_numero_processo: "Nº processo",
  sit_placa_veiculo: "Placa do veículo",
  sit_tipo_doc_despesa: "Tipo doc despesa",
  sit_tipo_doc_pagamento: "Tipo de pagamento",
  valor: "Valor",
  data_lancamento: "Data de lançamento",
  fornecedor: "Fornecedor",
};

function truncWithWarn(
  v: any,
  field: string,
  warnings: DespesaWarning[],
  source?: string
): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s) return null;
  const limit = FIELD_LIMITS[field];
  if (limit && s.length > limit) {
    const truncated = s.slice(0, limit);
    warnings.push({
      field,
      label: FIELD_LABELS[field] ?? field,
      severity: "warn",
      message: `Texto reduzido de ${s.length} para ${limit} caracteres (limite do SIT).`,
      original: s,
      applied: truncated,
      rule: `truncate.${field}`,
      source,
    });
    return truncated;
  }
  return s;
}

function toSmallIntWithWarn(
  v: any,
  field: string,
  warnings: DespesaWarning[],
  source?: string
): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const raw = String(v);
  const digits = raw.replace(/\D/g, "");
  const n = parseInt(digits, 10);
  if (!Number.isFinite(n)) {
    warnings.push({
      field,
      label: FIELD_LABELS[field] ?? field,
      severity: "error",
      message: `Valor "${raw}" não é numérico — campo ficará vazio.`,
      original: raw,
      rule: `coerce.${field}.invalid`,
      source,
    });
    return null;
  }
  if (digits !== raw.trim()) {
    warnings.push({
      field,
      label: FIELD_LABELS[field] ?? field,
      severity: "info",
      message: `Convertido de "${raw}" para o código numérico ${n}.`,
      original: raw,
      applied: String(n),
      rule: `coerce.${field}.strip_non_digits`,
      source,
    });
  }
  return n;
}

/**
 * Resolve um campo SIT que pode vir como código numérico OU como label
 * textual (ex: "NFS-e", "PIX", "Boleto"). Aplica o mapeamento centralizado
 * em `sitCodeMappings.ts` e registra um warning explicando a conversão.
 */
function resolveSitCodeWithWarn(
  v: any,
  field: string,
  resolver: (raw: any) => { code: number | null; applied: boolean; original: string | null },
  describe: (c: number | null) => string,
  warnings: DespesaWarning[],
  source?: string
): number | null {
  if (v === null || v === undefined || v === "") return null;
  const result: any = resolver(v);
  const { code, applied, original } = result;
  const matchedAlias: string | undefined = result.matchedAlias;
  const rule: string = result.rule ?? `map.${field}.unknown`;
  if (code === null) {
    warnings.push({
      field,
      label: FIELD_LABELS[field] ?? field,
      severity: "error",
      message: `Não foi possível mapear "${original}" para um código SIT — campo ficará vazio.`,
      original: original ?? undefined,
      rule,
      source,
      matchedAlias,
    });
    return null;
  }
  if (applied) {
    warnings.push({
      field,
      label: FIELD_LABELS[field] ?? field,
      severity: "info",
      message: `Label "${original}" convertido para código ${code} (${describe(code)}).`,
      original: original ?? undefined,
      applied: String(code),
      rule,
      source,
      matchedAlias,
    });
  }
  return code;
}

export function validateDespesa(
  e: any,
  ctx: { mesRef: string; storageUrl?: string }
): ValidatedDespesa {
  const warnings: DespesaWarning[] = [];
  const missing: string[] = [];

  const cnpjcpf = (e.cnpj_cpf || "").replace(/\D/g, "");
  const tipoFavSource = e.sit_tipo_doc_favorecido
    ? "ai.sit_tipo_doc_favorecido"
    : cnpjcpf.length === 14
    ? "derived.cnpj_cpf=CNPJ"
    : cnpjcpf.length === 11
    ? "derived.cnpj_cpf=CPF"
    : "missing";
  const tipoFavRawInput =
    e.sit_tipo_doc_favorecido ||
    (cnpjcpf.length === 14 ? "CNPJ" : cnpjcpf.length === 11 ? "CPF" : null);
  const tipoFavMap: any = normalizeSitTipoDocFavorecido(tipoFavRawInput);
  if (tipoFavRawInput && !tipoFavMap.code) {
    warnings.push({
      field: "sit_tipo_doc_favorecido",
      label: FIELD_LABELS.sit_tipo_doc_favorecido,
      severity: "error",
      message: `Tipo de favorecido "${tipoFavRawInput}" não reconhecido (use CNPJ, CPF ou EXT).`,
      original: String(tipoFavRawInput),
      rule: tipoFavMap.rule ?? "map.tipo_doc_favorecido.no_match",
      source: tipoFavSource,
    });
  } else if (tipoFavMap.applied) {
    warnings.push({
      field: "sit_tipo_doc_favorecido",
      label: FIELD_LABELS.sit_tipo_doc_favorecido,
      severity: "info",
      message: `"${tipoFavMap.original}" convertido para "${tipoFavMap.code}".`,
      original: tipoFavMap.original ?? undefined,
      applied: tipoFavMap.code ?? undefined,
      rule: tipoFavMap.rule ?? "map.tipo_doc_favorecido.alias",
      source: tipoFavSource,
      matchedAlias: tipoFavMap.matchedAlias,
    });
  }
  const tipoFav = truncWithWarn(
    tipoFavMap.code ?? tipoFavRawInput,
    "sit_tipo_doc_favorecido",
    warnings,
    tipoFavSource
  );
  const nomeFav = truncWithWarn(
    e.sit_nome_favorecido || e.fornecedor,
    "sit_nome_favorecido",
    warnings,
    e.sit_nome_favorecido ? "ai.sit_nome_favorecido" : "ai.fornecedor"
  );
  const numDocDespesa = truncWithWarn(
    e.sit_numero_doc_despesa || e.numero_documento,
    "sit_numero_doc_despesa",
    warnings,
    e.sit_numero_doc_despesa ? "ai.sit_numero_doc_despesa" : "ai.numero_documento"
  );
  const numDocPagamento = truncWithWarn(
    e.sit_numero_doc_pagamento,
    "sit_numero_doc_pagamento",
    warnings,
    "ai.sit_numero_doc_pagamento"
  );
  const numInstrumento = truncWithWarn(
    e.sit_numero_instrumento,
    "sit_numero_instrumento",
    warnings,
    "ai.sit_numero_instrumento"
  );

  const tipoDocDespesa = resolveSitCodeWithWarn(
    e.sit_tipo_doc_despesa ?? e.tipo_documento,
    "sit_tipo_doc_despesa",
    normalizeSitTipoDocDespesa,
    describeSitTipoDocDespesa,
    warnings,
    e.sit_tipo_doc_despesa ? "ai.sit_tipo_doc_despesa" : "ai.tipo_documento"
  );
  const tipoDocPagamento = resolveSitCodeWithWarn(
    e.sit_tipo_doc_pagamento ?? e.forma_pagamento,
    "sit_tipo_doc_pagamento",
    normalizeSitTipoDocPagamento,
    describeSitTipoDocPagamento,
    warnings,
    e.sit_tipo_doc_pagamento ? "ai.sit_tipo_doc_pagamento" : "ai.forma_pagamento"
  );
  const tipoTransferencia = resolveSitCodeWithWarn(
    e.sit_tipo_transferencia,
    "sit_tipo_doc_despesa", // reaproveita label genérico se faltar; ok pois é só pra warning
    normalizeSitTipoTransferencia,
    (c) => `tipo transferência ${c}`,
    warnings,
    "ai.sit_tipo_transferencia"
  );
  const modalidadeCompra = resolveSitCodeWithWarn(
    e.sit_modalidade_compra,
    "sit_tipo_doc_despesa",
    normalizeSitModalidadeCompra,
    (c) => `modalidade ${c}`,
    warnings,
    "ai.sit_modalidade_compra"
  );

  // Obrigatórios
  if (!e.valor || Number(e.valor) <= 0) missing.push("valor");
  if (!e.data_lancamento) missing.push("data_lancamento");
  if (!e.fornecedor && !nomeFav) missing.push("fornecedor");
  if (!tipoDocDespesa) missing.push("sit_tipo_doc_despesa");
  if (!tipoDocPagamento) missing.push("sit_tipo_doc_pagamento");

  // Avisos sobre fallbacks aplicados silenciosamente
  if (!e.descricao) {
    warnings.push({
      field: "descricao",
      label: "Descrição",
      severity: "info",
      message: 'Sem descrição extraída — será gravado "Sem descrição".',
      rule: "default.descricao.placeholder",
      source: "ai.descricao",
    });
  }
  if (!e.data_lancamento) {
    warnings.push({
      field: "data_lancamento",
      label: "Data de lançamento",
      severity: "warn",
      message: "Data não detectada — será usada a data de hoje.",
      rule: "default.data_lancamento.today",
      source: "ai.data_lancamento",
    });
  }
  if (!ctx.storageUrl) {
    warnings.push({
      field: "comprovante",
      label: "Comprovante",
      severity: "info",
      message: "Sem comprovante anexado — despesa entrará como pendente.",
      rule: "default.comprovante.pendente",
      source: "upload",
    });
  }

  const obrigatoriosOk = missing.length === 0;

  const row = {
    descricao: e.descricao || "Sem descrição",
    valor: Number(e.valor) || 0,
    data_lancamento: e.data_lancamento || new Date().toISOString().split("T")[0],
    categoria_id: null,
    mes_referencia: ctx.mesRef,
    fornecedor: e.fornecedor || e.sit_nome_favorecido || null,
    cnpj_cpf: e.cnpj_cpf || null,
    numero_documento: e.numero_documento || e.sit_numero_doc_despesa || null,
    tipo_documento: e.tipo_documento || "nota_fiscal",
    nota_url: ctx.storageUrl || null,
    sit_tipo_doc_favorecido: tipoFav,
    sit_nome_favorecido: nomeFav,
    sit_tipo_doc_despesa: tipoDocDespesa,
    sit_numero_doc_despesa: numDocDespesa,
    sit_data_doc_despesa: e.sit_data_doc_despesa || e.data_lancamento || null,
    sit_tipo_doc_pagamento: tipoDocPagamento,
    sit_numero_doc_pagamento: numDocPagamento,
    sit_data_emissao_pagamento: e.sit_data_emissao_pagamento || null,
    sit_data_debito: e.sit_data_debito || null,
    sit_numero_instrumento: numInstrumento,
    sit_ano_transferencia: e.sit_ano_transferencia ?? null,
    sit_tipo_transferencia: tipoTransferencia ?? e.sit_tipo_transferencia ?? null,
    sit_modalidade_compra: modalidadeCompra ?? e.sit_modalidade_compra ?? null,
    sit_descricao_item: e.sit_descricao_item || e.descricao || null,
    sit_completo: obrigatoriosOk,
    pendente_comprovante: !ctx.storageUrl,
    lote_origem_pdf: ctx.storageUrl || null,
  };

  return { row, warnings, missing };
}

export function missingFieldLabel(field: string): string {
  return FIELD_LABELS[field] ?? field;
}