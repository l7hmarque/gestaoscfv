CREATE OR REPLACE FUNCTION public.get_pendencias_integridade_detalhes()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_periodo_div jsonb;
  v_deslig_incomp jsonb;
  v_planej_sem_turma jsonb;
  v_sem_nasc jsonb;
  v_turmas_sem_edu jsonb;
  v_turmas_vazias jsonb;
BEGIN
  -- Período divergente (turma vs participante)
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'participante_id', p.id,
    'participante_nome', p.nome_completo,
    'participante_periodo', p.periodo,
    'turma_id', t.id,
    'turma_nome', t.nome,
    'turma_periodo', t.periodo
  )), '[]'::jsonb) INTO v_periodo_div
  FROM participantes p
  JOIN turma_participantes tp ON tp.participante_id = p.id
  JOIN turmas t ON t.id = tp.turma_id
  WHERE p.status = 'ativo' AND t.ativa = true
    AND p.periodo IS NOT NULL AND t.periodo IS NOT NULL
    AND p.periodo::text <> t.periodo::text
    AND p.periodo::text <> 'integral' AND t.periodo::text <> 'integral';

  -- Desligados incompletos
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', id,
    'nome', nome_completo,
    'data_desligamento', data_desligamento,
    'motivo_desligamento', motivo_desligamento
  )), '[]'::jsonb) INTO v_deslig_incomp
  FROM participantes
  WHERE status = 'desligado'
    AND (data_desligamento IS NULL OR motivo_desligamento IS NULL OR motivo_desligamento = '');

  -- Planejamentos sem turma
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id,
    'titulo', p.titulo,
    'data_aplicacao', p.data_aplicacao,
    'educador_nome', pr.nome
  )), '[]'::jsonb) INTO v_planej_sem_turma
  FROM planejamentos p
  LEFT JOIN profiles pr ON pr.id = p.educador_id
  WHERE NOT EXISTS (SELECT 1 FROM planejamento_turmas pt WHERE pt.planejamento_id = p.id);

  -- Ativos sem data de nascimento
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', id,
    'nome', nome_completo,
    'periodo', periodo
  )), '[]'::jsonb) INTO v_sem_nasc
  FROM participantes WHERE status = 'ativo' AND data_nascimento IS NULL;

  -- Turmas sem educador
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', id,
    'nome', nome,
    'periodo', periodo,
    'faixa_etaria', faixa_etaria
  )), '[]'::jsonb) INTO v_turmas_sem_edu
  FROM turmas WHERE ativa = true AND educador_id IS NULL;

  -- Turmas vazias
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', t.id,
    'nome', t.nome,
    'periodo', t.periodo,
    'faixa_etaria', t.faixa_etaria
  )), '[]'::jsonb) INTO v_turmas_vazias
  FROM turmas t
  WHERE t.ativa = true
    AND NOT EXISTS (
      SELECT 1 FROM turma_participantes tp
      JOIN participantes p ON p.id = tp.participante_id
      WHERE tp.turma_id = t.id AND p.status IN ('ativo','busca_ativa')
    );

  RETURN jsonb_build_object(
    'periodo_divergente', v_periodo_div,
    'desligados_incompletos', v_deslig_incomp,
    'planejamentos_sem_turma', v_planej_sem_turma,
    'sem_data_nascimento', v_sem_nasc,
    'turmas_sem_educador', v_turmas_sem_edu,
    'turmas_vazias', v_turmas_vazias
  );
END;
$$;