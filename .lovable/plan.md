## Visão geral

Hoje existem 3 categorias de upload financeiro que rodam em fluxos separados (Despesas, Controle Bancário, Orçamentos). A proposta cria **um único hub de importação** ("Caixa de Entrada Financeira") onde a IA classifica cada PDF por tipo (Despesa comum, Tributo, Folha, Orçamento/Mapa, Controle Bancário) e decide o destino + modalidade. Inclui regras específicas de tributos federais e classificação automática de modalidade de compra a partir de orçamentos previamente importados.

---

## 1. Tributos federais (DARF / GFIP)

Acrescentar regras dedicadas ao prompt do `detect-despesa-from-doc`:

**Detecção:** documento contém "DARF", "GPS", "GFIP", "FGTS", "INSS", "PIS", "COFINS", "Receita Federal", "Caixa Econômica".

**Mapeamento automático por tributo (preenchido pela IA, sem digitação):**

| Tributo | tipo_documento | sit_tipo_doc_despesa | Fornecedor (forçado) | CNPJ (forçado) | Rubrica |
|---|---|---|---|---|---|
| INSS / GPS | `darf` | 8 (DARF) | MINISTERIO DA FAZENDA - ATUAL | 00.394.460/0001-41 | 3.1.90.13.02 |
| PIS | `darf` | 8 (DARF) | MINISTERIO DA FAZENDA - ATUAL | 00.394.460/0001-41 | 3.3.90.47.99 |
| FGTS | `gfip` | 10 (GFIP) | CAIXA ECONOMICA FEDERAL - BRASILIA | 00.360.305/0001-04 | 3.1.90.13.01 |
| Outros DARFs | `darf` | 8 | MINISTERIO DA FAZENDA - ATUAL | 00.394.460/0001-41 | 3.3.90.47.99 |

**Datas:** a IA extrai a data de **emissão do pagamento** do canto superior direito do documento (autenticação bancária / data de pagamento) e usa esse valor para `sit_data_emissao_pagamento` e `sit_data_debito`. `sit_data_doc_despesa` = mesma data (DARF/GFIP não têm data de "emissão de NF" separada).

**Modalidade:** todos os tributos recebem `sit_modalidade_compra = 8` (Tributos/Pessoal — aquisição direta). Adicionar esse código ao `sitCodeMappings.ts` se ainda não existir.

**Adicionar em `TIPOS_DOCUMENTO`** (FinanceiroPage.tsx) os labels "DARF — Federal" e "GFIP — FGTS".

---

## 2. Classificação automática de Modalidade de Compra

**Regra padrão:** toda despesa nova entra com `sit_modalidade_compra = 6` (Tributos/Pessoal — aquisição direta), exceto quando vinculada a um orçamento aprovado → `5` (Pesquisa de preço).

**Como vincular despesa ↔ orçamento:**

a) **Vínculo manual já existente** no módulo Orçamentos (campo `orcamento_id` na despesa, quando o usuário cria a despesa a partir de um item de orçamento aprovado) → mantém-se e força modalidade 5.

b) **Novo vínculo via IA na importação:** após o `detect-despesa-from-doc`, rodar um *matcher* (no servidor) que compara cada despesa extraída com itens de **orçamentos APROVADOS no mesmo mês** usando:
   - CNPJ do fornecedor vencedor + valor (±2%) + descrição (similaridade trigram > 0.4)
   - Score ≥ 0.7 → vincula `orcamento_id` automaticamente e marca modalidade 5
   - Score 0.4–0.7 → mostra sugestão no `ImportReviewDialog` ("Possível vínculo com orçamento X — confirmar?")
   - Sem match → modalidade 6 padrão

c) **Upload de mapa comparativo:** novo tipo de documento "Mapa Comparativo / Orçamento". A IA extrai os 3 fornecedores com seus valores e cria/atualiza um `orcamento` na tabela existente. Reutiliza a estrutura de `OrcamentosTab.tsx`, com edge function nova `detect-orcamento-from-doc`. Campo extra: `vencedor_cnpj` para alimentar o matcher do item (b).

---

## 3. Hub de Importação Unificado ("Caixa de Entrada")

Substitui as 3 abas separadas por **1 dropzone única** que aceita múltiplos arquivos. Para cada arquivo, a IA decide o tipo:

```text
                    ┌─────────────────────────┐
                    │  Upload (1..N arquivos) │
                    └───────────┬─────────────┘
                                ▼
                    ┌─────────────────────────┐
                    │ classify-financeiro-doc │  (nova edge function)
                    │  → tipo + confiança     │
                    └───────────┬─────────────┘
                                ▼
       ┌────────────────┬──────────────┬─────────────┬──────────────┐
       ▼                ▼              ▼             ▼              ▼
 detect-despesa   detect-orcamento  detect-controle  (folha)     (tributo)
       │                │              │             │              │
       └────────────────┴──────────────┴─────────────┴──────────────┘
                                ▼
                    ┌─────────────────────────┐
                    │ ImportReviewDialog v2   │
                    │ - lista por categoria   │
                    │ - vínculos sugeridos    │
                    │ - status SIT por linha  │
                    └─────────────────────────┘
```

**Nova edge function `classify-financeiro-doc`:** chamada barata (gemini-flash-lite) que retorna `{ tipo: "despesa" | "tributo" | "folha" | "orcamento" | "controle_bancario", confidence }` analisando 1ª página. Em paralelo dispara o detector específico.

**Ordem recomendada (UX):** o usuário pode jogar tudo de uma vez; o backend processa em ordem otimizada:
1. **Orçamentos** (precisam existir antes para o matcher)
2. **Controle Bancário** (define `ordem_prestacao`)
3. **Despesas, Folha, Tributos** (usam orçamentos + controle bancário para classificar)

Exibido na UI como "Etapa 1/3 — Processando orçamentos…".

---

## 4. Garantia de conformidade do Despesa.txt (SIT)

Auditoria do `sitExport.ts` para garantir layout oficial do TCE-PR antes do release:

- **Campos obrigatórios** (1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 17, 20, 21, 22, 23) já cobertos; reforçar validação **bloqueante** quando algum estiver vazio.
- **CNPJ do concedente:** sempre 14 dígitos com zero-padding ✓ (já existe).
- **Datas:** `dd-MM-aaaa` ✓.
- **Decimal:** ponto com 2 casas ✓; reforçar truncamento (não arredondar) — alterar `fmtVal` para `Math.trunc(n*100)/100`.
- **Sem acentuação** nos campos de texto: aplicar `.normalize("NFD").replace(/[\u0300-\u036f]/g, "")` em `nmFavorecido` e `dsItemDespesa` (TCE-PR rejeita acentos).
- **Sem pipe interno:** já filtrado em `dsItemDespesa`; estender para todos os campos texto.
- **Quebra de linha CRLF** ✓.
- **Sem cabeçalho** ✓ (já confirmado em memory).
- **`sit_codigo_tipo_despesa` (campo 5):** validar que está preenchido (vinha sendo opcional para tributos — agora derivado da rubrica).
- **Tributos:** garantir que `sit_tipo_doc_despesa` = 8 ou 10, `sit_modalidade_compra` = 8, e `nrDocumentoDespesa` use o nº de autenticação da DARF/GFIP (até 10 chars).

Adicionar **dry-run validator** que roda 100% das despesas do mês antes de gerar o ZIP e bloqueia exportação se houver erro crítico, com link direto para a linha problemática.

---

## 5. Detalhes técnicos

**Arquivos a editar/criar:**

- `supabase/functions/detect-despesa-from-doc/index.ts` — adicionar regras de tributos no SYSTEM_PROMPT, forçar fornecedor/CNPJ por tipo de tributo, mapear modalidade 8.
- `supabase/functions/classify-financeiro-doc/index.ts` *(nova)* — classificador leve gemini-flash-lite.
- `supabase/functions/detect-orcamento-from-doc/index.ts` *(nova)* — extrai 3 fornecedores + valores + vencedor.
- `supabase/functions/match-despesa-orcamento/index.ts` *(nova, opcional)* — RPC alternativa: matcher SQL via pg_trgm.
- `src/lib/sitCodeMappings.ts` — adicionar modalidade 8 (Tributos/Pessoal), confirmar mapeamento DARF=8 e GFIP=10.
- `src/lib/sitExport.ts` — sanitização de acentos, truncamento (não arredondamento), pipe-strip global.
- `src/lib/despesaImportValidation.ts` — derivar modalidade 5 quando `orcamento_id` presente; padrão 6/8 conforme tipo.
- `src/pages/financeiro/FinanceiroPage.tsx` — substituir 3 cards de upload por um único hub; adicionar TIPOS_DOCUMENTO darf/gfip/orcamento.
- `src/components/financeiro/ImportReviewDialog.tsx` — agrupar por categoria (Despesas / Tributos / Folha / Orçamentos / Bancário); coluna "Vínculo orçamento" com sugestões.
- Migration: `ALTER TABLE despesas ADD COLUMN orcamento_id uuid REFERENCES orcamentos(id);` (se não existir) + índice trigram em `orcamentos.descricao` e `orcamentos_itens.fornecedor_nome`.

**Compatibilidade:** os 3 botões antigos de upload continuam funcionando (redirecionam para o hub) por 1 release antes de serem removidos.

---

## Resposta direta às perguntas

1. **Identificar/classificar despesas via orçamento:** matcher automático CNPJ+valor+similaridade após upload, com sugestão visível no review. Manual também continua disponível.
2. **Upload de orçamentos/mapas comparativos:** sim — novo tipo "Mapa Comparativo" extraído por IA, alimenta a tabela `orcamentos` e o matcher.
3. **Ordem das importações:** Orçamentos → Controle Bancário → Despesas/Folha/Tributos. O hub unificado faz isso sozinho mesmo com upload simultâneo.
4. **Despesa.txt conforme SIT:** auditoria + sanitização + dry-run validator antes do ZIP.
5. **Importar tudo de uma vez:** sim — Hub de Caixa de Entrada com classificador IA roteando cada arquivo automaticamente.