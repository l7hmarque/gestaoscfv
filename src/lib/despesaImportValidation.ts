// Normalização + validação de despesas extraídas (IA / lote) antes do INSERT
// Centraliza limites do schema SIT e gera avisos de truncamento/conversão
// para que o usuário possa revisar antes de salvar.

export interface DespesaWarning {
  field: string;
  label: string;
  severity: "info" | "warn" | "error";
  message: string;
  original?: string;
  applied?: string;
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
  warnings: DespesaWarning[]
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
    });
    return truncated;
  }
  return s;
}

function toSmallIntWithWarn(
  v: any,
  field: string,
  warnings: DespesaWarning[]
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
    });
  }
  return n;
}

export function validateDespesa(
  e: any,
  ctx: { mesRef: string; storageUrl?: string }
): ValidatedDespesa {
  const warnings: DespesaWarning[] = [];
  const missing: string[] = [];

  const cnpjcpf = (e.cnpj_cpf || "").replace(/\D/g, "");
  const tipoFavRaw =
    e.sit_tipo_doc_favorecido ||
    (cnpjcpf.length === 14 ? "CNPJ" : cnpjcpf.length === 11 ? "CPF" : null);

  const tipoFav = truncWithWarn(tipoFavRaw, "sit_tipo_doc_favorecido", warnings);
  const nomeFav = truncWithWarn(
    e.sit_nome_favorecido || e.fornecedor,
    "sit_nome_favorecido",
    warnings
  );
  const numDocDespesa = truncWithWarn(
    e.sit_numero_doc_despesa || e.numero_documento,
    "sit_numero_doc_despesa",
    warnings
  );
  const numDocPagamento = truncWithWarn(
    e.sit_numero_doc_pagamento,
    "sit_numero_doc_pagamento",
    warnings
  );
  const numInstrumento = truncWithWarn(
    e.sit_numero_instrumento,
    "sit_numero_instrumento",
    warnings
  );

  const tipoDocDespesa = toSmallIntWithWarn(
    e.sit_tipo_doc_despesa,
    "sit_tipo_doc_despesa",
    warnings
  );
  const tipoDocPagamento = toSmallIntWithWarn(
    e.sit_tipo_doc_pagamento,
    "sit_tipo_doc_pagamento",
    warnings
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
    });
  }
  if (!e.data_lancamento) {
    warnings.push({
      field: "data_lancamento",
      label: "Data de lançamento",
      severity: "warn",
      message: "Data não detectada — será usada a data de hoje.",
    });
  }
  if (!ctx.storageUrl) {
    warnings.push({
      field: "comprovante",
      label: "Comprovante",
      severity: "info",
      message: "Sem comprovante anexado — despesa entrará como pendente.",
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