DROP TABLE IF EXISTS public.despesa_historico CASCADE;
DROP TABLE IF EXISTS public.estornos CASCADE;
DROP TABLE IF EXISTS public.parcelas_financeiras CASCADE;
DROP TABLE IF EXISTS public.despesas CASCADE;
DROP TABLE IF EXISTS public.orcamento_precos CASCADE;
DROP TABLE IF EXISTS public.orcamento_cotacoes CASCADE;
DROP TABLE IF EXISTS public.orcamento_itens CASCADE;
DROP TABLE IF EXISTS public.orcamentos CASCADE;
DROP TABLE IF EXISTS public.categorias_financeiras CASCADE;

DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT polname FROM pg_policy
    WHERE polrelid = 'storage.objects'::regclass
      AND pg_get_expr(polqual, polrelid) ILIKE '%prestacao-contas%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.polname);
  END LOOP;
END $$;