## Pausar o cron e desfazer impacto retroativo

### 1. Pausar o cron (edge function `recompute-participantes-status`)

A função é disparada por um agendamento externo (pg_cron com `net.http_post`, fora do repositório). Em vez de tentar removê-lo, **adiciono um guard na própria função**: nova chave em `configuracoes_gerais` chamada `recompute_pausado`. Se `= 'true'`, a função retorna imediatamente sem alterar nada e registra `paused` em `recompute_ultimo_resultado`.

Migration:
```sql
INSERT INTO configuracoes_gerais (chave, valor)
VALUES ('recompute_pausado', 'true')
ON CONFLICT (chave) DO UPDATE SET valor='true';
```

Edição de `supabase/functions/recompute-participantes-status/index.ts`:
```ts
// após carregar cfg
if ((map["recompute_pausado"] || "false") === "true") {
  await supabase.from("configuracoes_gerais")
    .update({ valor: JSON.stringify({ paused: true, at: new Date().toISOString() }) })
    .eq("chave", "recompute_ultimo_resultado");
  return ok({ paused: true });
}
```
Incluo `recompute_pausado` no `.in([...])` do select de config.

### 2. Correção retroativa dos dados

Tudo que o cron tocou está rastreável via `audit_log` (`acao='recompute_status'`) — 217 mudanças. Faço uma **migration única** (idempotente) que:

**a) Restaura status para `ativo`** todos os participantes que hoje estão em `busca_ativa` ou `desligado` **e** têm pelo menos uma entrada `recompute_status` no audit_log que os marcou como `busca ativa`:
```sql
UPDATE participantes p
SET status = 'ativo',
    busca_ativa_desde = NULL,
    data_desligamento = NULL,
    motivo_desligamento = NULL,
    desligado_em = NULL
WHERE p.status IN ('busca_ativa','desligado')
  AND EXISTS (
    SELECT 1 FROM audit_log a
    WHERE a.tabela='participantes'
      AND a.acao='recompute_status'
      AND a.registro_id = p.id::text
      AND a.detalhes ILIKE 'Marcado como busca ativa%'
  );
```

**b) Limpa indicadores derivados** gerados pelo cron:
```sql
-- alertas de desligamento sugeridos pelo cron
DELETE FROM alertas_desligamento_sugerido
WHERE created_at >= '2026-04-16';   -- início das execuções automáticas

-- registros automáticos de busca ativa (se houver)
DELETE FROM busca_ativa_registros
WHERE registrado_por = '00000000-0000-0000-0000-000000000000'
   OR observacao ILIKE '%recompute%';
```

**c) Apaga rastro no audit_log** para que dashboards de auditoria/atividade não contabilizem as 217 ações automáticas:
```sql
DELETE FROM audit_log
WHERE tabela='participantes' AND acao='recompute_status';
```

**d) Reseta o resumo da última execução:**
```sql
UPDATE configuracoes_gerais SET valor='{"paused":true}'
WHERE chave='recompute_ultimo_resultado';
```

### 3. Verificação após aplicar

Rodo 3 consultas:
- `SELECT status, COUNT(*) FROM participantes GROUP BY status` → espero ~321 ativos, 0 ou pouquíssimos `busca_ativa`/`desligado` (só os que vieram de ações humanas reais, se houver).
- `SELECT COUNT(*) FROM audit_log WHERE acao='recompute_status'` → 0.
- `SELECT COUNT(*) FROM alertas_desligamento_sugerido` → 0 (ou só anteriores a 16/04 se existirem).

### 4. Reativar quando quiser

Para religar o cron no futuro, basta `UPDATE configuracoes_gerais SET valor='false' WHERE chave='recompute_pausado'` — sem deploy.

### Risco / reversibilidade

- A migration toca apenas dados criados/alterados pelo cron (identificados pelo `audit_log`). Não afeta desligamentos/transferências feitas por usuários reais (essas têm `acao` diferente: `desligamento`, `transferencia`, etc.).
- Se algo der errado, posso restaurar o estado consultando o `audit_log` antes do DELETE — então proponho **primeiro fazer um SELECT de validação**, mostrar a você, e só depois rodar o DELETE.
