## Problema identificado

O fluxo atual da Caixa de Entrada **auto-lança** as despesas extraídas direto na tabela `despesas` e **deleta o documento da Caixa**. Quando o insert falha (ou retorna 0 linhas após validação), o doc some e nada aparece em lugar nenhum — o usuário só vê o toast "processamento concluído". Verificado no banco: 0 linhas em `despesas` e 0 em `caixa_entrada_documentos` após o upload de hoje.

## Solução: revisão manual obrigatória antes de lançar

### 1. Remover auto-lançamento em `CaixaEntradaTab.tsx`

No final de `processOne` (linhas 226–243), substituir o bloco que chama `launchDespesasFromDoc` + delete por:

- Apenas marcar `status: "ok"` e gravar `despesas_json` extraídas
- Toast informativo: `"{N} despesa(s) extraída(s) de {arquivo} — clique em Revisar para conferir"`
- Documento **permanece** na lista da Caixa de Entrada com badge "Pronto p/ revisão" e contador de despesas

### 2. Botão "Revisar e Lançar" por documento

Em cada item da lista de docs com `status === "ok"`:

- Botão primário **"Revisar e lançar (N)"** abre o `ImportReviewDialog` já existente, populado com `doc.resultado.despesas`
- Reusar `validateDespesa` + `applyOrcamentoMatching` dentro do dialog (já é o padrão do componente)
- Ao confirmar no dialog: insert em `despesas` + delete da Caixa de Entrada + toast de sucesso
- Em caso de erro de insert, manter doc na Caixa e exibir o erro real (não engolir)

### 3. Botão "Revisar Todos" no header da Caixa

Quando houver 2+ docs com `status === "ok"`, mostrar **"Revisar todos (N docs)"** que abre o `ImportReviewDialog` com a união das despesas, mantendo o `lote_id` por documento. Já existe lógica parecida em `handleLaunchSelected` (linhas 340–360) — adaptar para abrir o dialog ao invés de inserir direto.

### 4. Tratamento do arquivo grande (546 WORKER_RESOURCE_LIMIT)

O `Despesas_OCR.pdf` (PDF grande com OCR) estourou memória da edge function porque o split em chunks só roda quando NÃO tem texto. Quando `pagesText` existe, o código manda **todas as páginas em uma única chamada** (linha 191). Ajuste:

- Se `pagesText.length > 8` páginas, dividir o array em lotes de 8 e fazer chamadas sequenciais ao edge (igual o fluxo de visão)
- Concatenar os `despesas[]` retornados

### 5. Mensagens de erro visíveis

Nos `try/catch` que hoje só fazem `console.warn` (linhas 287–293, 303), exibir `toast.error` quando a operação realmente falhar (ex: insert da Caixa). O usuário precisa saber que algo deu errado em vez de assumir que funcionou.

## Arquivos afetados

- `src/components/financeiro/CaixaEntradaTab.tsx` — remover auto-launch, adicionar botões de revisão, dividir `pages_text` em lotes, corrigir engolimento de erros
- (opcional) `src/components/financeiro/ImportReviewDialog.tsx` — só se precisar aceitar o array `despesas[]` direto + `lote_id` por linha (provavelmente já aceita)

## O que NÃO muda

- Edge function `detect-despesa-from-doc` — mantém comportamento atual
- Schema do banco — sem migrations
- Detecção híbrida texto/visão e detecção de marca-texto amarela — preservadas
- Card de Conciliação do Extrato — preservado
