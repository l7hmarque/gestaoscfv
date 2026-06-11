
CREATE OR REPLACE FUNCTION public.auditar_integridade_presencas(
  _de date DEFAULT (now() - interval '60 days')::date,
  _ate date DEFAULT now()::date
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_duplicados jsonb;
  v_faltantes jsonb;
  v_orfas jsonb;
  v_sem_turma jsonb;
  v_sem_presenca jsonb;
BEGIN
  WITH pares AS (
    SELECT rt.turma_id, ra.data,
           COUNT(DISTINCT ra.id) AS qtd_relatorios,
           array_agg(DISTINCT ra.id) AS relatorio_ids
    FROM public.relatorios_atividade ra
    JOIN public.relatorio_turmas rt ON rt.relatorio_id = ra.id
    WHERE ra.data BETWEEN _de AND _ate
    GROUP BY rt.turma_id, ra.data
    HAVING COUNT(DISTINCT ra.id) > 1
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'turma_id', p.turma_id, 'turma_nome', t.nome, 'data', p.data,
    'qtd_relatorios', p.qtd_relatorios, 'relatorio_ids', p.relatorio_ids
  ) ORDER BY p.data DESC), '[]'::jsonb)
  INTO v_duplicados FROM pares p LEFT JOIN public.turmas t ON t.id = p.turma_id;

  WITH rels AS (
    SELECT ra.id AS relatorio_id, ra.data, rt.turma_id
    FROM public.relatorios_atividade ra
    JOIN public.relatorio_turmas rt ON rt.relatorio_id = ra.id
    WHERE ra.data BETWEEN _de AND _ate
  ),
  esperados AS (
    SELECT DISTINCT r.relatorio_id, r.data, r.turma_id, tp.participante_id
    FROM rels r
    JOIN public.turma_participantes tp ON tp.turma_id = r.turma_id
    WHERE tp.data_entrada <= r.data
      AND (tp.data_saida IS NULL OR tp.data_saida > r.data)
  ),
  faltantes AS (
    SELECT e.relatorio_id, e.data, e.turma_id, e.participante_id
    FROM esperados e
    LEFT JOIN public.relatorio_presenca rp
      ON rp.relatorio_id = e.relatorio_id AND rp.participante_id = e.participante_id
    WHERE rp.id IS NULL
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'relatorio_id', f.relatorio_id, 'data', f.data, 'turma_id', f.turma_id,
    'turma_nome', t.nome, 'participante_id', f.participante_id,
    'participante_nome', p.nome_completo, 'participante_status', p.status
  ) ORDER BY f.data DESC, t.nome, p.nome_completo), '[]'::jsonb)
  INTO v_faltantes
  FROM faltantes f
  LEFT JOIN public.turmas t ON t.id = f.turma_id
  LEFT JOIN public.participantes p ON p.id = f.participante_id;

  -- Órfã: participante não tem NENHUM vínculo com a turma (ignora datas para evitar
  -- falsos positivos de backfill histórico). Só conta se a turma tem outros membros.
  WITH rels AS (
    SELECT ra.id AS relatorio_id, ra.data, rt.turma_id
    FROM public.relatorios_atividade ra
    JOIN public.relatorio_turmas rt ON rt.relatorio_id = ra.id
    WHERE ra.data BETWEEN _de AND _ate
  ),
  orfas AS (
    SELECT rp.id AS presenca_id, rp.relatorio_id, rp.participante_id, r.data, r.turma_id
    FROM public.relatorio_presenca rp
    JOIN rels r ON r.relatorio_id = rp.relatorio_id
    WHERE rp.participante_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.turma_participantes tp
        WHERE tp.turma_id = r.turma_id AND tp.participante_id = rp.participante_id
      )
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'presenca_id', o.presenca_id, 'relatorio_id', o.relatorio_id, 'data', o.data,
    'turma_id', o.turma_id, 'turma_nome', t.nome,
    'participante_id', o.participante_id, 'participante_nome', p.nome_completo
  ) ORDER BY o.data DESC), '[]'::jsonb)
  INTO v_orfas
  FROM orfas o
  LEFT JOIN public.turmas t ON t.id = o.turma_id
  LEFT JOIN public.participantes p ON p.id = o.participante_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'relatorio_id', ra.id, 'data', ra.data, 'nome_atividade', ra.nome_atividade
  ) ORDER BY ra.data DESC), '[]'::jsonb)
  INTO v_sem_turma
  FROM public.relatorios_atividade ra
  WHERE ra.data BETWEEN _de AND _ate
    AND NOT EXISTS (SELECT 1 FROM public.relatorio_turmas rt WHERE rt.relatorio_id = ra.id);

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'relatorio_id', ra.id, 'data', ra.data, 'nome_atividade', ra.nome_atividade
  ) ORDER BY ra.data DESC), '[]'::jsonb)
  INTO v_sem_presenca
  FROM public.relatorios_atividade ra
  WHERE ra.data BETWEEN _de AND _ate
    AND NOT EXISTS (SELECT 1 FROM public.relatorio_presenca rp WHERE rp.relatorio_id = ra.id);

  RETURN jsonb_build_object(
    'periodo', jsonb_build_object('de', _de, 'ate', _ate),
    'pares_duplicados', v_duplicados,
    'presencas_faltantes', v_faltantes,
    'presencas_orfas', v_orfas,
    'relatorios_sem_turma', v_sem_turma,
    'relatorios_sem_presenca', v_sem_presenca,
    'resumo', jsonb_build_object(
      'pares_duplicados', jsonb_array_length(v_duplicados),
      'presencas_faltantes', jsonb_array_length(v_faltantes),
      'presencas_orfas', jsonb_array_length(v_orfas),
      'relatorios_sem_turma', jsonb_array_length(v_sem_turma),
      'relatorios_sem_presenca', jsonb_array_length(v_sem_presenca)
    )
  );
END;
$$;
