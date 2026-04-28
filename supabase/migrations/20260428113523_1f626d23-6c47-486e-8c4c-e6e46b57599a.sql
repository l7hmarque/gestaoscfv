REVOKE EXECUTE ON FUNCTION public.is_projeto_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.projeto_member_papel(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.criar_projeto(text, text, text, date, date, uuid[]) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_projeto_stats(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_projeto_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.projeto_member_papel(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.criar_projeto(text, text, text, date, date, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_projeto_stats(uuid) TO authenticated;