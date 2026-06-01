
-- View: participantes vinculados em turma cuja faixa não bate com a idade atual
CREATE OR REPLACE VIEW public.vw_participantes_fora_faixa AS
WITH faixa_atual AS (
  SELECT
    p.id,
    p.nome_completo,
    p.bairro_id,
    p.periodo,
    p.data_nascimento,
    extract(year FROM age(current_date, p.data_nascimento))::int AS idade,
    CASE
      WHEN extract(year FROM age(current_date, p.data_nascimento))::int BETWEEN 6 AND 8 THEN '6-8'
      WHEN extract(year FROM age(current_date, p.data_nascimento))::int BETWEEN 9 AND 11 THEN '9-11'
      WHEN extract(year FROM age(current_date, p.data_nascimento))::int BETWEEN 12 AND 17 THEN '12-17'
      WHEN extract(year FROM age(current_date, p.data_nascimento))::int >= 60 THEN 'idosos'
      ELSE NULL
    END AS faixa_atual
  FROM participantes p
  WHERE p.data_nascimento IS NOT NULL
    AND p.status IN ('ativo','busca_ativa')
    AND p.is_teste = false
)
SELECT
  tp.id AS vinculo_id,
  tp.participante_id,
  fa.nome_completo,
  fa.idade,
  fa.faixa_atual,
  fa.bairro_id AS participante_bairro_id,
  fa.periodo AS participante_periodo,
  tp.turma_id,
  t.nome AS turma_nome,
  t.faixa_etaria AS turma_faixa_etaria,
  t.faixas_etarias AS turma_faixas_etarias,
  t.bairro_id AS turma_bairro_id,
  t.periodo AS turma_periodo,
  tp.data_entrada,
  (current_date - tp.data_entrada) AS dias_no_vinculo
FROM turma_participantes tp
JOIN faixa_atual fa ON fa.id = tp.participante_id
JOIN turmas t ON t.id = tp.turma_id
WHERE tp.data_saida IS NULL
  AND t.ativa = true
  AND fa.faixa_atual IS NOT NULL
  AND COALESCE(t.faixa_etaria::text,'') <> fa.faixa_atual
  AND NOT (fa.faixa_atual = ANY(COALESCE(t.faixas_etarias,'{}')));

GRANT SELECT ON public.vw_participantes_fora_faixa TO authenticated;
GRANT SELECT ON public.vw_participantes_fora_faixa TO service_role;

-- RPC: contagem para badges e banner
CREATE OR REPLACE FUNCTION public.contar_participantes_fora_faixa()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT jsonb_build_object(
    'total', COALESCE((SELECT COUNT(DISTINCT participante_id) FROM public.vw_participantes_fora_faixa), 0),
    'vinculos', COALESCE((SELECT COUNT(*) FROM public.vw_participantes_fora_faixa), 0),
    'por_faixa', COALESCE((
      SELECT jsonb_object_agg(faixa_atual, qtd)
      FROM (
        SELECT faixa_atual, COUNT(DISTINCT participante_id) AS qtd
        FROM public.vw_participantes_fora_faixa
        GROUP BY faixa_atual
      ) s
    ), '{}'::jsonb)
  )
$$;

GRANT EXECUTE ON FUNCTION public.contar_participantes_fora_faixa() TO authenticated;
