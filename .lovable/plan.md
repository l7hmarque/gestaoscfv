# Plano: Telemetria detalhada + Otimização de performance

## Parte 1 — Telemetria por lançamento (não só média)

### 1.1 Estender `user_action_durations`
A tabela e o hook `useFormTimer` já existem. Hoje gravam duração e `registro_id`, mas a tela `ProdutividadeTab` só exibe média/somatório.

Migration:
- Adicionar índice `idx_uad_registro (tipo, registro_id)` para lookup rápido por lançamento.
- Adicionar coluna `contexto jsonb` (opcional) para guardar título/turma/data do registro relacionado, evitando joins pesados depois.
- Ampliar enum de tipos: `atendimento`, `edicao_atendimento`, `encaminhamento`, `busca_ativa`, `roteiro_visita` (equipe técnica).

### 1.2 Instrumentar equipe técnica
Adicionar `useFormTimer("atendimento" | "encaminhamento" | "busca_ativa" | "roteiro_visita")` nos formulários correspondentes (mesma estratégia silenciosa já usada em relatórios/planejamentos/presença). Custo zero em runtime do usuário: um único insert ao salvar.

### 1.3 RPC nova: `get_lancamentos_detalhados(_profile_id, _tipo?, _de?, _ate?, _limit, _offset)`
Retorna lista paginada:
```
[{ tipo, registro_id, iniciado_em, duracao_segundos, rota, titulo, link }]
```
- Resolve título/link via JOIN leve com a tabela alvo (`relatorios_atividades`, `planejamentos`, `presencas`, `atendimentos`, etc.) usando CASE.
- Paginação obrigatória (default 50). Index `(user_id, tipo, iniciado_em DESC)`.

### 1.4 UI — Drawer "Detalhar" na linha do profissional
Em `ProdutividadeTab`:
- Manter a tabela atual de médias (visão de longo prazo).
- Botão `Detalhar` por linha abre um `Sheet` lateral lazy-loaded com:
  - Filtros: tipo de ação, intervalo de datas.
  - Tabela paginada (50 por página) com: data/hora, tipo, título do registro (link), duração formatada.
  - Mini-stats no topo: total, p50, p90, mais demorado, mais rápido.
- Aba "Equipe técnica" no mesmo padrão, listando atendimentos/encaminhamentos/busca ativa por profissional técnico.

Performance: só roda a query ao abrir o drawer; nada extra carrega no painel principal.

## Parte 2 — Diagnóstico e correção de lentidão

### 2.1 Causas mais prováveis (a investigar e medir)
- Bundle: `CronogramaPage` (842 linhas), tabelas grandes, libs pesadas (xlsx, docx, html2canvas, recharts) sendo importadas no carregamento de várias páginas.
- Tipos do Supabase: `types.ts` enorme aumenta TS-check; ok runtime.
- Queries sem paginação em listas (participantes, relatórios, audit_log).
- Realtime subscriptions duplicadas/abertas sem cleanup.
- Re-renders por context global (`AuthContext`, `CienteRequiredModal` que faz query a cada render).
- Imagens não otimizadas no Feed/Mural/Registros Fotográficos (PNG full).
- Edge functions chamadas em série quando poderiam paralelizar.

### 2.2 Ações concretas
1. **Code-splitting agressivo** das libs pesadas: `xlsx`, `xlsx-js-style`, `docx`, `html2canvas`, `jspdf`, `framer-motion`, `recharts` → dynamic `import()` apenas no momento do uso (exportações/dashboards específicos). Hoje várias estão no bundle inicial.
2. **Lazy import** dos componentes de export (`useDocumentExport`, `useBulkRelatorioExport`, `useBackupExport`).
3. **Auditar `useEffect` + subscribes**: garantir `removeChannel` em todos os componentes com realtime (Cronograma, Notificações, Feed, CienteRequiredModal).
4. **Paginar** queries que hoje puxam tudo: participantes, relatórios, audit_log, feed (cursor por `created_at`).
5. **Indexes faltantes**: revisar via `supabase--linter` + plano de execução nas queries do `DashboardPage` e `CoordenacaoPage`.
6. **React Query**: aumentar `staleTime` para dados pouco mutáveis (bairros, turmas, perfis) — já parcial; estender para indicadores do site público.
7. **Imagens**: aplicar `loading="lazy"` + `decoding="async"` em Feed/Mural/Registros, e converter PNG do storage para WebP no upload (edge function já existe — adicionar resize/compress).
8. **Memoizar** células do grid do Cronograma e da matriz de presença.
9. **Remover `select("*")`** onde só usa 3 campos.
10. **Limitar `CienteRequiredModal`** a polling/realtime em vez de query a cada navegação.

### 2.3 Como medir antes/depois
- `browser--performance_profile` em /, /dashboard, /cronograma, /participantes, /coordenacao.
- Long tasks > 200ms, bundle inicial via build stats.
- p95 das RPCs no log do Supabase.

## Parte 3 — Limpeza de código morto / não utilizado

Auditoria proposta (a executar antes de remover qualquer coisa):
1. `rg` por imports de cada página/hook/edge function — listar órfãos.
2. Verificar tabelas com 0 inserts nos últimos 60 dias via SQL.
3. Verificar rotas no `App.tsx` sem links na sidebar/menu.

Suspeitas a confirmar (NÃO remover sem validar):
- `/preview-design` (DesignPreviewPage) — ferramenta interna.
- `useTransporteOffline` + `offlineDB` — usado?
- `useDocumentScanner` — usado?
- Funções edge antigas: `generate-noticia`, `generate-relatorio-gdoc` (se substituídas).
- Tabelas/colunas legadas: `drive_planilhas_mensais` (RLS hoje "OR true"), `auditoria_abril_desligamentos` (one-shot já consumido?).
- `useProjetos` / `useProjetoTarefas` / `ProjetoWorkspacePage` — não há rota em `App.tsx`. Forte candidato à remoção.

Para cada item confirmado como morto: remover arquivo, dropar tabela/coluna via migration, remover policies, remover do `types.ts` (auto-regen).

## Ordem de execução proposta
1. Plano aprovado → executar auditoria de uso (read-only) e apresentar relatório com candidatos confirmados.
2. Telemetria detalhada (migration + hook + RPC + drawer UI).
3. Otimizações de bundle (dynamic imports) — maior ganho com menor risco.
4. Paginação + memoização + imagens.
5. Remoções de código morto (uma PR por bloco, com migrations reversíveis).
6. Re-medir performance e reportar deltas.

## Garantias
- Nenhuma alteração quebra indicadores: RPCs atuais (`get_dashboard_stats`, `get_coordenacao_stats`, `get_produtividade_educadores`) permanecem intactas; só adicionamos novas.
- Telemetria continua silenciosa (1 insert no save, sem polling).
- Remoções só após confirmar 0 referências em código + 0 uso em dados.

## Fora de escopo
- Migrar para Next/SSR.
- Reescrever Cronograma.
- Mudar provider de auth/storage.
