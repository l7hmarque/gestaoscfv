
CREATE TABLE public.cronograma_disponibilidade (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  dia_semana TEXT NOT NULL,
  periodo TEXT NOT NULL DEFAULT 'manha',
  disponivel BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (profile_id, dia_semana, periodo)
);

ALTER TABLE public.cronograma_disponibilidade ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated select cronograma_disponibilidade"
  ON public.cronograma_disponibilidade FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Coord ou tecnico manage cronograma_disponibilidade"
  ON public.cronograma_disponibilidade FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'coordenacao'::app_role) OR has_role(auth.uid(), 'tecnico'::app_role))
  WITH CHECK (has_role(auth.uid(), 'coordenacao'::app_role) OR has_role(auth.uid(), 'tecnico'::app_role));
