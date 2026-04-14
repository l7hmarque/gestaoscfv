

## Plano: Mover 110 participantes inativos para Busca Ativa

### Contexto

- 186 participantes com status `ativo`
- 76 tiveram presença em março/2026
- 110 sem nenhuma presença em março — serão movidos para `busca_ativa`
- 61 desligados permanecem como estão

### Ação

1. **SQL UPDATE via insert tool**: Atualizar os 110 participantes que estão como `ativo` mas NÃO tiveram presença em março/2026 para `status = 'busca_ativa'`

```sql
UPDATE participantes
SET status = 'busca_ativa', updated_at = now()
WHERE status = 'ativo'
AND id NOT IN (
  SELECT DISTINCT participante_id
  FROM presenca
  WHERE presente = true
    AND data >= '2026-03-01'
    AND data < '2026-04-01'
);
```

2. **Dashboard**: Nenhuma alteração de código necessária — o dashboard já filtra por `status = 'ativo'`, então passará a mostrar ~76 participantes ativos automaticamente.

### Resultado esperado

| Status | Antes | Depois |
|---|---|---|
| Ativo | 186 | ~76 |
| Busca Ativa | 1 | ~111 |
| Desligado | 61 | 61 |

