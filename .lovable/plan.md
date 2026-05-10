## Problema

Na aba **Indicadores** do dashboard:

1. **O filtro de Mês/Ano (e intervalo de datas) não afeta vários KPIs.** A função `get_dashboard_stats` ignora o filtro nestes campos:
   - `totalParticipantesAtivos` (sempre conta `status='ativo'` global)
   - `totalTurmasAtivas` (sempre conta turmas ativas globais)
   - `participantesPorFaixa`, `participantesPorGenero`, `participantesPorBairro`, `participantesPorPeriodo` (sempre snapshot atual)
   - `totalParticipantesAlerta` (sempre histórico completo)
   - `eloMensal`, `adesaoMensal`, `presencaMensal` (séries temporais — correto manter trend completo)

2. **O número "-69" aparece como delta vs mês anterior.** Bug: `participantesAtivosMesAtual` e `participantesAtivosMesAnterior` usam **sempre** `current_date` / mês corrente do servidor — ignoram completamente os parâmetros `_mes`/`_ano`/`_data_inicio`/`_data_fim`. Quando o usuário seleciona Abril/2026, o card mostra o total atual (ex.: 200) mas o delta continua sendo (ativos de maio até hoje) − (ativos de abril cheio) = número grande negativo, sem relação com o filtro escolhido.

## Solução (somente backend — RPC)

Reescrever `public.get_dashboard_stats` em uma nova migração para aplicar o filtro de período de forma coerente:

### 1. KPIs sensíveis ao período passam a respeitar o filtro
Quando há filtro ativo (`v_has_filter`), calcular:

- **totalParticipantesAtivos**: `COUNT(participantes)` onde participante estava ativo *durante* o período — `iniciou_em <= v_filter_end - 1` AND (`status <> 'desligado'` OR `data_desligamento >= v_filter_start`) AND `is_teste = false`. Sem filtro: comportamento atual (status='ativo' agora).
- **totalTurmasAtivas**: turmas com `created_at < v_filter_end` AND (`ativa = true` OR `desativada_em >= v_filter_start`). Sem filtro: comportamento atual.
- **participantesPorFaixa / Genero / Bairro / Periodo**: aplicar o mesmo predicado de "ativo durante o período" do item acima.
- **totalParticipantesAlerta**: já filtra por `relatorios_atividade.data`; passar a usar `v_effective_start..v_filter_end` quando há filtro.

### 2. Delta de Participantes — alinhado ao filtro

Renomear conceitualmente para "ativos no período selecionado vs período anterior equivalente":

- Quando há filtro de **mês/ano**: `v_ativos_mes_atual` = distintos com `presente=true` em `[mes_selecionado_inicio, mes_selecionado_fim)`; `v_ativos_mes_anterior` = mesmo cálculo no mês imediatamente anterior ao selecionado.
- Quando há filtro de **intervalo**: comparar com janela imediatamente anterior do mesmo tamanho (ex.: 15 dias vs 15 dias anteriores).
- Sem filtro: manter cálculo atual (mês corrente vs mês anterior, parcial).

Adicionar flag `parcialAtual` ao retorno para o tooltip indicar quando o "atual" ainda está incompleto (mes corrente).

### 3. Tooltip do KPI
Atualizar o `tooltip` em `DashboardPage.tsx` (apenas o texto) para refletir que o delta agora segue o filtro selecionado.

## Arquivos

- **Nova migração**: `supabase/migrations/<timestamp>_fix_dashboard_stats_filtro.sql` — recria `public.get_dashboard_stats` com a lógica acima.
- **Edit**: `src/pages/dashboard/DashboardPage.tsx` — somente texto do tooltip do card "Participantes Ativos".

Sem mudanças em hooks, tipos ou outras tabs (Profissionais, Admin, Relatório Mensal continuam intactas).
