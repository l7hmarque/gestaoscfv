## Objetivo

Ajustar a importação de Documentos Fiscais para que a IA entenda corretamente como as páginas de um PDF se relacionam, evitando duplicar despesas quando NF, boleto/fatura e comprovante aparecem em páginas distintas.

## Regra de negócio a ensinar à IA

Cada despesa pode ser montada a partir de páginas separadas dentro do mesmo PDF:

- **Boleto bancário ou Fatura**: frequentemente está na MESMA página do comprovante de pagamento (print do banco impresso logo abaixo, ou comprovante anexado ao boleto). Tratar como UM único conjunto pagamento+cobrança.
- **Nota Fiscal**: vem em página SEPARADA. Deve ser pareada com o boleto/fatura+comprovante correspondente pelo valor, fornecedor (CNPJ) e/ou número do documento citado no boleto.
- **Pagamento via PIX**: NÃO existe boleto/fatura. Há apenas a Nota Fiscal (uma página) + Comprovante PIX (outra página). Pareie pelo valor, data e favorecido.
- **Folha de pagamento**: regra atual mantida (1 despesa por funcionário, par holerite + comprovante de transferência).

Resultado esperado: **1 despesa por transação real**, mesmo que a evidência esteja distribuída em 2–3 páginas. Não criar despesas duplicadas (uma para a NF, outra para o boleto, outra para o comprovante).

## Mudanças

### 1. `supabase/functions/detect-despesa-from-doc/index.ts`

Adicionar nova seção de regras no `SYSTEM_PROMPT` (após a regra 3, renumerando) explicando o pareamento multi-página:

```text
PAREAMENTO MULTI-PÁGINA (CRÍTICO — não duplique despesas):
- Um PDF pode conter, em páginas diferentes, os documentos que compõem UMA MESMA despesa.
- Combinações típicas:
  a) Nota Fiscal (página A) + Boleto/Fatura com comprovante de pagamento impresso junto (página B) → 1 despesa.
  b) Nota Fiscal (página A) + Comprovante PIX (página B), SEM boleto → 1 despesa (pagamento via PIX).
  c) Boleto/Fatura sozinho com comprovante na mesma página, SEM NF → 1 despesa (ex: contas de consumo).
  d) Holerite (página A) + Comprovante de transferência bancária (página B) → 1 despesa por funcionário.
- Pareamento: use VALOR (idêntico ou muito próximo), FORNECEDOR/CNPJ, DATA de vencimento × data do pagamento, e número do documento referenciado no boleto/PIX.
- Quando houver NF, priorize seus dados (sit_numero_doc_despesa, sit_data_doc_despesa, descrição do item) e use o comprovante para sit_numero_doc_pagamento, sit_data_emissao_pagamento e sit_tipo_doc_pagamento.
- Se o comprovante for PIX, sit_tipo_doc_pagamento = 3 (TED/DOC/PIX) e NÃO marque como boleto.
- Se houver boleto + comprovante mas NÃO houver NF correspondente, sit_tipo_doc_despesa = 5 (Boleto) ou 3 (Fatura), conforme o caso.
- NUNCA gere uma despesa só com a NF e outra só com o boleto/comprovante para o mesmo valor — eles são a mesma despesa.
```

Ajustar também a mensagem do usuário (`userContent[0].text`) para reforçar:

> "Antes de listar as despesas, percorra TODAS as páginas e identifique os pareamentos NF↔boleto/fatura↔comprovante (e NF↔PIX). Cada transação real = 1 despesa, mesmo que a evidência esteja em 2 ou 3 páginas distintas."

### 2. Sem mudanças de schema, banco ou frontend

O `PARAMS_SCHEMA`, a tabela `despesas` e o `ImportReviewDialog.tsx` já suportam todos os campos necessários (`sit_tipo_doc_pagamento`, `sit_tipo_doc_despesa`, `sit_numero_doc_pagamento`, etc.). A mudança é puramente de prompt/instrução para a IA.

### 3. Deploy

Redeploy da edge function `detect-despesa-from-doc` (automático).

## Fora de escopo

- Não alterar a lista de 28 rubricas oficiais.
- Não alterar a UI de revisão (continua mostrando 1 linha por despesa retornada).
- Não alterar regras de folha de pagamento já existentes.
