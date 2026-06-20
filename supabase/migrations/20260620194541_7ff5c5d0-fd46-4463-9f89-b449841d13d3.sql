INSERT INTO configuracoes_gerais (chave, valor)
VALUES ('recompute_pausado', 'true')
ON CONFLICT (chave) DO UPDATE SET valor='true';

UPDATE participantes p
SET status = 'ativo',
    busca_ativa_desde = NULL,
    data_desligamento = NULL,
    motivo_desligamento = NULL
WHERE p.status IN ('busca_ativa','desligado')
  AND EXISTS (
    SELECT 1 FROM audit_log a
    WHERE a.tabela='participantes'
      AND a.acao='recompute_status'
      AND a.registro_id = p.id::text
      AND a.detalhes ILIKE 'Marcado como busca ativa%'
  );

DELETE FROM alertas_desligamento_sugerido
WHERE created_at >= '2026-04-16';

DELETE FROM audit_log
WHERE tabela='participantes' AND acao='recompute_status';

UPDATE configuracoes_gerais SET valor='{"paused":true}'
WHERE chave='recompute_ultimo_resultado';