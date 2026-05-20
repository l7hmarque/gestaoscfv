
REVOKE EXECUTE ON FUNCTION public.has_module_access(uuid, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.default_module_level(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_my_module_access() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.has_module_access(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.default_module_level(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_module_access() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated;
