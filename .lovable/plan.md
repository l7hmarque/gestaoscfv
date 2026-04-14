## Plano: Turmas, Dados Financeiros, Notificações, Feed e Ferramenta de Cronograma

### 1. Turmas — Criar Karatê Alvorada

Criar 2 turmas de Karatê no Alvorada:

- **KARATE — 6-8 — ALVORADA** (manhã, seg/qua)
- **KARATE — 9-11 — ALVORADA** (manhã, seg/qua)

Educador: Felipe Gomes da Silva (mesmo das outras turmas de karatê). Via insert SQL.

As demais turmas estão corretas conforme conferido.

### 2. Dados Financeiros no Banco de Dados

`**src/pages/banco-dados/BancoDadosPage.tsx**`:

- Adicionar abas: **Despesas**, **Categorias**, **Parcelas**, **Estornos**, **Orçamentos**
- Carregar dados via `fetchAllRows` para cada tabela financeira
- Adicionar colunas apropriadas (valor formatado, fornecedor, mês, status, etc.)
- Adicionar entradas no `TAB_TABLE_MAP` com cascatas corretas:
  - `orcamentos` → cascade: `orcamento_itens` (fk: `orcamento_id`), `orcamento_cotacoes` (fk: `orcamento_id`), `despesas` (fk: `orcamento_id`)
  - `orcamento_cotacoes` → cascade: `orcamento_precos` (fk: `cotacao_id`)
  - `despesas` → cascade: `despesa_historico` (fk: `despesa_id`)
- Atualizar lista de categorias de backup

### 3. Notificações em Tempo Real

**Problema**: O canal realtime `recados-notif` está configurado corretamente, mas o `loadData` recarrega tudo a cada evento. O problema real é que o componente `NotificationBell` é montado apenas uma vez e o `useEffect` depende de `[user]` — se o user object muda de referência sem mudar de valor, pode não re-subscribir.

**Correção em `src/components/NotificationBell.tsx**`:

- Garantir que o canal realtime está realmente ativo verificando logs
- Adicionar `console.log` de debug temporário ou verificar se a subscription está sendo criada com `status: SUBSCRIBED`
- Verificar se a tabela `recados` tem realtime habilitado (`ALTER PUBLICATION supabase_realtime ADD TABLE recados`)

### 4. Feed — Reação Lenta

**Problema**: `handleReacao` faz o Supabase call, espera completar, e depois chama `onRefresh()` que recarrega TODOS os posts + fotos + reações + comentários.

**Correção em `src/components/FeedPost.tsx**`:

- Aplicar **optimistic update**: atualizar o estado local imediatamente antes de esperar a resposta do servidor
- Não chamar `onRefresh()` para reações — atualizar apenas o estado local de reações

**Correção em `src/pages/feed/FeedPage.tsx**`:

- Expor uma função `onReacaoUpdate(postId, reacoes)` em vez de `onRefresh` para atualizações parciais de reações

### 5. Ferramenta de Cronograma Semanal (Novo Módulo)

**Conceito**: Um planejador visual de grade semanal onde cada célula é um slot (dia × período × local) e o usuário arrasta/atribui atividades, educadores e oficineiros.

**Variáveis do problema**:

- Dias da semana (seg-sex)
- Períodos (manhã/tarde)
- Bairros/locais de atendimento (3 territórios) 
- Educadores disponíveis (com carga horária)
- Oficineiros (karatê, etc.)
- Faixas etárias por turma
- Mínimo de dias de atendimento por bairro
- Rodízio de oficinas

**Proposta de UI**:

- Grade visual: linhas = bairros × períodos, colunas = dias da semana
- Cada célula mostra: educador(es), atividade/oficina, faixas atendidas
- Sidebar com educadores/oficineiros disponíveis para arrastar
- Menu de configuracao de regras
- Indicadores visuais: conflitos (educador em 2 lugares), mínimo de dias não atingido, rodízio incompleto
- Validação automática: alertas em tempo real quando uma regra é violada
- Salvar cenários para comparar alternativas

**Tabela nova**: `cronograma_slots` com campos: `dia_semana`, `periodo`, `bairro_id`, `educador_id`, `oficineiro_id`, `tipo_atividade`, `cenario_id`

**Nova página**: `/cronograma` acessível pelo menu lateral

### Arquivos afetados

1. **SQL**: Insert turmas karatê Alvorada + `ALTER PUBLICATION supabase_realtime ADD TABLE recados` + nova tabela `cronograma_slots` + `cronograma_cenarios`
2. `**src/pages/banco-dados/BancoDadosPage.tsx**`: Adicionar abas financeiras
3. `**src/components/NotificationBell.tsx**`: Verificar/corrigir realtime
4. `**src/components/FeedPost.tsx**`: Optimistic updates para reações
5. `**src/pages/feed/FeedPage.tsx**`: Suporte a atualização parcial
6. **Novo `src/pages/cronograma/CronogramaPage.tsx**`: Ferramenta de cronograma
7. `**src/App.tsx**`: Adicionar rota `/cronograma`
8. `**src/components/AppSidebar.tsx**`: Adicionar link no menu  
  
FIZ ALTERACOES NO PLANO, LEIA E APLIQUE