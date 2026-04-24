// Gera o arquivo Despesa.txt no layout SIT/TCE-PR (pipe-delimited).
// Regras: separador "|", decimal com ponto, datas DD-MM-AAAA, sem cabeçalho,
// obrigatórios numéricos vazios = 0.00, sem acentuação em campos #.
import { format } from "date-fns";

export interface SitConfig {
  cnpj_concedente: string;
  tipo_transferencia_padrao: number;
  numero_instrumento_padrao: string;
  ano_transferencia_padrao: number;
  tipo_doc_pagamento_padrao: number;
  modalidade_compra_padrao: number;
}

const onlyDigits = (s: string | null | undefined) => (s || "").replace(/\D/g, "");
const fmtDate = (d: string | null | undefined) => {
  if (!d) return "";
  try { return format(new Date(d + "T12:00:00"), "dd-MM-yyyy"); } catch { return ""; }
};
const fmtVal = (v: number | string | null | undefined) => {
  const n = Number(v); return Number.isFinite(n) ? n.toFixed(2) : "0.00";
};
const trunc = (s: string | null | undefined, n: number) =>
  (s || "").toString().substring(0, n);

export function buildDespesaTxtLine(d: any, cfg: SitConfig): string {
  const cnpjFav = onlyDigits(d.cnpj_cpf);
  const tipoFav = d.sit_tipo_doc_favorecido || (cnpjFav.length === 14 ? "CNPJ" : cnpjFav.length === 11 ? "CPF" : "EXT");
  const cols = [
    onlyDigits(cfg.cnpj_concedente).padStart(14, "0"),                    // 1 CNPJConcedente
    String(d.sit_tipo_transferencia ?? cfg.tipo_transferencia_padrao),    // 2 tpTransferencia
    trunc(d.sit_numero_instrumento || cfg.numero_instrumento_padrao, 20), // 3 nrInternoConcedente
    String(d.sit_ano_transferencia ?? cfg.ano_transferencia_padrao),      // 4 anoTransferencia
    String(d.sit_codigo_tipo_despesa ?? "").trim(),                       // 5 tpDespesa
    tipoFav,                                                               // 6 tpDocumentoFavorecido
    tipoFav === "EXT" ? "0" : (cnpjFav || "0"),                            // 7 nrDocumentoFavorecido
    trunc(d.sit_nome_favorecido || d.fornecedor || "", 250),               // 8 nmFavorecido
    String(d.sit_tipo_doc_despesa ?? ""),                                  // 9 tpDocumentoDespesa
    trunc(d.sit_numero_doc_despesa || d.numero_documento || "", 10),       // 10 nrDocumentoDespesa
    fmtVal(d.valor),                                                        // 11 vlDocumentoDespesa
    fmtDate(d.sit_data_doc_despesa || d.data_lancamento),                  // 12 dtDocumentoDespesa
    trunc(d.sit_placa_veiculo || "", 7),                                   // 13 dsPlacaVeiculo
    d.sit_quilometragem != null ? String(d.sit_quilometragem) : "",        // 14 nrQuilometragemVeiculo
    trunc(d.sit_numero_empenho || "", 15),                                 // 15 nrEmpenho
    fmtDate(d.sit_data_empenho),                                            // 16 dtEmpenho
    String(d.sit_modalidade_compra ?? cfg.modalidade_compra_padrao),       // 17 cdModalidadeCompra
    trunc(d.sit_numero_processo || "", 10),                                // 18 nrProcessoCompra
    fmtDate(d.sit_data_processo),                                           // 19 dtProcessoCompra
    String(d.sit_tipo_doc_pagamento ?? cfg.tipo_doc_pagamento_padrao),     // 20 tpDocumentoPagamento
    trunc(d.sit_numero_doc_pagamento || "", 15),                           // 21 nrDocumentoPagamento
    fmtDate(d.sit_data_emissao_pagamento || d.data_lancamento),            // 22 dtEmissaoPagamento
    fmtDate(d.sit_data_debito),                                             // 23 dtDebito
    trunc((d.sit_descricao_item || d.descricao || "").replace(/[\r\n|]+/g, " "), 2000), // 24 dsItemDespesa
  ];
  return cols.join("|");
}

export function buildDespesaTxt(despesas: any[], cfg: SitConfig): string {
  return despesas.map(d => buildDespesaTxtLine(d, cfg)).join("\r\n") + "\r\n";
}

export function validarDespesaSit(d: any, cfg: SitConfig): string[] {
  const erros: string[] = [];
  if (!cfg.cnpj_concedente) erros.push("CNPJ do concedente não configurado");
  if (!d.sit_codigo_tipo_despesa) erros.push("Código do tipo de despesa (SIT) não preenchido");
  if (!d.sit_tipo_doc_despesa) erros.push("Tipo de documento da despesa (SIT) não preenchido");
  if (!d.sit_nome_favorecido && !d.fornecedor) erros.push("Nome do favorecido não preenchido");
  if (!d.valor || Number(d.valor) <= 0) erros.push("Valor inválido");
  if (!d.data_lancamento && !d.sit_data_doc_despesa) erros.push("Data do documento não preenchida");
  return erros;
}
