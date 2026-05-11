---
name: Rubricas oficiais financeiro
description: Lista única de 28 rubricas SIT/TCE-PR usadas no módulo financeiro e na detecção por IA
type: feature
---
A tabela `categorias_financeiras` contém exclusivamente as 28 rubricas oficiais (códigos de 5 segmentos, ex.: `3.1.90.11.01`).
Fonte da verdade no front: `src/lib/rubricasOficiais.ts`. A edge function `detect-despesa-from-doc` recebe `rubrica_codigo` como enum no schema da IA e o `validateDespesa` resolve `rubrica_codigo → categoria_id` via mapa fornecido pela `FinanceiroPage`/`ImportReviewDialog`. O dialog de revisão exibe a rubrica sugerida pela IA com Select para override.
