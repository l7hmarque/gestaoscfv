
-- ============================================================
-- PARTE 1: Cobertura territorial restrita + indicadores extras
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_coordenacao_stats(_user_id uuid DEFAULT NULL::uuid, _periodo_dias integer DEFAULT 30)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_dashboard jsonb;
  v_pendencias jsonb;
  v_data_corte date;
  v_periodo_inicio timestamptz;
  v_acoes_pendentes jsonb;
  v_qualidade jsonb;
  v_qualidade_extra jsonb;
  v_decisoes jsonb;
  v_cobertura jsonb;
  v_atividades_periodo jsonb;
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
  v_atividades_count int;
  v_atividades_minutos int;
  v_bairros_alvo text[] := ARRAY['ALVORADA','PARQUE INDEPENDENCIA','JARDIM IRENE'];
BEGIN
  IF v_uid IS NULL OR NOT public.has_role(v_uid, 'coordenacao'::app_role) THEN
    RETURN jsonb_build_object('error', 'forbidden');
  END IF;

  SELECT valor::date INTO v_data_corte FROM configuracoes_gerais WHERE chave = 'data_inicio_operacional';
  v_data_corte := COALESCE(v_data_corte, '2026-04-01'::date);
  v_periodo_inicio := (current_date - (_periodo_dias || ' days')::interval)::timestamptz;

  v_dashboard := public.get_dashboard_stats(NULL, NULL);
  v_pendencias := public.get_pendencias_integridade();

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

  SELECT count(*) INTO v_relatorios_mes FROM relatorios_atividade
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

  -- ============ NOVO: indicadores extras de qualidade ============
  v_qualidade_extra := jsonb_build_object(
    'presenca_por_bairro', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('bairro', bairro, 'pct', pct) ORDER BY bairro)
      FROM (
        SELECT b.nome AS bairro,
          round(100.0 * sum(CASE WHEN rp.presente THEN 1 ELSE 0 END) / NULLIF(count(*), 0), 1) AS pct
        FROM relatorio_presenca rp
        JOIN relatorios_atividade ra ON ra.id = rp.relatorio_id
        JOIN participantes p ON p.id = rp.participante_id AND p.is_teste = false
        LEFT JOIN bairros b ON b.id = p.bairro_id
        WHERE ra.data >= v_periodo_inicio::date AND b.nome = ANY(v_bairros_alvo)
        GROUP BY b.nome
      ) sub
    ), '[]'::jsonb),
    'pct_relatorios_com_foto', COALESCE((
      SELECT round(100.0 * count(*) FILTER (WHERE EXISTS (SELECT 1 FROM relatorio_fotos rf WHERE rf.relatorio_id = ra.id))
                 / NULLIF(count(*), 0), 1)
      FROM relatorios_atividade ra
      WHERE ra.data >= v_periodo_inicio::date
        AND COALESCE(ra.nome_atividade,'') NOT LIKE 'Atividade SCFV (consolidado%'
    ), 0),
    'pct_relatorios_com_analise_ia', COALESCE((
      SELECT round(100.0 * count(*) FILTER (WHERE ra.analise_ia IS NOT NULL AND length(trim(ra.analise_ia)) > 0)
                 / NULLIF(count(*), 0), 1)
      FROM relatorios_atividade ra
      WHERE ra.data >= v_periodo_inicio::date
    ), 0),
    'objetivos_distribuicao', COALESCE((
      SELECT jsonb_object_agg(status, qtd)
      FROM (
        SELECT objetivo_alcancado::text AS status, count(*) AS qtd
        FROM relatorios_atividade
        WHERE data >= v_periodo_inicio::date AND objetivo_alcancado IS NOT NULL
        GROUP BY 1
      ) s
    ), '{}'::jsonb),
    'top_educadores_elo', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('nome', nome, 'elo_medio', elo, 'qtd', qtd) ORDER BY elo DESC)
      FROM (
        SELECT pr.nome, round(avg(ra.score_elo)::numeric, 2) AS elo, count(*) AS qtd
        FROM relatorios_atividade ra
        JOIN profiles pr ON pr.id = ra.educador_id
        WHERE ra.data >= v_periodo_inicio::date AND ra.score_elo IS NOT NULL
        GROUP BY pr.nome
        HAVING count(*) >= 3
        ORDER BY elo DESC
        LIMIT 5
      ) s
    ), '[]'::jsonb),
    'recados_tecnicos_status', jsonb_build_object(
      'pendentes', (SELECT count(*) FROM recados WHERE tipo_recado = 'tecnico' AND status = 'pendente'),
      'respondidos', (SELECT count(*) FROM recados WHERE tipo_recado = 'tecnico' AND status IN ('respondido','resolvido') AND created_at >= v_periodo_inicio)
    ),
    'acessos_familia_periodo', COALESCE((
      SELECT count(*) FROM familia_acessos WHERE iniciado_em >= v_periodo_inicio
    ), 0),
    'permanencia_media_dias', COALESCE((
      SELECT round(avg(EXTRACT(EPOCH FROM (COALESCE(data_desligamento::timestamptz, now()) - created_at))/86400)::numeric, 0)
      FROM participantes WHERE is_teste = false
    ), 0)
  );

  SELECT count(*) INTO v_decisoes_proprias FROM audit_log WHERE user_id = v_uid AND created_at >= v_periodo_inicio;

  SELECT count(*) INTO v_decisoes_equipe FROM audit_log al
  WHERE created_at >= v_periodo_inicio
    AND EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = al.user_id AND ur.role = 'coordenacao'::app_role);

  SELECT count(*) INTO v_exclusoes FROM audit_log
  WHERE user_id = v_uid AND created_at >= v_periodo_inicio AND (acao ILIKE '%delete%' OR acao ILIKE '%exclu%');

  SELECT count(*) INTO v_aprovacoes FROM audit_log
  WHERE user_id = v_uid AND created_at >= v_periodo_inicio AND (acao ILIKE '%aprov%' OR acao ILIKE '%transfer%');

  SELECT count(*) INTO v_desligamentos FROM audit_log
  WHERE user_id = v_uid AND created_at >= v_periodo_inicio AND acao ILIKE '%deslig%';

  v_decisoes := jsonb_build_object(
    'proprias_periodo', v_decisoes_proprias,
    'equipe_periodo', v_decisoes_equipe,
    'exclusoes', v_exclusoes,
    'aprovacoes', v_aprovacoes,
    'desligamentos_validados', v_desligamentos
  );

  -- ============ COBERTURA: APENAS 3 BAIRROS ALVO ============
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
  FROM bairros b
  WHERE b.nome = ANY(v_bairros_alvo);

  SELECT count(*), COALESCE(sum(duracao_minutos), 0)
  INTO v_atividades_count, v_atividades_minutos
  FROM coordenacao_atividades
  WHERE data >= (current_date - (_periodo_dias || ' days')::interval)::date;

  v_atividades_periodo := jsonb_build_object(
    'count', COALESCE(v_atividades_count, 0),
    'minutos_totais', COALESCE(v_atividades_minutos, 0)
  );

  RETURN jsonb_build_object(
    'dashboard', v_dashboard,
    'pendencias', v_pendencias,
    'gestao', jsonb_build_object(
      'acoes_pendentes', v_acoes_pendentes,
      'qualidade', v_qualidade,
      'qualidade_extra', v_qualidade_extra,
      'decisoes', v_decisoes,
      'cobertura_metas', v_cobertura,
      'atividades_periodo', v_atividades_periodo,
      'data_inicio_operacional', v_data_corte,
      'periodo_dias', _periodo_dias
    )
  );
END;
$function$;

-- ============================================================
-- PARTE 2: Telemetria - tabelas de pings e cronômetros
-- ============================================================
CREATE TABLE IF NOT EXISTS public.user_activity_pings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  session_id uuid NOT NULL,
  route text,
  created_at timestamptz NOT NULL DEFAULT now(),
  archived boolean NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS idx_uap_user_created ON public.user_activity_pings (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_uap_created ON public.user_activity_pings (created_at);

ALTER TABLE public.user_activity_pings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Insere proprios pings"
  ON public.user_activity_pings FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Coordenacao le todos os pings"
  ON public.user_activity_pings FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'coordenacao'::app_role));

CREATE POLICY "Coordenacao atualiza pings"
  ON public.user_activity_pings FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'coordenacao'::app_role));

CREATE POLICY "Coordenacao deleta pings"
  ON public.user_activity_pings FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'coordenacao'::app_role));

CREATE TABLE IF NOT EXISTS public.user_action_durations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('relatorio','planejamento','presenca','edicao_relatorio','edicao_planejamento','edicao_presenca')),
  registro_id text,
  iniciado_em timestamptz NOT NULL,
  salvo_em timestamptz NOT NULL DEFAULT now(),
  duracao_segundos integer NOT NULL,
  rota text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_uad_user_tipo ON public.user_action_durations (user_id, tipo, salvo_em DESC);

ALTER TABLE public.user_action_durations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Insere proprias duracoes"
  ON public.user_action_durations FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Coordenacao le duracoes"
  ON public.user_action_durations FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'coordenacao'::app_role));

-- ============================================================
-- PARTE 3: Configs de prazo
-- ============================================================
INSERT INTO public.configuracoes_gerais (chave, valor)
VALUES
  ('prazo_relatorios_dia_mes_seguinte', '1'),
  ('prazo_presencas_dia_mes_seguinte', '1'),
  ('prazo_planejamentos_dia_mes_seguinte', '')
ON CONFLICT (chave) DO NOTHING;

-- ============================================================
-- PARTE 4: Audit trigger genérico com diff JSONB em detalhes
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_audit_changes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_nome text;
  v_acao text;
  v_reg_id text;
  v_diff jsonb;
  v_old jsonb;
  v_new jsonb;
  v_keys text[];
  v_k text;
BEGIN
  -- Pular se usuário não autenticado (jobs/sistema)
  IF v_uid IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT nome INTO v_nome FROM profiles WHERE user_id = v_uid LIMIT 1;
  v_nome := COALESCE(v_nome, 'Sistema');

  IF TG_OP = 'INSERT' THEN
    v_acao := 'INSERT_' || TG_TABLE_NAME;
    v_new := to_jsonb(NEW);
    v_diff := jsonb_build_object('new', v_new);
    v_reg_id := COALESCE(v_new->>'id', '');
  ELSIF TG_OP = 'DELETE' THEN
    v_acao := 'DELETE_' || TG_TABLE_NAME;
    v_old := to_jsonb(OLD);
    v_diff := jsonb_build_object('old', v_old);
    v_reg_id := COALESCE(v_old->>'id', '');
  ELSE -- UPDATE
    v_acao := 'UPDATE_' || TG_TABLE_NAME;
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
    v_diff := '{}'::jsonb;
    v_keys := ARRAY(SELECT jsonb_object_keys(v_new));
    FOREACH v_k IN ARRAY v_keys LOOP
      IF v_k = 'updated_at' THEN CONTINUE; END IF;
      IF (v_old->v_k) IS DISTINCT FROM (v_new->v_k) THEN
        v_diff := v_diff || jsonb_build_object(v_k, jsonb_build_object('antes', v_old->v_k, 'depois', v_new->v_k));
      END IF;
    END LOOP;
    v_reg_id := COALESCE(v_new->>'id', '');
    -- Pular se nada mudou (além de updated_at)
    IF v_diff = '{}'::jsonb THEN RETURN NEW; END IF;
  END IF;

  INSERT INTO public.audit_log (user_id, user_nome, acao, tabela, registro_id, detalhes)
  VALUES (v_uid, v_nome, v_acao, TG_TABLE_NAME, v_reg_id, v_diff::text);

  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- Aplicar triggers em tabelas críticas
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'participantes','turmas','turma_participantes','relatorios_atividade',
    'relatorio_presenca','presenca','planejamentos','user_roles',
    'participante_transferencias','bairros','configuracoes_gerais'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_%s ON public.%I', t, t);
    EXECUTE format('CREATE TRIGGER trg_audit_%s AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.fn_audit_changes()', t, t);
  END LOOP;
END$$;

-- Profile - apenas update em campos sensíveis
DROP TRIGGER IF EXISTS trg_audit_profiles ON public.profiles;
CREATE TRIGGER trg_audit_profiles
  AFTER UPDATE OF salario, ativo, cargo, data_desligamento, cpf, email ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_changes();

-- ============================================================
-- PARTE 5: RPC de produtividade dos educadores
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_produtividade_educadores(_mes int DEFAULT NULL, _ano int DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_mes int := COALESCE(_mes, extract(month from current_date)::int);
  v_ano int := COALESCE(_ano, extract(year from current_date)::int);
  v_inicio date := make_date(v_ano, v_mes, 1);
  v_fim date := (make_date(v_ano, v_mes, 1) + interval '1 month')::date;
  v_prazo_relatorios date;
  v_prazo_presencas date;
  v_prazo_planejamentos date;
  v_dias_para_prazo int;
  v_cfg_rel text;
  v_cfg_pres text;
  v_cfg_plan text;
  v_result jsonb;
BEGIN
  IF v_uid IS NULL OR NOT public.has_role(v_uid, 'coordenacao'::app_role) THEN
    RETURN jsonb_build_object('error','forbidden');
  END IF;

  SELECT valor INTO v_cfg_rel FROM configuracoes_gerais WHERE chave = 'prazo_relatorios_dia_mes_seguinte';
  SELECT valor INTO v_cfg_pres FROM configuracoes_gerais WHERE chave = 'prazo_presencas_dia_mes_seguinte';
  SELECT valor INTO v_cfg_plan FROM configuracoes_gerais WHERE chave = 'prazo_planejamentos_dia_mes_seguinte';

  v_prazo_relatorios := v_fim + ((COALESCE(NULLIF(v_cfg_rel,''),'1')::int - 1) || ' days')::interval;
  v_prazo_presencas := v_fim + ((COALESCE(NULLIF(v_cfg_pres,''),'1')::int - 1) || ' days')::interval;
  v_prazo_planejamentos := CASE WHEN NULLIF(v_cfg_plan,'') IS NULL THEN NULL
                                ELSE v_fim + ((v_cfg_plan::int - 1) || ' days')::interval END;

  SELECT jsonb_build_object(
    'mes', v_mes,
    'ano', v_ano,
    'prazo_relatorios', v_prazo_relatorios,
    'prazo_presencas', v_prazo_presencas,
    'prazo_planejamentos', v_prazo_planejamentos,
    'dias_para_prazo_relatorios', GREATEST(0, (v_prazo_relatorios - current_date)::int),
    'dias_para_prazo_presencas', GREATEST(0, (v_prazo_presencas - current_date)::int),
    'educadores', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'profile_id', pr.id,
        'user_id', pr.user_id,
        'nome', pr.nome,
        'cargo', pr.cargo,
        'relatorios_mes', COALESCE((SELECT count(*) FROM relatorios_atividade ra WHERE ra.educador_id = pr.id AND ra.data >= v_inicio AND ra.data < v_fim), 0),
        'presencas_mes', COALESCE((SELECT count(*) FROM presenca pr2 WHERE pr2.registrado_por = pr.user_id AND pr2.data >= v_inicio AND pr2.data < v_fim), 0),
        'planejamentos_mes', COALESCE((SELECT count(*) FROM planejamentos pl WHERE pl.educador_id = pr.id AND pl.data_aplicacao >= v_inicio AND pl.data_aplicacao < v_fim), 0),
        'turmas_atribuidas', COALESCE((SELECT count(*) FROM turmas t WHERE t.educador_id = pr.id AND t.ativa = true), 0),
        'ultimo_lancamento', (
          SELECT max(d) FROM (
            SELECT max(ra.created_at) AS d FROM relatorios_atividade ra WHERE ra.educador_id = pr.id
            UNION ALL
            SELECT max(pl.created_at) FROM planejamentos pl WHERE pl.educador_id = pr.id
            UNION ALL
            SELECT max(pr2.created_at) FROM presenca pr2 WHERE pr2.registrado_por = pr.user_id
          ) s
        ),
        'tempo_medio_relatorio_s', COALESCE((SELECT round(avg(duracao_segundos)::numeric, 0) FROM user_action_durations uad WHERE uad.user_id = pr.user_id AND uad.tipo IN ('relatorio','edicao_relatorio') AND uad.salvo_em >= v_inicio), 0),
        'tempo_medio_planejamento_s', COALESCE((SELECT round(avg(duracao_segundos)::numeric, 0) FROM user_action_durations uad WHERE uad.user_id = pr.user_id AND uad.tipo IN ('planejamento','edicao_planejamento') AND uad.salvo_em >= v_inicio), 0),
        'tempo_medio_presenca_s', COALESCE((SELECT round(avg(duracao_segundos)::numeric, 0) FROM user_action_durations uad WHERE uad.user_id = pr.user_id AND uad.tipo IN ('presenca','edicao_presenca') AND uad.salvo_em >= v_inicio), 0),
        'tempo_total_burocratico_mes_s', COALESCE((SELECT sum(duracao_segundos) FROM user_action_durations uad WHERE uad.user_id = pr.user_id AND uad.salvo_em >= v_inicio AND uad.salvo_em < v_fim), 0),
        'tempo_total_burocratico_semana_s', COALESCE((SELECT sum(duracao_segundos) FROM user_action_durations uad WHERE uad.user_id = pr.user_id AND uad.salvo_em >= (current_date - interval '7 days')), 0),
        'tempo_total_burocratico_dia_s', COALESCE((SELECT sum(duracao_segundos) FROM user_action_durations uad WHERE uad.user_id = pr.user_id AND uad.salvo_em::date = current_date), 0)
      ) ORDER BY pr.nome)
      FROM profiles pr
      WHERE pr.ativo = true AND pr.cargo IS NOT NULL
        AND (pr.cargo ILIKE '%educador%' OR pr.cargo ILIKE '%oficineir%' OR pr.cargo ILIKE '%instrutor%' OR pr.cargo ILIKE '%professor%')
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$function$;

-- ============================================================
-- PARTE 6: RPC de atividade na plataforma (minutos por sessão)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_user_activity_summary(_user_id uuid, _from timestamptz, _to timestamptz)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_minutos_total numeric;
  v_por_dia jsonb;
  v_top_rotas jsonb;
BEGIN
  IF v_uid IS NULL OR NOT public.has_role(v_uid, 'coordenacao'::app_role) THEN
    RETURN jsonb_build_object('error','forbidden');
  END IF;

  -- Agrupa pings consecutivos com gap < 2 min (cada ping ~30s -> conta 0.5 min)
  WITH pings AS (
    SELECT created_at, route,
      lag(created_at) OVER (ORDER BY created_at) AS prev_at
    FROM user_activity_pings
    WHERE user_id = _user_id AND created_at >= _from AND created_at < _to
  ),
  sessions AS (
    SELECT created_at, route,
      CASE WHEN prev_at IS NULL OR (created_at - prev_at) > interval '2 minutes' THEN 1 ELSE 0 END AS new_session
    FROM pings
  ),
  grouped AS (
    SELECT created_at, route, sum(new_session) OVER (ORDER BY created_at) AS sid
    FROM sessions
  ),
  sess_durations AS (
    SELECT sid, EXTRACT(EPOCH FROM (max(created_at) - min(created_at)))/60.0 + 0.5 AS minutos
    FROM grouped GROUP BY sid
  )
  SELECT round(COALESCE(sum(minutos), 0)::numeric, 1) INTO v_minutos_total FROM sess_durations;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('dia', dia, 'minutos', minutos) ORDER BY dia), '[]'::jsonb)
  INTO v_por_dia
  FROM (
    SELECT created_at::date AS dia, round((count(*) * 0.5)::numeric, 1) AS minutos
    FROM user_activity_pings
    WHERE user_id = _user_id AND created_at >= _from AND created_at < _to
    GROUP BY 1
  ) s;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('route', route, 'pings', cnt) ORDER BY cnt DESC), '[]'::jsonb)
  INTO v_top_rotas
  FROM (
    SELECT route, count(*) AS cnt FROM user_activity_pings
    WHERE user_id = _user_id AND created_at >= _from AND created_at < _to AND route IS NOT NULL
    GROUP BY route ORDER BY 2 DESC LIMIT 10
  ) s;

  RETURN jsonb_build_object(
    'minutos_total', v_minutos_total,
    'por_dia', v_por_dia,
    'top_rotas', v_top_rotas
  );
END;
$function$;

-- ============================================================
-- PARTE 7: Limpeza automática (pings > 90 dias não arquivados)
-- ============================================================
CREATE OR REPLACE FUNCTION public.cleanup_old_pings()
 RETURNS int
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_count int;
BEGIN
  DELETE FROM public.user_activity_pings
  WHERE created_at < (now() - interval '90 days') AND archived = false;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$function$;
