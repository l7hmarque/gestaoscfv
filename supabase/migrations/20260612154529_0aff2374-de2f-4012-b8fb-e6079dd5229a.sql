
CREATE OR REPLACE FUNCTION public.auditar_datas_invertidas()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_data_futura jsonb;
  v_entrada_apos_saida jsonb;
  v_nasc_apos_matricula jsonb;
  v_clusters jsonb;
  v_ambiguas_participantes jsonb;
  v_relatorios_futuros jsonb;
  v_transf_futuras jsonb;
  v_totais jsonb;
BEGIN
  IF v_uid IS NULL OR NOT public.has_role(v_uid, 'coordenacao'::app_role) THEN
    RETURN jsonb_build_object('error', 'forbidden');
  END IF;

  -- 1) Datas de desligamento no futuro (caso Sofia)
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', id, 'nome', nome_completo, 'data_atual', data_desligamento,
    'data_proposta',
      CASE WHEN extract(day FROM data_desligamento)::int <= 12
        THEN make_date(extract(year FROM data_desligamento)::int,
                       extract(day FROM data_desligamento)::int,
                       extract(month FROM data_desligamento)::int)
        ELSE NULL END,
    'updated_at', updated_at,
    'status', status::text,
    'motivo_desligamento', motivo_desligamento
  ) ORDER BY updated_at, nome_completo), '[]'::jsonb)
  INTO v_data_futura
  FROM participantes
  WHERE data_desligamento > current_date
    AND is_teste = false;

  -- 2) data_entrada > data_saida em turma_participantes
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', tp.id,
    'participante', p.nome_completo,
    'turma', t.nome,
    'data_entrada', tp.data_entrada,
    'data_saida', tp.data_saida
  ) ORDER BY tp.data_entrada), '[]'::jsonb)
  INTO v_entrada_apos_saida
  FROM turma_participantes tp
  JOIN participantes p ON p.id = tp.participante_id
  JOIN turmas t ON t.id = tp.turma_id
  WHERE tp.data_saida IS NOT NULL
    AND tp.data_entrada > tp.data_saida;

  -- 3) data_nascimento após data_matricula
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', id, 'nome', nome_completo,
    'data_nascimento', data_nascimento,
    'data_matricula', data_matricula
  ) ORDER BY data_matricula), '[]'::jsonb)
  INTO v_nasc_apos_matricula
  FROM participantes
  WHERE data_nascimento IS NOT NULL
    AND data_matricula IS NOT NULL
    AND data_nascimento > data_matricula
    AND is_teste = false;

  -- 4) Clusters de updated_at em participantes (suspeito de import em lote)
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'updated_at', updated_at,
    'qtd', qtd
  ) ORDER BY qtd DESC), '[]'::jsonb)
  INTO v_clusters
  FROM (
    SELECT updated_at, count(*) AS qtd
    FROM participantes
    WHERE is_teste = false
      AND data_desligamento IS NOT NULL
    GROUP BY updated_at
    HAVING count(*) >= 5
    ORDER BY count(*) DESC
    LIMIT 20
  ) s;

  -- 5) Participantes desligados em cluster suspeito com data ambígua (dia<=12 e mes<=12)
  --    e sem entrada em audit_log para o desligamento
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', p.id,
    'nome', p.nome_completo,
    'data_atual', p.data_desligamento,
    'data_proposta',
      CASE WHEN extract(day FROM p.data_desligamento)::int <= 12
                AND extract(month FROM p.data_desligamento)::int <= 12
                AND extract(day FROM p.data_desligamento)::int <> extract(month FROM p.data_desligamento)::int
        THEN make_date(extract(year FROM p.data_desligamento)::int,
                       extract(day FROM p.data_desligamento)::int,
                       extract(month FROM p.data_desligamento)::int)
        ELSE NULL END,
    'updated_at', p.updated_at,
    'motivo_desligamento', p.motivo_desligamento,
    'tem_audit', EXISTS(
      SELECT 1 FROM audit_log al
      WHERE al.tabela = 'participantes'
        AND al.registro_id = p.id
        AND al.acao ILIKE '%deslig%'
    )
  ) ORDER BY p.updated_at, p.nome_completo), '[]'::jsonb)
  INTO v_ambiguas_participantes
  FROM participantes p
  WHERE p.is_teste = false
    AND p.data_desligamento IS NOT NULL
    AND p.data_desligamento <= current_date  -- exclui as já cobertas em (1)
    AND extract(day FROM p.data_desligamento)::int <= 12
    AND extract(month FROM p.data_desligamento)::int <= 12
    AND extract(day FROM p.data_desligamento)::int <> extract(month FROM p.data_desligamento)::int
    AND p.updated_at IN (
      SELECT updated_at FROM participantes
      WHERE is_teste = false AND data_desligamento IS NOT NULL
      GROUP BY updated_at HAVING count(*) >= 5
    );

  -- 6) Relatórios com data futura
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', id, 'titulo', titulo, 'data', data, 'created_at', created_at
  ) ORDER BY data), '[]'::jsonb)
  INTO v_relatorios_futuros
  FROM relatorios_atividade
  WHERE data > current_date;

  -- 7) Transferências com data futura > 30 dias (provável inversão)
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', pt.id,
    'participante', p.nome_completo,
    'data_transferencia', pt.data_transferencia,
    'created_at', pt.created_at
  ) ORDER BY pt.data_transferencia), '[]'::jsonb)
  INTO v_transf_futuras
  FROM participante_transferencias pt
  JOIN participantes p ON p.id = pt.participante_id
  WHERE pt.data_transferencia > (current_date + interval '30 days');

  v_totais := jsonb_build_object(
    'desligamentos_futuros', jsonb_array_length(v_data_futura),
    'entrada_apos_saida', jsonb_array_length(v_entrada_apos_saida),
    'nasc_apos_matricula', jsonb_array_length(v_nasc_apos_matricula),
    'clusters_import', jsonb_array_length(v_clusters),
    'ambiguas_em_cluster', jsonb_array_length(v_ambiguas_participantes),
    'relatorios_futuros', jsonb_array_length(v_relatorios_futuros),
    'transferencias_futuras', jsonb_array_length(v_transf_futuras)
  );

  RETURN jsonb_build_object(
    'gerado_em', now(),
    'totais', v_totais,
    'desligamentos_futuros', v_data_futura,
    'entrada_apos_saida', v_entrada_apos_saida,
    'nasc_apos_matricula', v_nasc_apos_matricula,
    'clusters_import', v_clusters,
    'ambiguas_em_cluster', v_ambiguas_participantes,
    'relatorios_futuros', v_relatorios_futuros,
    'transferencias_futuras', v_transf_futuras
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.auditar_datas_invertidas() TO authenticated;
