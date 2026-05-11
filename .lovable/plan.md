# Correções Hub de Exportação Drive

## 1. Listas de Presença no Relatório Mensal Consolidado (formato antigo)

**Diagnóstico:** O `generate-relatorio-mensal` ainda gera abas "Matriz de Frequência" usando marcador `■` por turma. O modelo enviado (sheet `12taeg34kh…`) usa **P / A / J** com cabeçalho institucional + linha "Educador/Oficineiro · Oficina" e título "LISTA DE PRESENCA".

**Decisão:** Gerar como **arquivo separado** (já existe `generate-listas-frequencia-mes-gsheet`, basta alinhar formato ao modelo) e **remover as abas de chamada de dentro do consolidado**, mantendo o consolidado focado em indicadores/atividades.

**Mudanças:**
- `supabase/functions/generate-relatorio-mensal/index.ts`: remover o bloco `for (const t of turmas)` que cria as abas por turma (linhas ~621–716). O consolidado deixa de ter abas de presença por turma.
- `supabase/functions/generate-listas-frequencia-mes-gsheet/index.ts`: ajustar layout para casar com o modelo:
  - Título: `LISTA DE PRESENCA` (linha 5).
  - Linha 6: `Turma: NOME | Bairro: X | Período: Y`.
  - Linha 7: legenda P/A/J/D/BA/*.
  - Linha 8: `Educador/Oficineiro: …  ·  Oficina: …`.
  - Linha 9: cabeçalho `Nº | Nome | DD/MM…`.
  - Células: `P` (presente), `A` (ausente), `J` (justificado), `*` (fora do vínculo). Remover uso de `■`.
- O Card "1. Relatório Mensal Consolidado" no hub passa a abrir 2 links (Consolidado + Listas de Frequência). O Card 5 já existe e gera o arquivo separado — manter.

## 2. Erro `column planejamentos.data does not exist`

**Diagnóstico:** Em `src/pages/relatorios/ExportarRelatoriosPage.tsx` linha 902, a query usa `.gte("data", …)`. A coluna correta em `planejamentos` é `data_aplicacao` (já confirmado no próprio arquivo, linha 207).

**Mudança:**
- Trocar a coluna do filtro conforme o tipo:
  ```ts
  const col = tipo === "relatorio" ? "data" : "data_aplicacao";
  await supabase.from(tabela).select("id").gte(col, dataIniMes).lt(col, proxMesIso);
  ```

## 3. Pastas separadas no Drive: chamada em branco × frequência preenchida

**Diagnóstico:** Ambas funções (`generate-listas-chamada-mes-gsheet` e `generate-listas-frequencia-mes-gsheet`) movem o arquivo para `04_Listas_Presenca`.

**Mudanças:**
- `generate-listas-chamada-mes-gsheet/index.ts`: subpasta passa a ser `04_Listas_Chamada_Em_Branco`.
- `generate-listas-frequencia-mes-gsheet/index.ts`: subpasta passa a ser `05_Listas_Frequencia_Preenchidas`.
- Aplicar o mesmo nas funções single (`generate-lista-chamada-gsheet` e `generate-lista-frequencia-gsheet`) para coerência.

## 4. Batch "Relatórios de Atividade do Mês" não aparece no Drive

**Diagnóstico (logs do worker):**
- `MAX_JOBS_PER_RUN = 3` e o worker NÃO se reinvoca após terminar — restantes ficam pendurados na fila.
- Erros 429 da API do Google Docs (`WriteRequestsPerMinutePerUser = 60`) marcam jobs como `erro` sem backoff exponencial.
- Erros 503 transitórios também derrubam jobs.
- Não há cron agendado processando a fila.

**Mudanças (`supabase/functions/drive-sync-worker/index.ts`):**
- Após `processQueue()`, se ainda existirem jobs com `status in ('pendente','erro') and tentativas < MAX_TENTATIVAS`, **re-invocar a própria função** via `fetch` HTTP em background (`EdgeRuntime.waitUntil`) com pequeno delay (`setTimeout` 4s) para encadear lotes sem estourar 150s de idle.
- Em `docsBatch`/`cloneFromTemplate`/`getDocFull` adicionar **retry com backoff exponencial** quando a resposta for `429` ou `503` (até 4 tentativas, esperando 2/4/8/16s, respeitando `Retry-After` se houver). Só marca o job como `erro` se todas as retentativas falharem.
- Reduzir paralelismo: manter `MAX_JOBS_PER_RUN = 2` para garantir respeito ao limite de 60 writes/min/user (cada relatório faz vários `batchUpdate`).
- Adicionar **cron job** (pg_cron) chamando `drive-sync-worker` a cada 1 minuto via `net.http_post`, garantindo que filas grandes sejam drenadas mesmo sem invocação manual.

**Mudança no UI (`ExportarRelatoriosPage.tsx`):**
- Após enfileirar o lote, mostrar contador real consultando `drive_sync_queue` filtrado por `tipo` + intervalo de `created_at`, com estados `pendente/processando/sincronizado/erro` (já temos `DriveSyncBadge`, basta um resumo agregado: "X de Y sincronizados").

## Ordem de implementação

1. Migration: criar cron job 1/min para `drive-sync-worker` (pg_cron + pg_net).
2. Editar `drive-sync-worker` (retry 429/503 + chain self-invoke + MAX_JOBS=2).
3. Editar `ExportarRelatoriosPage.tsx` (corrigir coluna + indicador de progresso da fila).
4. Editar `generate-relatorio-mensal` (remover abas de presença).
5. Editar `generate-listas-frequencia-mes-gsheet` (formato P/A/J + nova pasta).
6. Editar `generate-listas-chamada-mes-gsheet` + funções single (nova pasta).

Sem novas tabelas. Apenas 1 migration (cron) + 6 arquivos de função/UI.
