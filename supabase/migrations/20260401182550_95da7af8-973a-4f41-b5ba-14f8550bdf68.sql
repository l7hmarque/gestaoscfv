
ALTER TYPE public.status_participante ADD VALUE IF NOT EXISTS 'pendente';

ALTER TABLE public.participantes ADD COLUMN IF NOT EXISTS visualizado_em timestamptz;
