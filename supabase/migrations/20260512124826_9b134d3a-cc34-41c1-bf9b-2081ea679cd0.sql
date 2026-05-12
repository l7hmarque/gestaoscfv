REVOKE EXECUTE ON FUNCTION public.match_controle_bancario_to_despesas(text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.match_controle_bancario_to_despesas(text) TO authenticated;