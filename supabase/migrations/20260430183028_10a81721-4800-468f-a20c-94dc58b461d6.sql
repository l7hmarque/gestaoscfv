
-- 1. Coluna + índice
ALTER TABLE public.participantes
  ADD COLUMN IF NOT EXISTS is_teste boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_participantes_is_teste
  ON public.participantes (is_teste)
  WHERE is_teste = true;

-- 2. get_dashboard_stats — adiciona filtro is_teste=false em todas as agregações de participantes
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
  v_data_30d date := (current_date - interval '30 days')::date;
BEGIN
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

  SELECT count(*) INTO v_total_participantes FROM participantes WHERE status = 'ativo' AND is_teste = false;
  SELECT count(*) INTO v_total_turmas FROM turmas WHERE ativa = true;

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
    WHERE status = 'ativo' AND is_teste = false AND data_nascimento IS NOT NULL
    GROUP BY faixa
    HAVING CASE
        WHEN extract(year FROM age(current_date, data_nascimento)) BETWEEN 6 AND 8 THEN '6-8'
        WHEN extract(year FROM age(current_date, data_nascimento)) BETWEEN 9 AND 11 THEN '9-11'
        WHEN extract(year FROM age(current_date, data_nascimento)) BETWEEN 12 AND 17 THEN '12-17'
        WHEN extract(year FROM age(current_date, data_nascimento)) >= 60 THEN 'idosos'
        ELSE NULL
      END IS NOT NULL
  ) sub;

  SELECT coalesce(jsonb_agg(jsonb_build_object('genero', g, 'count', cnt)), '[]'::jsonb)
  INTO v_por_genero
  FROM (
    SELECT coalesce(genero, 'Não informado') AS g, count(*) AS cnt
    FROM participantes WHERE status = 'ativo' AND is_teste = false
    GROUP BY g
  ) sub;

  SELECT coalesce(jsonb_agg(jsonb_build_object('bairro', b, 'count', cnt)), '[]'::jsonb)
  INTO v_por_bairro
  FROM (
    SELECT coalesce(ba.nome, 'Não informado') AS b, count(*) AS cnt
    FROM participantes p
    LEFT JOIN bairros ba ON ba.id = p.bairro_id
    WHERE p.status = 'ativo' AND p.is_teste = false
    GROUP BY b
    ORDER BY cnt DESC
    LIMIT 10
  ) sub;

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
    FROM participantes WHERE status = 'ativo' AND is_teste = false
    GROUP BY per
  ) sub;

  SELECT coalesce(jsonb_agg(jsonb_build_object('mes', mes, 'elo', elo) ORDER BY mes), '[]'::jsonb)
  INTO v_elo_mensal
  FROM (
    SELECT to_char(data, 'YYYY-MM') AS mes, round(avg(score_elo)::numeric, 2) AS elo
    FROM relatorios_atividade WHERE score_elo IS NOT NULL AND data >= v_data_corte
    GROUP BY mes
  ) sub;

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

  SELECT count(*) INTO v_total_alerta
  FROM (
    SELECT rp.participante_id
    FROM relatorio_presenca rp
    JOIN participantes p ON p.id = rp.participante_id AND p.status = 'ativo' AND p.is_teste = false
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

  SELECT count(*) INTO v_count_now 
  FROM participantes 
  WHERE status = 'ativo' AND is_teste = false;

  IF v_data_30d < v_data_corte THEN
    v_delta_participantes := 0;
  ELSE
    SELECT count(*) INTO v_count_30d
    FROM participantes
    WHERE coalesce(iniciou_em, created_at::date) <= v_data_30d
      AND status IN ('ativo','busca_ativa')
      AND is_teste = false
      AND (data_desligamento IS NULL OR data_desligamento > v_data_30d);

    v_delta_participantes := v_count_now - v_count_30d;
  END IF;

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

-- 3. get_pendencias_integridade — exclui is_teste
CREATE OR REPLACE FUNCTION public.get_pendencias_integridade()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_periodo_div int;
  v_deslig_incomp int;
  v_planej_sem_turma int;
  v_sem_nasc int;
  v_turmas_sem_edu int;
  v_turmas_vazias int;
  v_total int;
BEGIN
  SELECT count(DISTINCT p.id) INTO v_periodo_div
  FROM participantes p
  JOIN turma_participantes tp ON tp.participante_id = p.id
  JOIN turmas t ON t.id = tp.turma_id
  WHERE p.status = 'ativo' AND p.is_teste = false AND t.ativa = true
    AND p.periodo IS NOT NULL AND t.periodo IS NOT NULL
    AND p.periodo::text <> t.periodo::text
    AND p.periodo::text <> 'integral' AND t.periodo::text <> 'integral';

  SELECT count(*) INTO v_deslig_incomp
  FROM participantes
  WHERE status = 'desligado' AND is_teste = false
    AND (data_desligamento IS NULL OR motivo_desligamento IS NULL OR motivo_desligamento = '');

  SELECT count(*) INTO v_planej_sem_turma
  FROM planejamentos p
  WHERE NOT EXISTS (SELECT 1 FROM planejamento_turmas pt WHERE pt.planejamento_id = p.id);

  SELECT count(*) INTO v_sem_nasc
  FROM participantes WHERE status = 'ativo' AND is_teste = false AND data_nascimento IS NULL;

  SELECT count(*) INTO v_turmas_sem_edu
  FROM turmas WHERE ativa = true AND educador_id IS NULL;

  SELECT count(*) INTO v_turmas_vazias
  FROM turmas t
  WHERE t.ativa = true
    AND NOT EXISTS (
      SELECT 1 FROM turma_participantes tp
      JOIN participantes p ON p.id = tp.participante_id
      WHERE tp.turma_id = t.id AND p.status IN ('ativo','busca_ativa') AND p.is_teste = false
    );

  v_total := v_periodo_div + v_deslig_incomp + v_planej_sem_turma + v_sem_nasc + v_turmas_sem_edu + v_turmas_vazias;

  RETURN jsonb_build_object(
    'total', v_total,
    'periodo_divergente', v_periodo_div,
    'desligados_incompletos', v_deslig_incomp,
    'planejamentos_sem_turma', v_planej_sem_turma,
    'sem_data_nascimento', v_sem_nasc,
    'turmas_sem_educador', v_turmas_sem_edu,
    'turmas_vazias', v_turmas_vazias
  );
END;
$function$;

-- 4. get_pendencias_integridade_detalhes — exclui is_teste
CREATE OR REPLACE FUNCTION public.get_pendencias_integridade_detalhes()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_periodo_div jsonb;
  v_deslig_incomp jsonb;
  v_planej_sem_turma jsonb;
  v_sem_nasc jsonb;
  v_turmas_sem_edu jsonb;
  v_turmas_vazias jsonb;
BEGIN
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'participante_id', p.id, 'participante_nome', p.nome_completo, 'participante_periodo', p.periodo,
    'turma_id', t.id, 'turma_nome', t.nome, 'turma_periodo', t.periodo
  )), '[]'::jsonb) INTO v_periodo_div
  FROM participantes p
  JOIN turma_participantes tp ON tp.participante_id = p.id
  JOIN turmas t ON t.id = tp.turma_id
  WHERE p.status = 'ativo' AND p.is_teste = false AND t.ativa = true
    AND p.periodo IS NOT NULL AND t.periodo IS NOT NULL
    AND p.periodo::text <> t.periodo::text
    AND p.periodo::text <> 'integral' AND t.periodo::text <> 'integral';

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', id, 'nome', nome_completo, 'data_desligamento', data_desligamento, 'motivo_desligamento', motivo_desligamento
  )), '[]'::jsonb) INTO v_deslig_incomp
  FROM participantes
  WHERE status = 'desligado' AND is_teste = false
    AND (data_desligamento IS NULL OR motivo_desligamento IS NULL OR motivo_desligamento = '');

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id, 'titulo', p.titulo, 'data_aplicacao', p.data_aplicacao, 'educador_nome', pr.nome
  )), '[]'::jsonb) INTO v_planej_sem_turma
  FROM planejamentos p
  LEFT JOIN profiles pr ON pr.id = p.educador_id
  WHERE NOT EXISTS (SELECT 1 FROM planejamento_turmas pt WHERE pt.planejamento_id = p.id);

  SELECT coalesce(jsonb_agg(jsonb_build_object('id', id, 'nome', nome_completo, 'periodo', periodo)), '[]'::jsonb) INTO v_sem_nasc
  FROM participantes WHERE status = 'ativo' AND is_teste = false AND data_nascimento IS NULL;

  SELECT coalesce(jsonb_agg(jsonb_build_object('id', id, 'nome', nome, 'periodo', periodo, 'faixa_etaria', faixa_etaria)), '[]'::jsonb) INTO v_turmas_sem_edu
  FROM turmas WHERE ativa = true AND educador_id IS NULL;

  SELECT coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'nome', t.nome, 'periodo', t.periodo, 'faixa_etaria', t.faixa_etaria)), '[]'::jsonb) INTO v_turmas_vazias
  FROM turmas t
  WHERE t.ativa = true
    AND NOT EXISTS (
      SELECT 1 FROM turma_participantes tp
      JOIN participantes p ON p.id = tp.participante_id
      WHERE tp.turma_id = t.id AND p.status IN ('ativo','busca_ativa') AND p.is_teste = false
    );

  RETURN jsonb_build_object(
    'periodo_divergente', v_periodo_div,
    'desligados_incompletos', v_deslig_incomp,
    'planejamentos_sem_turma', v_planej_sem_turma,
    'sem_data_nascimento', v_sem_nasc,
    'turmas_sem_educador', v_turmas_sem_edu,
    'turmas_vazias', v_turmas_vazias
  );
END;
$function$;

-- 5. get_restricoes_alimentares — exclui is_teste (apenas a CTE part)
CREATE OR REPLACE FUNCTION public.get_restricoes_alimentares()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_result jsonb;
BEGIN
  IF v_uid IS NULL OR NOT (public.has_role(v_uid,'cozinheiro'::app_role) OR public.has_role(v_uid,'coordenacao'::app_role)) THEN
    RETURN jsonb_build_object('error','forbidden');
  END IF;

  WITH part AS (
    SELECT
      p.id, p.nome_completo, p.data_nascimento, p.periodo, p.foto_url,
      p.restricao_alimentar, p.remedio_continuo, p.outras_condicoes,
      b.nome AS bairro_nome,
      CASE WHEN p.data_nascimento IS NOT NULL
           THEN EXTRACT(YEAR FROM age(current_date, p.data_nascimento))::int
           ELSE NULL END AS idade
    FROM participantes p
    LEFT JOIN bairros b ON b.id = p.bairro_id
    WHERE p.status='ativo' AND p.is_teste = false AND (
      (p.restricao_alimentar IS NOT NULL AND trim(p.restricao_alimentar) <> '')
      OR (p.remedio_continuo IS NOT NULL AND trim(p.remedio_continuo) <> '')
      OR (p.outras_condicoes IS NOT NULL AND trim(p.outras_condicoes) <> '')
    )
  ),
  turmas_part AS (
    SELECT tp.participante_id,
           jsonb_agg(jsonb_build_object('id', t.id, 'nome', t.nome, 'dias_semana', COALESCE(t.dias_semana, ARRAY[]::text[]))) AS turmas,
           COALESCE(array_agg(DISTINCT d) FILTER (WHERE d IS NOT NULL), ARRAY[]::text[]) AS dias_uniao
    FROM turma_participantes tp
    JOIN turmas t ON t.id = tp.turma_id AND t.ativa = true
    LEFT JOIN LATERAL unnest(COALESCE(t.dias_semana, ARRAY[]::text[])) AS d ON true
    WHERE tp.participante_id IN (SELECT id FROM part)
    GROUP BY tp.participante_id
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', p.id,
    'nome', p.nome_completo,
    'idade', p.idade,
    'periodo', p.periodo,
    'bairro', p.bairro_nome,
    'foto_url', p.foto_url,
    'restricao_alimentar', p.restricao_alimentar,
    'remedio_continuo', p.remedio_continuo,
    'outras_condicoes', p.outras_condicoes,
    'turmas', COALESCE(tp.turmas, '[]'::jsonb),
    'dias_frequenta', CASE
      WHEN tp.dias_uniao IS NULL OR array_length(tp.dias_uniao,1) IS NULL
        THEN ARRAY['seg','ter','qua','qui','sex']
      ELSE tp.dias_uniao
    END,
    'sem_turma', (tp.turmas IS NULL)
  ) ORDER BY p.nome_completo), '[]'::jsonb) INTO v_result
  FROM part p
  LEFT JOIN turmas_part tp ON tp.participante_id = p.id;

  RETURN v_result;
END;
$function$;

-- 6. recalcular_busca_ativa — pula is_teste
CREATE OR REPLACE FUNCTION public.recalcular_busca_ativa(_participante_ids uuid[] DEFAULT NULL::uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_now timestamptz := now();
  v_today date := current_date;
  v_cutoff date := current_date - interval '14 days';
  v_to_ba int := 0;
  v_to_ativo int := 0;
  v_detalhes jsonb := '[]'::jsonb;
  rec record;
  v_last_presence date;
  v_last_three boolean[];
  v_motivo text;
  v_should_be_ba boolean;
  v_has_history boolean;
  v_sistema_profile uuid;
  v_sistema_user uuid;
BEGIN
  SELECT p.id, p.user_id INTO v_sistema_profile, v_sistema_user
  FROM profiles p
  JOIN user_roles ur ON ur.user_id = p.user_id
  WHERE ur.role = 'coordenacao'
  LIMIT 1;

  IF v_sistema_profile IS NULL THEN
    SELECT id, user_id INTO v_sistema_profile, v_sistema_user FROM profiles WHERE ativo = true LIMIT 1;
  END IF;

  FOR rec IN
    SELECT p.id, p.nome_completo, p.status
    FROM participantes p
    WHERE p.status IN ('ativo','busca_ativa')
      AND p.is_teste = false
      AND (_participante_ids IS NULL OR p.id = ANY(_participante_ids))
  LOOP
    SELECT GREATEST(
      COALESCE((SELECT max(data) FROM presenca WHERE participante_id=rec.id AND presente=true), '1900-01-01'::date),
      COALESCE((SELECT max(ra.data) FROM relatorio_presenca rp JOIN relatorios_atividade ra ON ra.id=rp.relatorio_id WHERE rp.participante_id=rec.id AND rp.presente=true), '1900-01-01'::date)
    ) INTO v_last_presence;

    v_has_history := v_last_presence > '1900-01-01'::date;

    SELECT array_agg(presente ORDER BY data DESC)
    INTO v_last_three
    FROM (
      SELECT presente, data FROM (
        SELECT presente, data FROM presenca WHERE participante_id=rec.id
        UNION ALL
        SELECT rp.presente, ra.data FROM relatorio_presenca rp JOIN relatorios_atividade ra ON ra.id=rp.relatorio_id WHERE rp.participante_id=rec.id
      ) u
      ORDER BY data DESC
      LIMIT 3
    ) t;

    v_should_be_ba := false;
    v_motivo := NULL;

    IF v_last_three IS NOT NULL AND array_length(v_last_three,1) >= 3
       AND v_last_three[1]=false AND v_last_three[2]=false AND v_last_three[3]=false THEN
      v_should_be_ba := true;
      v_motivo := 'Detecção automática — 3 faltas consecutivas';
    END IF;

    IF NOT v_should_be_ba AND v_has_history AND v_last_presence < v_cutoff THEN
      v_should_be_ba := true;
      v_motivo := format('Detecção automática — sem presença desde %s (>14 dias)', to_char(v_last_presence,'DD/MM/YYYY'));
    END IF;

    IF v_should_be_ba AND rec.status='ativo' AND v_sistema_profile IS NOT NULL THEN
      UPDATE participantes SET status='busca_ativa', updated_at=v_now WHERE id=rec.id;
      INSERT INTO busca_ativa_registros (participante_id, profissional_id, tipo_contato, descricao, resultado, data_registro)
      VALUES (rec.id, v_sistema_profile, 'sistema', v_motivo, 'detectado_automatico', v_today);
      INSERT INTO audit_log (user_id, user_nome, acao, tabela, registro_id, detalhes)
      VALUES (v_sistema_user, 'Sistema (recalcular_busca_ativa)', 'auto_busca_ativa', 'participantes', rec.id::text, v_motivo);
      v_to_ba := v_to_ba + 1;
      v_detalhes := v_detalhes || jsonb_build_object('id', rec.id, 'nome', rec.nome_completo, 'acao', 'para_busca_ativa', 'motivo', v_motivo, 'ultima_presenca', v_last_presence);
    ELSIF NOT v_should_be_ba AND rec.status='busca_ativa' AND v_sistema_profile IS NOT NULL THEN
      UPDATE participantes SET status='ativo', updated_at=v_now WHERE id=rec.id;
      INSERT INTO busca_ativa_registros (participante_id, profissional_id, tipo_contato, descricao, resultado, data_registro)
      VALUES (rec.id, v_sistema_profile, 'sistema', 'Retorno automático — presença recente detectada', 'ja_retornou', v_today);
      INSERT INTO audit_log (user_id, user_nome, acao, tabela, registro_id, detalhes)
      VALUES (v_sistema_user, 'Sistema (recalcular_busca_ativa)', 'auto_retorno_ativo', 'participantes', rec.id::text, 'Presença recente detectada');
      v_to_ativo := v_to_ativo + 1;
      v_detalhes := v_detalhes || jsonb_build_object('id', rec.id, 'nome', rec.nome_completo, 'acao', 'para_ativo', 'ultima_presenca', v_last_presence);
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'executado_em', v_now,
    'movidos_para_busca_ativa', v_to_ba,
    'retornados_para_ativo', v_to_ativo,
    'detalhes', v_detalhes
  );
END;
$function$;

-- 7. recalcular_vinculos_turmas — pula is_teste
CREATE OR REPLACE FUNCTION public.recalcular_vinculos_turmas()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_removidos int := 0;
  v_adicionados int := 0;
  v_sem_turma int := 0;
  v_sem_turma_lista jsonb := '[]'::jsonb;
  v_tmp int;
  rec record;
  v_faixa text;
  v_idade int;
  v_turma_alvo uuid;
BEGIN
  FOR rec IN
    SELECT p.id, p.nome_completo, p.bairro_id, p.periodo, p.data_nascimento
    FROM participantes p
    WHERE p.status IN ('ativo','busca_ativa') AND p.is_teste = false
  LOOP
    IF rec.data_nascimento IS NULL THEN
      v_faixa := NULL;
    ELSE
      v_idade := extract(year FROM age(current_date, rec.data_nascimento))::int;
      v_faixa := CASE
        WHEN v_idade BETWEEN 6 AND 8 THEN '6-8'
        WHEN v_idade BETWEEN 9 AND 11 THEN '9-11'
        WHEN v_idade BETWEEN 12 AND 17 THEN '12-17'
        WHEN v_idade >= 60 THEN 'idosos'
        ELSE NULL
      END;
    END IF;

    v_turma_alvo := NULL;
    IF rec.periodo IS NOT NULL AND rec.bairro_id IS NOT NULL AND v_faixa IS NOT NULL THEN
      SELECT t.id INTO v_turma_alvo
      FROM turmas t
      WHERE t.ativa = true
        AND (t.periodo::text = rec.periodo::text OR t.periodo::text = 'integral')
        AND (
          t.bairro_id = rec.bairro_id
          OR (t.bairro_ids IS NOT NULL AND rec.bairro_id = ANY(t.bairro_ids))
        )
        AND (
          t.faixa_etaria::text = v_faixa
          OR (t.faixas_etarias IS NOT NULL AND v_faixa = ANY(t.faixas_etarias))
        )
      ORDER BY
        CASE WHEN t.periodo::text = rec.periodo::text THEN 0 ELSE 1 END,
        t.nome
      LIMIT 1;
    END IF;

    IF v_turma_alvo IS NULL THEN
      v_sem_turma := v_sem_turma + 1;
      v_sem_turma_lista := v_sem_turma_lista || jsonb_build_object(
        'id', rec.id, 'nome', rec.nome_completo,
        'periodo', rec.periodo, 'bairro_id', rec.bairro_id, 'faixa', v_faixa
      );
      CONTINUE;
    END IF;

    WITH del AS (
      DELETE FROM turma_participantes
      WHERE participante_id = rec.id AND turma_id <> v_turma_alvo
      RETURNING 1
    )
    SELECT count(*) INTO v_tmp FROM del;
    v_removidos := v_removidos + COALESCE(v_tmp, 0);

    IF NOT EXISTS (
      SELECT 1 FROM turma_participantes
      WHERE participante_id = rec.id AND turma_id = v_turma_alvo
    ) THEN
      INSERT INTO turma_participantes (participante_id, turma_id)
      VALUES (rec.id, v_turma_alvo);
      v_adicionados := v_adicionados + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'vinculos_removidos', v_removidos,
    'vinculos_adicionados', v_adicionados,
    'sem_turma_compativel', v_sem_turma,
    'sem_turma_lista', v_sem_turma_lista
  );
END;
$function$;

-- 8. find_fuzzy_participant — exclui is_teste para não confundir matrícula pública
CREATE OR REPLACE FUNCTION public.find_fuzzy_participant(_nome text, _data_nascimento date)
 RETURNS TABLE(id uuid, nome_completo text, sim numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    p.id,
    p.nome_completo,
    round(similarity(p.nome_completo, _nome)::numeric, 2) AS sim
  FROM participantes p
  WHERE p.data_nascimento = _data_nascimento
    AND p.is_teste = false
    AND similarity(p.nome_completo, _nome) > 0.5
  ORDER BY sim DESC
  LIMIT 3;
$function$;

-- 9. find_similar_participants — exclui is_teste
CREATE OR REPLACE FUNCTION public.find_similar_participants()
 RETURNS TABLE(id1 uuid, nome1 text, status1 text, id2 uuid, nome2 text, status2 text, data_nascimento date, similaridade numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    p1.id AS id1, p1.nome_completo AS nome1, p1.status::text AS status1,
    p2.id AS id2, p2.nome_completo AS nome2, p2.status::text AS status2,
    p1.data_nascimento,
    round(similarity(p1.nome_completo, p2.nome_completo)::numeric, 2) AS similaridade
  FROM participantes p1
  JOIN participantes p2
    ON p1.id < p2.id
    AND p1.data_nascimento IS NOT NULL
    AND p1.data_nascimento = p2.data_nascimento
    AND similarity(p1.nome_completo, p2.nome_completo) > 0.4
  WHERE p1.is_teste = false AND p2.is_teste = false
  ORDER BY similaridade DESC
  LIMIT 50;
$function$;
