CREATE OR REPLACE FUNCTION public.recalcular_busca_ativa(_participante_ids uuid[] DEFAULT NULL::uuid[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Classificação de Busca Ativa agora é 100% manual.
  -- Função mantida como no-op para compatibilidade com chamadas antigas.
  RETURN jsonb_build_object(
    'ok', true,
    'manual_only', true,
    'movidos_para_busca_ativa', 0,
    'retornados_para_ativo', 0
  );
END;
$$;