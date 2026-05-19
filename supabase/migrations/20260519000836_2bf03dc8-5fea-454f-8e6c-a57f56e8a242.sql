
-- 1. Ampliar tipos aceitos
ALTER TABLE public.user_action_durations DROP CONSTRAINT IF EXISTS user_action_durations_tipo_check;
ALTER TABLE public.user_action_durations ADD CONSTRAINT user_action_durations_tipo_check
  CHECK (tipo IN (
    'relatorio','planejamento','presenca',
    'edicao_relatorio','edicao_planejamento','edicao_presenca',
    'atendimento','edicao_atendimento',
    'encaminhamento','edicao_encaminhamento',
    'busca_ativa','edicao_busca_ativa',
    'roteiro_visita','edicao_roteiro_visita'
  ));

-- 2. Índice para lookups por registro
CREATE INDEX IF NOT EXISTS idx_uad_tipo_registro
  ON public.user_action_durations (tipo, registro_id);

CREATE INDEX IF NOT EXISTS idx_uad_user_salvo
  ON public.user_action_durations (user_id, salvo_em DESC);

-- 3. RPC paginada com título/link resolvido
CREATE OR REPLACE FUNCTION public.get_lancamentos_detalhados(
  _profile_id uuid,
  _tipo text DEFAULT NULL,
  _de date DEFAULT NULL,
  _ate date DEFAULT NULL,
  _limit int DEFAULT 50,
  _offset int DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_rows jsonb;
  v_total bigint;
BEGIN
  IF NOT has_role(auth.uid(), 'coordenacao'::app_role) THEN
    RETURN jsonb_build_object('error', 'forbidden');
  END IF;

  SELECT user_id INTO v_user_id FROM profiles WHERE id = _profile_id;
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'profile_not_found');
  END IF;

  WITH base AS (
    SELECT uad.*
    FROM user_action_durations uad
    WHERE uad.user_id = v_user_id
      AND (_tipo IS NULL OR uad.tipo = _tipo OR uad.tipo = ('edicao_'||_tipo))
      AND (_de   IS NULL OR uad.salvo_em::date >= _de)
      AND (_ate  IS NULL OR uad.salvo_em::date <= _ate)
  ),
  pg AS (
    SELECT * FROM base ORDER BY salvo_em DESC
    LIMIT _limit OFFSET _offset
  ),
  enriched AS (
    SELECT
      pg.id,
      pg.tipo,
      pg.registro_id,
      pg.iniciado_em,
      pg.salvo_em,
      pg.duracao_segundos,
      pg.rota,
      CASE
        WHEN pg.tipo IN ('relatorio','edicao_relatorio') THEN (
          SELECT COALESCE(ra.titulo, 'Relatório')
          FROM relatorios_atividades ra WHERE ra.id::text = pg.registro_id
        )
        WHEN pg.tipo IN ('planejamento','edicao_planejamento') THEN (
          SELECT COALESCE(p.titulo, 'Planejamento')
          FROM planejamentos p WHERE p.id::text = pg.registro_id
        )
        WHEN pg.tipo IN ('atendimento','edicao_atendimento') THEN (
          SELECT 'Atendimento — ' || COALESCE(a.tipo, '') || ' ' || COALESCE(a.data_atendimento::text,'')
          FROM atendimentos a WHERE a.id::text = pg.registro_id
        )
        WHEN pg.tipo IN ('encaminhamento','edicao_encaminhamento') THEN (
          SELECT 'Encaminhamento — ' || COALESCE(e.orgao,'')
          FROM encaminhamentos_externos e WHERE e.id::text = pg.registro_id
        )
        WHEN pg.tipo IN ('busca_ativa','edicao_busca_ativa') THEN (
          SELECT 'Busca ativa — ' || COALESCE(b.tipo_contato,'')
          FROM busca_ativa_registros b WHERE b.id::text = pg.registro_id
        )
        ELSE pg.tipo
      END AS titulo
    FROM pg
  )
  SELECT jsonb_agg(to_jsonb(enriched)) INTO v_rows FROM enriched;

  SELECT count(*) INTO v_total FROM base;

  RETURN jsonb_build_object(
    'rows', COALESCE(v_rows, '[]'::jsonb),
    'total', v_total,
    'limit', _limit,
    'offset', _offset
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_lancamentos_detalhados(uuid, text, date, date, int, int) TO authenticated;
