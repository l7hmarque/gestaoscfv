

# Módulo de Coordenação

Hub dedicado em `/coordenacao` que consolida atribuições do cargo de coordenador e oferece **KPIs do próprio trabalho de gestão**. Os indicadores reaproveitam e se somam aos dados já calculados pelo `get_dashboard_stats` e `get_pendencias_integridade` existentes — sem duplicar lógica, sem criar métricas paralelas.

## Princípio de integração de dados

Os KPIs do coordenador são uma **camada complementar** sobre o que já existe:

- **Reaproveita**: chama `get_dashboard_stats` e `get_pendencias_integridade` por dentro do novo RPC `get_coordenacao_stats` e mescla no JSON de retorno (chaves `dashboard` e `pendencias`).
- **Respeita o marco operacional**: lê `configuracoes_gerais.data_inicio_operacional` (mesma constante usada no dashboard) para filtrar audit_log, transferências e tempos médios.
- **Adiciona** apenas o que ainda não existe: tempos médios de resposta, decisões do coordenador no `audit_log`, fila priorizada de ações, cobertura de metas territoriais cruzada com `bairros.meta_*`.
- **Frontend**: a tela de coordenação consome o RPC unificado e exibe lado a lado os KPIs operacionais herdados do dashboard + os KPIs de gestão novos, deixando claro de onde vem cada número.

## O que será entregue

### 1. Rota `/coordenacao` (acesso restrito ao role `coordenacao`)
Item dedicado na sidebar, grupo **Gestão**, ícone Briefcase. Bloqueado para outros perfis com redirect + toast.

### 2. Layout em 5 abas

**Aba 1 — Painel do Coordenador (default)**
- KPIs herdados (`dashboard.*`): participantes ativos, turmas ativas, taxa de frequência, média ELO, delta de participantes — exibidos como contexto operacional.
- KPIs novos de gestão (último período): pendências de integridade abertas (de `pendencias.total`, com link para `/integridade`), aprovações de transferência pendentes, avisos ativos, recados técnicos sem resposta, encaminhamentos abertos > 30 dias, turmas sem educador / vazias (de `pendencias.*`), % de educadores que entregaram relatórios no mês, % de planejamentos com turma vinculada, cobertura de metas territoriais.
- Cada card indica a fonte (Operacional / Gestão / Integridade) com badge sutil.

**Aba 2 — Ações Pendentes**
Fila única e priorizada construída a partir das tabelas existentes:
- Transferências aguardando aprovação (`participante_transferencias`)
- Matrículas pendentes
- Top categorias de `get_pendencias_integridade_detalhes`
- Recados técnicos endereçados à coordenação
- Avisos expirando em 7 dias (`avisos_sistema`)

Cada item tem ação rápida (aprovar/rejeitar/abrir tela específica) sem sair da página.

**Aba 3 — Decisões e Auditoria**
Log de `audit_log` filtrado pelo `user_id` do coordenador logado:
- Tabela com data, ação, tabela afetada, justificativa
- Filtros: período, tipo de ação (exclusão, aprovação, transferência, desligamento)
- Contadores agregados (exclusões justificadas, aprovações, desligamentos validados)
- Toggle "Equipe (todos coordenadores)" / "Individual"

**Aba 4 — Indicadores de Qualidade da Gestão**
Métricas derivadas dos dados já existentes:
- Tempo médio de resposta a transferências (`participante_transferencias.created_at` → `data_transferencia`)
- Tempo médio de resolução de pendências (via `audit_log`)
- % de turmas ativas com educador (de `pendencias.turmas_sem_educador` vs total)
- % de participantes ativos sem pendências
- Reusa séries `presencaMensal` e `eloMensal` já entregues por `get_dashboard_stats` para gráficos de evolução
- Cobertura territorial real (de `dashboard.participantesPorBairro` + `participantesPorPeriodo`) vs metas (`bairros.meta_*`)

**Aba 5 — Relatório do Coordenador**
PDF + XLSX do trabalho da coordenação no período selecionado, reaproveitando `addInstitutionalHeader`, `applyInstitutionalStyle`, `sysCfvFileName`, paleta grayscale. Conteúdo: capa, sumário executivo (mesmos KPIs do painel), decisões registradas, aprovações concedidas, desligamentos validados, pendências abertas vs resolvidas, gráficos. Nome: `SysCFV_RelatorioCoordenacao_{YYYY-MM-DD}_{HHmmss}.{ext}`.

## Detalhes técnicos

**Backend (1 migration)** — RPC `get_coordenacao_stats(_user_id uuid, _periodo_dias int)`:
- Lê data de corte de `configuracoes_gerais.data_inicio_operacional` (mesma fonte do dashboard).
- Chama `public.get_dashboard_stats(NULL, NULL)` e `public.get_pendencias_integridade()` por dentro e mescla os resultados.
- Adiciona blocos novos: `acoes_pendentes`, `qualidade_gestao` (tempos médios via `EXTRACT(EPOCH FROM ...)`), `decisoes_proprias` (count de `audit_log` filtrado), `cobertura_metas`.
- Retorna `jsonb_build_object('dashboard', ..., 'pendencias', ..., 'gestao', ...)`.
- `SECURITY DEFINER` + check `has_role(_user_id, 'coordenacao')`.

**Frontend (3 arquivos novos + 2 edições)**:
- `src/pages/coordenacao/CoordenacaoPage.tsx` — shell com Tabs (estado controlado, padrão do projeto)
- `src/pages/coordenacao/PainelCoordenadorTab.tsx` — KPIs unificados (operacional + gestão) e fila de ações
- `src/hooks/useCoordenacaoData.ts` — TanStack Query consumindo a RPC, expondo `dashboard`, `pendencias` e `gestao` para componentes
- Edição `src/components/AppSidebar.tsx` — novo item "Coordenação" no grupo Gestão (visível só se role = coordenacao)
- Edição `src/App.tsx` — rota lazy-loaded `/coordenacao` dentro de `<ProtectedRoute>`

**Estilo**: cards com borda lateral 4px colorida (padrão `DashboardPage`), badge de origem do dado (Operacional/Gestão/Integridade), grayscale para documentos exportados.

## Diagrama de fluxo de dados

```text
configuracoes_gerais.data_inicio_operacional
            │
            ▼
get_coordenacao_stats(user_id, periodo_dias)
   ├── chama get_dashboard_stats()        → bloco "dashboard"
   ├── chama get_pendencias_integridade() → bloco "pendencias"
   └── calcula novos KPIs de gestão       → bloco "gestao"
            │
            ▼
useCoordenacaoData (TanStack Query, cache 5min)
            │
            ▼
CoordenacaoPage → 5 abas (KPIs unificados sem duplicar lógica)
```

## Fora do escopo (já existem em outras páginas)
- Aprovação individual de transferências → `/participantes` (linkada daqui)
- Pendências detalhadas → `/integridade` (linkada daqui)
- Desligamento em lote → `/desligamento-admin` (linkado daqui)
- Edição de roles → `/configuracoes`

