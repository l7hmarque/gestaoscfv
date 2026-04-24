# Plano — Importação de despesas com rastreabilidade e revisão completa

Quatro melhorias no fluxo de importação por PDF/IA do módulo Financeiro: telemetria detalhada do validador, histórico persistente por lote, edição inline antes do lançamento e bloqueio quando há pendências.

## 1. Logs detalhados de transformação no validador

Estender `src/lib/despesaImportValidation.ts` e `src/lib/sitCodeMappings.ts` para registrar, em cada warning, exatamente **como** a transformação aconteceu — não só o resultado.

Cada `DespesaWarning` ganha campos novos:
- `rule` — identificador estável da regra aplicada (ex: `truncate.sit_numero_doc_despesa`, `map.tipo_doc_despesa.alias`, `map.tipo_doc_despesa.numeric_prefix`, `fallback.cnpj_to_tipo_favorecido`, `default.data_lancamento.today`).
- `source` — de onde veio o valor original (`ai.sit_tipo_doc_despesa`, `ai.tipo_documento`, `derived.cnpj_cpf`, `user_edit`).
- `matchedAlias` — quando vem do mapeamento label→código, qual alias bateu (ex: `"NFS E"` matched in `SIT_TIPO_DOC_DESPESA[1]`).

O modal de revisão exibe esses metadados em formato compacto: `Tipo doc despesa: "NFS-e" → 1 (Nota Fiscal) [regra: map.tipo_doc_despesa.alias, alias: NFS E]`. Um botão "Copiar diagnóstico" copia para a área de transferência um JSON com `{ fileName, despIdx, original, warnings, missing }` por despesa, para colar em correções de prompts da IA ou em chamados.

Adicionalmente, ao processar um lote o `confirmAndSaveImportedDocs` faz `console.groupCollapsed("[ImportDespesas] lote <id>")` e loga: arquivos processados, totais OK/ajuste/bloqueado, e a lista de regras únicas que foram disparadas com contagem (`truncate.sit_numero_doc_despesa: 4×`, `map.tipo_doc_pagamento.alias: 7×`).

## 2. Histórico persistente por lote de importação

Nova tabela `despesa_lotes_importacao` (migration):
- `id uuid pk`
- `confirmado_por uuid` (auth.uid)
- `confirmado_por_nome text`
- `confirmado_em timestamptz default now()`
- `mes_referencia text`
- `total_despesas int`, `total_ok int`, `total_ajustes int`, `total_bloqueadas int`
- `arquivos jsonb` — `[{ fileName, storageUrl, qtdDespesas }]`
- `resumo_warnings jsonb` — agregação por `rule` com contagem
- `lote_id uuid` (mesmo `lote_id` injetado nas linhas de `despesas`, permite navegar)

RLS:
- SELECT: autenticado.
- INSERT: coordenação OU técnico.
- UPDATE/DELETE: bloqueado (histórico imutável).

`confirmAndSaveImportedDocs` passa a, depois do `INSERT` em `despesas`, gravar uma linha em `despesa_lotes_importacao` com o snapshot do lote.

Nova aba na página Financeiro: **"Lotes importados"** (ou seção dentro da aba Despesas). Lista paginada com:
- Data/hora, responsável, mês de referência, badges OK/ajustes/bloqueadas, nº de arquivos.
- Botão "Ver despesas do lote" → abre modal listando despesas filtradas por `lote_id`, com link direto para Regularizar cada uma.
- Botão "Baixar diagnóstico" → JSON dos warnings agregados (útil para corrigir templates de PDF).

## 3. Edição inline pré-confirmação no modal de revisão

Refatorar o modal `reviewOpen` em `FinanceiroPage.tsx` para que cada linha de despesa expanda em um editor inline mostrando **apenas os campos com warning ou missing**, mais os campos-chave SIT.

Comportamento:
- Cada item da lista vira um `<Collapsible>`. Cabeçalho mantém badge OK/ajustes/bloqueada como hoje.
- Ao expandir, renderiza um mini-formulário em grid com inputs controlados para: `descricao`, `fornecedor`, `cnpj_cpf`, `valor`, `data_lancamento`, `sit_nome_favorecido`, `sit_tipo_doc_favorecido` (Select CNPJ/CPF/EXT), `sit_tipo_doc_despesa` (Select com os 6 códigos), `sit_numero_doc_despesa`, `sit_data_doc_despesa`, `sit_tipo_doc_pagamento` (Select), `sit_numero_doc_pagamento`, `sit_data_debito`.
- Inputs com limites (ex: `sit_numero_doc_despesa`) usam `maxLength` + contador `7/10` para evitar truncamento posterior.
- Cada alteração chama `updateDocExtracted(docIdx, despIdx, field, value)` (já existe). O `validatedDocs` é recalculado a cada render, então badges/warnings atualizam em tempo real — o usuário vê o erro sumir conforme edita.
- Botão **"Aplicar sugestão da IA"** ao lado de cada warning de mapeamento: preenche o campo com o `applied` proposto e marca `source: "user_edit"` no próximo recálculo.
- Botão **"Remover esta despesa"** por linha (já existe `removeDespesa`, só expor no modal).

## 4. Bloqueio automático quando há campos obrigatórios ausentes

Mudar a regra atual (que apenas avisa) para bloquear o lançamento.

- Botão "Confirmar e lançar" fica `disabled` quando `totalWithMissing > 0`. Tooltip: "Resolva as N despesas com campos obrigatórios ausentes antes de lançar."
- Topo do modal ganha banner vermelho fixo quando há bloqueios, com botão **"Mostrar só pendências"** que filtra a lista para itens com `missing.length > 0`.
- A ordenação da lista passa a ser: bloqueadas primeiro, depois ajustes, depois OK — facilitando atacar pendências.
- Cada arquivo no agrupamento mostra contadores próprios (ex: `relatorio.pdf — 12 despesas (2 bloqueadas, 5 ajustes, 5 OK)`).
- Remover o texto atual "serão lançadas como incompletas" e a flag `sit_completo: obrigatoriosOk` continua sendo gravada (despesas só entram via revisão limpa).
- O botão `Regularizar` na listagem de despesas continua existindo para casos legados, mas o pipeline de importação não cria mais despesas incompletas.

Para liberar uma "via expressa" controlada, adiciono um checkbox secundário **"Lançar mesmo assim como pendentes (apenas coordenação)"** visível só para `coordenacao`, que reativa o botão. Sem o checkbox, lançamento bloqueado para todos.

## Detalhes técnicos

**Arquivos alterados/criados:**
- `src/lib/despesaImportValidation.ts` — adicionar `rule`, `source`, `matchedAlias` ao `DespesaWarning`; aplicar nos chamadores de `truncWithWarn`, `resolveSitCodeWithWarn`, fallbacks de data e favorecido.
- `src/lib/sitCodeMappings.ts` — `numericResolve` e resolvers retornam também `matchedAlias` e `rule`.
- `src/components/financeiro/ImportReviewDialog.tsx` (novo) — extrai o modal de revisão hoje inline na `FinanceiroPage` para conter o editor inline (Collapsible + form), ordenação por severidade, filtro "só pendências", banner de bloqueio e botão de diagnóstico.
- `src/components/financeiro/LotesImportadosTab.tsx` (novo) — listagem dos lotes históricos.
- `src/pages/financeiro/FinanceiroPage.tsx` — usa o novo dialog, grava `despesa_lotes_importacao` no `confirmAndSaveImportedDocs`, adiciona aba/seção de lotes.
- `src/hooks/useCurrentUserRoles.ts` (se ainda não existir, ou usar o existente) — para o checkbox exclusivo de coordenação.
- `supabase/migrations/<timestamp>_create_despesa_lotes_importacao.sql` — tabela + RLS.

**Conformidade SIT:** o bloqueio de obrigatórios garante que toda despesa importada já entre `sit_completo = true`, melhorando a taxa de exportação `Despesa.txt`.

**Compatibilidade:** o fluxo manual (botão "+ Despesa" individual) e o lote em planilha não passam pelo validador novo — sem regressões. Regularização posterior via `RegularizarSitDialog` continua funcionando para despesas legadas.
