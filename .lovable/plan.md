## Reposicionar o filtro manual de idade

O filtro de intervalo de idade hoje está no header da aba (ao lado do filtro de período), o que o desconecta visualmente do indicador que ele afeta semanticamente. O cross-filter para os demais indicadores já funciona no backend (`_idade_min`/`_idade_max` já participam do CTE `participantes_filtrados` da RPC `get_dashboard_stats`) — então essa parte não precisa de mudança. Só falta aproximar o controle do card.

### Mudança

Em `src/pages/dashboard/DashboardPage.tsx`:

1. **Remover** o `<IdadeRangeFilter />` do header da aba (linhas 398–403).
2. **Adicionar suporte a um slot `action`** no `ChartCard` (linhas 177–194):
   - Nova prop opcional `action?: React.ReactNode`.
   - Renderizar no `CardHeader`, à esquerda do `ChartCopyButton` já existente, mantendo o mesmo alinhamento `flex-row items-center justify-between`.
3. **Renderizar o `IdadeRangeFilter` dentro do `ChartCard "Faixa Etária"`** (linha 599) via essa nova prop `action`. O componente continua usando `applyIdadeRange` / `clearIdadeRange` / `dim.idadeMin` / `dim.idadeMax` já existentes — toda a lógica de exclusividade com `dim.faixa` e o chip "Idade: X–Y anos" no painel de "Filtros ativos" permanece igual.
4. **Manter inalterado**: chip ativo, lógica `applyIdadeRange` (que já limpa `dim.faixa`), `toggleFaixaBar` (que já limpa `idadeMin/idadeMax`), e o cross-filter no hook/RPC.

### Resultado

- Botão "Idade" aparece no canto superior do card "Faixa Etária", colado ao gráfico que ele complementa.
- Ao aplicar um intervalo, todos os outros KPIs e cards (ELO, frequência, Gênero, Bairro, Período, alertas etc.) continuam sendo refiltrados — comportamento que já existe via RPC.
- O header da aba fica mais limpo, só com `PeriodFilter`.

### Fora de escopo

- Mudar a aparência interna do `IdadeRangeFilter` (popover, inputs, copy).
- Persistir filtro na URL.
- Adicionar filtros equivalentes para gênero/bairro.
