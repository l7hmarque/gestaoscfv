CREATE OR REPLACE FUNCTION public.get_dashboard_stats(_mes integer DEFAULT NULL::integer, _ano integer DEFAULT NULL::integer, _data_inicio date DEFAULT NULL::date, _data_fim date DEFAULT NULL::date)
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
BEGIN
  SELECT valor::date INTO v_data_corte
  FROM configuracoes_gerais WHERE chave = 'data_inicio_operacional';
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

  SELECT count(DISTINCT rp.participante_id) INTO v_total_participantes
  FROM relatorio_presenca rp
  JOIN relatorios_atividade ra ON ra.id = rp.relatorio_id
  JOIN participantes p ON p.id = rp.participante_id AND p.is_teste = false
  WHERE rp.presente = true
    AND ra.data >= v_effective_start AND ra.data < v_filter_end;

  IF v_has_filter THEN
    SELECT count(*) INTO v_total_turmas FROM turmas WHERE created_at < v_filter_end;
  ELSE
    SELECT count(*) INTO v_total_turmas FROM turmas WHERE ativa = true;
  END IF;

  IF v_has_filter THEN
    SELECT 
      count(*) FILTER (WHERE coalesce(nome_atividade,'') NOT LIKE v_synthetic_filter),
      count(*) FILTER (WHERE coalesce(nome_atividade,'') LIKE v_synthetic_filter)
    INTO v_total_relatorios, v_total_consolidados
    FROM relatorios_atividade
    WHERE data >= v_effective_start AND data < v_filter_end;
    SELECT count(*) INTO v_total_planejamentos FROM planejamentos WHERE data_aplicacao >= v_effective_start AND data_aplicacao < v_filter_end;
  ELSE
    SELECT 
      count(*) FILTER (WHERE coalesce(nome_atividade,'') NOT LIKE v_synthetic_filter),
      count(*) FILTER (WHERE coalesce(nome_atividade,'') LIKE v_synthetic_filter)
    INTO v_total_relatorios, v_total_consolidados
    FROM relatorios_atividade
    WHERE data >= v_data_corte;
    SELECT count(*) INTO v_total_planejamentos FROM planejamentos WHERE coalesce(data_aplicacao, '1900-01-01'::date) >= v_data_corte;
  END IF;

  IF v_has_filter THEN
    SELECT 
      coalesce(avg(score_elo), 0), 
      count(*) FILTER (WHERE score_elo IS NOT NULL),
      coalesce(avg(pct_adesao) FILTER (WHERE coalesce(nome_atividade,'') NOT LIKE v_synthetic_filter), 0)
    INTO v_media_elo, v_media_elo_n, v_media_adesao
    FROM relatorios_atividade
    WHERE data >= v_effective_start AND data < v_filter_end;

    SELECT coalesce(avg(pct_adesao), 0)
    INTO v_media_adesao_consolidada
    FROM relatorios_atividade
    WHERE data >= v_effective_start AND data < v_filter_end
      AND coalesce(nome_atividade,'') LIKE v_synthetic_filter;
  ELSE
    SELECT 
      coalesce(avg(score_elo), 0), 
      count(*) FILTER (WHERE score_elo IS NOT NULL),
      coalesce(avg(pct_adesao) FILTER (WHERE coalesce(nome_atividade,'') NOT LIKE v_synthetic_filter), 0)
    INTO v_media_elo, v_media_elo_n, v_media_adesao
    FROM relatorios_atividade
    WHERE data >= v_data_corte;

    SELECT coalesce(avg(pct_adesao), 0)
    INTO v_media_adesao_consolidada
    FROM relatorios_atividade
    WHERE data >= v_data_corte
      AND coalesce(nome_atividade,'') LIKE v_synthetic_filter;
  END IF;

  SELECT coalesce(jsonb_object_agg(faixa, qtd), '{}'::jsonb) INTO v_por_faixa FROM (
    SELECT
      CASE
        WHEN extract(year from age(current_date, p.data_nascimento)) BETWEEN 0 AND 5 THEN '0-5'
        WHEN extract(year from age(current_date, p.data_nascimento)) BETWEEN 6 AND 10 THEN '6-10'
        WHEN extract(year from age(current_date, p.data_nascimento)) BETWEEN 11 AND 14 THEN '11-14'
        WHEN extract(year from age(current_date, p.data_nascimento)) BETWEEN 15 AND 17 THEN '15-17'
        WHEN extract(year from age(current_date, p.data_nascimento)) BETWEEN 18 AND 29 THEN '18-29'
        WHEN extract(year from age(current_date, p.data_nascimento)) BETWEEN 30 AND 59 THEN '30-59'
        ELSE '60+'
      END as faixa,
      count(*) as qtd
    FROM participantes p WHERE p.status = 'ativo' AND p.is_teste = false GROUP BY faixa
  ) sub;

  SELECT coalesce(jsonb_object_agg(coalesce(genero,'N/I'), qtd), '{}'::jsonb) INTO v_por_genero FROM (
    SELECT genero, count(*) as qtd FROM participantes WHERE status = 'ativo' AND is_teste = false GROUP BY genero
  ) sub;

  SELECT coalesce(jsonb_object_agg(coalesce(b.nome,'N/I'), qtd), '{}'::jsonb) INTO v_por_bairro FROM (
    SELECT b.nome, count(*) as qtd 
    FROM participantes p 
    LEFT JOIN bairros b ON b.id = p.bairro_id
    WHERE p.status = 'ativo' AND p.is_teste = false 
    GROUP BY b.nome
  ) b;

  -- FIX: cast enum to text antes do coalesce, senão 'N/I' falha o cast pro periodo_enum
  SELECT coalesce(jsonb_object_agg(coalesce(periodo_txt,'N/I'), qtd), '{}'::jsonb) INTO v_por_periodo FROM (
    SELECT periodo::text AS periodo_txt, count(*) as qtd FROM participantes WHERE status = 'ativo' AND is_teste = false GROUP BY periodo
  ) sub;

  SELECT coalesce(jsonb_agg(jsonb_build_object('mes', mes, 'media', media)), '[]'::jsonb) INTO v_elo_mensal FROM (
    SELECT to_char(date_trunc('month', data), 'YYYY-MM') as mes, round(avg(score_elo), 2) as media
    FROM relatorios_atividade
    WHERE score_elo IS NOT NULL
      AND data >= COALESCE(v_effective_start, v_data_corte)
      AND (NOT v_has_filter OR data < v_filter_end)
    GROUP BY date_trunc('month', data) ORDER BY 1
  ) sub;

  SELECT coalesce(jsonb_agg(jsonb_build_object('mes', mes, 'media', media)), '[]'::jsonb) INTO v_adesao_mensal FROM (
    SELECT to_char(date_trunc('month', data), 'YYYY-MM') as mes, round(avg(pct_adesao), 1) as media
    FROM relatorios_atividade
    WHERE pct_adesao IS NOT NULL
      AND coalesce(nome_atividade,'') NOT LIKE v_synthetic_filter
      AND data >= COALESCE(v_effective_start, v_data_corte)
      AND (NOT v_has_filter OR data < v_filter_end)
    GROUP BY date_trunc('month', data) ORDER BY 1
  ) sub;

  SELECT coalesce(jsonb_object_agg(comp, total), '{}'::jsonb) INTO v_competencias FROM (
    SELECT unnest(competencias_trabalhadas) as comp, count(*) as total
    FROM relatorios_atividade
    WHERE competencias_trabalhadas IS NOT NULL
      AND data >= COALESCE(v_effective_start, v_data_corte)
      AND (NOT v_has_filter OR data < v_filter_end)
    GROUP BY 1 ORDER BY 2 DESC LIMIT 12
  ) sub;

  SELECT coalesce(jsonb_object_agg(obj, total), '{}'::jsonb) INTO v_objetivos FROM (
    SELECT unnest(objetivos_alcancados) as obj, count(*) as total
    FROM relatorios_atividade
    WHERE objetivos_alcancados IS NOT NULL
      AND data >= COALESCE(v_effective_start, v_data_corte)
      AND (NOT v_has_filter OR data < v_filter_end)
    GROUP BY 1 ORDER BY 2 DESC LIMIT 12
  ) sub;

  SELECT coalesce(round(100.0 * sum(num_participantes) / nullif(sum(num_participantes_planejados), 0), 1), 0)
  INTO v_taxa_frequencia
  FROM relatorios_atividade
  WHERE num_participantes_planejados > 0
    AND coalesce(nome_atividade,'') NOT LIKE v_synthetic_filter
    AND data >= COALESCE(v_effective_start, v_data_corte)
    AND (NOT v_has_filter OR data < v_filter_end);

  SELECT coalesce(jsonb_agg(jsonb_build_object('id', id, 'nome', nome, 'total', total) ORDER BY total DESC), '[]'::jsonb)
  INTO v_top_educadores
  FROM (
    SELECT pr.id, pr.nome, count(*) as total
    FROM relatorios_atividade ra
    JOIN profiles pr ON pr.id = ra.educador_id
    WHERE coalesce(ra.nome_atividade,'') NOT LIKE v_synthetic_filter
      AND ra.data >= COALESCE(v_effective_start, v_data_corte)
      AND (NOT v_has_filter OR ra.data < v_filter_end)
    GROUP BY pr.id, pr.nome ORDER BY total DESC LIMIT 5
  ) sub;

  SELECT count(*) INTO v_total_alerta FROM (
    SELECT rp.participante_id
    FROM relatorio_presenca rp
    JOIN relatorios_atividade ra ON ra.id = rp.relatorio_id
    JOIN participantes p ON p.id = rp.participante_id AND p.status = 'ativo' AND p.is_teste = false
    WHERE ra.data >= current_date - interval '60 days'
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
    FROM relatorio_presenca rp
    JOIN relatorios_atividade ra ON ra.id = rp.relatorio_id
    WHERE ra.data >= COALESCE(v_effective_start, v_data_corte)
      AND (NOT v_has_filter OR ra.data < v_filter_end)
    GROUP BY date_trunc('month', ra.data)
  ) sub;

  SELECT count(DISTINCT rp.participante_id) INTO v_ativos_atual
  FROM relatorio_presenca rp
  JOIN relatorios_atividade ra ON ra.id = rp.relatorio_id
  WHERE rp.presente = true
    AND ra.data >= v_effective_start AND ra.data < v_filter_end;

  SELECT count(DISTINCT rp.participante_id) INTO v_ativos_anterior
  FROM relatorio_presenca rp
  JOIN relatorios_atividade ra ON ra.id = rp.relatorio_id
  WHERE rp.presente = true
    AND ra.data >= v_prev_start AND ra.data < v_prev_end;

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
    SELECT * FROM relatorios_atividade 
    WHERE coalesce(nome_atividade,'') NOT LIKE v_synthetic_filter
      AND (NOT v_has_filter OR (data >= v_effective_start AND data < v_filter_end))
      AND data >= v_data_corte
    ORDER BY data DESC, created_at DESC LIMIT 10
  ) r
  LEFT JOIN profiles pr ON pr.id = r.educador_id;

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