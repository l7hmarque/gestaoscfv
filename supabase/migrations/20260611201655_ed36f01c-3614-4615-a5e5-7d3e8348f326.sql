CREATE OR REPLACE FUNCTION public.reconciliar_duplicados(_manter_id uuid, _descartar_ids uuid[], _justificativa text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_mp int := 0; v_mf int := 0; v_mt int := 0; v_del int := 0;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  IF NOT public.has_role(v_uid, 'coordenacao') THEN RAISE EXCEPTION 'forbidden: somente coordenação'; END IF;
  IF _justificativa IS NULL OR length(trim(_justificativa)) < 10 THEN RAISE EXCEPTION 'justificativa obrigatória (mín. 10 caracteres)'; END IF;
  IF _manter_id = ANY(_descartar_ids) THEN RAISE EXCEPTION 'manter_id não pode estar em descartar_ids'; END IF;

  INSERT INTO public.relatorio_turmas (relatorio_id, turma_id)
  SELECT _manter_id, rt.turma_id FROM public.relatorio_turmas rt
  WHERE rt.relatorio_id = ANY(_descartar_ids)
    AND NOT EXISTS (SELECT 1 FROM public.relatorio_turmas rt2 WHERE rt2.relatorio_id = _manter_id AND rt2.turma_id = rt.turma_id);
  GET DIAGNOSTICS v_mt = ROW_COUNT;

  INSERT INTO public.relatorio_presenca (relatorio_id, participante_id, presente, justificativa, nome_avulso)
  SELECT _manter_id, rp.participante_id, rp.presente, rp.justificativa, rp.nome_avulso FROM public.relatorio_presenca rp
  WHERE rp.relatorio_id = ANY(_descartar_ids)
    AND NOT EXISTS (SELECT 1 FROM public.relatorio_presenca rp2 WHERE rp2.relatorio_id = _manter_id
      AND COALESCE(rp2.participante_id::text, rp2.nome_avulso, '') = COALESCE(rp.participante_id::text, rp.nome_avulso, ''));
  GET DIAGNOSTICS v_mp = ROW_COUNT;

  UPDATE public.relatorio_fotos SET relatorio_id = _manter_id WHERE relatorio_id = ANY(_descartar_ids);
  GET DIAGNOSTICS v_mf = ROW_COUNT;

  DELETE FROM public.relatorio_presenca WHERE relatorio_id = ANY(_descartar_ids);
  DELETE FROM public.relatorio_turmas WHERE relatorio_id = ANY(_descartar_ids);
  DELETE FROM public.relatorios_atividade WHERE id = ANY(_descartar_ids);
  GET DIAGNOSTICS v_del = ROW_COUNT;

  INSERT INTO public.audit_log (user_id, acao, tabela, registro_id, justificativa, detalhes)
  VALUES (v_uid, 'reconciliar_duplicados', 'relatorios_atividade', _manter_id::text, _justificativa,
    jsonb_build_object('manter_id', _manter_id, 'descartar_ids', to_jsonb(_descartar_ids),
      'migrated_turmas', v_mt, 'migrated_presencas', v_mp, 'migrated_fotos', v_mf, 'deleted', v_del)::text);

  RETURN jsonb_build_object('ok', true, 'deleted', v_del, 'migrated_presencas', v_mp, 'migrated_turmas', v_mt, 'migrated_fotos', v_mf);
END; $$;

CREATE OR REPLACE FUNCTION public.resolver_presenca_orfa(_presenca_id uuid, _acao text, _justificativa text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_turma_id uuid; v_part_id uuid; v_data date;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  IF NOT public.has_role(v_uid, 'coordenacao') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _justificativa IS NULL OR length(trim(_justificativa)) < 10 THEN RAISE EXCEPTION 'justificativa obrigatória (mín. 10 caracteres)'; END IF;
  IF _acao NOT IN ('excluir','vincular') THEN RAISE EXCEPTION 'ação inválida'; END IF;

  SELECT rp.participante_id, ra.data, rt.turma_id INTO v_part_id, v_data, v_turma_id
  FROM public.relatorio_presenca rp
  JOIN public.relatorios_atividade ra ON ra.id = rp.relatorio_id
  JOIN public.relatorio_turmas rt ON rt.relatorio_id = rp.relatorio_id
  WHERE rp.id = _presenca_id LIMIT 1;

  IF v_part_id IS NULL THEN RAISE EXCEPTION 'presença não encontrada ou sem turma'; END IF;

  IF _acao = 'excluir' THEN
    DELETE FROM public.relatorio_presenca WHERE id = _presenca_id;
  ELSE
    INSERT INTO public.turma_participantes (turma_id, participante_id, data_entrada)
    VALUES (v_turma_id, v_part_id, v_data) ON CONFLICT DO NOTHING;
  END IF;

  INSERT INTO public.audit_log (user_id, acao, tabela, registro_id, justificativa, detalhes)
  VALUES (v_uid, 'resolver_presenca_orfa_' || _acao, 'relatorio_presenca', _presenca_id::text, _justificativa,
    jsonb_build_object('participante_id', v_part_id, 'turma_id', v_turma_id, 'data', v_data)::text);

  RETURN jsonb_build_object('ok', true, 'acao', _acao);
END; $$;

CREATE OR REPLACE FUNCTION public.completar_presenca_faltante(_relatorio_id uuid, _participante_id uuid, _status text, _justificativa text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_presente boolean; v_just text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  IF NOT public.has_role(v_uid, 'coordenacao') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _justificativa IS NULL OR length(trim(_justificativa)) < 10 THEN RAISE EXCEPTION 'justificativa obrigatória (mín. 10 caracteres)'; END IF;
  IF _status NOT IN ('P','A','J') THEN RAISE EXCEPTION 'status inválido'; END IF;

  v_presente := (_status = 'P');
  v_just := CASE WHEN _status = 'J' THEN _justificativa ELSE NULL END;

  INSERT INTO public.relatorio_presenca (relatorio_id, participante_id, presente, justificativa)
  VALUES (_relatorio_id, _participante_id, v_presente, v_just);

  INSERT INTO public.audit_log (user_id, acao, tabela, registro_id, justificativa, detalhes)
  VALUES (v_uid, 'completar_presenca_faltante', 'relatorio_presenca', _relatorio_id::text, _justificativa,
    jsonb_build_object('participante_id', _participante_id, 'status', _status)::text);

  RETURN jsonb_build_object('ok', true);
END; $$;

CREATE OR REPLACE FUNCTION public.excluir_relatorio_vazio(_relatorio_id uuid, _justificativa text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_tt boolean; v_tp boolean;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  IF NOT public.has_role(v_uid, 'coordenacao') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _justificativa IS NULL OR length(trim(_justificativa)) < 10 THEN RAISE EXCEPTION 'justificativa obrigatória (mín. 10 caracteres)'; END IF;

  SELECT EXISTS(SELECT 1 FROM public.relatorio_turmas WHERE relatorio_id = _relatorio_id),
         EXISTS(SELECT 1 FROM public.relatorio_presenca WHERE relatorio_id = _relatorio_id)
    INTO v_tt, v_tp;

  IF v_tt AND v_tp THEN RAISE EXCEPTION 'relatório não está vazio (tem turma e presenças). Use a tela de edição.'; END IF;

  DELETE FROM public.relatorio_presenca WHERE relatorio_id = _relatorio_id;
  DELETE FROM public.relatorio_turmas WHERE relatorio_id = _relatorio_id;
  DELETE FROM public.relatorio_fotos WHERE relatorio_id = _relatorio_id;
  DELETE FROM public.relatorios_atividade WHERE id = _relatorio_id;

  INSERT INTO public.audit_log (user_id, acao, tabela, registro_id, justificativa, detalhes)
  VALUES (v_uid, 'excluir_relatorio_vazio', 'relatorios_atividade', _relatorio_id::text, _justificativa,
    jsonb_build_object('tinha_turma', v_tt, 'tinha_presenca', v_tp)::text);

  RETURN jsonb_build_object('ok', true);
END; $$;

REVOKE EXECUTE ON FUNCTION public.reconciliar_duplicados(uuid, uuid[], text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.resolver_presenca_orfa(uuid, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.completar_presenca_faltante(uuid, uuid, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.excluir_relatorio_vazio(uuid, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.reconciliar_duplicados(uuid, uuid[], text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.resolver_presenca_orfa(uuid, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.completar_presenca_faltante(uuid, uuid, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.excluir_relatorio_vazio(uuid, text) TO authenticated, service_role;