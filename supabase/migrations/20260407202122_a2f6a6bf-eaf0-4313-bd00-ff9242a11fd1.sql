
-- Add serial numero to recados
ALTER TABLE public.recados ADD COLUMN numero serial;

-- Create chamadas_assinadas table
CREATE TABLE public.chamadas_assinadas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  turma_id uuid REFERENCES public.turmas(id) ON DELETE CASCADE NOT NULL,
  mes_referencia text NOT NULL,
  arquivo_url text NOT NULL,
  uploaded_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.chamadas_assinadas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated select chamadas_assinadas" ON public.chamadas_assinadas
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Non-visitante insert chamadas_assinadas" ON public.chamadas_assinadas
  FOR INSERT TO authenticated
  WITH CHECK (NOT has_role(auth.uid(), 'visitante'::app_role));

CREATE POLICY "Coord delete chamadas_assinadas" ON public.chamadas_assinadas
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'coordenacao'::app_role));
