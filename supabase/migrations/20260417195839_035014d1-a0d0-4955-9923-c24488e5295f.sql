CREATE OR REPLACE FUNCTION public.get_pendencias_integridade()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_periodo_div int;
  v_deslig_incomp int;
  v_planej_sem_turma int;
  v_sem_nasc int;
  v_turmas_sem_edu int;
  v_turmas_vazias int;
  v_total int;
BEGIN
  -- Período divergente (turma vs participante)
  SELECT count(DISTINCT p.id) INTO v_periodo_div
  FROM participantes p
  JOIN turma_participantes tp ON tp.participante_id = p.id
  JOIN turmas t ON t.id = tp.turma_id
  WHERE p.status = 'ativo' AND t.ativa = true
    AND p.periodo IS NOT NULL AND t.periodo IS NOT NULL
    AND p.periodo::text <> t.periodo::text
    AND p.periodo::text <> 'integral' AND t.periodo::text <> 'integral';

  -- Desligados incompletos (sem data ou motivo)
  SELECT count(*) INTO v_deslig_incomp
  FROM participantes
  WHERE status = 'desligado'
    AND (data_desligamento IS NULL OR motivo_desligamento IS NULL OR motivo_desligamento = '');

  -- Planejamentos sem turma
  SELECT count(*) INTO v_planej_sem_turma
  FROM planejamentos p
  WHERE NOT EXISTS (SELECT 1 FROM planejamento_turmas pt WHERE pt.planejamento_id = p.id);

  -- Ativos sem data de nascimento
  SELECT count(*) INTO v_sem_nasc
  FROM participantes WHERE status = 'ativo' AND data_nascimento IS NULL;

  -- Turmas ativas sem educador
  SELECT count(*) INTO v_turmas_sem_edu
  FROM turmas WHERE ativa = true AND educador_id IS NULL;

  -- Turmas ativas sem participantes
  SELECT count(*) INTO v_turmas_vazias
  FROM turmas t
  WHERE t.ativa = true
    AND NOT EXISTS (
      SELECT 1 FROM turma_participantes tp
      JOIN participantes p ON p.id = tp.participante_id
      WHERE tp.turma_id = t.id AND p.status IN ('ativo','busca_ativa')
    );

  v_total := v_periodo_div + v_deslig_incomp + v_planej_sem_turma + v_sem_nasc + v_turmas_sem_edu + v_turmas_vazias;

  RETURN jsonb_build_object(
    'total', v_total,
    'periodo_divergente', v_periodo_div,
    'desligados_incompletos', v_deslig_incomp,
    'planejamentos_sem_turma', v_planej_sem_turma,
    'sem_data_nascimento', v_sem_nasc,
    'turmas_sem_educador', v_turmas_sem_edu,
    'turmas_vazias', v_turmas_vazias
  );
END;
$$;