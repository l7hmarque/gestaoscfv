-- Função RPC para exclusão atômica de turma com auditoria
CREATE OR REPLACE FUNCTION public.excluir_turma_com_auditoria(
  _turma_id uuid,
  _justificativa text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_nome text;
  v_user_nome text;
  v_vinc_removidos int;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('error','unauthenticated');
  END IF;

  SELECT nome INTO v_nome FROM public.turmas WHERE id = _turma_id;
  IF v_nome IS NULL THEN
    RETURN jsonb_build_object('error','turma_nao_encontrada');
  END IF;

  SELECT COALESCE(nome, (SELECT email FROM auth.users WHERE id = v_uid))
    INTO v_user_nome FROM public.profiles WHERE user_id = v_uid;

  -- conta vínculos antes
  SELECT count(*) INTO v_vinc_removidos
  FROM public.turma_participantes WHERE turma_id = _turma_id;

  -- exclui vínculos e turma na mesma transação
  DELETE FROM public.turma_participantes WHERE turma_id = _turma_id;
  DELETE FROM public.turmas WHERE id = _turma_id;

  -- auditoria
  INSERT INTO public.audit_log (user_id, user_nome, tabela, acao, registro_id, detalhes, justificativa)
  VALUES (v_uid, v_user_nome, 'turmas', 'exclusao', _turma_id,
          format('Turma "%s" excluída (%s vínculos removidos)', v_nome, v_vinc_removidos),
          _justificativa);

  RETURN jsonb_build_object('ok', true, 'vinculos_removidos', v_vinc_removidos, 'nome', v_nome);
END;
$$;

-- Função RPC para exclusão atômica em lote
CREATE OR REPLACE FUNCTION public.excluir_turmas_lote_com_auditoria(
  _turma_ids uuid[],
  _justificativa text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_user_nome text;
  v_total int := 0;
  v_vinc int := 0;
  rec record;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('error','unauthenticated');
  END IF;

  SELECT COALESCE(nome, (SELECT email FROM auth.users WHERE id = v_uid))
    INTO v_user_nome FROM public.profiles WHERE user_id = v_uid;

  SELECT count(*) INTO v_vinc FROM public.turma_participantes WHERE turma_id = ANY(_turma_ids);

  FOR rec IN SELECT id, nome FROM public.turmas WHERE id = ANY(_turma_ids) LOOP
    INSERT INTO public.audit_log (user_id, user_nome, tabela, acao, registro_id, detalhes, justificativa)
    VALUES (v_uid, v_user_nome, 'turmas', 'exclusao_lote', rec.id,
            format('Turma "%s" excluída em lote (%s turmas total)', rec.nome, array_length(_turma_ids, 1)),
            _justificativa);
    v_total := v_total + 1;
  END LOOP;

  DELETE FROM public.turma_participantes WHERE turma_id = ANY(_turma_ids);
  DELETE FROM public.turmas WHERE id = ANY(_turma_ids);

  RETURN jsonb_build_object('ok', true, 'turmas_excluidas', v_total, 'vinculos_removidos', v_vinc);
END;
$$;