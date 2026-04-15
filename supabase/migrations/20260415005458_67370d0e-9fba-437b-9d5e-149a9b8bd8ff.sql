
CREATE OR REPLACE FUNCTION public.get_dashboard_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  v_total_participantes int;
  v_total_turmas int;
  v_total_relatorios int;
  v_total_planejamentos int;
  v_media_elo numeric;
  v_media_adesao numeric;
  v_taxa_frequencia numeric;
  v_total_alerta int;
  v_delta_participantes int;
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
  v_last_month text;
  v_prev_month text;
  v_last_count int;
  v_prev_count int;
BEGIN
  -- Totais simples
  SELECT count(*) INTO v_total_participantes FROM participantes WHERE status = 'ativo';
  SELECT count(*) INTO v_total_turmas FROM turmas WHERE ativa = true;
  SELECT count(*) INTO v_total_relatorios FROM relatorios_atividade;
  SELECT count(*) INTO v_total_planejamentos FROM planejamentos;

  -- Médias globais
  SELECT coalesce(avg(score_elo), 0), coalesce(avg(pct_adesao), 0)
  INTO v_media_elo, v_media_adesao
  FROM relatorios_atividade
  WHERE score_elo IS NOT NULL OR pct_adesao IS NOT NULL;

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

  -- ELO mensal
  SELECT coalesce(jsonb_agg(jsonb_build_object('mes', mes, 'elo', elo) ORDER BY mes), '[]'::jsonb)
  INTO v_elo_mensal
  FROM (
    SELECT to_char(data, 'YYYY-MM') AS mes, round(avg(score_elo)::numeric, 2) AS elo
    FROM relatorios_atividade WHERE score_elo IS NOT NULL
    GROUP BY mes
  ) sub;

  -- Adesão mensal
  SELECT coalesce(jsonb_agg(jsonb_build_object('mes', mes, 'adesao', adesao) ORDER BY mes), '[]'::jsonb)
  INTO v_adesao_mensal
  FROM (
    SELECT to_char(data, 'YYYY-MM') AS mes, round(avg(pct_adesao)::numeric, 1) AS adesao
    FROM relatorios_atividade WHERE pct_adesao IS NOT NULL
    GROUP BY mes
  ) sub;

  -- Competências médias
  SELECT jsonb_build_object(
    'iniciativa', round(coalesce(avg(iniciativa), 0)::numeric, 2),
    'autonomia', round(coalesce(avg(autonomia), 0)::numeric, 2),
    'colaboracao', round(coalesce(avg(colaboracao), 0)::numeric, 2),
    'comunicacao', round(coalesce(avg(comunicacao), 0)::numeric, 2),
    'respeito_mutuo', round(coalesce(avg(respeito_mutuo), 0)::numeric, 2)
  ) INTO v_competencias
  FROM relatorios_atividade;

  -- Objetivos
  SELECT coalesce(jsonb_agg(jsonb_build_object('status', obj, 'count', cnt)), '[]'::jsonb)
  INTO v_objetivos
  FROM (
    SELECT objetivo_alcancado AS obj, count(*) AS cnt
    FROM relatorios_atividade WHERE objetivo_alcancado IS NOT NULL
    GROUP BY obj
  ) sub;

  -- Top 5 educadores
  SELECT coalesce(jsonb_agg(jsonb_build_object('nome', nome, 'count', cnt) ORDER BY cnt DESC), '[]'::jsonb)
  INTO v_top_educadores
  FROM (
    SELECT coalesce(pr.nome, 'Desconhecido') AS nome, count(*) AS cnt
    FROM relatorios_atividade r
    LEFT JOIN profiles pr ON pr.id = r.educador_id
    GROUP BY pr.nome
    ORDER BY cnt DESC
    LIMIT 5
  ) sub;

  -- Taxa de frequência geral (relatorio_presenca)
  SELECT
    CASE WHEN count(*) > 0 THEN round((sum(CASE WHEN presente THEN 1 ELSE 0 END)::numeric / count(*)) * 100, 1) ELSE 0 END
  INTO v_taxa_frequencia
  FROM relatorio_presenca;

  -- Presença mensal
  SELECT coalesce(jsonb_agg(jsonb_build_object('mes', mes, 'presentes', presentes, 'total', total, 'pct', pct) ORDER BY mes), '[]'::jsonb)
  INTO v_presenca_mensal
  FROM (
    SELECT
      to_char(ra.data, 'YYYY-MM') AS mes,
      sum(CASE WHEN rp.presente THEN 1 ELSE 0 END) AS presentes,
      count(*) AS total,
      CASE WHEN count(*) > 0 THEN round((sum(CASE WHEN rp.presente THEN 1 ELSE 0 END)::numeric / count(*)) * 100, 1) ELSE 0 END AS pct
    FROM relatorio_presenca rp
    JOIN relatorios_atividade ra ON ra.id = rp.relatorio_id
    GROUP BY mes
  ) sub;

  -- Alerta: participantes ativos com 3+ faltas consecutivas recentes
  SELECT count(*) INTO v_total_alerta
  FROM (
    SELECT rp.participante_id
    FROM relatorio_presenca rp
    JOIN participantes p ON p.id = rp.participante_id AND p.status = 'ativo'
    JOIN relatorios_atividade ra ON ra.id = rp.relatorio_id
    WHERE rp.participante_id IS NOT NULL
    GROUP BY rp.participante_id
    HAVING (
      -- Check last 3 records are all absent
      array_agg(rp.presente ORDER BY ra.data DESC, rp.id DESC) @> ARRAY[false, false, false]
      AND (array_agg(rp.presente ORDER BY ra.data DESC, rp.id DESC))[1] = false
      AND (array_agg(rp.presente ORDER BY ra.data DESC, rp.id DESC))[2] = false
      AND (array_agg(rp.presente ORDER BY ra.data DESC, rp.id DESC))[3] = false
    )
  ) sub;

  -- Delta participantes (últimos 2 meses)
  SELECT mes INTO v_last_month FROM (
    SELECT DISTINCT to_char(ra.data, 'YYYY-MM') AS mes
    FROM relatorio_presenca rp JOIN relatorios_atividade ra ON ra.id = rp.relatorio_id
    ORDER BY mes DESC LIMIT 1
  ) sub;

  SELECT mes INTO v_prev_month FROM (
    SELECT DISTINCT to_char(ra.data, 'YYYY-MM') AS mes
    FROM relatorio_presenca rp JOIN relatorios_atividade ra ON ra.id = rp.relatorio_id
    ORDER BY mes DESC LIMIT 2
  ) sub ORDER BY mes ASC LIMIT 1;

  IF v_last_month IS NOT NULL AND v_prev_month IS NOT NULL AND v_last_month <> v_prev_month THEN
    SELECT count(DISTINCT rp.participante_id) INTO v_last_count
    FROM relatorio_presenca rp
    JOIN relatorios_atividade ra ON ra.id = rp.relatorio_id
    WHERE rp.presente = true AND to_char(ra.data, 'YYYY-MM') = v_last_month AND rp.participante_id IS NOT NULL;

    SELECT count(DISTINCT rp.participante_id) INTO v_prev_count
    FROM relatorio_presenca rp
    JOIN relatorios_atividade ra ON ra.id = rp.relatorio_id
    WHERE rp.presente = true AND to_char(ra.data, 'YYYY-MM') = v_prev_month AND rp.participante_id IS NOT NULL;

    v_delta_participantes := v_last_count - v_prev_count;
  ELSE
    v_delta_participantes := 0;
  END IF;

  -- Montar resultado final
  result := jsonb_build_object(
    'totalParticipantesAtivos', v_total_participantes,
    'totalTurmasAtivas', v_total_turmas,
    'totalRelatorios', v_total_relatorios,
    'totalPlanejamentos', v_total_planejamentos,
    'mediaELO', round(v_media_elo, 2),
    'mediaAdesao', round(v_media_adesao, 1),
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
    'deltaParticipantes', v_delta_participantes
  );

  RETURN result;
END;
$$;
