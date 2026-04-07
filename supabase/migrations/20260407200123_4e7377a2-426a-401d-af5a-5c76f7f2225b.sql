
CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  user_nome text,
  acao text NOT NULL,
  tabela text NOT NULL,
  registro_id text,
  detalhes text,
  justificativa text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coordenacao select audit_log" ON public.audit_log
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'coordenacao'::app_role));

CREATE POLICY "Authenticated insert audit_log" ON public.audit_log
  FOR INSERT TO authenticated
  WITH CHECK (true);
