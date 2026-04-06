CREATE TABLE public.despesa_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  despesa_id uuid NOT NULL,
  campo text NOT NULL,
  valor_anterior text,
  valor_novo text,
  alterado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.despesa_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated select despesa_historico"
  ON public.despesa_historico FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Coord ou tecnico insert despesa_historico"
  ON public.despesa_historico FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'coordenacao') OR has_role(auth.uid(), 'tecnico'));