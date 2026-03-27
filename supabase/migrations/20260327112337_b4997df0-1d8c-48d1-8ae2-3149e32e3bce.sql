
-- Add professional fields to profiles
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS cpf text,
  ADD COLUMN IF NOT EXISTS rg text,
  ADD COLUMN IF NOT EXISTS rg_data_expedicao date,
  ADD COLUMN IF NOT EXISTS rg_orgao_expedidor text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS registro_profissional text,
  ADD COLUMN IF NOT EXISTS endereco text,
  ADD COLUMN IF NOT EXISTS telefone text,
  ADD COLUMN IF NOT EXISTS data_inicio date;

-- Add horario fields to pontos_transporte
ALTER TABLE public.pontos_transporte
  ADD COLUMN IF NOT EXISTS ativo boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS horario_manha text,
  ADD COLUMN IF NOT EXISTS horario_tarde text;
