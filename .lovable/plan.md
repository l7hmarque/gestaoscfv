## Problema

1. A IA está classificando errado (PDF de despesas vira "controle bancário").
2. A etapa de classificação é uma chamada extra à IA por arquivo — isso atrasa tudo sem gerar valor real, já que todo PDF que entra pela Caixa de Entrada de despesas vai pro mesmo destino: extração para o SIT.

## Solução

**Eliminar a etapa de classificação por IA.** Tratar todo upload na Caixa de Entrada como `despesa` direto, indo para o `detect-despesa-from-doc`, que já sabe identificar despesa, tributo, folha, NF, boleto, holerite e PIX dentro do mesmo PDF.

Para os outros tipos (orçamento, controle bancário), o usuário continua tendo abas dedicadas — eles não precisam passar pelo mesmo funil.

### Mudanças em `src/components/financeiro/CaixaEntradaTab.tsx`

1. **Remover a etapa "classificando"**:
  - Apagar a chamada `supabase.functions.invoke("classify-financeiro-doc", …)` no `handleFiles`.
  - Apagar o helper `firstPagePdfBase64` (não será mais usado).
  - Remover o status `"classificando"` do tipo `ClassifiedDoc["status"]`.
  - Manter só upload no storage + setar tipo fixo `"despesa"` na fila.
2. **Simplificar tipos**:
  - Reduzir `DocTipo` a `"despesa" | "desconhecido"` (mantém o badge visual minimalista) ou remover de vez o conceito e tirar o filtro/contador por tipo.
  - Atualizar `TIPO_META`, badges de contagem e ordenação em `processarTodos` (a fila vira só "despesa", então some o `sort`).
3. **Otimizar performance**:
  - **Iniciar processamento automático** quando arquivos forem soltos (sem precisar do botão "Processar todos") — o usuário caiu numa fila desnecessária, já que a classificação foi removida. *Opcional, ver pergunta abaixo.*
  - **Paralelizar arquivos**: hoje o loop em `processarTodos` é sequencial (`for (const d of fila)`). Trocar por `Promise.all` com limite de concorrência (ex: 3 arquivos simultâneos), mantendo os chunks de 5 páginas por arquivo.
  - **Reduzir chunks**: como o `detect-despesa-from-doc` já usa `gemini-2.5-flash` e o problema do timeout sumiu, manter os chunks de 5 páginas (já está bom).
4. **Atualizar texto da UI**:
  - Mudar o copy do header pra refletir que a Caixa só recebe despesas/tributos/folha/comprovantes.
  - Manter o aviso do marca-texto amarelo (modalidade 7).

### Mudanças em `supabase/functions/`

5. **Não excluir** `classify-financeiro-doc` (pode ser usada em outro lugar futuramente). Apenas deixa de ser chamada pelo cliente.

### Resultado esperado

- Upload de PDF de despesas → sobe pro storage → entra direto na fila como `despesa` → roda `detect-despesa-from-doc` em chunks paralelos.
- Tempo total cai aprox. pela metade (sem a chamada de classificação por arquivo + processamento paralelo de até 3 arquivos).
- Sem mais erro de classificação, porque não há mais classificação.

## Pergunta antes de implementar

Quero confirmar uma coisa só: você quer que a Caixa de Entrada **inicie o processamento automaticamente** assim que os arquivos forem soltos (sem precisar clicar em "Processar todos"), ou prefere manter o botão pra você revisar a lista antes? INICIE AUTOMATICO.