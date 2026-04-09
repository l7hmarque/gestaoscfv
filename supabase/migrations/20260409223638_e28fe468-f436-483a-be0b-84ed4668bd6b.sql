
-- Table for general system configuration (key-value)
CREATE TABLE public.configuracoes_gerais (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chave text NOT NULL UNIQUE,
  valor text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.configuracoes_gerais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated select configuracoes"
  ON public.configuracoes_gerais FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Coordenacao manage configuracoes"
  ON public.configuracoes_gerais FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'coordenacao'::app_role))
  WITH CHECK (has_role(auth.uid(), 'coordenacao'::app_role));

CREATE TRIGGER update_configuracoes_updated_at
  BEFORE UPDATE ON public.configuracoes_gerais
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add goal columns to bairros
ALTER TABLE public.bairros
  ADD COLUMN meta_criancas_manha integer DEFAULT 0,
  ADD COLUMN meta_criancas_tarde integer DEFAULT 0,
  ADD COLUMN meta_idosos integer DEFAULT 0;
