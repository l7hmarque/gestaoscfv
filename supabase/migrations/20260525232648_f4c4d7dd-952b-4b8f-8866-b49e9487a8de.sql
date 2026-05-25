ALTER TABLE public.participante_transferencias
  DROP CONSTRAINT participante_transferencias_turma_origem_id_fkey,
  ADD CONSTRAINT participante_transferencias_turma_origem_id_fkey
    FOREIGN KEY (turma_origem_id) REFERENCES public.turmas(id) ON DELETE SET NULL;

ALTER TABLE public.participante_transferencias
  DROP CONSTRAINT participante_transferencias_turma_destino_id_fkey,
  ADD CONSTRAINT participante_transferencias_turma_destino_id_fkey
    FOREIGN KEY (turma_destino_id) REFERENCES public.turmas(id) ON DELETE SET NULL;

ALTER TABLE public.cronograma_slots
  DROP CONSTRAINT cronograma_slots_turma_id_fkey,
  ADD CONSTRAINT cronograma_slots_turma_id_fkey
    FOREIGN KEY (turma_id) REFERENCES public.turmas(id) ON DELETE CASCADE;