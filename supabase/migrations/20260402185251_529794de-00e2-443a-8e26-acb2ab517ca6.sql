
-- Add tipo_atividade array and tipo_atividade_detalhe to planejamentos
ALTER TABLE public.planejamentos ADD COLUMN IF NOT EXISTS tipo_atividade text[] DEFAULT '{}';
ALTER TABLE public.planejamentos ADD COLUMN IF NOT EXISTS tipo_atividade_detalhe text;

-- Add oficina to turmas
ALTER TABLE public.turmas ADD COLUMN IF NOT EXISTS oficina text;

-- Convert relatorios_atividade.tipo_atividade from text to text[]
ALTER TABLE public.relatorios_atividade ADD COLUMN IF NOT EXISTS tipo_atividade_arr text[] DEFAULT '{}';
UPDATE public.relatorios_atividade SET tipo_atividade_arr = CASE WHEN tipo_atividade IS NOT NULL AND tipo_atividade != '' THEN ARRAY[tipo_atividade] ELSE '{}' END;
ALTER TABLE public.relatorios_atividade DROP COLUMN tipo_atividade;
ALTER TABLE public.relatorios_atividade RENAME COLUMN tipo_atividade_arr TO tipo_atividade;

-- Add tipo_atividade_detalhe to relatorios_atividade
ALTER TABLE public.relatorios_atividade ADD COLUMN IF NOT EXISTS tipo_atividade_detalhe text;
