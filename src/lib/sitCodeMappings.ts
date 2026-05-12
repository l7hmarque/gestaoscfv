// Mapeamento centralizado de labels textuais (vindos da IA, OCR ou
// digitação livre) para os códigos numéricos esperados pelos campos
// `sit_tipo_*` do layout SIT. Use `normalizeSitTipoDocDespesa`,
// `normalizeSitTipoDocPagamento`, `normalizeSitTipoDocFavorecido`,
// `normalizeSitTipoTransferencia` e `normalizeSitModalidadeCompra`
// antes de montar `row` / `INSERT`.

function clean(s: any): string {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Tipo de documento da DESPESA (sit_tipo_doc_despesa) */
export const SIT_TIPO_DOC_DESPESA: Record<number, { label: string; aliases: string[] }> = {
  1: { label: "Nota Fiscal", aliases: ["NF", "NFE", "NFSE", "NFS E", "NFS-E", "NOTA FISCAL", "NOTA FISCAL ELETRONICA", "NOTA FISCAL DE SERVICO", "DANFE", "INVOICE"] },
  2: { label: "Recibo", aliases: ["RECIBO", "RPA", "RECEIPT"] },
  3: { label: "Cupom Fiscal", aliases: ["CUPOM", "CUPOM FISCAL", "SAT", "CFE", "ECF"] },
  4: { label: "Boleto", aliases: ["BOLETO", "BOLETO BANCARIO", "FATURA", "DAM"] },
  5: { label: "DARF/GPS", aliases: ["DARF", "GPS", "GUIA", "GUIA RECOLHIMENTO", "DAS", "GRU", "GARE", "GUIA INSS", "GUIA FGTS"] },
  6: { label: "Folha Pagamento/Holerite", aliases: ["FOLHA", "FOLHA PAGAMENTO", "FOLHA DE PAGAMENTO", "HOLERITE", "CONTRACHEQUE", "FOLHA_PAGAMENTO", "PAYROLL"] },
  9: { label: "Outro", aliases: ["OUTRO", "OUTROS", "DIVERSOS"] },
};

/** Tipo de documento de PAGAMENTO (sit_tipo_doc_pagamento) */
export const SIT_TIPO_DOC_PAGAMENTO: Record<number, { label: string; aliases: string[] }> = {
  1: { label: "Cheque", aliases: ["CHEQUE", "CH"] },
  2: { label: "OB / Ordem Bancária", aliases: ["OB", "ORDEM BANCARIA", "ORDEM DE PAGAMENTO", "OP"] },
  3: { label: "TED", aliases: ["TED", "TRANSFERENCIA ELETRONICA", "TRANSFERENCIA"] },
  4: { label: "DOC", aliases: ["DOC"] },
  5: { label: "PIX", aliases: ["PIX", "PIX QR", "PIX QRCODE"] },
  6: { label: "Débito automático", aliases: ["DEBITO AUTOMATICO", "DEBITO EM CONTA", "DA"] },
  7: { label: "Boleto pago", aliases: ["BOLETO", "BOLETO PAGO", "PAGAMENTO BOLETO"] },
  9: { label: "Outro", aliases: ["OUTRO", "OUTROS", "DINHEIRO", "ESPECIE", "CARTAO", "CARTAO DEBITO", "CARTAO CREDITO"] },
};

/** Tipo de documento do FAVORECIDO (texto, mas normalizamos) */
export const SIT_TIPO_DOC_FAVORECIDO_ALIASES: Record<string, string[]> = {
  CNPJ: ["CNPJ", "PESSOA JURIDICA", "PJ", "EMPRESA"],
  CPF: ["CPF", "PESSOA FISICA", "PF"],
  EXT: ["EXT", "EXTERIOR", "ESTRANGEIRO", "FOREIGN"],
};

/** Tipo de transferência (sit_tipo_transferencia) */
export const SIT_TIPO_TRANSFERENCIA: Record<number, { label: string; aliases: string[] }> = {
  1: { label: "Convênio", aliases: ["CONVENIO"] },
  2: { label: "Termo de Colaboração", aliases: ["TERMO DE COLABORACAO", "COLABORACAO", "TC"] },
  3: { label: "Termo de Fomento", aliases: ["TERMO DE FOMENTO", "FOMENTO", "TF"] },
  4: { label: "Acordo de Cooperação", aliases: ["ACORDO DE COOPERACAO", "COOPERACAO", "AC"] },
  5: { label: "Contrato de Gestão", aliases: ["CONTRATO DE GESTAO", "GESTAO", "CG"] },
};

/** Modalidade de compra (sit_modalidade_compra) */
export const SIT_MODALIDADE_COMPRA: Record<number, { label: string; aliases: string[] }> = {
  1: { label: "Convite", aliases: ["CONVITE"] },
  2: { label: "Tomada de Preços", aliases: ["TOMADA DE PRECOS", "TOMADA"] },
  3: { label: "Concorrência", aliases: ["CONCORRENCIA"] },
  4: { label: "Pregão", aliases: ["PREGAO", "PREGAO ELETRONICO", "PREGAO PRESENCIAL"] },
  5: { label: "Dispensa", aliases: ["DISPENSA", "DISPENSA DE LICITACAO"] },
  6: { label: "Inexigibilidade", aliases: ["INEXIGIBILIDADE", "INEXIGIVEL"] },
  7: { label: "Cotação prévia de preços", aliases: ["COTACAO", "COTACAO PREVIA", "COTACAO DE PRECOS", "TRES ORCAMENTOS", "3 ORCAMENTOS"] },
  8: { label: "Tributos/Pessoal — Aquisição Direta", aliases: ["TRIBUTOS", "TRIBUTOS PESSOAL", "AQUISICAO DIRETA", "TRIBUTO", "FOLHA", "FGTS", "INSS", "PIS", "DARF", "GFIP", "GPS"] },
  9: { label: "Não se aplica", aliases: ["NSA", "NAO SE APLICA", "N A", "NA"] },
};

function buildResolver<K extends string | number>(
  table: Record<K, { label: string; aliases: string[] }> | Record<string, string[]>,
  isCodeMap: boolean
) {
  // Indexa: chave normalizada -> { code, alias original que matchou }
  const idx = new Map<string, { code: K; alias: string }>();
  if (isCodeMap) {
    const t = table as Record<K, { label: string; aliases: string[] }>;
    for (const k of Object.keys(t) as K[]) {
      idx.set(clean(k as any), { code: k, alias: String(k) });
      idx.set(clean(t[k].label), { code: k, alias: t[k].label });
      for (const a of t[k].aliases) idx.set(clean(a), { code: k, alias: a });
    }
  } else {
    const t = table as Record<string, string[]>;
    for (const k of Object.keys(t)) {
      idx.set(clean(k), { code: k as K, alias: k });
      for (const a of t[k]) idx.set(clean(a), { code: k as K, alias: a });
    }
  }
  return (raw: any): { code: K; alias: string } | null => {
    if (raw === null || raw === undefined || raw === "") return null;
    const c = clean(raw);
    if (!c) return null;
    if (idx.has(c)) return idx.get(c)!;
    // fallback: tenta primeira palavra (ex: "PIX (chave xxxx)" -> "PIX")
    const first = c.split(" ")[0];
    if (idx.has(first)) return idx.get(first)!;
    return null;
  };
}

const resolveTipoDocDespesa = buildResolver(SIT_TIPO_DOC_DESPESA, true);
const resolveTipoDocPagamento = buildResolver(SIT_TIPO_DOC_PAGAMENTO, true);
const resolveTipoDocFavorecido = buildResolver(SIT_TIPO_DOC_FAVORECIDO_ALIASES, false);
const resolveTipoTransferencia = buildResolver(SIT_TIPO_TRANSFERENCIA, true);
const resolveModalidadeCompra = buildResolver(SIT_MODALIDADE_COMPRA, true);

export interface SitMappingResult<T> {
  code: T | null;
  applied: boolean; // true se houve conversão de label -> código
  original: string | null;
  /** Identificador estável da regra que produziu o resultado. */
  rule: string;
  /** Quando applied=true, alias do dicionário que casou com o input. */
  matchedAlias?: string;
}

function numericResolve(
  raw: any,
  resolver: (v: any) => { code: number; alias: string } | null,
  ruleNs: string
): SitMappingResult<number> {
  if (raw === null || raw === undefined || raw === "") {
    return { code: null, applied: false, original: null, rule: `${ruleNs}.empty` };
  }
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return { code: raw, applied: false, original: String(raw), rule: `${ruleNs}.passthrough_number` };
  }
  const s = String(raw).trim();
  if (/^\d+$/.test(s)) {
    const n = parseInt(s, 10);
    return {
      code: Number.isFinite(n) ? n : null,
      applied: false,
      original: s,
      rule: `${ruleNs}.digits_only`,
    };
  }
  // Formato "1 — Nota Fiscal"
  const m = s.match(/^\s*(\d+)\s*[—\-–:]/);
  if (m) {
    const n = parseInt(m[1], 10);
    return { code: n, applied: false, original: s, rule: `${ruleNs}.numeric_prefix` };
  }
  const hit = resolver(s);
  if (!hit) return { code: null, applied: false, original: s, rule: `${ruleNs}.no_match` };
  return {
    code: hit.code,
    applied: true,
    original: s,
    rule: `${ruleNs}.alias`,
    matchedAlias: hit.alias,
  };
}

export function normalizeSitTipoDocDespesa(raw: any) {
  return numericResolve(raw, resolveTipoDocDespesa, "map.tipo_doc_despesa");
}
export function normalizeSitTipoDocPagamento(raw: any) {
  return numericResolve(raw, resolveTipoDocPagamento, "map.tipo_doc_pagamento");
}
export function normalizeSitTipoTransferencia(raw: any) {
  return numericResolve(raw, resolveTipoTransferencia, "map.tipo_transferencia");
}
export function normalizeSitModalidadeCompra(raw: any) {
  return numericResolve(raw, resolveModalidadeCompra, "map.modalidade_compra");
}

export function normalizeSitTipoDocFavorecido(raw: any): SitMappingResult<string> {
  if (raw === null || raw === undefined || raw === "") {
    return { code: null, applied: false, original: null, rule: "map.tipo_doc_favorecido.empty" };
  }
  const s = String(raw).trim();
  const hit = resolveTipoDocFavorecido(s);
  if (!hit) {
    return { code: null, applied: false, original: s, rule: "map.tipo_doc_favorecido.no_match" };
  }
  const applied = hit.code !== s.toUpperCase();
  return {
    code: hit.code,
    applied,
    original: s,
    rule: applied ? "map.tipo_doc_favorecido.alias" : "map.tipo_doc_favorecido.passthrough",
    matchedAlias: applied ? hit.alias : undefined,
  };
}

export function describeSitTipoDocDespesa(code: number | null | undefined): string {
  return code != null ? SIT_TIPO_DOC_DESPESA[code]?.label ?? `Código ${code}` : "—";
}
export function describeSitTipoDocPagamento(code: number | null | undefined): string {
  return code != null ? SIT_TIPO_DOC_PAGAMENTO[code]?.label ?? `Código ${code}` : "—";
}