ALTER TABLE public.turmas ADD COLUMN faixas_etarias text[] DEFAULT '{}';
ALTER TABLE public.turmas ADD COLUMN bairro_ids uuid[] DEFAULT '{}';