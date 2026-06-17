DROP FUNCTION IF EXISTS public.get_participantes_turma(uuid, date, text);

CREATE OR REPLACE FUNCTION public.get_participantes_turma(_turma_id uuid, _ref_date date DEFAULT CURRENT_DATE, _modo text DEFAULT 'frequencia'::text)
 RETURNS TABLE(participante_id uuid, nome text, status text, data_desligamento date, desligado_registrado_em timestamp with time zone, busca_ativa_desde timestamp with time zone, marcador text, bloqueado_chamada boolean, bloqueado_desde date, turma_destino_nome text, data_transferencia date, vinculo_saida date, vinculo_entrada date)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_first date := date_trunc('month', _ref_date)::date;
  v_last  date := (date_trunc('month', _ref_date) + INTERVAL '1 month - 1 day')::date;
  v_d     date := _ref_date;
  v_ba_cutoff timestamptz := (_ref_date - INTERVAL '30 days')::timestamptz;
BEGIN
  IF _modo = 'chamada_branco' THEN
    RETURN QUERY
    SELECT
      tp.participante_id,
      p.nome_completo AS nome,
      p.status::text  AS status,
      p.data_desligamento,
      p.desligado_registrado_em,
      p.busca_ativa_desde,
      CASE WHEN p.status = 'busca_ativa' THEN '(BA)' ELSE '' END AS marcador,
      false              AS bloqueado_chamada,
      NULL::date         AS bloqueado_desde,
      NULL::text         AS turma_destino_nome,
      NULL::date         AS data_transferencia,
      NULL::date         AS vinculo_saida,
      tp.data_entrada    AS vinculo_entrada
    FROM turma_participantes tp
    JOIN participantes p ON p.id = tp.participante_id
    WHERE tp.turma_id = _turma_id
      AND p.is_teste = false
      AND tp.data_entrada <= v_d
      AND (tp.data_saida IS NULL OR tp.data_saida > v_d)
      AND p.created_at::date <= v_d
      AND (
        p.status = 'ativo'
        OR (p.status = 'busca_ativa' AND p.busca_ativa_desde IS NOT NULL AND p.busca_ativa_desde >= v_ba_cutoff)
      )
    ORDER BY p.nome_completo;
    RETURN;
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT
      tp.participante_id,
      p.nome_completo AS nome,
      p.status::text AS status,
      p.data_desligamento,
      p.desligado_registrado_em,
      p.busca_ativa_desde,
      tp.data_saida AS vinculo_saida,
      tp.data_entrada AS vinculo_entrada
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
      WHEN b.status = 'busca_ativa' THEN '(BA)'
      WHEN b.status = 'desligado' THEN '(Desligado)'
      WHEN ut.data_transferencia IS NOT NULL
           AND ut.data_transferencia >= v_first
        THEN '(Transferido ' || to_char(ut.data_transferencia, 'DD/MM') || ' para "'
             || COALESCE(ut.turma_destino_nome, '—') || '")'
      ELSE ''
    END AS marcador,
    CASE
      WHEN b.status = 'desligado' THEN true
      WHEN ut.data_transferencia IS NOT NULL
           AND ut.data_transferencia >= v_first THEN true
      WHEN b.vinculo_saida IS NOT NULL AND b.vinculo_saida <= v_last THEN true
      ELSE false
    END AS bloqueado_chamada,
    LEAST(
      CASE
        WHEN b.status = 'desligado' THEN COALESCE(b.data_desligamento, b.desligado_registrado_em::date)
        WHEN ut.data_transferencia IS NOT NULL THEN ut.data_transferencia
        ELSE NULL
      END,
      CASE
        WHEN b.vinculo_saida IS NOT NULL THEN (b.vinculo_saida + INTERVAL '1 day')::date
        ELSE NULL
      END
    ) AS bloqueado_desde,
    ut.turma_destino_nome,
    ut.data_transferencia,
    b.vinculo_saida,
    b.vinculo_entrada
  FROM base b
  LEFT JOIN ult_transf ut ON ut.participante_id = b.participante_id
  WHERE
    b.status IN ('ativo','busca_ativa')
    OR (
      b.status = 'desligado'
      AND COALESCE(b.data_desligamento, b.desligado_registrado_em::date) >= v_first
    )
  ORDER BY b.nome;
END;
$function$;