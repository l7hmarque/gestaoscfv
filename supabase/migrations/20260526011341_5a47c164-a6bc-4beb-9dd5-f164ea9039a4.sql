CREATE OR REPLACE FUNCTION public.get_participantes_turma(
  _turma_id uuid,
  _ref_date date DEFAULT CURRENT_DATE,
  _modo text DEFAULT 'frequencia'
)
RETURNS TABLE(
  participante_id uuid,
  nome text,
  status text,
  data_desligamento date,
  desligado_registrado_em timestamp with time zone,
  busca_ativa_desde timestamp with time zone,
  marcador text,
  bloqueado_chamada boolean,
  bloqueado_desde date,
  turma_destino_nome text,
  data_transferencia date
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_first date := date_trunc('month', _ref_date)::date;
  v_last  date := (date_trunc('month', _ref_date) + INTERVAL '1 month - 1 day')::date;
BEGIN
  RETURN QUERY
  WITH base AS (
    SELECT
      tp.participante_id,
      p.nome_completo AS nome,
      p.status::text AS status,
      p.data_desligamento,
      p.desligado_registrado_em,
      p.busca_ativa_desde
    FROM turma_participantes tp
    JOIN participantes p ON p.id = tp.participante_id
    WHERE tp.turma_id = _turma_id
      AND p.is_teste = false
      AND tp.data_entrada <= v_last
      AND (tp.data_saida IS NULL OR tp.data_saida >= v_first)
      AND p.created_at::date <= v_last
  ),
  ult_transf AS (
    SELECT DISTINCT ON (pt.participante_id)
      pt.participante_id,
      pt.data_transferencia,
      pt.turma_destino_id,
      td.nome AS turma_destino_nome
    FROM participante_transferencias pt
    LEFT JOIN turmas td ON td.id = pt.turma_destino_id
    WHERE pt.turma_origem_id = _turma_id
    ORDER BY pt.participante_id, pt.data_transferencia DESC NULLS LAST, pt.created_at DESC
  )
  SELECT
    b.participante_id,
    b.nome,
    b.status,
    b.data_desligamento,
    b.desligado_registrado_em,
    b.busca_ativa_desde,
    CASE
      WHEN _modo = 'chamada_branco' AND b.status = 'busca_ativa' THEN '(BA)'
      WHEN _modo = 'chamada_branco' THEN ''
      WHEN b.status = 'busca_ativa' THEN '(BA)'
      WHEN b.status = 'desligado' THEN '(Desligado)'
      WHEN ut.data_transferencia IS NOT NULL
           AND ut.data_transferencia >= v_first
        THEN '(Transferido ' || to_char(ut.data_transferencia, 'DD/MM') || ' para "'
             || COALESCE(ut.turma_destino_nome, '—') || '")'
      ELSE ''
    END AS marcador,
    CASE
      WHEN _modo = 'chamada_branco' THEN false
      WHEN b.status = 'desligado' THEN true
      WHEN ut.data_transferencia IS NOT NULL
           AND ut.data_transferencia >= v_first THEN true
      ELSE false
    END AS bloqueado_chamada,
    CASE
      WHEN b.status = 'desligado' THEN COALESCE(b.data_desligamento, b.desligado_registrado_em::date)
      WHEN ut.data_transferencia IS NOT NULL THEN ut.data_transferencia
      ELSE NULL
    END AS bloqueado_desde,
    ut.turma_destino_nome,
    ut.data_transferencia
  FROM base b
  LEFT JOIN ult_transf ut ON ut.participante_id = b.participante_id
  WHERE
    CASE
      WHEN _modo = 'chamada_branco' THEN
        b.status IN ('ativo','cadastro_incompleto','busca_ativa')
      ELSE
        b.status IN ('ativo','cadastro_incompleto','busca_ativa')
        OR (
          b.status = 'desligado'
          AND COALESCE(b.data_desligamento, b.desligado_registrado_em::date) >= v_first
        )
    END
  ORDER BY b.nome;
END;
$function$;