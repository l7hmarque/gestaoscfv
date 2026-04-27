
-- Atualiza enqueue_biblioteca_doc para preservar status/storage_path em conflito
CREATE OR REPLACE FUNCTION public.enqueue_biblioteca_doc(
  _tipo text,
  _origem_id uuid
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_titulo text;
  v_data date;
  v_educador_id uuid;
  v_educador_nome text;
  v_turma_nome text;
BEGIN
  IF _tipo = 'relatorio' THEN
    SELECT
      COALESCE(r.nome_atividade, r.tipo_atividade_detalhe, 'Relatório'),
      r.data,
      r.educador_id,
      pr.nome,
      (SELECT string_agg(t.nome, ', ') FROM relatorio_turmas rt JOIN turmas t ON t.id = rt.turma_id WHERE rt.relatorio_id = r.id)
    INTO v_titulo, v_data, v_educador_id, v_educador_nome, v_turma_nome
    FROM relatorios_atividade r
    LEFT JOIN profiles pr ON pr.id = r.educador_id
    WHERE r.id = _origem_id;
  ELSIF _tipo = 'planejamento' THEN
    SELECT
      COALESCE(p.titulo, 'Planejamento'),
      COALESCE(p.data_aplicacao, current_date),
      p.educador_id,
      pr.nome,
      (SELECT string_agg(t.nome, ', ') FROM planejamento_turmas pt JOIN turmas t ON t.id = pt.turma_id WHERE pt.planejamento_id = p.id)
    INTO v_titulo, v_data, v_educador_id, v_educador_nome, v_turma_nome
    FROM planejamentos p
    LEFT JOIN profiles pr ON pr.id = p.educador_id
    WHERE p.id = _origem_id;
  ELSE
    RAISE EXCEPTION 'tipo invalido';
  END IF;

  IF v_titulo IS NULL THEN
    RAISE EXCEPTION 'origem nao encontrada';
  END IF;

  INSERT INTO public.biblioteca_documentos (
    tipo, origem_id, titulo, data_referencia, ano, mes,
    educador_id, educador_nome, turma_nome, storage_path, status
  ) VALUES (
    _tipo, _origem_id, v_titulo, v_data,
    EXTRACT(YEAR FROM v_data)::int, EXTRACT(MONTH FROM v_data)::int,
    v_educador_id, v_educador_nome, v_turma_nome,
    _tipo || 's/' || EXTRACT(YEAR FROM v_data)::int || '/' ||
      LPAD(EXTRACT(MONTH FROM v_data)::text, 2, '0') || '/' ||
      _origem_id::text || '.docx',
    'pendente'
  )
  ON CONFLICT (tipo, origem_id) DO UPDATE SET
    titulo = EXCLUDED.titulo,
    data_referencia = EXCLUDED.data_referencia,
    ano = EXCLUDED.ano,
    mes = EXCLUDED.mes,
    educador_id = EXCLUDED.educador_id,
    educador_nome = EXCLUDED.educador_nome,
    turma_nome = EXCLUDED.turma_nome,
    updated_at = now()
    -- IMPORTANTE: preserva storage_path, status, gerado_em e erro_mensagem
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- Alimentar retroativamente: registrar todos os relatórios e planejamentos que ainda não têm entrada
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT id FROM relatorios_atividade
    WHERE NOT EXISTS (
      SELECT 1 FROM biblioteca_documentos b
      WHERE b.tipo = 'relatorio' AND b.origem_id = relatorios_atividade.id
    )
  LOOP
    PERFORM public.enqueue_biblioteca_doc('relatorio', r.id);
  END LOOP;

  FOR r IN
    SELECT id FROM planejamentos
    WHERE NOT EXISTS (
      SELECT 1 FROM biblioteca_documentos b
      WHERE b.tipo = 'planejamento' AND b.origem_id = planejamentos.id
    )
  LOOP
    PERFORM public.enqueue_biblioteca_doc('planejamento', r.id);
  END LOOP;
END $$;
