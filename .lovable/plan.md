

## Plano: Mural Post-It + Heat Map por Participantes + Reorganização UI/UX

---

### 1. Mural com estética de Post-It

**`MuralPage.tsx`** — Redesign completo do layout dos posts:

- Trocar layout de lista vertical (`Card`) para **grid responsivo** de post-its: `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4`
- Cada post-it terá:
  - Fundo colorido por tipo: aviso = `bg-amber-100`, lembrete = `bg-blue-100`, informativo = `bg-green-100`
  - Leve rotação aleatória (`rotate-[-2deg]`, `rotate-[1deg]`, `rotate-[-1deg]`) via classe condicional baseada no index
  - Sombra estilo papel: `shadow-md hover:shadow-lg`
  - Borda superior grossa colorida ou fita adesiva simulada (div decorativo no topo)
  - Canto levemente dobrado via pseudo-elemento ou gradient
  - Posts fixados com destaque visual (pin icon no canto + fundo levemente diferente)
- Manter funcionalidade: criar, fixar/desafixar, deletar
- Posts fixados sempre no topo do grid

---

### 2. Volume por dia da semana baseado em participantes

**`EquipeTecnicaPage.tsx`** — Corrigir `mapaCalor` (linhas 142-156):

- Atualmente conta quantidade de turmas por dia. Deve contar **participantes**.
- Carregar `turma_participantes` no `loadAll()` (nova query: `supabase.from("turma_participantes").select("turma_id")`)
- Contar quantos participantes cada turma tem: `tpCountMap[turma_id] = count`
- No cálculo do heat map, em vez de `diasMap[key]++`, somar `diasMap[key] += tpCountMap[turma.id] || 0`
- Atualizar label: "Participantes estimados por dia"

---

### 3. Reorganização UI/UX do Sidebar e Navegação

**Problema atual**: 10 itens flat no sidebar sem agrupamento. Presença, Planejamento e Relatórios são do fluxo do educador mas ficam misturados. Mural e Feed são comunicação mas não estão juntos. Banco de Dados fica no meio.

**Nova estrutura do sidebar com grupos** (`AppSidebar.tsx`):

```text
PRINCIPAL
  Dashboard
  Participantes
  Turmas

ATIVIDADES
  Presença
  Planejamento
  Relatórios

COMUNICAÇÃO
  Mural
  Feed

GESTÃO
  Equipe Técnica
  Banco de Dados
```

- Usar `SidebarGroup` + `SidebarGroupLabel` para cada categoria
- Manter todos os itens visíveis (sem collapse de grupo)
- Separadores visuais leves entre grupos

**Página Index (Home)** — Enriquecer com informações úteis:

- Manter grid de atalhos existente
- Adicionar seção de **avisos fixados do mural** (últimos 2-3 posts fixados, mini cards)
- Adicionar **alertas rápidos**: pendentes count, recados não lidos count
- Isso tira a sensação de "coisas escondidas" pois o home resume o que precisa de atenção

---

### Arquivos

| Arquivo | Mudança |
|---|---|
| `src/pages/mural/MuralPage.tsx` | Redesign com grid de post-its coloridos com rotação |
| `src/pages/equipe-tecnica/EquipeTecnicaPage.tsx` | Heat map conta participantes, não turmas |
| `src/components/AppSidebar.tsx` | Sidebar com 4 grupos categorizados |
| `src/pages/Index.tsx` | Home com avisos fixados + alertas rápidos |

