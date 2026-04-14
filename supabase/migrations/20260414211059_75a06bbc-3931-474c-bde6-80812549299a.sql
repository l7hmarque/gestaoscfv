
CREATE TABLE public.avisos_sistema (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  mensagem text NOT NULL,
  tipo text NOT NULL DEFAULT 'info',
  ativo boolean NOT NULL DEFAULT true,
  criado_por uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone
);

ALTER TABLE public.avisos_sistema ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated select avisos_sistema"
  ON public.avisos_sistema FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Coordenacao manage avisos_sistema"
  ON public.avisos_sistema FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'coordenacao'::app_role))
  WITH CHECK (has_role(auth.uid(), 'coordenacao'::app_role));
