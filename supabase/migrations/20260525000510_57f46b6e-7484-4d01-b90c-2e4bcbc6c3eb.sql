CREATE OR REPLACE FUNCTION public.recalcular_vinculos_turmas()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_adicionados int := 0;
  v_removidos int := 0;
  v_sem_oficina int := 0;
  v_sem_oficina_lista jsonb := '[]'::jsonb;
  rec record;
  ofic record;
  v_faixa text;
  v_idade int;
  v_turma_alvo uuid;
  v_ja_vinculado uuid;
  v_oficinas_compativeis int;
BEGIN
  FOR rec IN
    SELECT p.id, p.nome_completo, p.bairro_id, p.periodo, p.data_nascimento
    FROM participantes p
    WHERE p.status IN ('ativo','busca_ativa') AND p.is_teste = false
  LOOP
    -- faixa etária
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

    IF rec.periodo IS NULL OR rec.bairro_id IS NULL OR v_faixa IS NULL THEN
      CONTINUE;
    END IF;

    v_oficinas_compativeis := 0;

    -- itera por oficina distinta
    FOR ofic IN
      SELECT DISTINCT t.oficina
      FROM turmas t
      WHERE t.ativa = true
        AND t.oficina IS NOT NULL
        AND btrim(t.oficina) <> ''
    LOOP
      -- escolhe a melhor turma desta oficina para o participante
      SELECT t.id INTO v_turma_alvo
      FROM turmas t
      WHERE t.ativa = true
        AND t.oficina = ofic.oficina
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
        CASE WHEN t.bairro_id = rec.bairro_id THEN 0 ELSE 1 END,
        CASE WHEN t.faixa_etaria::text = v_faixa THEN 0 ELSE 1 END,
        t.nome
      LIMIT 1;

      IF v_turma_alvo IS NULL THEN
        CONTINUE;
      END IF;

      v_oficinas_compativeis := v_oficinas_compativeis + 1;

      -- já vinculado em alguma turma dessa oficina?
      SELECT tp.turma_id INTO v_ja_vinculado
      FROM turma_participantes tp
      JOIN turmas t2 ON t2.id = tp.turma_id
      WHERE tp.participante_id = rec.id
        AND t2.oficina = ofic.oficina
        AND tp.data_saida IS NULL
      LIMIT 1;

      IF v_ja_vinculado IS NULL THEN
        INSERT INTO turma_participantes (participante_id, turma_id, data_entrada)
        VALUES (rec.id, v_turma_alvo, current_date)
        ON CONFLICT DO NOTHING;
        v_adicionados := v_adicionados + 1;
      END IF;
    END LOOP;

    IF v_oficinas_compativeis = 0 THEN
      v_sem_oficina := v_sem_oficina + 1;
      v_sem_oficina_lista := v_sem_oficina_lista || jsonb_build_object(
        'id', rec.id, 'nome', rec.nome_completo,
        'periodo', rec.periodo, 'bairro_id', rec.bairro_id, 'faixa', v_faixa
      );
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'vinculos_adicionados', v_adicionados,
    'vinculos_removidos', v_removidos,
    'sem_oficina_compativel', v_sem_oficina,
    'sem_oficina_lista', v_sem_oficina_lista
  );
END;
$function$;