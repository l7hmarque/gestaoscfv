// Matcher despesa ↔ orçamento aprovado.
// Para cada despesa do lote, busca um orçamento APROVADO no mesmo mês cujo
// fornecedor (CNPJ ou nome) bata com o da despesa. Quando encontra, define
// `orcamento_id` e `sit_modalidade_compra = 7` (Cotação prévia / Pesquisa de preço).
import { supabase } from "@/integrations/supabase/client";

const onlyDigits = (s: any) => String(s || "").replace(/\D/g, "");
const norm = (s: any) =>
  String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export interface OrcamentoMatch {
  orcamento_id: string;
  titulo: string;
  fornecedor_vencedor: string | null;
}

export async function applyOrcamentoMatching(
  rows: any[],
  mesRef: string
): Promise<{ rows: any[]; matchedCount: number }> {
  if (!rows.length) return { rows, matchedCount: 0 };

  const { data: orcs } = await supabase
    .from("orcamentos")
    .select("id, titulo, mes_referencia, status, fornecedor_vencedor, cnpj_vencedor, categoria_id")
    .eq("mes_referencia", mesRef)
    .eq("status", "aprovado");

  const orcamentos = orcs || [];
  if (!orcamentos.length) return { rows, matchedCount: 0 };

  let matched = 0;
  const next = rows.map((r) => {
    if (r.orcamento_id) return r; // já vinculado manualmente
    const cnpjDesp = onlyDigits(r.cnpj_cpf);
    const nomeDesp = norm(r.fornecedor || r.sit_nome_favorecido);
    const hit = orcamentos.find((o: any) => {
      const cnpjOrc = onlyDigits(o.cnpj_vencedor);
      if (cnpjDesp && cnpjOrc && cnpjDesp === cnpjOrc) return true;
      const nomeOrc = norm(o.fornecedor_vencedor);
      return !!nomeOrc && !!nomeDesp && (nomeOrc === nomeDesp || nomeOrc.includes(nomeDesp) || nomeDesp.includes(nomeOrc));
    });
    if (!hit) {
      // Sem orçamento aprovado correspondente: se o usuário marcou
      // o PDF com marca-texto amarelo, ainda assim mantém modalidade 7
      // (Pesquisa de Preço) — apenas o vínculo `orcamento_id` fica nulo.
      if (r.marcado_orcamento === true) {
        return { ...r, sit_modalidade_compra: 7 };
      }
      return r;
    }
    matched++;
    return {
      ...r,
      orcamento_id: hit.id,
      sit_modalidade_compra: 7, // Cotação prévia de preços
      categoria_id: r.categoria_id || hit.categoria_id || null,
    };
  });

  return { rows: next, matchedCount: matched };
}