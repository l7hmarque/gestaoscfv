## Hub de Projetos & Tarefas

Novo módulo `/projetos` para criar projetos (instâncias), endereçar tarefas a colaboradores, acompanhar via Kanban, Gantt com dependências, lista filtrada e ficha de tarefa com comentários/checklist/anexos.

### Localização e acesso
- Item "Projetos" no grupo **Gestão** do `AppSidebar` (visível para todos os profissionais autenticados).
- Rota nova `/projetos` (lista de projetos) e `/projetos/:id` (workspace do projeto).
- Qualquer profissional pode criar projetos. Dentro de cada projeto, papéis:
  - **Owner** (criador) — edita tudo, arquiva, exclui projeto.
  - **Membro** — cria/edita tarefas e move cards.
  - **Observador** — somente leitura.
- Coordenação tem visibilidade universal (vê todos os projetos, mesmo sem ser membro).

### Modelo de dados (novas tabelas)
```text
projetos
  id, nome, descricao, status (ativo|pausado|concluido|arquivado),
  cor, owner_id (profiles), data_inicio, data_fim_prevista, created_at, updated_at

projeto_membros
  projeto_id, profile_id, papel (owner|membro|observador), PRIMARY KEY (projeto_id, profile_id)

projeto_colunas         -- colunas configuráveis do Kanban
  id, projeto_id, nome, ordem, cor
  -- seed automático ao criar projeto: A Fazer / Em Andamento / Em Revisão / Concluído

projeto_tarefas
  id, projeto_id, coluna_id, titulo, descricao,
  responsavel_id (profiles), criador_id, prioridade (baixa|media|alta|urgente),
  data_inicio, prazo, duracao_estimada_horas, progresso_pct,
  ordem_kanban, tags text[], created_at, updated_at, concluido_em

projeto_tarefa_dependencias
  tarefa_id, depende_de_id, tipo (FS), PRIMARY KEY (tarefa_id, depende_de_id)
  -- ciclo prevenido por trigger

projeto_tarefa_checklist
  id, tarefa_id, texto, concluido bool, ordem

projeto_tarefa_comentarios
  id, tarefa_id, autor_id, texto, created_at

projeto_tarefa_anexos
  id, tarefa_id, storage_path, nome, mime, tamanho, autor_id, created_at

-- Storage bucket "projeto-anexos" privado (RLS por membresia do projeto)
```

**RLS resumida:** SELECT em todas as tabelas filhas exige `EXISTS (membro do projeto) OR has_role(coordenacao)`. INSERT/UPDATE em tarefas exige papel `membro|owner`. DELETE de projeto só `owner` ou `coordenacao`.

**Trigger anti-ciclo** em `projeto_tarefa_dependencias` faz busca recursiva e levanta exceção se a dependência criar loop.

### Telas

**`/projetos` — Lista de projetos**
- Cards (grid) com nome, % conclusão (tarefas concluídas/total), prazo, contagem de membros, dot de status.
- Filtros: status, "meus projetos", busca por nome.
- Botão "Novo projeto" → diálogo (nome, descrição, cor, datas, membros iniciais).

**`/projetos/:id` — Workspace** (Tabs controladas, padrão do projeto)
1. **Visão geral** — KPIs (tarefas abertas, atrasadas, concluídas este mês, % progresso), descrição do projeto, prazo, membros com avatar.
2. **Kanban** — colunas drag-and-drop com `@dnd-kit/core` + `@dnd-kit/sortable`. Card mostra título, responsável (avatar), prazo (badge vermelha se atrasada), prioridade (cor), ícone de dependência se houver predecessoras pendentes (e bloqueia movimento para "Concluído"). Botão "+ tarefa" por coluna.
3. **Lista** — tabela com filtros (responsável, prazo, prioridade, tag, status). Edição inline de status/prazo/responsável.
4. **Gantt** — timeline construída em SVG (sem nova lib pesada): eixo de dias/semanas, barras por tarefa baseadas em `data_inicio` → `prazo`, marco vertical do `data_fim_prevista` do projeto, setas curvas ligando dependências (FS). Zoom dia/semana/mês. Hover mostra tooltip; clique abre ficha da tarefa.
5. **Membros** — adicionar/remover profissionais (busca em `profiles`), trocar papel.
6. **Configurações** — nome, datas, cor, arquivar/excluir (com justificativa registrada em `audit_log`).

**Ficha da tarefa** (Sheet lateral, abre de qualquer tela)
- Edição de todos os campos.
- **Checklist** de subtarefas com progresso automático (% feito atualiza `progresso_pct` da tarefa).
- **Dependências**: combobox para adicionar predecessoras (mesma projeto), com badge de status. Bloqueia auto-dependência e ciclos (validação cliente + trigger no banco).
- **Comentários** com @menções (reusa `MentionInput`) — cada menção dispara notificação.
- **Anexos** via Storage bucket `projeto-anexos` (upload Base64 em chunks, padrão do sistema).
- Botão "Concluir tarefa" — só habilitado se todas as predecessoras estiverem concluídas.

### Notificações
Ao **criar/atribuir tarefa**, **alterar responsável**, **mudar prazo**, ou **mencionar em comentário**:
- Insere linha em `notificacoes` (sino existente do `NotificationBell`) com link `/projetos/:id?tarefa=:tarefa_id`.
- Insere `recados` com `tipo_recado='tecnico'`, destinatário = responsável, corpo automatizado ("Nova tarefa atribuída no projeto X — prazo DD/MM").
- Card "Tarefas pendentes pra você" no `/dashboard` (atalho), reaproveitando padrão dos outros widgets.

### Estética e padrões
- Mesma identidade do hub Coordenação (header com ícone em `bg-primary/10`, cards `border-l-4 border-l-primary/60`, Tabs controladas).
- Componentes reutilizam `@/components/ui/*` (Card, Tabs, Sheet, Select, Badge, DropdownMenu).
- Drag-and-drop instala apenas `@dnd-kit/core` + `@dnd-kit/sortable` (lightweight, sem React 19 conflicts). Gantt feito sob medida em SVG — sem nova dependência.
- TanStack Query para cache (já em uso no projeto).
- Datas exibidas DD/MM, padrão SysCFV; nomes em Title Case na criação de projetos.

### Detalhes técnicos
- Migrations: criar tabelas + índices em `projeto_id`, `responsavel_id`, `prazo` + trigger anti-ciclo + bucket Storage + policies RLS.
- Função SQL `get_projeto_stats(_projeto_id)` retornando jsonb com KPIs (totais por status, atrasadas, % conclusão, próximos vencimentos) — chamada na aba Visão geral.
- Função SQL `criar_projeto(_nome, ..., _membros_ids[])` que cria projeto, adiciona owner como membro, cria 4 colunas padrão e retorna id (transação).
- Drag no Kanban faz UPDATE otimista (`coluna_id`, `ordem_kanban`) com revert em erro.
- Gantt: cálculo de min/max datas, escala em pixels, virtualização opcional se >200 tarefas (fora do MVP).
- Memória nova: `mem://funcionalidades/hub-projetos-tarefas` documentando estrutura, papéis e regra de bloqueio por dependência.

### Arquivos a criar
```text
src/pages/projetos/
  ProjetosListPage.tsx
  ProjetoWorkspacePage.tsx
  tabs/VisaoGeralTab.tsx
  tabs/KanbanTab.tsx
  tabs/ListaTab.tsx
  tabs/GanttTab.tsx
  tabs/MembrosTab.tsx
  tabs/ConfiguracoesTab.tsx
  components/TarefaSheet.tsx
  components/GanttChart.tsx
  components/KanbanColumn.tsx
  components/KanbanCard.tsx
  components/NovoProjetoDialog.tsx
src/hooks/useProjetos.ts
src/hooks/useProjetoTarefas.ts
src/lib/projetoHelpers.ts (cores, formatos, validação dependência)
supabase/migrations/<timestamp>_hub_projetos.sql
```

### Fora do MPV (para iterações futuras)
- Templates de projeto, recorrência de tarefas, time tracking real, exportação Gantt em PNG/PDF, integração com calendário externo, automações tipo "ao concluir → mover".
