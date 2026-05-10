ALTER TABLE public.relatorios_atividade
  ADD COLUMN IF NOT EXISTS gdoc_id text,
  ADD COLUMN IF NOT EXISTS gdoc_url text;