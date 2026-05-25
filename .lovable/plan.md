## Problema

Ao excluir uma turma, três FKs sem regra de exclusão bloqueiam a operação:

1. `participante_transferencias.turma_origem_id` → turmas (NO ACTION)
2. `participante_transferencias.turma_destino_id` → turmas (NO ACTION)
3. `cronograma_slots.turma_id` → turmas (NO ACTION)

A RPC `excluir_turma_com_auditoria` só apaga `turma_participantes` antes de remover a turma, então o `DELETE` quebra na constraint.

## Decisão de design

Para **`participante_transferencias`** (histórico de transferências aprovadas — dado de auditoria, NÃO pode ser apagado):
→ alterar FKs para **`ON DELETE SET NULL`**. A transferência permanece no histórico apontando para "turma removida".

Para **`cronograma_slots`** (slots da agenda semanal, recriáveis):
→ alterar FK para **`ON DELETE CASCADE`**. Slot sem turma não faz sentido.

Essa abordagem é melhor do que apagar manualmente na RPC porque:
- Funciona para QUALQUER caminho de exclusão (RPC, console, futuras rotinas), não só a RPC atual.
- Preserva o histórico de transferências (LGPD/auditoria).
- Não exige novo código TypeScript.

## Implementação

**Uma migration SQL apenas:**

```sql
-- 1. participante_transferencias: preservar histórico, apenas desreferenciar
ALTER TABLE public.participante_transferencias
  DROP CONSTRAINT participante_transferencias_turma_origem_id_fkey,
  ADD CONSTRAINT participante_transferencias_turma_origem_id_fkey
    FOREIGN KEY (turma_origem_id) REFERENCES public.turmas(id) ON DELETE SET NULL;

ALTER TABLE public.participante_transferencias
  DROP CONSTRAINT participante_transferencias_turma_destino_id_fkey,
  ADD CONSTRAINT participante_transferencias_turma_destino_id_fkey
    FOREIGN KEY (turma_destino_id) REFERENCES public.turmas(id) ON DELETE SET NULL;

-- 2. cronograma_slots: cascade (slot órfão é inútil)
ALTER TABLE public.cronograma_slots
  DROP CONSTRAINT cronograma_slots_turma_id_fkey,
  ADD CONSTRAINT cronograma_slots_turma_id_fkey
    FOREIGN KEY (turma_id) REFERENCES public.turmas(id) ON DELETE CASCADE;
```

A RPC `excluir_turma_com_auditoria` e o `BancoDadosPage` continuam funcionando sem mudanças. O delete em lote (`excluir_turmas_lote_com_auditoria`) também passa a funcionar.

## Implicações no fluxo

- **Tela de Turmas / Banco de Dados:** exclusão volta a funcionar para qualquer turma, incluindo as 11 turmas inativas com vínculos órfãos identificadas anteriormente.
- **Histórico de transferências:** se uma turma referenciada for excluída, o registro mostrará "—" no lugar do nome. O participante e a data permanecem. Recomendo, na tela de transferências, exibir um fallback tipo "Turma removida" quando `turma_*_id` for null.
- **Cronograma semanal:** slots da turma excluída somem da agenda automaticamente, comportamento esperado.
- **Reversão:** trivial — basta nova migration revertendo as constraints.

## Risco

Baixo. Nenhuma perda de dado de auditoria (transferências preservadas). `cronograma_slots` é regenerado a cada planejamento semanal.
