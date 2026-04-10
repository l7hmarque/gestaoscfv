ALTER TABLE public.turma_participantes
  ADD COLUMN data_saida date DEFAULT NULL,
  ADD COLUMN motivo_saida text DEFAULT NULL;