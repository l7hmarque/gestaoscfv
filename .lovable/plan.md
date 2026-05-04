## Problema diagnosticado

A timeline do indicador **Participantes Ativos** está mostrando majoritariamente desligamentos. Investigando o banco em produção:

- **271 participantes** criados nos últimos 60 dias.
- Apenas **40** com `iniciou_em` no intervalo (que é o que o fetcher usa).
- **62 participantes** estão com `iniciou_em = NULL` (16 em 27/03, 43 em 10/04, etc. — provavelmente importações em lote ou matrículas online antigas que não preencheram o campo).
- Em paralelo, **105 desligamentos** no mesmo período → dominam a lista, dando a impressão de que "só tem desligamento".

Resultado: matrículas reais ficam invisíveis e o gráfico fica desbalanceado, pois reconstrói o passado a partir de deltas incompletos.

## Correções

### 1. Backfill retroativo (migration data-only via insert tool)

Preencher `iniciou_em = COALESCE(iniciou_em, created_at::date)` para todos os participantes onde `iniciou_em IS NULL` e `is_teste = false`. Registrar no `audit_log` como ação administrativa.

Isso restaura coerência histórica do indicador sem inventar datas — usa a data real de criação do registro como proxy de matrícula.

### 2. Fetcher `fetchParticipantes` (src/lib/indicadorTimelineFetchers.ts)

Tornar o fetcher robusto a inconsistências futuras:

- **Fonte de matrículas**: usar `COALESCE(iniciou_em, created_at::date)` na consulta. Como Supabase JS não permite COALESCE direto, fazer **duas queries**:
  - matrículas com `iniciou_em` no período
  - participantes com `created_at` no período E `iniciou_em IS NULL` (fallback)
  - unir e deduplicar por id
- **Filtro `is_teste = false`** explícito (hoje não está, pode poluir).
- **Excluir** participantes que já foram desligados antes do início do período (não são "matrícula" recente para o gráfico).
- Marcar a origem do evento na contexto: `Origem do registro: matrícula online | importação | manual` quando disponível, e adicionar `Data efetiva` quando `iniciou_em` foi inferida do `created_at`.
- **Janela**: manter 60 dias.

### 3. Eventos adicionais — Transferências

Hoje só "matrícula" e "desligamento" são eventos. Adicionar:
- **TRANSFERÊNCIA APROVADA**: query em `transferencias_participante` (ou tabela equivalente) com `status = 'aprovada'` e `aprovado_em` no período. Não altera total ativo (delta 0), mas é movimentação relevante.

Se a tabela não existir / estiver vazia, ignorar silenciosamente.

### 4. Correção visual no drawer

- Quando matrículas e desligamentos coexistem, o filtro por tipo já existe — manter, mas garantir que o seletor abra com "Todos" (já é o default).
- Mostrar contadores no header do histórico: `Matrículas: X · Desligamentos: Y · Transferências: Z` para dar visibilidade imediata.

### 5. Validação pós-mudança

Após aplicar backfill + fetcher novo, conferir via SQL:
- Contagem por dia de matrículas recompostas no período.
- Pico do gráfico bate com `count(*) where status='ativo' and is_teste=false`.

## Arquivos

- **Migration data-only** (insert tool): `UPDATE participantes SET iniciou_em = created_at::date WHERE iniciou_em IS NULL AND is_teste = false;` + insert em `audit_log`.
- **Editar**: `src/lib/indicadorTimelineFetchers.ts` — função `fetchParticipantes` reescrita conforme acima.
- **Editar**: `src/components/dashboard/IndicadorTimelineDrawer.tsx` — adicionar contadores no cabeçalho do histórico.

Sem mudanças de schema, RLS ou edge functions.
