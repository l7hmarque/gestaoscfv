
-- =====================================================
-- 1) RPC get_coordenacao_stats — usa auth.uid() server-side
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_coordenacao_stats(_user_id uuid DEFAULT NULL, _periodo_dias integer DEFAULT 30)
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

  SELECT count(*) INTO v_decisoes_proprias
  FROM audit_log WHERE user_id = v_uid AND created_at >= v_periodo_inicio;

  SELECT count(*) INTO v_decisoes_equipe
  FROM audit_log al
  WHERE created_at >= v_periodo_inicio
    AND EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = al.user_id AND ur.role = 'coordenacao'::app_role);

  SELECT count(*) INTO v_exclusoes
  FROM audit_log
  WHERE user_id = v_uid AND created_at >= v_periodo_inicio
    AND (acao ILIKE '%delete%' OR acao ILIKE '%exclu%');

  SELECT count(*) INTO v_aprovacoes
  FROM audit_log
  WHERE user_id = v_uid AND created_at >= v_periodo_inicio
    AND (acao ILIKE '%aprov%' OR acao ILIKE '%transfer%');

  SELECT count(*) INTO v_desligamentos
  FROM audit_log
  WHERE user_id = v_uid AND created_at >= v_periodo_inicio
    AND acao ILIKE '%deslig%';

  v_decisoes := jsonb_build_object(
    'proprias_periodo', v_decisoes_proprias,
    'equipe_periodo', v_decisoes_equipe,
    'exclusoes', v_exclusoes,
    'aprovacoes', v_aprovacoes,
    'desligamentos_validados', v_desligamentos
  );

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

  -- Atividades do período (agregadas)
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
      'decisoes', v_decisoes,
      'cobertura_metas', v_cobertura,
      'atividades_periodo', v_atividades_periodo,
      'data_inicio_operacional', v_data_corte,
      'periodo_dias', _periodo_dias
    )
  );
END;
$function$;

-- =====================================================
-- 2) Tabela coordenacao_atividades (criada antes para o RPC referenciar)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.coordenacao_atividades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coordenador_id uuid NOT NULL,
  data date NOT NULL DEFAULT CURRENT_DATE,
  categoria text NOT NULL DEFAULT 'outro',
  titulo text NOT NULL,
  descricao text,
  duracao_minutos integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.coordenacao_atividades ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Coord select atividades" ON public.coordenacao_atividades;
CREATE POLICY "Coord select atividades" ON public.coordenacao_atividades
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'coordenacao'::app_role));

DROP POLICY IF EXISTS "Coord insert atividades" ON public.coordenacao_atividades;
CREATE POLICY "Coord insert atividades" ON public.coordenacao_atividades
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'coordenacao'::app_role)
    AND coordenador_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Coord update atividades" ON public.coordenacao_atividades;
CREATE POLICY "Coord update atividades" ON public.coordenacao_atividades
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'coordenacao'::app_role));

DROP POLICY IF EXISTS "Coord delete atividades" ON public.coordenacao_atividades;
CREATE POLICY "Coord delete atividades" ON public.coordenacao_atividades
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'coordenacao'::app_role));

DROP TRIGGER IF EXISTS update_coordenacao_atividades_updated_at ON public.coordenacao_atividades;
CREATE TRIGGER update_coordenacao_atividades_updated_at
  BEFORE UPDATE ON public.coordenacao_atividades
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_coord_ativ_data ON public.coordenacao_atividades(data DESC);
CREATE INDEX IF NOT EXISTS idx_coord_ativ_coord ON public.coordenacao_atividades(coordenador_id);

-- =====================================================
-- 3) RLS Hardening
-- =====================================================

-- audit_log: INSERT só com user_id = auth.uid()
DROP POLICY IF EXISTS "Authenticated insert audit_log" ON public.audit_log;
CREATE POLICY "Authenticated insert audit_log" ON public.audit_log
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- chamadas_assinadas: uploaded_by = auth.uid() AND não visitante
DROP POLICY IF EXISTS "Non-visitante insert chamadas_assinadas" ON public.chamadas_assinadas;
CREATE POLICY "Non-visitante insert chamadas_assinadas" ON public.chamadas_assinadas
  FOR INSERT TO authenticated
  WITH CHECK (uploaded_by = auth.uid() AND NOT public.has_role(auth.uid(), 'visitante'::app_role));

-- conquistas: somente coordenação
DROP POLICY IF EXISTS "System insert conquistas" ON public.conquistas;
CREATE POLICY "System insert conquistas" ON public.conquistas
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'coordenacao'::app_role));

-- feed_posts INSERT
DROP POLICY IF EXISTS "Authenticated insert feed" ON public.feed_posts;
CREATE POLICY "Authenticated insert feed" ON public.feed_posts
  FOR INSERT TO authenticated
  WITH CHECK (
    NOT public.has_role(auth.uid(), 'visitante'::app_role)
    AND autor_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

-- feed_comentarios INSERT
DROP POLICY IF EXISTS "Authenticated insert comentarios" ON public.feed_comentarios;
CREATE POLICY "Authenticated insert comentarios" ON public.feed_comentarios
  FOR INSERT TO authenticated
  WITH CHECK (
    NOT public.has_role(auth.uid(), 'visitante'::app_role)
    AND autor_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

-- feed_fotos INSERT
DROP POLICY IF EXISTS "Authenticated insert feed fotos" ON public.feed_fotos;
CREATE POLICY "Authenticated insert feed fotos" ON public.feed_fotos
  FOR INSERT TO authenticated
  WITH CHECK (
    NOT public.has_role(auth.uid(), 'visitante'::app_role)
    AND feed_post_id IN (
      SELECT fp.id FROM public.feed_posts fp
      WHERE fp.autor_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    )
  );

-- feed_reacoes INSERT
DROP POLICY IF EXISTS "Authenticated insert reacoes" ON public.feed_reacoes;
CREATE POLICY "Authenticated insert reacoes" ON public.feed_reacoes
  FOR INSERT TO authenticated
  WITH CHECK (
    NOT public.has_role(auth.uid(), 'visitante'::app_role)
    AND user_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

-- mural_posts INSERT
DROP POLICY IF EXISTS "Authenticated insert mural" ON public.mural_posts;
CREATE POLICY "Authenticated insert mural" ON public.mural_posts
  FOR INSERT TO authenticated
  WITH CHECK (
    NOT public.has_role(auth.uid(), 'visitante'::app_role)
    AND autor_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

-- participante_documentos: exigir role operacional
DROP POLICY IF EXISTS "Non-visitante insert docs" ON public.participante_documentos;
CREATE POLICY "Non-visitante insert docs" ON public.participante_documentos
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'coordenacao'::app_role)
    OR public.has_role(auth.uid(), 'tecnico'::app_role)
    OR public.has_role(auth.uid(), 'educador'::app_role)
  );

DROP POLICY IF EXISTS "Non-visitante update docs" ON public.participante_documentos;
CREATE POLICY "Non-visitante update docs" ON public.participante_documentos
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'coordenacao'::app_role)
    OR public.has_role(auth.uid(), 'tecnico'::app_role)
    OR public.has_role(auth.uid(), 'educador'::app_role)
  );

-- participantes: exigir role operacional
DROP POLICY IF EXISTS "Non-visitante insert participantes" ON public.participantes;
CREATE POLICY "Non-visitante insert participantes" ON public.participantes
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'coordenacao'::app_role)
    OR public.has_role(auth.uid(), 'tecnico'::app_role)
    OR public.has_role(auth.uid(), 'educador'::app_role)
  );

DROP POLICY IF EXISTS "Non-visitante update participantes" ON public.participantes;
CREATE POLICY "Non-visitante update participantes" ON public.participantes
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'coordenacao'::app_role)
    OR public.has_role(auth.uid(), 'tecnico'::app_role)
    OR public.has_role(auth.uid(), 'educador'::app_role)
  );

-- presenca
DROP POLICY IF EXISTS "Non-visitante insert presenca" ON public.presenca;
CREATE POLICY "Non-visitante insert presenca" ON public.presenca
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'coordenacao'::app_role)
    OR public.has_role(auth.uid(), 'tecnico'::app_role)
    OR public.has_role(auth.uid(), 'educador'::app_role)
  );

DROP POLICY IF EXISTS "Non-visitante update presenca" ON public.presenca;
CREATE POLICY "Non-visitante update presenca" ON public.presenca
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'coordenacao'::app_role)
    OR public.has_role(auth.uid(), 'tecnico'::app_role)
    OR public.has_role(auth.uid(), 'educador'::app_role)
  );

DROP POLICY IF EXISTS "Non-visitante delete presenca" ON public.presenca;
CREATE POLICY "Non-visitante delete presenca" ON public.presenca
  FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'coordenacao'::app_role)
    OR public.has_role(auth.uid(), 'tecnico'::app_role)
    OR public.has_role(auth.uid(), 'educador'::app_role)
  );

-- planejamentos INSERT
DROP POLICY IF EXISTS "Non-visitante insert planejamentos" ON public.planejamentos;
CREATE POLICY "Non-visitante insert planejamentos" ON public.planejamentos
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'coordenacao'::app_role)
    OR public.has_role(auth.uid(), 'tecnico'::app_role)
    OR public.has_role(auth.uid(), 'educador'::app_role)
  );

-- planejamento_turmas
DROP POLICY IF EXISTS "Non-visitante manage planejamento_turmas" ON public.planejamento_turmas;
CREATE POLICY "Non-visitante manage planejamento_turmas" ON public.planejamento_turmas
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'coordenacao'::app_role)
    OR public.has_role(auth.uid(), 'tecnico'::app_role)
    OR public.has_role(auth.uid(), 'educador'::app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'coordenacao'::app_role)
    OR public.has_role(auth.uid(), 'tecnico'::app_role)
    OR public.has_role(auth.uid(), 'educador'::app_role)
  );

-- participante_transferencias
DROP POLICY IF EXISTS "Non-visitante manage transferencias" ON public.participante_transferencias;
CREATE POLICY "Non-visitante manage transferencias" ON public.participante_transferencias
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'coordenacao'::app_role)
    OR public.has_role(auth.uid(), 'tecnico'::app_role)
    OR public.has_role(auth.uid(), 'educador'::app_role)
  );

DROP POLICY IF EXISTS "Non-visitante update transferencias" ON public.participante_transferencias;
CREATE POLICY "Non-visitante update transferencias" ON public.participante_transferencias
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'coordenacao'::app_role)
    OR public.has_role(auth.uid(), 'tecnico'::app_role)
  );

DROP POLICY IF EXISTS "Non-visitante delete transferencias" ON public.participante_transferencias;
CREATE POLICY "Non-visitante delete transferencias" ON public.participante_transferencias
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'coordenacao'::app_role));
