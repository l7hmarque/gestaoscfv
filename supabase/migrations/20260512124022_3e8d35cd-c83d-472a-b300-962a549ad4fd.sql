
ALTER TABLE public.despesas ADD COLUMN IF NOT EXISTS ordem_prestacao integer;
CREATE INDEX IF NOT EXISTS idx_despesas_ordem_prestacao ON public.despesas (mes_referencia, ordem_prestacao);

CREATE TABLE IF NOT EXISTS public.controle_bancario_lancamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mes_referencia text NOT NULL,
  data date NOT NULL,
  descricao text NOT NULL,
  valor numeric(14,2) NOT NULL,
  nr_documento text,
  ordem integer NOT NULL,
  despesa_id uuid REFERENCES public.despesas(id) ON DELETE SET NULL,
  origem_arquivo text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);
CREATE INDEX IF NOT EXISTS idx_cb_mes ON public.controle_bancario_lancamentos (mes_referencia, ordem);

ALTER TABLE public.controle_bancario_lancamentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cb_select ON public.controle_bancario_lancamentos;
CREATE POLICY cb_select ON public.controle_bancario_lancamentos
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS cb_modify ON public.controle_bancario_lancamentos;
CREATE POLICY cb_modify ON public.controle_bancario_lancamentos
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'coordenacao'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'coordenacao'::app_role));
