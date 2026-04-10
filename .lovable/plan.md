

## Plano: Corrigir bug de presença fantasma ao desmarcar turmas

### Problema
Ao marcar e desmarcar uma turma no formulário de relatório, os participantes daquela turma permanecem no objeto `form.presenca` (linha 165). A contagem de `numParticipantes` (linha 194) usa `Object.values(form.presenca).filter(Boolean).length` — que conta **todos** os participantes já adicionados, inclusive os de turmas desmarcadas. Isso infla a adesão.

### Causa raiz
O `useEffect` (linha 152-172) apenas **adiciona** novos participantes ao `presenca`, mas nunca remove os de turmas desmarcadas. Quando `turma_ids` fica vazio, `participantesTurma` é limpo mas `form.presenca` não.

### Bug secundário
O cálculo de `numParticipantes` deveria considerar apenas participantes que estão em `participantesTurma` (a lista atual), não todos os que já passaram pelo `presenca`.

### Correções

**Arquivo: `src/pages/relatorios/RelatorioNovoPage.tsx`**

1. **Limpar presença ao esvaziar turmas** (linha 153): quando `turma_ids.length === 0`, além de `setParticipantesTurma([])`, limpar `form.presenca` e `form.justificativas`.

2. **Filtrar presença ao carregar participantes** (linhas 164-168): ao montar o novo `pres`, começar do zero usando apenas os IDs da lista atual, preservando o estado (presente/ausente) se o participante já existia.

3. **Limpar justificativas órfãs** junto com a presença.

4. **Proteger o cálculo de adesão** (linha 194): contar apenas participantes presentes **que existam em `participantesTurma`**, como segurança extra.

### Resumo técnico das mudanças

| Local | Mudança |
|---|---|
| Linha 153 | Adicionar limpeza de `presenca` e `justificativas` quando não há turmas |
| Linhas 164-168 | Reconstruir `pres` filtrando apenas IDs da lista atual |
| Linha 194 | Calcular `numParticipantes` intersectando com `participantesTurma` |

Apenas um arquivo alterado, sem mudanças de banco de dados.

