-- 1. Adiciona data_entrada
ALTER TABLE public.turma_participantes
  ADD COLUMN IF NOT EXISTS data_entrada date NOT NULL DEFAULT CURRENT_DATE;

-- 2. Backfill com participantes.created_at
UPDATE public.turma_participantes tp
SET data_entrada = COALESCE(p.created_at::date, '2026-01-01'::date)
FROM public.participantes p
WHERE p.id = tp.participante_id
  AND tp.data_entrada = CURRENT_DATE;

-- 3. Higienização: encerrar vínculos duplicados (mantém o mais antigo por ctid)
WITH dups AS (
  SELECT id,
         participante_id,
         ROW_NUMBER() OVER (PARTITION BY participante_id ORDER BY data_entrada ASC, ctid ASC) AS rn
  FROM public.turma_participantes
  WHERE data_saida IS NULL
)
UPDATE public.turma_participantes tp
SET data_saida = CURRENT_DATE,
    motivo_saida = COALESCE(motivo_saida, 'Higienização automática — vínculo duplicado')
FROM dups
WHERE dups.id = tp.id
  AND dups.rn > 1;

-- 4. Índice para acelerar filtros por janela
CREATE INDEX IF NOT EXISTS idx_tp_turma_janela
  ON public.turma_participantes (turma_id, data_entrada, data_saida);