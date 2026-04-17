CREATE OR REPLACE FUNCTION public.get_dashboard_stats(_mes integer DEFAULT NULL::integer, _ano integer DEFAULT NULL::integer)
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
  v_count_now int;
  v_count_30d int;
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
  v_current_month text := to_char(current_date, 'YYYY-MM');
  v_synthetic_filter text := 'Atividade SCFV (consolidado%';
  v_data_corte date;
  v_effective_start date;
BEGIN
  -- Ler data de corte operacional (configurável)
  SELECT valor::date INTO v_data_corte
  FROM configuracoes_gerais WHERE chave = 'data_inicio_operacional';
  v_data_corte := COALESCE(v_data_corte, '2026-04-01'::date);

  v_has_filter := (_mes IS NOT NULL AND _ano IS NOT NULL);
  IF v_has_filter THEN
    v_filter_start := make_date(_ano, _mes, 1);
    v_filter_end := (v_filter_start + interval '1 month')::date;
    v_effective_start := GREATEST(v_filter_start, v_data_corte);
  ELSE
    v_effective_start := v_data_corte;
  END IF;

  -- Totais simples
  SELECT count(*) INTO v_total_participantes FROM participantes WHERE status = 'ativo';
  SELECT count(*) INTO v_total_turmas FROM turmas WHERE ativa = true;

  -- Relatórios reais e consolidados (com corte)
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

  -- Médias globais (filtered) - ELO e Adesão sobre RELATÓRIOS REAIS
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

  -- Participantes por faixa etária
  SELECT coalesce(jsonb_agg(jsonb_build_object('faixa', faixa, 'count', cnt)), '[]'::jsonb)
  INTO v_por_faixa
  FROM (
    SELECT
      CASE
        WHEN extract(year FROM age(current_date, data_nascimento)) BETWEEN 6 AND 8 THEN '6-8'
        WHEN extract(year FROM age(current_date, data_nascimento)) BETWEEN 9 AND 11 THEN '9-11'
        WHEN extract(year FROM age(current_date, data_nascimento)) BETWEEN 12 AND 17 THEN '12-17'
        WHEN extract(year FROM age(current_date, data_nascimento)) >= 60 THEN 'idosos'
        ELSE NULL
      END AS faixa,
      count(*) AS cnt
    FROM participantes
    WHERE status = 'ativo' AND data_nascimento IS NOT NULL
    GROUP BY faixa
    HAVING CASE
        WHEN extract(year FROM age(current_date, data_nascimento)) BETWEEN 6 AND 8 THEN '6-8'
        WHEN extract(year FROM age(current_date, data_nascimento)) BETWEEN 9 AND 11 THEN '9-11'
        WHEN extract(year FROM age(current_date, data_nascimento)) BETWEEN 12 AND 17 THEN '12-17'
        WHEN extract(year FROM age(current_date, data_nascimento)) >= 60 THEN 'idosos'
        ELSE NULL
      END IS NOT NULL
  ) sub;

  -- Participantes por gênero
  SELECT coalesce(jsonb_agg(jsonb_build_object('genero', g, 'count', cnt)), '[]'::jsonb)
  INTO v_por_genero
  FROM (
    SELECT coalesce(genero, 'Não informado') AS g, count(*) AS cnt
    FROM participantes WHERE status = 'ativo'
    GROUP BY g
  ) sub;

  -- Participantes por bairro (top 10)
  SELECT coalesce(jsonb_agg(jsonb_build_object('bairro', b, 'count', cnt)), '[]'::jsonb)
  INTO v_por_bairro
  FROM (
    SELECT coalesce(ba.nome, 'Não informado') AS b, count(*) AS cnt
    FROM participantes p
    LEFT JOIN bairros ba ON ba.id = p.bairro_id
    WHERE p.status = 'ativo'
    GROUP BY b
    ORDER BY cnt DESC
    LIMIT 10
  ) sub;

  -- Participantes por período
  SELECT coalesce(jsonb_agg(jsonb_build_object('periodo', per, 'count', cnt)), '[]'::jsonb)
  INTO v_por_periodo
  FROM (
    SELECT
      CASE coalesce(periodo, 'manha')
        WHEN 'manha' THEN 'Manhã'
        WHEN 'tarde' THEN 'Tarde'
        WHEN 'integral' THEN 'Integral'
        ELSE periodo::text
      END AS per,
      count(*) AS cnt
    FROM participantes WHERE status = 'ativo'
    GROUP BY per
  ) sub;

  -- ELO mensal (com corte)
  SELECT coalesce(jsonb_agg(jsonb_build_object('mes', mes, 'elo', elo) ORDER BY mes), '[]'::jsonb)
  INTO v_elo_mensal
  FROM (
    SELECT to_char(data, 'YYYY-MM') AS mes, round(avg(score_elo)::numeric, 2) AS elo
    FROM relatorios_atividade WHERE score_elo IS NOT NULL AND data >= v_data_corte
    GROUP BY mes
  ) sub;

  -- Adesão mensal (apenas relatórios reais, com corte)
  SELECT coalesce(jsonb_agg(jsonb_build_object('mes', mes, 'adesao', adesao) ORDER BY mes), '[]'::jsonb)
  INTO v_adesao_mensal
  FROM (
    SELECT to_char(data, 'YYYY-MM') AS mes, round(avg(pct_adesao)::numeric, 1) AS adesao
    FROM relatorios_atividade 
    WHERE pct_adesao IS NOT NULL
      AND coalesce(nome_atividade,'') NOT LIKE v_synthetic_filter
      AND data >= v_data_corte
    GROUP BY mes
  ) sub;

  -- Competências médias (filtered, com corte)
  IF v_has_filter THEN
    SELECT jsonb_build_object(
      'iniciativa', round(coalesce(avg(iniciativa), 0)::numeric, 2),
      'autonomia', round(coalesce(avg(autonomia), 0)::numeric, 2),
      'colaboracao', round(coalesce(avg(colaboracao), 0)::numeric, 2),
      'comunicacao', round(coalesce(avg(comunicacao), 0)::numeric, 2),
      'respeito_mutuo', round(coalesce(avg(respeito_mutuo), 0)::numeric, 2)
    ) INTO v_competencias
    FROM relatorios_atividade WHERE data >= v_effective_start AND data < v_filter_end;
  ELSE
    SELECT jsonb_build_object(
      'iniciativa', round(coalesce(avg(iniciativa), 0)::numeric, 2),
      'autonomia', round(coalesce(avg(autonomia), 0)::numeric, 2),
      'colaboracao', round(coalesce(avg(colaboracao), 0)::numeric, 2),
      'comunicacao', round(coalesce(avg(comunicacao), 0)::numeric, 2),
      'respeito_mutuo', round(coalesce(avg(respeito_mutuo), 0)::numeric, 2)
    ) INTO v_competencias
    FROM relatorios_atividade WHERE data >= v_data_corte;
  END IF;

  -- Objetivos (filtered, com corte)
  IF v_has_filter THEN
    SELECT coalesce(jsonb_agg(jsonb_build_object('status', obj, 'count', cnt)), '[]'::jsonb)
    INTO v_objetivos
    FROM (
      SELECT objetivo_alcancado AS obj, count(*) AS cnt
      FROM relatorios_atividade WHERE objetivo_alcancado IS NOT NULL AND data >= v_effective_start AND data < v_filter_end
      GROUP BY obj
    ) sub;
  ELSE
    SELECT coalesce(jsonb_agg(jsonb_build_object('status', obj, 'count', cnt)), '[]'::jsonb)
    INTO v_objetivos
    FROM (
      SELECT objetivo_alcancado AS obj, count(*) AS cnt
      FROM relatorios_atividade WHERE objetivo_alcancado IS NOT NULL AND data >= v_data_corte
      GROUP BY obj
    ) sub;
  END IF;

  -- Top 5 educadores (excluindo sintéticos, com corte)
  IF v_has_filter THEN
    SELECT coalesce(jsonb_agg(jsonb_build_object('nome', nome, 'count', cnt) ORDER BY cnt DESC), '[]'::jsonb)
    INTO v_top_educadores
    FROM (
      SELECT coalesce(pr.nome, 'Desconhecido') AS nome, count(*) AS cnt
      FROM relatorios_atividade r
      LEFT JOIN profiles pr ON pr.id = r.educador_id
      WHERE r.data >= v_effective_start AND r.data < v_filter_end
        AND coalesce(r.nome_atividade,'') NOT LIKE v_synthetic_filter
      GROUP BY pr.nome
      ORDER BY cnt DESC
      LIMIT 5
    ) sub;
  ELSE
    SELECT coalesce(jsonb_agg(jsonb_build_object('nome', nome, 'count', cnt) ORDER BY cnt DESC), '[]'::jsonb)
    INTO v_top_educadores
    FROM (
      SELECT coalesce(pr.nome, 'Desconhecido') AS nome, count(*) AS cnt
      FROM relatorios_atividade r
      LEFT JOIN profiles pr ON pr.id = r.educador_id
      WHERE coalesce(r.nome_atividade,'') NOT LIKE v_synthetic_filter
        AND r.data >= v_data_corte
      GROUP BY pr.nome
      ORDER BY cnt DESC
      LIMIT 5
    ) sub;
  END IF;

  -- Taxa de frequência geral (filtered, com corte)
  IF v_has_filter THEN
    SELECT
      CASE WHEN count(*) > 0 THEN round((sum(CASE WHEN rp.presente THEN 1 ELSE 0 END)::numeric / count(*)) * 100, 1) ELSE 0 END
    INTO v_taxa_frequencia
    FROM relatorio_presenca rp
    JOIN relatorios_atividade ra ON ra.id = rp.relatorio_id
    WHERE ra.data >= v_effective_start AND ra.data < v_filter_end;
  ELSE
    SELECT
      CASE WHEN count(*) > 0 THEN round((sum(CASE WHEN rp.presente THEN 1 ELSE 0 END)::numeric / count(*)) * 100, 1) ELSE 0 END
    INTO v_taxa_frequencia
    FROM relatorio_presenca rp
    JOIN relatorios_atividade ra ON ra.id = rp.relatorio_id
    WHERE ra.data >= v_data_corte;
  END IF;

  -- Presença mensal (com corte)
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'mes', mes, 
    'presentes', presentes, 
    'total', total, 
    'pct', pct,
    'parcial', (mes = v_current_month)
  ) ORDER BY mes), '[]'::jsonb)
  INTO v_presenca_mensal
  FROM (
    SELECT
      to_char(ra.data, 'YYYY-MM') AS mes,
      sum(CASE WHEN rp.presente THEN 1 ELSE 0 END) AS presentes,
      count(*) AS total,
      CASE WHEN count(*) > 0 THEN round((sum(CASE WHEN rp.presente THEN 1 ELSE 0 END)::numeric / count(*)) * 100, 1) ELSE 0 END AS pct
    FROM relatorio_presenca rp
    JOIN relatorios_atividade ra ON ra.id = rp.relatorio_id
    WHERE ra.data >= v_data_corte
    GROUP BY mes
  ) sub;

  -- Alerta: participantes ativos com 3+ faltas consecutivas recentes (com corte)
  SELECT count(*) INTO v_total_alerta
  FROM (
    SELECT rp.participante_id
    FROM relatorio_presenca rp
    JOIN participantes p ON p.id = rp.participante_id AND p.status = 'ativo'
    JOIN relatorios_atividade ra ON ra.id = rp.relatorio_id
    WHERE rp.participante_id IS NOT NULL
      AND ra.data >= v_data_corte
    GROUP BY rp.participante_id
    HAVING (
      array_agg(rp.presente ORDER BY ra.data DESC, rp.id DESC) @> ARRAY[false, false, false]
      AND (array_agg(rp.presente ORDER BY ra.data DESC, rp.id DESC))[1] = false
      AND (array_agg(rp.presente ORDER BY ra.data DESC, rp.id DESC))[2] = false
      AND (array_agg(rp.presente ORDER BY ra.data DESC, rp.id DESC))[3] = false
    )
  ) sub;

  -- Delta participantes ativos (mantém lógica baseada em cadastro, não em corte)
  SELECT count(*) INTO v_count_now 
  FROM participantes 
  WHERE status = 'ativo';

  SELECT count(*) INTO v_count_30d
  FROM participantes
  WHERE coalesce(iniciou_em, created_at::date) <= (current_date - interval '30 days')::date
    AND (data_desligamento IS NULL OR data_desligamento > (current_date - interval '30 days')::date);

  v_delta_participantes := v_count_now - v_count_30d;

  -- Atividades recentes (últimos 5, EXCLUINDO sintéticos, com corte)
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
      AND data >= v_data_corte
    ORDER BY data DESC, created_at DESC LIMIT 5
  ) r
  LEFT JOIN profiles pr ON pr.id = r.educador_id;

  -- Montar resultado final
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
    'atividadesRecentes', v_atividades_recentes,
    'dataInicioOperacional', v_data_corte
  );

  RETURN result;
END;
$function$;