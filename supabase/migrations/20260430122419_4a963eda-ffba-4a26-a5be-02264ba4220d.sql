ALTER TABLE public.pontos_transporte ADD COLUMN IF NOT EXISTS ordem integer NOT NULL DEFAULT 0;

-- Inicializa ordem por bairro (alfabético) para registros existentes
WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY bairro_id ORDER BY nome) AS rn
  FROM public.pontos_transporte
)
UPDATE public.pontos_transporte p
SET ordem = r.rn
FROM ranked r
WHERE p.id = r.id;

CREATE INDEX IF NOT EXISTS idx_pontos_transporte_bairro_ordem
  ON public.pontos_transporte (bairro_id, ordem, nome);