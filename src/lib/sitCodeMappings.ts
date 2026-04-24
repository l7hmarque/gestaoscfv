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
  9: { label: "Não se aplica", aliases: ["NSA", "NAO SE APLICA", "N A", "NA"] },
};

function buildResolver<K extends string | number>(
  table: Record<K, { label: string; aliases: string[] }> | Record<string, string[]>,
  isCodeMap: boolean
) {
  const idx = new Map<string, K>();
  if (isCodeMap) {
    const t = table as Record<K, { label: string; aliases: string[] }>;
    for (const k of Object.keys(t) as K[]) {
      idx.set(clean(k as any), k);
      idx.set(clean(t[k].label), k);
      for (const a of t[k].aliases) idx.set(clean(a), k);
    }
  } else {
    const t = table as Record<string, string[]>;
    for (const k of Object.keys(t)) {
      idx.set(clean(k), k as K);
      for (const a of t[k]) idx.set(clean(a), k as K);
    }
  }
  return (raw: any): K | null => {
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
}

function numericResolve(
  raw: any,
  resolver: (v: any) => number | null
): SitMappingResult<number> {
  if (raw === null || raw === undefined || raw === "") return { code: null, applied: false, original: null };
  // Se já é número válido, retorna direto
  if (typeof raw === "number" && Number.isFinite(raw)) return { code: raw, applied: false, original: String(raw) };
  const s = String(raw).trim();
  // Apenas dígitos -> usa direto
  if (/^\d+$/.test(s)) {
    const n = parseInt(s, 10);
    return { code: Number.isFinite(n) ? n : null, applied: false, original: s };
  }
  // Tenta extrair código numérico no formato "1 — Nota Fiscal"
  const m = s.match(/^\s*(\d+)\s*[—\-–:]/);
  if (m) {
    const n = parseInt(m[1], 10);
    return { code: n, applied: false, original: s };
  }
  const code = resolver(s);
  return { code, applied: code !== null, original: s };
}

export function normalizeSitTipoDocDespesa(raw: any) {
  return numericResolve(raw, resolveTipoDocDespesa);
}
export function normalizeSitTipoDocPagamento(raw: any) {
  return numericResolve(raw, resolveTipoDocPagamento);
}
export function normalizeSitTipoTransferencia(raw: any) {
  return numericResolve(raw, resolveTipoTransferencia);
}
export function normalizeSitModalidadeCompra(raw: any) {
  return numericResolve(raw, resolveModalidadeCompra);
}

export function normalizeSitTipoDocFavorecido(raw: any): SitMappingResult<string> {
  if (raw === null || raw === undefined || raw === "") return { code: null, applied: false, original: null };
  const s = String(raw).trim();
  const c = resolveTipoDocFavorecido(s);
  return { code: c, applied: c !== null && c !== s.toUpperCase(), original: s };
}

export function describeSitTipoDocDespesa(code: number | null | undefined): string {
  return code != null ? SIT_TIPO_DOC_DESPESA[code]?.label ?? `Código ${code}` : "—";
}
export function describeSitTipoDocPagamento(code: number | null | undefined): string {
  return code != null ? SIT_TIPO_DOC_PAGAMENTO[code]?.label ?? `Código ${code}` : "—";
}