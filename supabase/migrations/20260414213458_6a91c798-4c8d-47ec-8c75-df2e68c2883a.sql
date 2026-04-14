ALTER TABLE public.cronograma_cenarios
ADD COLUMN regras_frequencia jsonb DEFAULT '[]'::jsonb;