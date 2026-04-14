

## Plano: Aplicar Design do Preview Globalmente + Atalhos Rápidos + Incentivos de Engajamento

### 1. Aplicar design tokens globais (`src/index.css`)

Atualizar as CSS variables `:root` para a paleta do preview:

| Token | Atual | Novo |
|---|---|---|
| `--background` | `40 20% 97%` (bege) | `220 14% 96%` (cinza frio) |
| `--primary` | `0 65% 67%` (rosa claro) | `0 58% 56%` (vermelho profundo) |
| `--muted` | `210 15% 93%` | `215 20% 93%` |
| `--muted-foreground` | `215 14% 46%` | `215 16% 46%` |
| `--sidebar-background` | `0 0% 100%` | `220 15% 98%` |
| `--sidebar-accent` | `210 15% 95%` | `220 15% 95%` |

### 2. Sidebar — estilo técnico (`AppSidebar.tsx`)

- Item ativo: borda-esquerda 3px primária + fundo sutil (`bg-primary/5`) em vez de `bg-sidebar-accent`
- Labels de grupo: `uppercase tracking-[0.1em] text-[10px] font-semibold` com cor muted
- Logo: usar `SysCFVLogo` já existente (sem mudança)

### 3. Header — gradiente sutil (`AppLayout.tsx`)

- Fundo com gradiente `bg-gradient-to-r from-card to-background` em vez de `bg-card` sólido
- Aumentar de `h-12` para `h-[52px]`

### 4. DataTable — refinamentos (`DataTable.tsx`)

- Header: `bg-muted/50 uppercase tracking-wider text-[11px]`
- Zebra striping: linhas alternadas `even:bg-muted/30`
- Hover: `hover:bg-muted/40`

### 5. Dashboard — atalhos rápidos no topo + KPIs estilo preview (`DashboardPage.tsx` + `Index.tsx`)

**Atalhos rápidos** (antes dos KPIs):
- Barra horizontal com 4-5 botões compactos: Relatórios, Cronograma, Feed, Participantes, Presença
- Estilo: cards pequenos com ícone + label, hover com `shadow-md`, sem fundo circular no ícone
- Borda-esquerda colorida por contexto

**KPI Cards** — aplicar estilo do preview:
- Borda-esquerda `border-l-4` colorida por contexto
- Número em `text-2xl font-bold`, label em `text-[11px] uppercase tracking-wider`
- Delta com seta e cor (verde/vermelho)

### 6. Login page (`LoginPage.tsx`)

- Usar componente `SysCFVLogo` em vez do quadrado com "S"
- Fundo com gradiente sutil

### 7. Incentivos de engajamento para Feed e Recados

**A. Streak de atividade no perfil do profissional**
- Contar dias consecutivos com atividade no feed (post ou comentário)
- Exibir "🔥 X dias de streak" no perfil e no sidebar footer
- Conquistas novas: `streak_7` (7 dias), `streak_30` (30 dias)

**B. Leaderboard semanal no Feed**
- Card no topo do Feed mostrando "Top 3 da semana" (quem mais postou/reagiu/comentou)
- Dados derivados de `feed_posts` + `feed_reacoes` + `feed_comentarios` da última semana

**C. Conquistas de comunicação** (adicionar ao `useConquistas.ts`):
- `primeiro_post_feed`: "📢 Primeira Publicação!" — postou no feed pela primeira vez
- `comunicador_10`: "💬 Comunicador Ativo" — 10 posts no feed
- `recado_respondido`: "✅ Responsável" — respondeu/concluiu 10 recados técnicos

**D. Badge "Contribuidor da Semana"** no sidebar/header
- Quem teve mais interações (posts + reações + comentários) na semana ganha badge temporário

### Arquivos editados

| Arquivo | Mudança |
|---|---|
| `src/index.css` | Paleta fria, tokens atualizados |
| `src/components/AppSidebar.tsx` | Estilo de item ativo, labels uppercase |
| `src/components/AppLayout.tsx` | Header com gradiente, altura 52px |
| `src/components/DataTable.tsx` | Zebra striping, header uppercase |
| `src/pages/dashboard/DashboardPage.tsx` | Atalhos rápidos no topo, KPIs estilo preview |
| `src/pages/Index.tsx` | Atalhos atualizados (cronograma, feed) + estilo |
| `src/pages/auth/LoginPage.tsx` | Logo SysCFV, gradiente |
| `src/hooks/useConquistas.ts` | Novas conquistas de comunicação |
| `src/pages/feed/FeedPage.tsx` | Leaderboard semanal no topo |
| `src/pages/profissional/ProfissionalPerfilPage.tsx` | Streak de atividade |

### Banco de dados

Nenhuma migração necessária — as conquistas de comunicação usam a tabela `conquistas` existente (campo `tipo` é texto livre). O leaderboard é calculado client-side a partir de dados já existentes.

### Zero alteração na lógica de negócio existente

