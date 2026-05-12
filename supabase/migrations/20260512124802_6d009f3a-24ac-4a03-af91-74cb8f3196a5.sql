
CREATE OR REPLACE FUNCTION public.match_controle_bancario_to_despesas(p_mes text)
RETURNS TABLE(matched int, total int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lanc record;
  v_desp_id uuid;
  v_matched int := 0;
  v_total int := 0;
BEGIN
  -- Reset ordem_prestacao para o mês
  UPDATE public.despesas SET ordem_prestacao = NULL WHERE mes_referencia = p_mes;
  UPDATE public.controle_bancario_lancamentos SET despesa_id = NULL WHERE mes_referencia = p_mes;

  FOR v_lanc IN
    SELECT id, ordem, data, valor, nr_documento
    FROM public.controle_bancario_lancamentos
    WHERE mes_referencia = p_mes
    ORDER BY ordem ASC
  LOOP
    v_total := v_total + 1;
    v_desp_id := NULL;

    -- 1) Match por nr_documento + valor
    IF v_lanc.nr_documento IS NOT NULL AND length(v_lanc.nr_documento) > 0 THEN
      SELECT id INTO v_desp_id
      FROM public.despesas
      WHERE mes_referencia = p_mes
        AND ordem_prestacao IS NULL
        AND ABS(valor - v_lanc.valor) < 0.01
        AND (numero_documento = v_lanc.nr_documento
             OR sit_numero_doc_pagamento = v_lanc.nr_documento)
      LIMIT 1;
    END IF;

    -- 2) Match por valor + data ± 3 dias
    IF v_desp_id IS NULL THEN
      SELECT id INTO v_desp_id
      FROM public.despesas
      WHERE mes_referencia = p_mes
        AND ordem_prestacao IS NULL
        AND ABS(valor - v_lanc.valor) < 0.01
        AND ABS(EXTRACT(EPOCH FROM (data_lancamento::timestamp - v_lanc.data::timestamp))/86400) <= 3
      ORDER BY ABS(EXTRACT(EPOCH FROM (data_lancamento::timestamp - v_lanc.data::timestamp))) ASC
      LIMIT 1;
    END IF;

    -- 3) Fallback: só por valor exato
    IF v_desp_id IS NULL THEN
      SELECT id INTO v_desp_id
      FROM public.despesas
      WHERE mes_referencia = p_mes
        AND ordem_prestacao IS NULL
        AND ABS(valor - v_lanc.valor) < 0.01
      LIMIT 1;
    END IF;

    IF v_desp_id IS NOT NULL THEN
      UPDATE public.despesas SET ordem_prestacao = v_lanc.ordem WHERE id = v_desp_id;
      UPDATE public.controle_bancario_lancamentos SET despesa_id = v_desp_id WHERE id = v_lanc.id;
      v_matched := v_matched + 1;
    END IF;
  END LOOP;

  RETURN QUERY SELECT v_matched, v_total;
END;
$$;
