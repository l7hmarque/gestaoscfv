CREATE OR REPLACE FUNCTION public.recalcular_busca_ativa(_participante_ids uuid[] DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  v_sistema_user uuid;
BEGIN
  -- pega um user de coordenação para registrar o profissional_id
  SELECT user_id INTO v_sistema_user FROM user_roles WHERE role='coordenacao' LIMIT 1;

  FOR rec IN
    SELECT p.id, p.nome_completo, p.status
    FROM participantes p
    WHERE p.status IN ('ativo','busca_ativa')
      AND (_participante_ids IS NULL OR p.id = ANY(_participante_ids))
  LOOP
    -- última presença consolidada (presenca + relatorio_presenca)
    SELECT GREATEST(
      COALESCE((SELECT max(data) FROM presenca WHERE participante_id=rec.id AND presente=true), '1900-01-01'::date),
      COALESCE((SELECT max(ra.data) FROM relatorio_presenca rp JOIN relatorios_atividade ra ON ra.id=rp.relatorio_id WHERE rp.participante_id=rec.id AND rp.presente=true), '1900-01-01'::date)
    ) INTO v_last_presence;

    -- tem histórico de presença?
    v_has_history := v_last_presence > '1900-01-01'::date;

    -- últimas 3 marcações (presença OU falta)
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

    -- critério 1: 3 faltas consecutivas
    IF v_last_three IS NOT NULL AND array_length(v_last_three,1) >= 3
       AND v_last_three[1]=false AND v_last_three[2]=false AND v_last_three[3]=false THEN
      v_should_be_ba := true;
      v_motivo := 'Detecção automática — 3 faltas consecutivas';
    END IF;

    -- critério 2: 14 dias sem presença, com histórico anterior
    IF NOT v_should_be_ba AND v_has_history AND v_last_presence < v_cutoff THEN
      v_should_be_ba := true;
      v_motivo := format('Detecção automática — sem presença desde %s (>14 dias)', to_char(v_last_presence,'DD/MM/YYYY'));
    END IF;

    -- aplicar mudanças
    IF v_should_be_ba AND rec.status='ativo' THEN
      UPDATE participantes SET status='busca_ativa', updated_at=v_now WHERE id=rec.id;
      INSERT INTO busca_ativa_registros (participante_id, profissional_id, tipo_contato, descricao, resultado, data_registro)
      VALUES (rec.id, COALESCE(v_sistema_user, rec.id), 'sistema', v_motivo, 'detectado_automatico', v_today);
      INSERT INTO audit_log (user_id, user_nome, acao, tabela, registro_id, detalhes)
      VALUES (COALESCE(v_sistema_user, rec.id), 'Sistema (recalcular_busca_ativa)', 'auto_busca_ativa', 'participantes', rec.id::text, v_motivo);
      v_to_ba := v_to_ba + 1;
      v_detalhes := v_detalhes || jsonb_build_object('id', rec.id, 'nome', rec.nome_completo, 'acao', 'para_busca_ativa', 'motivo', v_motivo, 'ultima_presenca', v_last_presence);
    ELSIF NOT v_should_be_ba AND rec.status='busca_ativa' THEN
      UPDATE participantes SET status='ativo', updated_at=v_now WHERE id=rec.id;
      INSERT INTO busca_ativa_registros (participante_id, profissional_id, tipo_contato, descricao, resultado, data_registro)
      VALUES (rec.id, COALESCE(v_sistema_user, rec.id), 'sistema', 'Retorno automático — presença recente detectada', 'ja_retornou', v_today);
      INSERT INTO audit_log (user_id, user_nome, acao, tabela, registro_id, detalhes)
      VALUES (COALESCE(v_sistema_user, rec.id), 'Sistema (recalcular_busca_ativa)', 'auto_retorno_ativo', 'participantes', rec.id::text, 'Presença recente detectada');
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
$$;