## Objetivo

Corrigir três pontos no `/dashboard`:

1. **Delta de Participantes Ativos** — comparar quem teve **presença registrada** no mês anterior vs. mês atual (não cadastros ativos vs. 30 dias).
2. **% de Adesão** — auditar o cálculo (`mediaAdesao` / `adesaoMensal`) à luz dessa nova lógica de "ativo = teve presença no mês".
3. **Frequência Mensal** — revisar o "838 esperadas" em Abril (rótulo equivocado) e melhorar a legibilidade visual de todos os gráficos do painel.

---

## Mudanças

### 1. RPC `get_dashboard_stats` — nova lógica de delta

Substituir o cálculo atual:
```text
deltaParticipantes = ativos_hoje − (ativos+busca_ativa há 30 dias)
```
por:
```text
participantes_com_presenca_mes_atual  = DISTINCT participante_id em relatorio_presenca
                                        cujo relatorio.data ∈ [primeiro_dia_mes_atual, hoje]
                                        AND presente = true
participantes_com_presenca_mes_anterior = idem para o mês anterior completo
deltaParticipantes = atual − anterior
```

Adicionar ao retorno:
- `participantesAtivosMesAtual` (int)
- `participantesAtivosMesAnterior` (int)
- `deltaParticipantesBase` = `'presenca_mensal'` (para o frontend ajustar o tooltip/legenda).

A lógica antiga de cadastros é descartada (era o que inflava o delta após mutirão de desligamentos retroativos).

### 2. Auditoria de Adesão

`pct_adesao` em `relatorios_atividade` é calculado **na hora do salvamento** do relatório (presentes / esperados daquele relatório). Logo, **não é afetado** por desligamentos retroativos — é histórico congelado. Conclusão:

- `mediaAdesao` (média simples dos `pct_adesao` dos relatórios não-consolidados): **mantida como está** — está coerente.
- `adesaoMensal` (média mensal): **mantida** — idem.
- Apenas trocar o **subtítulo/tooltip** dos cards de adesão para deixar explícito: *"calculada por relatório, com base nos participantes esperados na data do lançamento — não afetada por desligamentos retroativos"*.

Sem mudança de SQL nesta seção.

### 3. Gráfico "Frequência Mensal — Comparativo" e rótulo "838 esperadas"

O número **838** corresponde ao total de **linhas em `relatorio_presenca`** dos relatórios de Abril (838 registros = soma de `participantes_esperados × atividades_lançadas`). Não é "esperadas no mês" — é "presenças registradas (somando todas as atividades)". Rótulo está enganoso.

Correções:
- Renomear a série `total` no gráfico de **"Esperadas"** → **"Registros (presença + falta)"**.
- No tooltip e card "Frequência Atual" trocar `"X presenças / Y esperadas"` por `"X presenças em Y registros lançados"`.
- Adicionar nota no `subtitle` do card: *"Cada relatório gera N registros (1 por participante esperado). O total cresce com o nº de atividades lançadas."*

Sem mudança de SQL — apenas rótulos.

### 4. Estética dos gráficos (todos os ChartCards do `DashboardPage.tsx`)

Aplicar de forma consistente em **todos** os `LineChart`, `BarChart`, `PieChart`, `RadarChart`:

- **Fonte dos eixos/legenda/tooltip:** `fill: "hsl(0,0%,10%)"` (preto) em vez de `hsl(215,14%,46%)`.
- **Barras cinzas claras** (`hsl(215,20%,85%)`, `hsl(220,13%,90%)` em séries secundárias) → **cinza forte** `hsl(215,15%,45%)`.
- **Grade de fundo:** trocar `strokeDasharray="3 3"` para linhas **contínuas finas**: `strokeDasharray="0"` + `strokeWidth={0.5}` + `stroke="hsl(220,13%,80%)"`, com `horizontal` e `vertical` ambos true.
- Manter a paleta vermelha (`hsl(0,58%,56%)`) como série primária — é a identidade SysCFV.

Centralizar num helper `src/lib/chartTheme.ts` exportando `axisTick`, `gridProps`, `colors.gray`, `colors.primary` para evitar duplicação nos ~12 gráficos do dashboard.

---

## Detalhes técnicos

- **Migração:** `CREATE OR REPLACE FUNCTION public.get_dashboard_stats(...)` — manter assinatura, alterar apenas o bloco de cálculo de `v_delta_participantes`. Adicionar 2 novas chaves no `jsonb_build_object`.
- **Frontend:**
  - `useDashboardData.ts` — incluir `participantesAtivosMesAtual`, `participantesAtivosMesAnterior` na interface.
  - `DashboardPage.tsx` — atualizar tooltip do card "Δ Participantes" mostrando `"Mês anterior: X · Mês atual: Y"`. Atualizar rótulos do gráfico Frequência. Substituir cores/grade conforme item 4.
  - Novo arquivo `src/lib/chartTheme.ts` com tokens reutilizáveis.

---

## Arquivos afetados

- `supabase/migrations/<novo>.sql` — RPC `get_dashboard_stats` (apenas bloco de delta)
- `src/hooks/useDashboardData.ts` — interface
- `src/pages/dashboard/DashboardPage.tsx` — rótulos + cores + grade
- `src/lib/chartTheme.ts` (novo) — tokens visuais dos gráficos

Sem alteração em edge functions, RLS ou dados existentes.