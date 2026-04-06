
CREATE OR REPLACE FUNCTION public.find_fuzzy_participant(_nome text, _data_nascimento date)
RETURNS TABLE(id uuid, nome_completo text, sim numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    p.nome_completo,
    round(similarity(p.nome_completo, _nome)::numeric, 2) AS sim
  FROM participantes p
  WHERE p.data_nascimento = _data_nascimento
    AND similarity(p.nome_completo, _nome) > 0.5
  ORDER BY sim DESC
  LIMIT 3;
$$;
