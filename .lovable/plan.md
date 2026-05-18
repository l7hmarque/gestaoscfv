## Filtro manual de faixa etária nos Indicadores

Hoje a filtragem por faixa só permite clicar nas barras pré-definidas (6-8, 9-11, 12-17, 60+). Vou adicionar um controle manual onde o usuário escolhe um intervalo livre (idade mínima e máxima) que recalcula todos os indicadores.

### UX
- Novo controle no cabeçalho da aba "Indicadores", ao lado do `PeriodFilter`: botão "Idade" que abre um popover com dois inputs numéricos (Mín / Máx, 0–120) + botões "Aplicar" e "Limpar".
- Quando aplicado, aparece um chip ativo "Idade: X–Y anos" (junto dos chips de Faixa/Gênero/Bairro/Período), removível com o "x".
- Clicar numa barra das faixas pré-definidas continua funcionando; selecionar um intervalo manual **substitui** o filtro de faixa categórica (são mutuamente exclusivos, para evitar conflito de semântica).

### Backend (RPC `get_dashboard_stats`)
- Adicionar dois parâmetros opcionais: `_idade_min int default null`, `_idade_max int default null`.
- No CTE `participantes_filtrados`, aplicar:
  ```sql
  AND (_idade_min IS NULL OR extract(year from age(current_date, p.data_nascimento)) >= _idade_min)
  AND (_idade_max IS NULL OR extract(year from age(current_date, p.data_nascimento)) <= _idade_max)
  ```
- Quando `_idade_min`/`_idade_max` vier preenchido, ignorar `_faixa` (ou somente aplicar `_faixa` se nenhum dos dois vier — proteção no SQL).
- Distribuições categóricas (`participantesPorFaixa` etc.) continuam mostrando todas as categorias, como já fazem com os outros filtros.

### Frontend
- `useDashboardData.ts`: novos campos opcionais `idadeMin`/`idadeMax` em `DashboardDimFilters`, incluídos no `queryKey` e no payload da RPC.
- `DashboardPage.tsx` (`IndicadoresTab`):
  - Novo componente local `IdadeRangeFilter` (Popover + 2 inputs + ações).
  - Estender `activeChips` com o chip "Idade".
  - `toggleDim`/`clearDim` tratam o par min/max como uma unidade.
  - Ao aplicar intervalo manual: limpar `dim.faixa`. Ao clicar numa barra de faixa: limpar `idadeMin/idadeMax`.

### Arquivos
- `supabase/migrations/<novo>.sql` — atualizar `get_dashboard_stats`.
- `src/hooks/useDashboardData.ts` — novos campos no filtro e na RPC.
- `src/pages/dashboard/DashboardPage.tsx` — novo controle, chip, lógica de exclusividade.

### Fora de escopo
- Persistir filtro na URL.
- Aplicar o filtro em outras abas do dashboard (somente "Indicadores").
- Filtro por intervalo nas demais dimensões (gênero/bairro/período).
