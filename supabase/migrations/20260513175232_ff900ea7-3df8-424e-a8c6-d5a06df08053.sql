DROP TABLE IF EXISTS public.documentos_prestacao_contas CASCADE;

DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND (qual LIKE '%prestacao-contas%' OR with_check LIKE '%prestacao-contas%')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
  END LOOP;
END$$;