## Problema

O KPI "Participantes Ativos" no `/dashboard` (aba Indicadores), quando filtrado por Abril/2026, está mostrando 260 — esse número vem da definição atual: "participantes cuja matrícula sobreviveu ao mês" (`iniciou_em < fim` AND não desligado antes do início). Ou seja, está contando *matriculados no período*, não *frequentantes*.

A definição correta solicitada: **1 participante = teve pelo menos 1 presença registrada (`presente=true`) no período filtrado.**

## Solução

Reescrever `public.get_dashboard_stats` para alinhar `totalParticipantesAtivos` ao mesmo critério já usado em `participantesAtivosMesAtual`:

- **Com filtro (mês/ano ou intervalo)**: `totalParticipantesAtivos` = `COUNT(DISTINCT rp.participante_id)` em `relatorio_presenca rp JOIN relatorios_atividade ra` onde `rp.presente=true` AND `ra.data` no período. Excluir participantes `is_teste=true`.
- **Sem filtro**: manter contagem atual (`status='ativo'` global), pois representa o estado vivo do cadastro.

Como esse passa a ser o mesmo valor de `participantesAtivosMesAtual` quando há filtro, o tooltip do card também é simplificado (Total = mesmo critério do delta).

Adicionalmente, alinhar as **distribuições** (Faixa, Gênero, Bairro, Período) ao mesmo universo de "frequentantes do período" quando há filtro — caso contrário, o KPI mostraria 80 mas a soma das fatias do gráfico seria 260, gerando incoerência. Sem filtro continuam sendo snapshot do cadastro ativo atual.

## Arquivos

- **Nova migração**: recria `public.get_dashboard_stats` ajustando os blocos de `v_total_participantes` e das 4 distribuições para usar a interseção com `relatorio_presenca` quando `v_has_filter`.
- **Edit**: `src/pages/dashboard/DashboardPage.tsx` — atualizar o `tooltip` do card "Participantes Ativos" para refletir o novo critério ("participantes distintos com presença registrada no período").

Sem alteração em hooks ou outras tabs.
