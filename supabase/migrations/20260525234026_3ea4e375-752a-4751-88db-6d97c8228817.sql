
-- RPC: lista vínculos órfãos (participantes ainda elegíveis presos em turmas inativas)
CREATE OR REPLACE FUNCTION public.get_orfaos_turmas_inativas()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  IF NOT (has_role(auth.uid(), 'coordenacao'::app_role) OR has_role(auth.uid(), 'tecnico'::app_role)) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  SELECT COALESCE(jsonb_agg(turma_obj ORDER BY turma_nome), '[]'::jsonb)
  INTO result
  FROM (
    SELECT
      t.id AS turma_id,
      t.nome AS turma_nome,
      t.periodo::text AS turma_periodo,
      t.faixa_etaria AS turma_faixa,
      t.bairro_id AS turma_bairro_id,
      t.bairro_ids AS turma_bairro_ids,
      jsonb_build_object(
        'turma_id', t.id,
        'turma_nome', t.nome,
        'turma_periodo', t.periodo,
        'turma_faixa', t.faixa_etaria,
        'participantes', jsonb_agg(
          jsonb_build_object(
            'participante_id', p.id,
            'nome', p.nome_completo,
            'status', p.status,
            'bairro_id', p.bairro_id,
            'periodo', p.periodo,
            'data_nascimento', p.data_nascimento,
            'sugestoes', (
              SELECT COALESCE(jsonb_agg(jsonb_build_object('id', td.id, 'nome', td.nome) ORDER BY td.nome), '[]'::jsonb)
              FROM turmas td
              WHERE td.ativa = true
                AND td.id <> t.id
                AND td.periodo = t.periodo
                AND td.faixa_etaria = t.faixa_etaria
                AND (
                  td.bairro_id = p.bairro_id
                  OR p.bairro_id = ANY(COALESCE(td.bairro_ids, ARRAY[]::uuid[]))
                  OR COALESCE(t.bairro_id, '00000000-0000-0000-0000-000000000000'::uuid) = td.bairro_id
                  OR COALESCE(t.bairro_id, '00000000-0000-0000-0000-000000000000'::uuid) = ANY(COALESCE(td.bairro_ids, ARRAY[]::uuid[]))
                )
            )
          ) ORDER BY p.nome_completo
        )
      ) AS turma_obj
    FROM turmas t
    JOIN turma_participantes tp ON tp.turma_id = t.id AND tp.data_saida IS NULL
    JOIN participantes p ON p.id = tp.participante_id AND COALESCE(p.is_teste, false) = false
    WHERE t.ativa = false
      AND p.status::text IN ('ativo','busca_ativa','pendente','incompleto')
    GROUP BY t.id, t.nome, t.periodo, t.faixa_etaria, t.bairro_id, t.bairro_ids
  ) sub;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_orfaos_turmas_inativas() TO authenticated;

-- RPC: aplica resoluções em lote (transferir / saida / desligar) com auditoria
CREATE OR REPLACE FUNCTION public.resolver_orfaos_lote(
  _acoes jsonb,
  _justificativa text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_user_nome text;
  v_acao jsonb;
  v_part uuid;
  v_origem uuid;
  v_destino uuid;
  v_tipo text;
  v_count_transf int := 0;
  v_count_saida int := 0;
  v_count_desl int := 0;
  v_count_skip int := 0;
  v_existing uuid;
BEGIN
  IF NOT has_role(v_user, 'coordenacao'::app_role) THEN
    RAISE EXCEPTION 'Apenas coordenação pode resolver vínculos órfãos';
  END IF;

  SELECT nome INTO v_user_nome FROM profiles WHERE user_id = v_user LIMIT 1;

  FOR v_acao IN SELECT * FROM jsonb_array_elements(_acoes)
  LOOP
    v_part   := (v_acao->>'participante_id')::uuid;
    v_origem := (v_acao->>'turma_origem_id')::uuid;
    v_destino := NULLIF(v_acao->>'turma_destino_id','')::uuid;
    v_tipo   := v_acao->>'acao';

    -- fecha vínculo origem se ainda estiver aberto
    UPDATE turma_participantes
       SET data_saida = CURRENT_DATE
     WHERE participante_id = v_part
       AND turma_id = v_origem
       AND data_saida IS NULL;

    IF NOT FOUND THEN
      v_count_skip := v_count_skip + 1;
      CONTINUE;
    END IF;

    IF v_tipo = 'transferir' THEN
      IF v_destino IS NULL THEN
        RAISE EXCEPTION 'Turma destino obrigatória para transferir (participante %)', v_part;
      END IF;

      -- evita duplicar vínculo ativo
      SELECT id INTO v_existing
        FROM turma_participantes
       WHERE participante_id = v_part AND turma_id = v_destino AND data_saida IS NULL
       LIMIT 1;

      IF v_existing IS NULL THEN
        INSERT INTO turma_participantes (participante_id, turma_id)
        VALUES (v_part, v_destino);
      END IF;

      INSERT INTO participante_transferencias (participante_id, turma_origem_id, turma_destino_id, motivo)
      VALUES (v_part, v_origem, v_destino, 'Realocação por desativação de turma');

      INSERT INTO audit_log (user_id, user_nome, acao, tabela, registro_id, detalhes, justificativa)
      VALUES (v_user, v_user_nome, 'resolver_orfao_transferir', 'turma_participantes', v_part::text,
              format('Transferido de turma %s para %s', v_origem, v_destino), _justificativa);

      v_count_transf := v_count_transf + 1;

    ELSIF v_tipo = 'saida' THEN
      INSERT INTO audit_log (user_id, user_nome, acao, tabela, registro_id, detalhes, justificativa)
      VALUES (v_user, v_user_nome, 'resolver_orfao_saida', 'turma_participantes', v_part::text,
              format('Saída sem transferência da turma %s', v_origem), _justificativa);
      v_count_saida := v_count_saida + 1;

    ELSIF v_tipo = 'desligar' THEN
      UPDATE participantes
         SET status = 'desligado'::status_participante,
             data_desligamento = CURRENT_DATE,
             desligado_registrado_em = now(),
             motivo_desligamento = COALESCE(NULLIF(motivo_desligamento,''), 'Encerramento de turma sem realocação'),
             justificativa_desligamento = COALESCE(NULLIF(justificativa_desligamento,''), _justificativa)
       WHERE id = v_part;

      INSERT INTO audit_log (user_id, user_nome, acao, tabela, registro_id, detalhes, justificativa)
      VALUES (v_user, v_user_nome, 'resolver_orfao_desligar', 'participantes', v_part::text,
              format('Desligado por encerramento da turma %s', v_origem), _justificativa);
      v_count_desl := v_count_desl + 1;
    ELSE
      RAISE EXCEPTION 'Ação inválida: %', v_tipo;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'transferidos', v_count_transf,
    'saidas', v_count_saida,
    'desligados', v_count_desl,
    'ignorados', v_count_skip
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolver_orfaos_lote(jsonb, text) TO authenticated;
