## Plano de Execução — Refatoração Dashboard, Transporte, UX Global e Drive

Pacote grande dividido em 6 frentes independentes. Cada frente pode ser revertida isoladamente.

---

### Frente 1 — Aba "Rel. Mensal" (/dashboard) e Drive

**Objetivo:** garantir que os botões da aba usem o pipeline novo (Google Docs / Sheets quando aplicável), não só XLSX local.

- Auditar `generate-relatorio-mensal` e `generate-reo`: hoje retornam XLSX/DOCX em URL temporária. Adicionar opção "Enviar ao Drive" (cria cópia em pasta SysCFV organizada) ao lado de "Baixar".
- Padronizar nome: `SysCFV_RelMensal_{Mes}_{YYYY}.xlsx` etc.
- Reaproveitar `generate-relatorio-gdoc` quando o usuário escolher formato Google Docs.

---

### Frente 2 — Auditoria e Refatoração da aba "Indicadores" (/dashboard)

**A. Auditoria de números (RPC `get_dashboard_stats`)**

- Validar cada KPI contra query manual:
  - `Participantes Ativos` × `participantes WHERE status='ativo' AND is_teste=false`
  - `Frequência Geral` × média ponderada de `relatorio_presenca` no período
  - `Relatórios` × `Consolidados de chamada` (separação correta)
  - `Média ELO` (n=) — confirmar denominador
  - `Média Adesão` × `consol.` 
  - `Educadores Ativos` — checar se conta apenas com relatório no período
- Documentar fórmula de cada indicador num tooltip detalhado (clique no `i`).
- Corrigir incoerências encontradas (delta participantes, alerta 3+ faltas, etc.).

**B. Remover "Atividades Recentes"**

- Excluir componente `AtividadesRecentes`, campo `atividadesRecentes` em `useDashboardData`/RPC e o grid `lg:col-span-2` que o continha.
- Frequência Mensal passa a ocupar largura total (ou cede espaço para nova "Frequência Atual").

**C. Gráficos — qualidade visual e tooltip**

- Helper único `formatMesLabel(mes: 'YYYY-MM')` → `"Mai/26"`.
- Aplicar em Frequência Mensal, Evolução de Presença, Score ELO Mensal, % Adesão Mensal.
- Tooltip enriquecida (componente `RichTooltip`): mês por extenso, valor formatado, comparativo vs mês anterior, n amostral.
- Fonte: `tabular-nums` + `font-medium`, tamanho 12px, contraste reforçado.
- Domínio Y dinâmico com `nice ticks` (recharts auto + padding 10%).

**D. Ajustes específicos solicitados**

- "Bairro (top 10)" → renomear para **"Distribuição por Bairros"** (remover "(top 10)").
- **Competências ELO**: trocar Radar por **BarChart vertical** com cores escalares por valor (vermelho<2, laranja 2–3, amarelo 3–4, verde>4).
- **Frequência Mensal**: dividir em 2 cards lado a lado:
  1. *Tendência* — LineChart dos últimos 6 meses.
  2. *Comparativo* — BarChart vertical mês atual × mês anterior (Total / Presentes).
- **Frequência Atual** (novo card KPI): % de presença do mês corrente em curso, marcado como "parcial" se mês não fechado. Usa `relatorio_presenca` filtrado por `data` no mês atual.

**E. Drawer ao clicar em "Participantes Ativos"**

- Revisar `IndicadorTimelineDrawer` + fetcher `participantes` em `indicadorTimelineFetchers.ts`:
  - Eventos: matrículas, desligamentos, transferências, busca ativa.
  - Validar que delta mostrado bate com KPI.
  - Rótulos em pt-BR, datas `dd/MM/yyyy`.
  - Corrigir filtro de tipo e card `EventoTecnicoCard` se necessário.

---

### Frente 3 — Aba "Admin" (/dashboard)

- Investigar uso real de `Modelos DOCX Institucionais`: hoje os relatórios usam Google Docs/Sheets via Edge Functions e templates próprios. Se nenhum fluxo ativo lê do bucket `templates`, **remover seção e bucket** (com backup ZIP prévio dos arquivos).
- Manter os blocos de Reset (ELO / Frequência) — são legítimos.
- Se houver dependências encontradas, listar e manter, mas mover para sub-aba "Avançado".

---

### Frente 4 — /transporte (DashboardTransporteTab)

- Quebrar em **Tabs internos**:
  1. **Embarques de Hoje** — bloco "Embarques de hoje" (motorista/coord), badges online/offline, sincronizar.
  2. **Pontos por Bairro** — listagem CRUD + ordenação + bulk.
- Seleção controlada (`useState`), persiste `?tab=` na URL para não resetar ao atualizar.

---

### Frente 5 — UX Global: atualizações sem reload + CTAs sempre visíveis

**A. Eliminar `window.location.reload()` / refetch que recria a página**

- Auditar grep por `location.reload`, `window.location.href = location`, navigate same-route com `replace`.
- Substituir por:
  - `queryClient.invalidateQueries(...)` (TanStack Query) onde aplicável.
  - Atualização otimista no estado local + refetch só do recurso afetado.
  - `useTransition` para não bloquear scroll/posição.
- Garantir que listas (Participantes, Relatórios, Planejamentos, Pontos Transporte, Atendimentos) preservem scroll position.

**B. CTAs flutuantes (FAB) sempre visíveis**

- Criar componente `<FloatingActionButton route action />` (canto inferior direito, mobile-first).
- Aplicar em: Relatórios → "Novo Relatório", Planejamentos → "Novo Planejamento", Atendimentos → "Novo Atendimento", Transporte → "Novo Ponto", Roteiros, Orçamentos.
- Em desktop: botão também fica na header da página (atual). Em mobile: FAB único.

**C. Tabs em mobile**

- Padronizar `<TabsList>` com:
  - `overflow-x-auto snap-x` em telas <640px.
  - Triggers com `whitespace-nowrap` + `flex-shrink-0`.
  - Barra inferior tipo "swipe indicator".
- Aplicar em todas as páginas com Tabs (Dashboard, Coordenação, Cozinha, Equipe Técnica, Configurações, Financeiro, Transporte novo, etc.).

---

### Frente 6 — Drive: pasta nova com modelos e dados atualizados

Usando o conector **Google Drive** já vinculado (ou solicitar conexão se ausente):

- Criar Edge Function `sync-drive-modelos` que:
  1. Cria pasta `SysCFV_Modelos_{YYYY-MM-DD}` na raiz do Drive de trabalho.
  2. Subpastas: `01_Modelos_Padrao/`, `02_Relatorios_Atualizados/`, `03_Listas_Chamada/`, `04_Planejamentos/`, `05_REO_Mensal/`.
  3. Para cada categoria, gera os documentos atuais (chamando as Edge Functions existentes — `generate-lista-chamada-gsheet`, `generate-relatorio-gdoc`, `generate-reo`, `generate-relatorio-mensal`) e os move/copia para a subpasta correta.
  4. Renomeia tudo no padrão `SysCFV_{Categoria}_{Identificador}_{YYYY-MM-DD}.{ext}`.
- Botão na aba Admin: **"Sincronizar Drive Institucional"** com progress (toast + count).

---

### Detalhes técnicos relevantes

- **RPC `get_dashboard_stats**`: precisará de migration adicionando `frequenciaAtual` (mês corrente parcial) e removendo `atividadesRecentes`. Manter compat: front lê opcional.
- **Cores de Competências**: helper `eloColor(value)` em `src/lib/eloColors.ts`.
- **MES_ABREV**: já existe no `DashboardPage.tsx`, criar util compartilhado em `src/lib/dateLabels.ts` (`formatMesLabel`, `formatMesAbrev`).
- **Tooltip rica**: componente `<DashboardTooltip>` consumido por todos os charts via prop `content`.
- **FAB**: um único `<FAB>` global em `AppLayout` reagindo à rota atual via map `routeFabActions`.
- **Tabs URL state**: hook `useTabState(key)` que sincroniza com `searchParams`.

---

### Arquivos previstos

- `src/pages/dashboard/DashboardPage.tsx` (refator pesado)
- `src/pages/dashboard/DashboardAdminTab.tsx` (remover seção Templates)
- `src/pages/dashboard/DashboardRelatorioMensalTab.tsx` (botões Drive)
- `src/pages/dashboard/DashboardTransporteTab.tsx` → split em `EmbarquesHojeTab.tsx` + `PontosTab.tsx`
- `src/pages/transporte/TransportePage.tsx` (Tabs)
- `src/components/dashboard/IndicadorTimelineDrawer.tsx` + fetcher
- `src/hooks/useDashboardData.ts` (frequenciaAtual, sem atividadesRecentes)
- `src/lib/dateLabels.ts`, `src/lib/eloColors.ts` (novos)
- `src/components/FloatingActionButton.tsx` (novo) + integração em `AppLayout`
- `src/components/ui/tabs.tsx` (variant mobile-friendly)
- `supabase/migrations/...` (RPC atualizada, drop bucket templates se confirmado)
- `supabase/functions/sync-drive-modelos/index.ts` (novo)

---

### Pontos que peço para confirmar antes de codar

1. **Remover bucket** `templates` **+ seção Modelos DOCX** mesmo? (faço backup ZIP antes). sim
2. **FAB único global** ou prefere apenas reforçar botões já existentes em cada página? reforcar
3. **Conector Google Drive** já está vinculado? Se não, peço para conectar antes da Frente 6. acho que sim
4. **Frequência Atual** deve considerar quais relatórios? (a) só `relatorios_atividade` reais, (b) consolidados de chamada também, (c) ambos separados. b