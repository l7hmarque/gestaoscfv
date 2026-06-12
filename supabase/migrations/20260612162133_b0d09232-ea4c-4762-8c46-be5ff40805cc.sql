
-- RPC: corrigir uma data invertida (swap DD<->MM) com registro em audit_log
CREATE OR REPLACE FUNCTION public.corrigir_data_participante(
  _participante_id uuid,
  _coluna text,
  _data_proposta date,
  _decisao text, -- 'corrigir' | 'manter' | 'editar'
  _justificativa text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _nome text;
  _valor_antes text;
  _valor_depois text;
  _sql text;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  IF NOT (public.has_role(_uid, 'admin') OR public.has_role(_uid, 'coordenacao')) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  IF _coluna NOT IN ('data_nascimento','data_matricula','data_desligamento','iniciou_em') THEN
    RAISE EXCEPTION 'Coluna não permitida: %', _coluna;
  END IF;

  SELECT nome INTO _nome FROM profiles WHERE user_id = _uid;

  -- Captura valor antes
  EXECUTE format('SELECT (%I)::text FROM participantes WHERE id = $1', _coluna)
    INTO _valor_antes USING _participante_id;

  IF _decisao = 'corrigir' OR _decisao = 'editar' THEN
    EXECUTE format('UPDATE participantes SET %I = $1, updated_at = now() WHERE id = $2', _coluna)
      USING _data_proposta, _participante_id;
    _valor_depois := _data_proposta::text;
  ELSE
    _valor_depois := _valor_antes;
  END IF;

  INSERT INTO audit_log (user_id, user_nome, acao, tabela, registro_id, detalhes, justificativa)
  VALUES (
    _uid,
    COALESCE(_nome, 'Desconhecido'),
    'auditoria_data_' || _decisao,
    'participantes',
    _participante_id::text,
    jsonb_build_object(
      'coluna', _coluna,
      'valor_antes', _valor_antes,
      'valor_depois', _valor_depois
    )::text,
    _justificativa
  );

  RETURN jsonb_build_object('ok', true, 'valor_antes', _valor_antes, 'valor_depois', _valor_depois);
END;
$$;

GRANT EXECUTE ON FUNCTION public.corrigir_data_participante(uuid, text, date, text, text) TO authenticated;

-- RPC: corrigir cluster de import em lote (apenas data_desligamento futura)
CREATE OR REPLACE FUNCTION public.corrigir_cluster_desligamentos(
  _cluster_timestamp timestamptz,
  _justificativa text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _nome text;
  _afetados int := 0;
  _rec record;
  _proposta date;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF NOT (public.has_role(_uid, 'admin') OR public.has_role(_uid, 'coordenacao')) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;
  IF _justificativa IS NULL OR length(trim(_justificativa)) < 5 THEN
    RAISE EXCEPTION 'Justificativa obrigatória';
  END IF;

  SELECT nome INTO _nome FROM profiles WHERE user_id = _uid;

  FOR _rec IN
    SELECT id, data_desligamento
    FROM participantes
    WHERE updated_at = _cluster_timestamp
      AND data_desligamento IS NOT NULL
      AND data_desligamento > current_date
      AND extract(day from data_desligamento) <= 12
      AND extract(month from data_desligamento) <= 12
  LOOP
    -- swap DD<->MM
    _proposta := make_date(
      extract(year from _rec.data_desligamento)::int,
      extract(day from _rec.data_desligamento)::int,
      extract(month from _rec.data_desligamento)::int
    );

    UPDATE participantes
       SET data_desligamento = _proposta, updated_at = now()
     WHERE id = _rec.id;

    INSERT INTO audit_log (user_id, user_nome, acao, tabela, registro_id, detalhes, justificativa)
    VALUES (_uid, COALESCE(_nome,'Desconhecido'),
      'auditoria_data_cluster_corrigir', 'participantes', _rec.id::text,
      jsonb_build_object('coluna','data_desligamento','valor_antes',_rec.data_desligamento::text,'valor_depois',_proposta::text,'cluster',_cluster_timestamp::text)::text,
      _justificativa);

    _afetados := _afetados + 1;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'afetados', _afetados);
END;
$$;

GRANT EXECUTE ON FUNCTION public.corrigir_cluster_desligamentos(timestamptz, text) TO authenticated;
