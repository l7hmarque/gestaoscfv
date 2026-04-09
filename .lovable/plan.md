

## Plano: Corrigir contagem duplicada de participantes estimados por dia

### Problema
O cálculo do "Mapa de Calor — Participantes Estimados por Dia" soma `turma_participantes` por turma e por dia da semana. Se um participante está em 2 turmas que operam no mesmo dia, ele é contado 2 vezes.

### Solução
Alterar a query de `turma_participantes` para incluir `participante_id` além de `turma_id`, e no cálculo do `mapaCalor`, usar um `Set` de `participante_id` por dia da semana para desduplicar.

### Mudança em `EquipeTecnicaPage.tsx`

1. **Query** (linha 79): mudar de `select("turma_id")` para `select("turma_id, participante_id")`

2. **Estado** (linha 89-93): em vez de `tpCountMap` (contagem por turma), construir uma estrutura `turmaParticipantes: Record<string, string[]>` que mapeia `turma_id → participante_id[]`

3. **`mapaCalor` useMemo** (linhas 196-211): para cada dia da semana, coletar os `participante_id` de todas as turmas que operam naquele dia em um `Set`, e usar `set.size` como contagem — eliminando duplicatas.

Nenhuma outra funcionalidade é alterada.

