CREATE OR REPLACE FUNCTION public.recalcular_vinculos_turmas()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
    WHERE p.status IN ('ativo','busca_ativa')
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
$$;