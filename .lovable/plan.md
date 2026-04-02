

## Plano: Ajustes em Participantes + Mural Coletivo + Feed Social com Conquistas

---

### 1. Filtros sem "Todos" na página Participantes

**`ParticipantesPage.tsx`**: Trocar os placeholders dos Selects:
- `"Todos status"` → `"Status"` (placeholder visual, valor `"todos"` mantido internamente)
- `"Todos períodos"` → `"Período"`
- `"Todos bairros"` → `"Bairro CAIA"`

Usar `placeholder` do SelectTrigger em vez de um SelectItem "todos". Quando nenhum filtro está selecionado, mostrar o placeholder. Adicionar botão "Limpar filtros" quando algum filtro estiver ativo.

### 2. Abrir página do participante clicando na linha

**`ParticipantesPage.tsx`**: Tornar toda a `TableRow` clicável com `onClick={() => navigate(`/participantes/${p.id}`)}` e `cursor-pointer`. Manter os botões de ação existentes (aprovar + ver).

---

### 3. Mural Coletivo (Comunicação entre Profissionais)

**Arquitetura proposta:**

```text
┌─────────────────────────────────┐
│         MURAL COLETIVO          │
├─────────────────────────────────┤
│ [Novo Aviso]                    │
│                                 │
│ 📌 Fixado: Reunião sexta 14h   │
│    por Maria (Coordenação)      │
│    há 2 dias                    │
│                                 │
│ 🔔 Lembrete: Entrega relatórios│
│    por João (Educador)          │
│    há 5 horas                   │
│                                 │
│ 💬 Informativo: Novo aluno...   │
│    por Ana (Eq. Técnica)        │
│    há 1 hora                    │
└─────────────────────────────────┘
```

**Tabela `mural_posts`:**
- `id`, `autor_id` (ref profiles), `tipo` (enum: aviso, lembrete, informativo), `titulo`, `conteudo`, `fixado` (boolean, default false), `created_at`
- RLS: authenticated SELECT/INSERT; coordenacao pode fixar/deletar qualquer; autor pode deletar/editar próprio

**Página `/mural`**: Lista de posts ordenados por fixados primeiro, depois por data. Formulário simples com tipo + título + conteúdo. Coordenação pode fixar/desafixar. Sem comentários neste módulo (comentários ficam no Feed).

---

### 4. Feed Social Coletivo

**Arquitetura proposta:**

```text
┌─────────────────────────────────┐
│          FEED SOCIAL            │
├─────────────────────────────────┤
│ 🏆 Conquista! João atingiu     │
│    50 relatórios este mês!      │
│    🎉 12 likes · 3 comentários │
│                                 │
│ 📸 [FOTO] Maria postou         │
│    "Atividade incrível hoje..." │
│    ❤️ 8 · 💬 2                  │
│                                 │
│ 📝 Auto-post do relatório      │
│    "CAIA MEDIANEIRA 🌍..."      │
│    [fotos do relatório]         │
│    ❤️ 5 · 💬 1                  │
└─────────────────────────────────┘
```

**Tabelas:**

**`feed_posts`:**
- `id`, `autor_id` (ref profiles), `conteudo` (text), `tipo` (enum: manual, relatorio_auto, conquista), `relatorio_id` (nullable, ref relatorios_atividade — para auto-posts), `created_at`
- RLS: authenticated SELECT; authenticated INSERT (não visitante); autor ou coordenacao DELETE/UPDATE

**`feed_fotos`:**
- `id`, `feed_post_id`, `foto_url`, `ordem`

**`feed_reacoes`:**
- `id`, `feed_post_id`, `user_id` (ref profiles), `tipo` (enum: like, amei), `created_at`
- Constraint UNIQUE (feed_post_id, user_id) — 1 reação por usuário por post (pode trocar tipo)

**`feed_comentarios`:**
- `id`, `feed_post_id`, `autor_id` (ref profiles), `conteudo`, `created_at`

**Auto-post de relatórios:** No `RelatorioNovoPage`, após salvar com sucesso e gerar o texto IA (Instagram), criar automaticamente um `feed_post` com `tipo = 'relatorio_auto'`, vinculando `relatorio_id`, copiando as fotos para `feed_fotos`, e usando o texto IA como `conteudo`.

**Sistema de Conquistas (`feed_conquistas` / lógica):**

Conquistas geradas automaticamente e postadas no feed:

| Conquista | Condição |
|---|---|
| 🎯 "Primeiro Relatório!" | Educador salva 1º relatório |
| 📝 "Escritor Dedicado" | 10 / 25 / 50 / 100 relatórios |
| ⭐ "ELO de Ouro" | Score ELO médio ≥ 4.0 no mês |
| 🔥 "Sequência de Fogo" | 5 relatórios consecutivos (dias úteis) |
| 📊 "100% Adesão" | Relatório com pct_adesao = 100% |
| 👥 "Turma Completa" | Presença de todos os matriculados |
| 📅 "Planejador do Mês" | 4+ planejamentos no mês |
| 🌟 "Educador Destaque" | Maior score ELO médio do mês |
| 📸 "Fotógrafo" | 50 fotos em relatórios |
| 🤝 "Engajamento Total" | Todos indicadores ELO ≥ 4 em um relatório |

Tabela **`conquistas`**: `id`, `perfil_id`, `tipo` (text), `nivel` (int, para progressivos), `created_at`. Check de conquistas executado ao salvar relatório.

---

### 5. Navegação

**`AppSidebar.tsx`**: Adicionar 2 itens ao menu:
- "Mural" → `/mural` (ícone: `MessageSquare`)
- "Feed" → `/feed` (ícone: `Newspaper`)

**`App.tsx`**: Adicionar rotas `/mural` e `/feed`.

---

### Migração SQL

1. Enum `tipo_mural` (aviso, lembrete, informativo)
2. Tabela `mural_posts` com RLS
3. Enum `tipo_feed_post` (manual, relatorio_auto, conquista)
4. Enum `tipo_reacao` (like, amei)
5. Tabelas `feed_posts`, `feed_fotos`, `feed_reacoes`, `feed_comentarios`, `conquistas` com RLS
6. Realtime habilitado para `mural_posts`, `feed_posts`, `feed_comentarios`, `feed_reacoes`

### Arquivos

| Arquivo | Mudança |
|---|---|
| Migração SQL | 5 tabelas + enums + RLS + realtime |
| `src/pages/participantes/ParticipantesPage.tsx` | Filtros sem "todos", linha clicável |
| `src/pages/mural/MuralPage.tsx` | Novo — listagem + criação de avisos |
| `src/pages/feed/FeedPage.tsx` | Novo — feed social com posts, reações, comentários |
| `src/components/FeedPost.tsx` | Novo — card de post com reações e comentários |
| `src/hooks/useConquistas.ts` | Novo — lógica de verificação de conquistas ao salvar relatório |
| `src/pages/relatorios/RelatorioNovoPage.tsx` | Auto-post no feed após salvar |
| `src/components/AppSidebar.tsx` | Itens Mural e Feed |
| `src/App.tsx` | Rotas /mural e /feed |

