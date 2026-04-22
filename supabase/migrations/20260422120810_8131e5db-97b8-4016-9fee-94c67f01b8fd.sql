CREATE OR REPLACE FUNCTION public.get_coordenacao_stats(_user_id uuid, _periodo_dias int DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_dashboard jsonb;
  v_pendencias jsonb;
  v_data_corte date;
  v_periodo_inicio timestamptz;
  v_acoes_pendentes jsonb;
  v_qualidade jsonb;
  v_decisoes jsonb;
  v_cobertura jsonb;
  v_transf_pendentes int;
  v_avisos_ativos int;
  v_avisos_expirando int;
  v_recados_tecnicos int;
  v_enc_abertos_30d int;
  v_relatorios_mes int;
  v_educadores_total int;
  v_educadores_ativos_mes int;
  v_planej_total int;
  v_planej_com_turma int;
  v_turmas_total int;
  v_turmas_com_edu int;
  v_tempo_transf numeric;
  v_decisoes_proprias int;
  v_decisoes_equipe int;
  v_exclusoes int;
  v_aprovacoes int;
  v_desligamentos int;
  v_is_coord boolean;
BEGIN
  v_is_coord := public.has_role(_user_id, 'coordenacao'::app_role);
  IF NOT v_is_coord THEN
    RETURN jsonb_build_object('error', 'forbidden');
  END IF;

  SELECT valor::date INTO v_data_corte FROM configuracoes_gerais WHERE chave = 'data_inicio_operacional';
  v_data_corte := COALESCE(v_data_corte, '2026-04-01'::date);
  v_periodo_inicio := (current_date - (_periodo_dias || ' days')::interval)::timestamptz;

  -- Reaproveita
  v_dashboard := public.get_dashboard_stats(NULL, NULL);
  v_pendencias := public.get_pendencias_integridade();

  -- Ações pendentes (counts)
  SELECT count(*) INTO v_transf_pendentes
  FROM participante_transferencias
  WHERE data_transferencia IS NULL OR data_transferencia > current_date;

  SELECT count(*) INTO v_avisos_ativos FROM avisos_sistema WHERE ativo = true;
  SELECT count(*) INTO v_avisos_expirando
  FROM avisos_sistema
  WHERE ativo = true AND expires_at IS NOT NULL
    AND expires_at <= (now() + interval '7 days') AND expires_at > now();

  SELECT count(*) INTO v_recados_tecnicos
  FROM recados WHERE tipo_recado = 'tecnico' AND status = 'pendente';

  SELECT count(*) INTO v_enc_abertos_30d
  FROM encaminhamentos_externos
  WHERE status = 'aberto' AND created_at < (now() - interval '30 days');

  v_acoes_pendentes := jsonb_build_object(
    'transferencias_pendentes', v_transf_pendentes,
    'avisos_ativos', v_avisos_ativos,
    'avisos_expirando_7d', v_avisos_expirando,
    'recados_tecnicos_pendentes', v_recados_tecnicos,
    'encaminhamentos_abertos_30d', v_enc_abertos_30d,
    'pendencias_integridade_total', COALESCE((v_pendencias->>'total')::int, 0)
  );

  -- Qualidade da gestão
  SELECT count(*) INTO v_relatorios_mes
  FROM relatorios_atividade
  WHERE data >= date_trunc('month', current_date)::date;

  SELECT count(DISTINCT id) INTO v_educadores_total FROM profiles WHERE ativo = true;
  SELECT count(DISTINCT educador_id) INTO v_educadores_ativos_mes
  FROM relatorios_atividade
  WHERE data >= date_trunc('month', current_date)::date AND educador_id IS NOT NULL;

  SELECT count(*) INTO v_planej_total FROM planejamentos;
  SELECT count(DISTINCT planejamento_id) INTO v_planej_com_turma FROM planejamento_turmas;

  SELECT count(*) INTO v_turmas_total FROM turmas WHERE ativa = true;
  SELECT count(*) INTO v_turmas_com_edu FROM turmas WHERE ativa = true AND educador_id IS NOT NULL;

  SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (data_transferencia::timestamptz - created_at)) / 86400.0), 0)
  INTO v_tempo_transf
  FROM participante_transferencias
  WHERE created_at >= v_periodo_inicio AND data_transferencia IS NOT NULL;

  v_qualidade := jsonb_build_object(
    'relatorios_mes_atual', v_relatorios_mes,
    'educadores_ativos_mes', v_educadores_ativos_mes,
    'educadores_total', v_educadores_total,
    'pct_educadores_ativos',
      CASE WHEN v_educadores_total > 0 THEN round((v_educadores_ativos_mes::numeric / v_educadores_total) * 100, 1) ELSE 0 END,
    'pct_planej_com_turma',
      CASE WHEN v_planej_total > 0 THEN round((v_planej_com_turma::numeric / v_planej_total) * 100, 1) ELSE 0 END,
    'pct_turmas_com_educador',
      CASE WHEN v_turmas_total > 0 THEN round((v_turmas_com_edu::numeric / v_turmas_total) * 100, 1) ELSE 0 END,
    'tempo_medio_transferencia_dias', round(v_tempo_transf, 1)
  );

  -- Decisões / Auditoria
  SELECT count(*) INTO v_decisoes_proprias
  FROM audit_log WHERE user_id = _user_id AND created_at >= v_periodo_inicio;

  SELECT count(*) INTO v_decisoes_equipe
  FROM audit_log al
  WHERE created_at >= v_periodo_inicio
    AND EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = al.user_id AND ur.role = 'coordenacao'::app_role);

  SELECT count(*) INTO v_exclusoes
  FROM audit_log
  WHERE user_id = _user_id AND created_at >= v_periodo_inicio
    AND (acao ILIKE '%delete%' OR acao ILIKE '%exclu%');

  SELECT count(*) INTO v_aprovacoes
  FROM audit_log
  WHERE user_id = _user_id AND created_at >= v_periodo_inicio
    AND (acao ILIKE '%aprov%' OR acao ILIKE '%transfer%');

  SELECT count(*) INTO v_desligamentos
  FROM audit_log
  WHERE user_id = _user_id AND created_at >= v_periodo_inicio
    AND acao ILIKE '%deslig%';

  v_decisoes := jsonb_build_object(
    'proprias_periodo', v_decisoes_proprias,
    'equipe_periodo', v_decisoes_equipe,
    'exclusoes', v_exclusoes,
    'aprovacoes', v_aprovacoes,
    'desligamentos_validados', v_desligamentos
  );

  -- Cobertura de metas territoriais
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'bairro', b.nome,
    'meta_criancas_manha', COALESCE(b.meta_criancas_manha, 0),
    'meta_criancas_tarde', COALESCE(b.meta_criancas_tarde, 0),
    'meta_idosos', COALESCE(b.meta_idosos, 0),
    'real_manha', COALESCE((SELECT count(*) FROM participantes p WHERE p.bairro_id = b.id AND p.status = 'ativo' AND p.periodo::text = 'manha'), 0),
    'real_tarde', COALESCE((SELECT count(*) FROM participantes p WHERE p.bairro_id = b.id AND p.status = 'ativo' AND p.periodo::text = 'tarde'), 0),
    'real_total', COALESCE((SELECT count(*) FROM participantes p WHERE p.bairro_id = b.id AND p.status = 'ativo'), 0)
  ) ORDER BY b.nome), '[]'::jsonb)
  INTO v_cobertura
  FROM bairros b;

  RETURN jsonb_build_object(
    'dashboard', v_dashboard,
    'pendencias', v_pendencias,
    'gestao', jsonb_build_object(
      'acoes_pendentes', v_acoes_pendentes,
      'qualidade', v_qualidade,
      'decisoes', v_decisoes,
      'cobertura_metas', v_cobertura,
      'data_inicio_operacional', v_data_corte,
      'periodo_dias', _periodo_dias
    )
  );
END;
$$;