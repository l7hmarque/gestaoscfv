

## Plano: Correções — Cadastro de Profissional, Vínculo Planejamento↔Relatório, Geração de Turmas e Calendários

---

### 1. Erro ao cadastrar profissional

**Causa:** A edge function `create-professional` usa `Deno.env.get("SUPABASE_PUBLISHABLE_KEY")` que não existe. O nome correto do secret é `SUPABASE_ANON_KEY`.

**Correção:**
- `supabase/functions/create-professional/index.ts` — trocar `SUPABASE_PUBLISHABLE_KEY` por `SUPABASE_ANON_KEY` na linha 18

---

### 2. Vínculo Planejamento ↔ Relatório

**Problema:** O relatório já salva `planejamento_id`, mas nenhuma das páginas de detalhe mostra o link cruzado.

**Correções:**
- **`RelatorioDetalhePage.tsx`**: buscar o planejamento vinculado (`item.planejamento_id`) e exibir um link clicável para `/planejamentos/{id}` com o título do planejamento
- **`PlanejamentoDetalhePage.tsx`**: fazer query em `relatorios_atividade` filtrando `planejamento_id = id` para listar relatórios vinculados, com links para `/relatorios/{id}`
- **`ProfissionalPerfilPage.tsx`**: na aba Planejamentos, mostrar se há relatório vinculado (badge "Relatório ✓"); na aba Relatórios, mostrar planejamento vinculado

---

### 3. Geração de turmas em lote — participantes errados

**Problema:** O auto-vínculo não verifica se o participante já está em outra turma da mesma faixa/período. Resultado: participantes duplicados ou mal distribuídos.

**Correção em `TurmaNovaPage.tsx`:**
- Antes de vincular, buscar vínculos existentes em `turma_participantes` para os participantes candidatos
- Filtrar: não vincular participante que já esteja em outra turma com mesma `faixa_etaria` + `periodo`
- Isso evita duplicação e garante alocação correta

---

### 4. Calendários devem abrir no mês atual

**Problema:** Os componentes `<Calendar>` não recebem `defaultMonth`, então podem abrir em meses aleatórios quando nenhuma data está selecionada.

**Correção em todas as páginas com calendário:**
- Adicionar `defaultMonth={new Date()}` em cada `<Calendar>`:
  - `PlanejamentoNovoPage.tsx`
  - `RelatorioNovoPage.tsx`
  - `PresencaPage.tsx`
  - Qualquer outro local que use `<Calendar>` sem data pré-selecionada

---

### Arquivos modificados

| Arquivo | Mudança |
|---|---|
| `supabase/functions/create-professional/index.ts` | Trocar `SUPABASE_PUBLISHABLE_KEY` → `SUPABASE_ANON_KEY` |
| `src/pages/relatorios/RelatorioDetalhePage.tsx` | Mostrar link para planejamento vinculado |
| `src/pages/planejamentos/PlanejamentoDetalhePage.tsx` | Listar relatórios vinculados ao planejamento |
| `src/pages/profissional/ProfissionalPerfilPage.tsx` | Mostrar vínculo planejamento↔relatório nas abas |
| `src/pages/turmas/TurmaNovaPage.tsx` | Evitar duplicação no auto-vínculo em lote |
| `src/pages/planejamentos/PlanejamentoNovoPage.tsx` | `defaultMonth={new Date()}` no Calendar |
| `src/pages/relatorios/RelatorioNovoPage.tsx` | `defaultMonth={new Date()}` no Calendar |
| `src/pages/presenca/PresencaPage.tsx` | `defaultMonth={new Date()}` no Calendar |

