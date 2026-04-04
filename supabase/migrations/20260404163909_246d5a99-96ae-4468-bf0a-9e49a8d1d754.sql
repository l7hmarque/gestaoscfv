ALTER TABLE public.participantes ADD COLUMN IF NOT EXISTS cpf text;
ALTER TABLE public.participantes ADD COLUMN IF NOT EXISTS data_desligamento date;
ALTER TABLE public.participantes ADD COLUMN IF NOT EXISTS dias_contraturno text;