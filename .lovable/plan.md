# Diagnóstico: por que páginas/abas demoram ou ficam carregando infinito

Mapeei como cada página carrega dados. Os problemas se repetem em vários lugares e explicam o sintoma de "carregando eterno" e abertura lenta.

## Causas-raiz encontradas

1. **Páginas pesadas usam `useEffect` + `useState` (sem cache do TanStack Query).**
   Cada vez que o usuário troca de aba ou volta para a página, tudo é refeito do zero — não há cache, dedupe ou `staleTime`. Páginas nesse padrão: `ParticipantesPage`, `TurmasPage`, `RelatoriosPage`, `PresencaPage`, `PlanejamentosPage`, `BancoDadosPage`, `EquipeTecnicaPage`, `FeedPage`, `MuralPage`, `ConfiguracoesPage`, abas de `Dashboard*` e `Coordenacao*`.

2. **`fetchAllRows` com `select: "*"` e joins puxando tabelas inteiras no cliente.** Exemplos críticos:
   - `BancoDadosPage`: pagina `participantes`, `turmas (+profiles)`, `presenca (+participantes,+turmas)`, `relatorios_atividade (+profiles)`, `planejamentos (+profiles)`, `profiles` — **6 tabelas inteiras em paralelo** a cada visita.
   - `ParticipantesPage`: `fetchAllRows("participantes", select:"*")` sempre.
   - `RelatoriosPage`: dois `fetchAllRows` em `relatorios_atividade`.
   - `EquipeTecnicaPage`: ~11 consultas em paralelo no mount (`atendimentos *`, `participantes` com 25 colunas, `presenca` 90 dias, planejamentos, relatórios, etc.) — qualquer uma travando trava a página.
   - `TurmasPage`: `turma_participantes` com join em `participantes(nome_completo)` retornando tudo.

3. **Falhas silenciosas deixam a UI em "loading" eterno.** Em vários `useEffect` o `setLoading(false)` está apenas no caminho de sucesso ou dentro de um `try` sem `finally`, e quando uma das consultas paralelas falha (RLS, timeout, payload grande) o estado nunca sai de loading.

4. **Sem timeouts/`AbortController`.** Consultas que demoram em backends sobrecarregados ficam pendentes indefinidamente — não há fallback visível.

5. **Joins aninhados retornando subobjetos para listas grandes** (ex.: `presenca` puxando `participantes(...)` e `turmas(nome)` para milhares de linhas) — explode tempo de query e payload.

6. **`EquipeTecnicaPage` (2.100 linhas) carrega TODAS as abas no mesmo mount**, mesmo que o usuário só veja uma delas. Não há `lazy`/code-split por aba.

7. **Refetch desnecessário ao trocar de aba** porque o estado mora no componente da aba, não no QueryClient.

## Plano de correção (faseado, sem quebrar nada)

A estratégia é melhorar disponibilidade e percepção **sem mudar regras de negócio nem RLS**. Cada fase é independente e segura para deploy isolado.

### Fase 1 — Robustez imediata (alto impacto, baixíssimo risco)
Aplicar em todas as páginas listadas em (1):

- Garantir `setLoading(false)` em `finally` em todo `useEffect` que faz fetch.
- Adicionar `try/catch` com `toast.error` para que falhas apareçam em vez de travar a tela.
- Adicionar timeout de 20s por bloco de fetch via `Promise.race`/`AbortController`; ao estourar, sair do loading e mostrar botão "Tentar novamente".
- Substituir telas brancas por um `ErrorState` reaproveitável com botão "Recarregar".

Resultado: acaba o "carregando eterno" — pior caso vira erro recuperável.

### Fase 2 — Cache com TanStack Query (médio impacto, baixo risco)
Migrar os fetchs de listas para `useQuery` com `staleTime: 5min` e `gcTime: 10min` (mesmo padrão já usado em `useDashboardData`/`useCoordenacaoData`). Ordem sugerida:
1. `ParticipantesPage`, `TurmasPage`, `RelatoriosPage`, `PlanejamentosPage`, `PresencaPage`
2. `BancoDadosPage`, `MuralPage`, `FeedPage`
3. Abas de `Dashboard*` e `Coordenacao*`

Sem mudança de UI ou de filtros — só troca da fonte de dados. Trocar entre abas vira instantâneo.

### Fase 3 — Reduzir payload das consultas (alto impacto, risco controlado)
- Trocar `select: "*"` por lista explícita de colunas usadas pela tela (principalmente `participantes`, `relatorios_atividade`, `planejamentos`, `presenca`).
- Em `BancoDadosPage`, carregar **uma aba por vez** (lazy) em vez das 6 tabelas no mount.
- Em `EquipeTecnicaPage`, quebrar o mount monolítico: cada aba (Atendimentos, Busca Ativa, Roteiros, etc.) busca seus próprios dados quando aberta. Manter o arquivo, só mover os fetchs para hooks por aba.
- `presenca` em `BancoDadosPage`: paginar por intervalo de datas (ex.: últimos 90 dias por padrão, com seletor) em vez de tudo.
- Joins pesados (`turma_participantes -> participantes`) substituídos por duas queries enxutas + merge no cliente quando o join estiver causando latência.

### Fase 4 — Code-splitting fino e prefetch
- `EquipeTecnicaPage` (2.100 linhas) e `ConfiguracoesPage` (822) passam a fazer `lazy import` das abas internas.
- Prefetch das queries mais comuns no `AppSidebar` ao hover do link (TanStack `queryClient.prefetchQuery`).
- Confirmar que `manualChunks` do Vite continua segmentando charts/xlsx/pdf (já está).

### Fase 5 — Observabilidade (opcional)
- Logar no console.warn queries que passam de 5s (somente em dev) para mapear hotspots reais.
- Avaliar índices/RPC server-side (`get_*_stats` já existem para dashboard/coordenação) para casos onde mesmo paginado o cliente sofre.

## Detalhes técnicos relevantes

- **Sem alterar `src/integrations/supabase/client.ts`, `types.ts` nem `supabase/config.toml`.**
- **Sem migrations nesta etapa.** Se a Fase 3 identificar consultas que sempre agregam, aí sim proponho RPC dedicada em uma migration separada (com aprovação à parte).
- `fetchAllRows` continua existindo para exports — só deixa de ser usado em telas interativas.
- Os hooks `useQuery` reusam o `QueryClient` já configurado em `App.tsx` (`staleTime 5min`, `retry 1`, `refetchOnWindowFocus false`).
- `react-query` já está no projeto, então não há nova dependência.

## Ordem de execução proposta

```text
Fase 1  ->  toda a base fica "à prova de loading infinito"
Fase 2  ->  navegação entre abas vira instantânea (cache)
Fase 3  ->  primeira carga das páginas mais pesadas cai drasticamente
Fase 4  ->  EquipeTecnica e Configuracoes deixam de ser monólitos
Fase 5  ->  observabilidade para próximos ajustes
```

Posso começar pela **Fase 1 + Fase 2 nas 5 páginas mais reclamadas** (Participantes, Turmas, Relatórios, BancoDados, EquipeTecnica) em uma primeira leva — é o melhor custo/benefício e já elimina o "carregando eterno".
