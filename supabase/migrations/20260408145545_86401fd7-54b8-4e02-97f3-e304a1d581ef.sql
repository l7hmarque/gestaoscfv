ALTER TABLE public.relatorio_presenca 
  ALTER COLUMN participante_id DROP NOT NULL,
  ADD COLUMN nome_avulso text;