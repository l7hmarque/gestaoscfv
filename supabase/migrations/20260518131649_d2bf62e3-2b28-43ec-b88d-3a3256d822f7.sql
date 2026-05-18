-- Remove os overloads atuais para criar uma assinatura única com novos filtros
DROP FUNCTION IF EXISTS public.get_dashboard_stats(integer, integer);
DROP FUNCTION IF EXISTS public.get_dashboard_stats(integer, integer, date, date);

CREATE OR REPLACE FUNCTION public.get_dashboard_stats(
  _mes integer DEFAULT NULL,
  _ano integer DEFAULT NULL,
  _data_inicio date DEFAULT NULL,
  _data_fim date DEFAULT NULL,
  _faixa text DEFAULT NULL,
  _genero text DEFAULT NULL,
  _bairro_id uuid DEFAULT NULL,
  _periodo text DEFAULT NULL
)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  result jsonb;
  v_total_participantes int;
  v_total_turmas int;
  v_total_relatorios int;
  v_total_consolidados int;
  v_total_planejamentos int;
  v_media_elo numeric;
  v_media_elo_n int;
  v_media_adesao numeric;
  v_media_adesao_consolidada numeric;
  v_taxa_frequencia numeric;
  v_total_alerta int;
  v_delta_participantes int;
  v_ativos_atual int;
  v_ativos_anterior int;
  v_por_faixa jsonb;
  v_por_genero jsonb;
  v_por_bairro jsonb;
  v_por_periodo jsonb;
  v_elo_mensal jsonb;
  v_adesao_mensal jsonb;
  v_competencias jsonb;
  v_objetivos jsonb;
  v_top_educadores jsonb;
  v_presenca_mensal jsonb;
  v_filter_start date;
  v_filter_end date;
  v_has_filter boolean;
  v_atividades_recentes jsonb;
  v_synthetic_filter text := 'Atividade SCFV (consolidado%';
  v_data_corte date;
  v_effective_start date;
  v_inicio_mes_atual date := date_trunc('month', current_date)::date;
  v_inicio_mes_anterior date := (date_trunc('month', current_date) - interval '1 month')::date;
  v_fim_mes_anterior date := (date_trunc('month', current_date))::date;
  v_prev_start date;
  v_prev_end date;
  v_parcial_atual boolean := false;
  v_window_days int;
  v_has_dim_filter boolean;
  v_pf_ids uuid[];
BEGIN
  SELECT valor::date INTO v_data_corte FROM configuracoes_gerais WHERE chave = 'data_inicio_operacional';
  v_data_corte := COALESCE(v_data_corte, '2026-04-01'::date);

  v_has_filter := (_data_inicio IS NOT NULL AND _data_fim IS NOT NULL) OR (_mes IS NOT NULL AND _ano IS NOT NULL);
  IF _data_inicio IS NOT NULL AND _data_fim IS NOT NULL THEN
    v_filter_start := _data_inicio;
    v_filter_end := _data_fim + 1;
    v_effective_start := GREATEST(v_filter_start, v_data_corte);
    v_window_days := (v_filter_end - v_filter_start);
    v_prev_start := v_filter_start - v_window_days;
    v_prev_end := v_filter_start;
  ELSIF _mes IS NOT NULL AND _ano IS NOT NULL THEN
    v_filter_start := make_date(_ano, _mes, 1);
    v_filter_end := (v_filter_start + interval '1 month')::date;
    v_effective_start := GREATEST(v_filter_start, v_data_corte);
    v_prev_start := (v_filter_start - interval '1 month')::date;
    v_prev_end := v_filter_start;
  ELSE
    v_filter_start := v_inicio_mes_atual;
    v_filter_end := (current_date + 1);
    v_effective_start := GREATEST(v_filter_start, v_data_corte);
    v_prev_start := v_inicio_mes_anterior;
    v_prev_end := v_fim_mes_anterior;
  END IF;

  -- Calcula universo de participantes filtrados pelas dimensões (faixa/gênero/bairro/período)
  v_has_dim_filter := (_faixa IS NOT NULL OR _genero IS NOT NULL OR _bairro_id IS NOT NULL OR _periodo IS NOT NULL);

  IF v_has_dim_filter THEN
    SELECT coalesce(array_agg(p.id), ARRAY[]::uuid[])
      INTO v_pf_ids
    FROM participantes p
    WHERE p.status = 'ativo' AND p.is_teste = false
      AND (_genero IS NULL OR coalesce(p.genero, '') = _genero)
      AND (_bairro_id IS NULL OR p.bairro_id = _bairro_id)
      AND (_periodo IS NULL OR p.periodo::text = _periodo)
      AND (_faixa IS NULL OR (
        CASE
          WHEN extract(year from age(current_date, p.data_nascimento)) BETWEEN 6 AND 8 THEN '6-8'
          WHEN extract(year from age(current_date, p.data_nascimento)) BETWEEN 9 AND 11 THEN '9-11'
          WHEN extract(year from age(current_date, p.data_nascimento)) BETWEEN 12 AND 17 THEN '12-17'
          WHEN extract(year from age(current_date, p.data_nascimento)) >= 60 THEN '60+'
          ELSE 'Outros'
        END = _faixa
      ));
  END IF;

  -- Total de participantes ativos no período (com presença), respeitando dimensões
  SELECT count(DISTINCT rp.participante_id) INTO v_total_participantes
  FROM relatorio_presenca rp
  JOIN relatorios_atividade ra ON ra.id = rp.relatorio_id
  JOIN participantes p ON p.id = rp.participante_id AND p.is_teste = false
  WHERE rp.presente = true AND ra.data >= v_effective_start AND ra.data < v_filter_end
    AND (NOT v_has_dim_filter OR rp.participante_id = ANY(v_pf_ids));

  IF v_has_filter THEN
    SELECT count(*) INTO v_total_turmas FROM turmas WHERE created_at < v_filter_end;
  ELSE
    SELECT count(*) INTO v_total_turmas FROM turmas WHERE ativa = true;
  END IF;

  -- Métricas de atividade — quando há filtro dimensional, só conta relatórios que envolvem o universo filtrado
  IF v_has_filter THEN
    SELECT count(*) FILTER (WHERE coalesce(nome_atividade,'') NOT LIKE v_synthetic_filter),
           count(*) FILTER (WHERE coalesce(nome_atividade,'') LIKE v_synthetic_filter)
      INTO v_total_relatorios, v_total_consolidados
      FROM relatorios_atividade ra
      WHERE data >= v_effective_start AND data < v_filter_end
        AND (NOT v_has_dim_filter OR EXISTS (
          SELECT 1 FROM relatorio_presenca rp
          WHERE rp.relatorio_id = ra.id AND rp.participante_id = ANY(v_pf_ids)
        ));
    SELECT count(*) INTO v_total_planejamentos FROM planejamentos WHERE data_aplicacao >= v_effective_start AND data_aplicacao < v_filter_end;
  ELSE
    SELECT count(*) FILTER (WHERE coalesce(nome_atividade,'') NOT LIKE v_synthetic_filter),
           count(*) FILTER (WHERE coalesce(nome_atividade,'') LIKE v_synthetic_filter)
      INTO v_total_relatorios, v_total_consolidados
      FROM relatorios_atividade ra
      WHERE data >= v_data_corte
        AND (NOT v_has_dim_filter OR EXISTS (
          SELECT 1 FROM relatorio_presenca rp
          WHERE rp.relatorio_id = ra.id AND rp.participante_id = ANY(v_pf_ids)
        ));
    SELECT count(*) INTO v_total_planejamentos FROM planejamentos WHERE coalesce(data_aplicacao, '1900-01-01'::date) >= v_data_corte;
  END IF;

  IF v_has_filter THEN
    SELECT coalesce(avg(score_elo), 0), count(*) FILTER (WHERE score_elo IS NOT NULL),
           coalesce(avg(pct_adesao) FILTER (WHERE coalesce(nome_atividade,'') NOT LIKE v_synthetic_filter), 0),
           coalesce(avg(pct_adesao) FILTER (WHERE coalesce(nome_atividade,'') LIKE v_synthetic_filter), 0)
      INTO v_media_elo, v_media_elo_n, v_media_adesao, v_media_adesao_consolidada
      FROM relatorios_atividade ra
      WHERE data >= v_effective_start AND data < v_filter_end
        AND (NOT v_has_dim_filter OR EXISTS (
          SELECT 1 FROM relatorio_presenca rp
          WHERE rp.relatorio_id = ra.id AND rp.participante_id = ANY(v_pf_ids)
        ));
  ELSE
    SELECT coalesce(avg(score_elo), 0), count(*) FILTER (WHERE score_elo IS NOT NULL),
           coalesce(avg(pct_adesao) FILTER (WHERE coalesce(nome_atividade,'') NOT LIKE v_synthetic_filter), 0),
           coalesce(avg(pct_adesao) FILTER (WHERE coalesce(nome_atividade,'') LIKE v_synthetic_filter), 0)
      INTO v_media_elo, v_media_elo_n, v_media_adesao, v_media_adesao_consolidada
      FROM relatorios_atividade ra
      WHERE data >= v_data_corte
        AND (NOT v_has_dim_filter OR EXISTS (
          SELECT 1 FROM relatorio_presenca rp
          WHERE rp.relatorio_id = ra.id AND rp.participante_id = ANY(v_pf_ids)
        ));
  END IF;

  -- Distribuições — sempre mostram todas as categorias (não filtra pela própria dimensão, para permitir desmarcar)
  SELECT coalesce(jsonb_object_agg(faixa, qtd), '{}'::jsonb) INTO v_por_faixa FROM (
    SELECT CASE
        WHEN extract(year from age(current_date, p.data_nascimento)) BETWEEN 6 AND 8 THEN '6-8'
        WHEN extract(year from age(current_date, p.data_nascimento)) BETWEEN 9 AND 11 THEN '9-11'
        WHEN extract(year from age(current_date, p.data_nascimento)) BETWEEN 12 AND 17 THEN '12-17'
        WHEN extract(year from age(current_date, p.data_nascimento)) >= 60 THEN '60+'
        ELSE 'Outros' END as faixa, count(*) as qtd
    FROM participantes p
    WHERE p.status = 'ativo' AND p.is_teste = false
      AND (_genero IS NULL OR coalesce(p.genero, '') = _genero)
      AND (_bairro_id IS NULL OR p.bairro_id = _bairro_id)
      AND (_periodo IS NULL OR p.periodo::text = _periodo)
    GROUP BY faixa
  ) sub;

  SELECT coalesce(jsonb_object_agg(coalesce(genero,'N/I'), qtd), '{}'::jsonb) INTO v_por_genero FROM (
    SELECT genero, count(*) as qtd FROM participantes p
    WHERE status = 'ativo' AND is_teste = false
      AND (_bairro_id IS NULL OR p.bairro_id = _bairro_id)
      AND (_periodo IS NULL OR p.periodo::text = _periodo)
      AND (_faixa IS NULL OR (
        CASE
          WHEN extract(year from age(current_date, p.data_nascimento)) BETWEEN 6 AND 8 THEN '6-8'
          WHEN extract(year from age(current_date, p.data_nascimento)) BETWEEN 9 AND 11 THEN '9-11'
          WHEN extract(year from age(current_date, p.data_nascimento)) BETWEEN 12 AND 17 THEN '12-17'
          WHEN extract(year from age(current_date, p.data_nascimento)) >= 60 THEN '60+'
          ELSE 'Outros'
        END = _faixa
      ))
    GROUP BY genero
  ) sub;

  SELECT coalesce(jsonb_object_agg(coalesce(b_nome,'N/I'), qtd), '{}'::jsonb) INTO v_por_bairro FROM (
    SELECT b.nome AS b_nome, count(*) as qtd FROM participantes p
      LEFT JOIN bairros b ON b.id = p.bairro_id
      WHERE p.status = 'ativo' AND p.is_teste = false
        AND (_genero IS NULL OR coalesce(p.genero, '') = _genero)
        AND (_periodo IS NULL OR p.periodo::text = _periodo)
        AND (_faixa IS NULL OR (
          CASE
            WHEN extract(year from age(current_date, p.data_nascimento)) BETWEEN 6 AND 8 THEN '6-8'
            WHEN extract(year from age(current_date, p.data_nascimento)) BETWEEN 9 AND 11 THEN '9-11'
            WHEN extract(year from age(current_date, p.data_nascimento)) BETWEEN 12 AND 17 THEN '12-17'
            WHEN extract(year from age(current_date, p.data_nascimento)) >= 60 THEN '60+'
            ELSE 'Outros'
          END = _faixa
        ))
      GROUP BY b.nome
  ) sub;

  SELECT coalesce(jsonb_object_agg(coalesce(periodo_txt,'N/I'), qtd), '{}'::jsonb) INTO v_por_periodo FROM (
    SELECT periodo::text AS periodo_txt, count(*) as qtd FROM participantes p
    WHERE status = 'ativo' AND is_teste = false
      AND (_genero IS NULL OR coalesce(p.genero, '') = _genero)
      AND (_bairro_id IS NULL OR p.bairro_id = _bairro_id)
      AND (_faixa IS NULL OR (
        CASE
          WHEN extract(year from age(current_date, p.data_nascimento)) BETWEEN 6 AND 8 THEN '6-8'
          WHEN extract(year from age(current_date, p.data_nascimento)) BETWEEN 9 AND 11 THEN '9-11'
          WHEN extract(year from age(current_date, p.data_nascimento)) BETWEEN 12 AND 17 THEN '12-17'
          WHEN extract(year from age(current_date, p.data_nascimento)) >= 60 THEN '60+'
          ELSE 'Outros'
        END = _faixa
      ))
    GROUP BY periodo
  ) sub;

  SELECT coalesce(jsonb_agg(jsonb_build_object('mes', mes, 'media', media)), '[]'::jsonb) INTO v_elo_mensal FROM (
    SELECT to_char(date_trunc('month', ra.data), 'YYYY-MM') as mes, round(avg(ra.score_elo), 2) as media
    FROM relatorios_atividade ra
    WHERE ra.score_elo IS NOT NULL
      AND ra.data >= COALESCE(v_effective_start, v_data_corte)
      AND (NOT v_has_filter OR ra.data < v_filter_end)
      AND (NOT v_has_dim_filter OR EXISTS (
        SELECT 1 FROM relatorio_presenca rp WHERE rp.relatorio_id = ra.id AND rp.participante_id = ANY(v_pf_ids)
      ))
    GROUP BY date_trunc('month', ra.data) ORDER BY 1
  ) sub;

  SELECT coalesce(jsonb_agg(jsonb_build_object('mes', mes, 'media', media)), '[]'::jsonb) INTO v_adesao_mensal FROM (
    SELECT to_char(date_trunc('month', ra.data), 'YYYY-MM') as mes, round(avg(ra.pct_adesao), 1) as media
    FROM relatorios_atividade ra
    WHERE ra.pct_adesao IS NOT NULL
      AND coalesce(ra.nome_atividade,'') NOT LIKE v_synthetic_filter
      AND ra.data >= COALESCE(v_effective_start, v_data_corte)
      AND (NOT v_has_filter OR ra.data < v_filter_end)
      AND (NOT v_has_dim_filter OR EXISTS (
        SELECT 1 FROM relatorio_presenca rp WHERE rp.relatorio_id = ra.id AND rp.participante_id = ANY(v_pf_ids)
      ))
    GROUP BY date_trunc('month', ra.data) ORDER BY 1
  ) sub;

  SELECT jsonb_build_object(
    'iniciativa', count(*) FILTER (WHERE iniciativa IS NOT NULL),
    'autonomia', count(*) FILTER (WHERE autonomia IS NOT NULL),
    'colaboracao', count(*) FILTER (WHERE colaboracao IS NOT NULL),
    'comunicacao', count(*) FILTER (WHERE comunicacao IS NOT NULL),
    'respeito_mutuo', count(*) FILTER (WHERE respeito_mutuo IS NOT NULL)
  ) INTO v_competencias
  FROM relatorios_atividade ra
  WHERE ra.data >= COALESCE(v_effective_start, v_data_corte)
    AND (NOT v_has_filter OR ra.data < v_filter_end)
    AND (NOT v_has_dim_filter OR EXISTS (
      SELECT 1 FROM relatorio_presenca rp WHERE rp.relatorio_id = ra.id AND rp.participante_id = ANY(v_pf_ids)
    ));

  SELECT coalesce(jsonb_object_agg(status, total), '{}'::jsonb) INTO v_objetivos FROM (
    SELECT ra.objetivo_alcancado::text as status, count(*) as total
    FROM relatorios_atividade ra
    WHERE ra.objetivo_alcancado IS NOT NULL
      AND ra.data >= COALESCE(v_effective_start, v_data_corte)
      AND (NOT v_has_filter OR ra.data < v_filter_end)
      AND (NOT v_has_dim_filter OR EXISTS (
        SELECT 1 FROM relatorio_presenca rp WHERE rp.relatorio_id = ra.id AND rp.participante_id = ANY(v_pf_ids)
      ))
    GROUP BY 1
  ) sub;

  SELECT coalesce(round(100.0 * sum(num_participantes) / nullif(sum(num_matriculados), 0), 1), 0)
    INTO v_taxa_frequencia
  FROM relatorios_atividade ra
  WHERE coalesce(num_matriculados, 0) > 0
    AND coalesce(nome_atividade,'') NOT LIKE v_synthetic_filter
    AND ra.data >= COALESCE(v_effective_start, v_data_corte)
    AND (NOT v_has_filter OR ra.data < v_filter_end)
    AND (NOT v_has_dim_filter OR EXISTS (
      SELECT 1 FROM relatorio_presenca rp WHERE rp.relatorio_id = ra.id AND rp.participante_id = ANY(v_pf_ids)
    ));

  SELECT coalesce(jsonb_agg(jsonb_build_object('id', id, 'nome', nome, 'total', total) ORDER BY total DESC), '[]'::jsonb)
    INTO v_top_educadores
  FROM (
    SELECT pr.id, pr.nome, count(*) as total
    FROM relatorios_atividade ra JOIN profiles pr ON pr.id = ra.educador_id
    WHERE coalesce(ra.nome_atividade,'') NOT LIKE v_synthetic_filter
      AND ra.data >= COALESCE(v_effective_start, v_data_corte)
      AND (NOT v_has_filter OR ra.data < v_filter_end)
      AND (NOT v_has_dim_filter OR EXISTS (
        SELECT 1 FROM relatorio_presenca rp WHERE rp.relatorio_id = ra.id AND rp.participante_id = ANY(v_pf_ids)
      ))
    GROUP BY pr.id, pr.nome ORDER BY total DESC LIMIT 5
  ) sub;

  SELECT count(*) INTO v_total_alerta FROM (
    SELECT rp.participante_id
    FROM relatorio_presenca rp
    JOIN relatorios_atividade ra ON ra.id = rp.relatorio_id
    JOIN participantes p ON p.id = rp.participante_id AND p.status = 'ativo' AND p.is_teste = false
    WHERE ra.data >= current_date - interval '60 days'
      AND (NOT v_has_dim_filter OR rp.participante_id = ANY(v_pf_ids))
    GROUP BY rp.participante_id
    HAVING count(*) >= 3 AND (
      array_agg(rp.presente ORDER BY ra.data DESC, rp.id DESC) @> ARRAY[false, false, false]
      AND (array_agg(rp.presente ORDER BY ra.data DESC, rp.id DESC))[1] = false
      AND (array_agg(rp.presente ORDER BY ra.data DESC, rp.id DESC))[2] = false
      AND (array_agg(rp.presente ORDER BY ra.data DESC, rp.id DESC))[3] = false
    )
  ) sub;

  SELECT coalesce(jsonb_agg(jsonb_build_object('mes', mes, 'pct', pct) ORDER BY mes), '[]'::jsonb)
    INTO v_presenca_mensal
  FROM (
    SELECT to_char(date_trunc('month', ra.data), 'YYYY-MM') as mes,
      round(100.0 * sum(case when rp.presente then 1 else 0 end) / nullif(count(*), 0), 1) as pct
    FROM relatorio_presenca rp JOIN relatorios_atividade ra ON ra.id = rp.relatorio_id
    WHERE ra.data >= COALESCE(v_effective_start, v_data_corte)
      AND (NOT v_has_filter OR ra.data < v_filter_end)
      AND (NOT v_has_dim_filter OR rp.participante_id = ANY(v_pf_ids))
    GROUP BY date_trunc('month', ra.data)
  ) sub;

  SELECT count(DISTINCT rp.participante_id) INTO v_ativos_atual
  FROM relatorio_presenca rp JOIN relatorios_atividade ra ON ra.id = rp.relatorio_id
  WHERE rp.presente = true AND ra.data >= v_effective_start AND ra.data < v_filter_end
    AND (NOT v_has_dim_filter OR rp.participante_id = ANY(v_pf_ids));

  SELECT count(DISTINCT rp.participante_id) INTO v_ativos_anterior
  FROM relatorio_presenca rp JOIN relatorios_atividade ra ON ra.id = rp.relatorio_id
  WHERE rp.presente = true AND ra.data >= v_prev_start AND ra.data < v_prev_end
    AND (NOT v_has_dim_filter OR rp.participante_id = ANY(v_pf_ids));

  v_parcial_atual := (v_filter_end > current_date);
  v_delta_participantes := v_ativos_atual - v_ativos_anterior;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', r.id,
    'nome_atividade', coalesce(r.nome_atividade, r.tipo_atividade_detalhe, 'Atividade'),
    'data', r.data,
    'educador', coalesce(pr.nome, 'Desconhecido'),
    'num_participantes', coalesce(r.num_participantes, 0)
  ) ORDER BY r.data DESC, r.created_at DESC), '[]'::jsonb)
    INTO v_atividades_recentes
  FROM (
    SELECT * FROM relatorios_atividade ra
    WHERE coalesce(ra.nome_atividade,'') NOT LIKE v_synthetic_filter
      AND (NOT v_has_filter OR (ra.data >= v_effective_start AND ra.data < v_filter_end))
      AND ra.data >= v_data_corte
      AND (NOT v_has_dim_filter OR EXISTS (
        SELECT 1 FROM relatorio_presenca rp WHERE rp.relatorio_id = ra.id AND rp.participante_id = ANY(v_pf_ids)
      ))
    ORDER BY ra.data DESC, ra.created_at DESC LIMIT 10
  ) r LEFT JOIN profiles pr ON pr.id = r.educador_id;

  result := jsonb_build_object(
    'totalParticipantesAtivos', v_total_participantes,
    'totalTurmasAtivas', v_total_turmas,
    'totalRelatorios', v_total_relatorios,
    'totalConsolidadosChamada', v_total_consolidados,
    'totalPlanejamentos', v_total_planejamentos,
    'mediaELO', round(v_media_elo, 2),
    'mediaELON', v_media_elo_n,
    'mediaAdesao', round(v_media_adesao, 1),
    'mediaAdesaoConsolidada', round(v_media_adesao_consolidada, 1),
    'participantesPorFaixa', v_por_faixa,
    'participantesPorGenero', v_por_genero,
    'participantesPorBairro', v_por_bairro,
    'participantesPorPeriodo', v_por_periodo,
    'eloMensal', v_elo_mensal,
    'adesaoMensal', v_adesao_mensal,
    'competencias', v_competencias,
    'objetivos', v_objetivos,
    'taxaFrequenciaGeral', v_taxa_frequencia,
    'topEducadores', v_top_educadores,
    'totalParticipantesAlerta', v_total_alerta,
    'presencaMensal', v_presenca_mensal,
    'deltaParticipantes', v_delta_participantes,
    'participantesAtivosMesAtual', v_ativos_atual,
    'participantesAtivosMesAnterior', v_ativos_anterior,
    'deltaParticipantesBase', 'presenca_periodo',
    'deltaParcialAtual', v_parcial_atual,
    'atividadesRecentes', v_atividades_recentes,
    'dataInicioOperacional', v_data_corte
  );
  RETURN result;
END;
$function$;