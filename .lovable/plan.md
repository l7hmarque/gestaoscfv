
## Auditoria Completa do Sistema — Gaps, Falhas e Otimizações

### Análise realizada
Auditei: 45 tabelas, 18 warnings do linter, todas as rotas, FKs, índices, RLS policies, padrões de fetch, arquitetura de componentes, edge functions, e fluxo de dados.

---

## PARTE 1 — BUGS E FALHAS ATIVAS

### 1.1. Página PresencaHistoricoPage é um stub vazio
- Arquivo: `src/pages/presenca/PresencaHistoricoPage.tsx`
- A página apenas mostra texto estático "Histórico mensal será carregado do banco de dados" — nenhuma funcionalidade implementada
- **Porém**: a rota nem está registrada no `App.tsx`, então não é acessível — código morto

### 1.2. `fetchAllRows` usa `(supabase.from as any)` — sem type safety
- Em `fetchAllRows`, `useAuditLog`, `EquipeTecnicaPage`, e `FinanceiroPage`
- Bypass completo de tipos TypeScript. Se tabela não existir, falha silenciosamente
- **Fix**: Adicionar as tabelas faltantes (`busca_ativa_registros`, `audit_log`) ao type generator ou usar tipagem genérica

### 1.3. Dashboard carrega TODAS as presenças sem filtro
- `useDashboardData.ts` linha 44: `fetchAllRows("presenca", { select: "id, presente" })`
- Atualmente 0 registros, mas ao crescer (ex: 10.000+), carregará tudo só pra calcular taxa de frequência
- **Fix**: Usar `count` com filtro server-side ou agregar com RPC

### 1.4. REO/Relatório Mensal fazem 11 fetchAllRows em paralelo
- `DashboardRelatorioMensalTab.tsx` linhas 163-175: carrega TODAS as linhas de 11 tabelas simultaneamente
- Com dados reais, isso pode consumir centenas de MB de memória e travar o browser
- **Fix**: Mover lógica pesada para edge function (já existe `generate-relatorio-mensal`), eliminar fetch duplicado client-side

### 1.5. TurmasPage faz N+1 queries para contar participantes
- Linha 68-70: Para cada turma, faz uma query separada `select("id", { count: "exact", head: true })`
- Com 21 turmas = 22 queries
- **Fix**: Uma única query `turma_participantes` com `group by turma_id` e join

### 1.6. Nenhum índice em colunas de busca frequente
Colunas usadas em filtros/joins que não possuem índice dedicado:
- `presenca.participante_id` — usado em quase toda exportação
- `presenca.data` — filtrado por range em relatórios mensais
- `presenca.turma_id` — join frequente
- `atendimentos.participante_id`
- `despesas.mes_referencia`
- `relatorios_atividade.data`
- `relatorios_atividade.educador_id`
- `audit_log.created_at`
- `recados.destinatario_id`
- `participantes.status`

O único índice composto existente é `presenca(turma_id, participante_id, data)` — bom, mas faltam os individuais.

---

## PARTE 2 — SEGURANÇA

### 2.1. 12+ RLS policies com `true` em INSERT/UPDATE/DELETE
Tabelas afetadas: `participantes`, `presenca`, `planejamento_turmas`, `relatorio_presenca`, `relatorio_turmas`, `relatorio_fotos`, `participante_documentos`

Qualquer usuário autenticado (incluindo visitantes recém-criados) pode inserir, atualizar e deletar nesses. Embora existam policies "Deny visitante", a combinação de `USING (true)` com `USING (NOT has_role('visitante'))` — ambas PERMISSIVE — cria um OR lógico, significando que a policy `true` prevalece e visitantes TAMBÉM podem operar.

**Fix**: Converter as policies "Deny visitante" de PERMISSIVE para RESTRICTIVE, ou remover as policies `true` e substituir por checks mais específicos.

### 2.2. DevPage protegida apenas por senha client-side
- `const DEV_PASSWORD = "leoleo"` — hardcoded e trivial
- A rota `/dev` não está dentro do `ProtectedRoute`, permitindo acesso sem autenticação
- Permite gerenciar roles de qualquer usuário
- **Fix**: Mover `/dev` para dentro de `ProtectedRoute` e validar `has_role('coordenacao')` server-side

### 2.3. Tabelas sem foreign keys reportadas pelo linter como "No foreign keys"
Na verdade as FKs EXISTEM (confirmei via pg_constraint), mas o schema exporter do Supabase não as detecta — provavelmente foram criadas sem `REFERENCES` na migration original e adicionadas depois. Não é um bug funcional.

---

## PARTE 3 — DATA RELATIONSHIP GAPS

### 3.1. Tabela `presenca` tem 0 registros vs `relatorio_presenca` com 63
- A presença real é registrada via `relatorio_presenca` (atrelada a relatórios de atividade), não pela tabela `presenca`
- A tabela `presenca` é usada pela `PresencaPage` (registro manual), que foi "ocultada" do menu
- O dashboard calcula `taxaFrequenciaGeral` usando `presenca` (0 registros) — resultado: **0% sempre**
- **Fix**: Dashboard e REO devem também considerar `relatorio_presenca` + `relatorio_turmas` como fonte de dados de frequência

### 3.2. `totalParticipantesAlerta` é sempre 0
- `useDashboardData.ts` linha 141: `totalParticipantesAlerta: 0` — hardcoded
- Deveria calcular baseado em faltas consecutivas (lógica já existe na Busca Ativa)
- **Fix**: Calcular com base na mesma lógica de detecção da `EquipeTecnicaPage`

### 3.3. `audit_log` não tem FK para `profiles` ou `auth.users`
- `user_id` é UUID mas sem constraint — aceita qualquer valor
- Logs de auditoria podem conter user_ids inválidos
- **Fix**: Adicionar FK para `auth.users(id)` com ON DELETE SET NULL

### 3.4. `recados.numero` usa sequence mas sem concurrency protection
- Sequence `recados_numero_seq` pode gerar gaps sob concorrência, mas isso é aceitável para numeração
- Não é um bug, apenas uma observação

---

## PARTE 4 — PERFORMANCE

### 4.1. Sem code splitting / lazy loading
- `App.tsx` importa TODOS os 30+ page components staticamente
- Bundle inicial inclui toda a lógica de financeiro, relatórios, export, charts
- **Fix**: `React.lazy()` + `Suspense` para cada rota — reduz bundle inicial em ~60-70%

### 4.2. Bibliotecas pesadas importadas globalmente
- `xlsx-js-style`, `docx`, `jspdf`, `jspdf-autotable`, `docxtemplater`, `pizzip`, `recharts`
- Todas carregadas no bundle principal mesmo quando usuário só acessa o dashboard
- **Fix**: Dynamic `import()` nas funções de export (já estão em handlers async, fácil de converter)

### 4.3. `DashboardRelatorioMensalTab` duplica dados entre `generateLocal` e `generateFullReport`
- Ambas funções fazem `fetchAllRows` das mesmas 10-11 tabelas
- Nenhuma usa cache do React Query
- **Fix**: Extrair para um hook com `useQuery`, reutilizar dados

### 4.4. Feed carrega 100 posts + todas as fotos/reações/comentários
- `FeedPage.tsx` linha 57-61: 5 queries sem filtro de limite nas tabelas de fotos/reações/comentários
- Com crescimento, vai carregar milhares de registros de fotos
- **Fix**: Paginação + filtro por `feed_post_id IN (últimos 100 post ids)`

---

## PARTE 5 — CÓDIGO MORTO / REDUNDÂNCIAS

### 5.1. Rotas duplicadas
- `/mural` e `/feed` apontam para o mesmo `FeedPage` — linha 100-101 do App.tsx
- `PresencaHistoricoPage` importada mas rota não registrada

### 5.2. `PresencaPage` e `PresencaExportarPage` ocultas do menu
- Existem no router mas não aparecem no `AppSidebar`
- Se são intencionalmente ocultas, ok. Caso contrário, código órfão

### 5.3. Vários `useEffect` sem cleanup que fazem fetches em components de página
- Padrão repetido: `useEffect(() => { loadAll(); }, [])` sem cancelamento
- Se o usuário navega rapidamente, state updates acontecem em componentes desmontados

---

## PLANO DE CORREÇÕES PRIORIZADAS

### Fase 1 — Crítico (Segurança + Bugs de dados)
1. **Corrigir RLS policies** — Converter 7 policies "Deny visitante" de PERMISSIVE para RESTRICTIVE
2. **Proteger /dev** — Mover para dentro de ProtectedRoute + role check
3. **Fix taxa de frequência** — Dashboard usar `relatorio_presenca` ao invés de `presenca` vazia
4. **Fix `totalParticipantesAlerta`** — Calcular com base em faltas reais

### Fase 2 — Performance
5. **Adicionar índices** — 10 índices nas colunas mais consultadas
6. **Lazy loading de rotas** — `React.lazy()` em todas as páginas
7. **Dynamic imports** — xlsx/docx/jspdf importados só quando usado
8. **Fix N+1 em TurmasPage** — Query única para contagem

### Fase 3 — Limpeza
9. **Remover código morto** — PresencaHistoricoPage, rota /mural duplicada
10. **Paginação no Feed** — Limitar fotos/reações ao subset visível

---

### Arquivos alterados (estimativa)

| Arquivo | Mudança |
|---|---|
| Migration SQL | 10 CREATE INDEX + 1 ALTER RLS policies |
| `src/App.tsx` | React.lazy para todas as rotas |
| `src/hooks/useDashboardData.ts` | Usar relatorio_presenca; calcular alerta real |
| `src/pages/turmas/TurmasPage.tsx` | Eliminar N+1 |
| `src/pages/feed/FeedPage.tsx` | Limitar fetch de fotos/reações |
| `src/pages/presenca/PresencaHistoricoPage.tsx` | Remover |
| RLS migration | Converter 7 policies PERMISSIVE→RESTRICTIVE |
