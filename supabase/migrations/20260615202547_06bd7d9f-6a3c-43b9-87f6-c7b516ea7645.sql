
ALTER TABLE public.participantes
  ADD COLUMN IF NOT EXISTS data_retorno timestamp with time zone;

CREATE OR REPLACE FUNCTION public.trg_participantes_retorno()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD.status = 'desligado'
     AND NEW.status IN ('ativo','busca_ativa')
     AND OLD.status IS DISTINCT FROM NEW.status
  THEN
    NEW.data_retorno := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_participantes_retorno ON public.participantes;
CREATE TRIGGER trg_participantes_retorno
  BEFORE UPDATE OF status ON public.participantes
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_participantes_retorno();

CREATE OR REPLACE FUNCTION public.get_participantes_turma(
  _turma_id uuid,
  _ref_date date DEFAULT CURRENT_DATE,
  _modo text DEFAULT 'frequencia'::text
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
SET search_path = public
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
      NULL::date         AS data_transferencia
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
    b.status IN ('ativo','busca_ativa')
    OR (
      b.status = 'desligado'
      AND COALESCE(b.data_desligamento, b.desligado_registrado_em::date) >= v_first
    )
  ORDER BY b.nome;
END;
$function$;

CREATE OR REPLACE VIEW public.vw_participante_frequencia_status
WITH (security_invoker = true)
AS
WITH ult_pres AS (
  SELECT
    pr.participante_id,
    pr.turma_id,
    MAX(pr.data) FILTER (WHERE pr.presente = true) AS ultima_presenca_em
  FROM public.presenca pr
  GROUP BY pr.participante_id, pr.turma_id
)
SELECT
  p.id                                   AS participante_id,
  tp.turma_id                            AS turma_id,
  p.status::text                         AS status_atual,
  (tp.data_saida IS NULL)                AS vinculo_aberto,
  up.ultima_presenca_em,
  CASE
    WHEN up.ultima_presenca_em IS NULL THEN NULL
    ELSE (CURRENT_DATE - up.ultima_presenca_em)
  END                                    AS dias_sem_presenca,
  (
    tp.data_saida IS NULL
    AND (
      p.status = 'ativo'
      OR (
        p.status = 'busca_ativa'
        AND p.busca_ativa_desde IS NOT NULL
        AND p.busca_ativa_desde >= (CURRENT_DATE - INTERVAL '30 days')
      )
    )
  )                                      AS frequentando,
  CASE
    WHEN tp.data_saida IS NOT NULL THEN 'sem_vinculo'
    WHEN p.status = 'desligado'   THEN 'desligado'
    WHEN p.status = 'busca_ativa'
      AND (p.busca_ativa_desde IS NULL
           OR p.busca_ativa_desde < (CURRENT_DATE - INTERVAL '30 days')) THEN 'ba_excedida'
    ELSE NULL
  END                                    AS motivo_exclusao
FROM public.participantes p
JOIN public.turma_participantes tp ON tp.participante_id = p.id
LEFT JOIN ult_pres up ON up.participante_id = p.id AND up.turma_id = tp.turma_id
WHERE p.is_teste = false;

GRANT SELECT ON public.vw_participante_frequencia_status TO authenticated;
GRANT SELECT ON public.vw_participante_frequencia_status TO service_role;
