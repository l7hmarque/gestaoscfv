
ALTER TABLE public.coordenacao_atividades
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'aberto',
  ADD COLUMN IF NOT EXISTS prioridade text NOT NULL DEFAULT 'media',
  ADD COLUMN IF NOT EXISTS prazo date NULL,
  ADD COLUMN IF NOT EXISTS responsaveis uuid[] NULL,
  ADD COLUMN IF NOT EXISTS tags text[] NULL;

CREATE INDEX IF NOT EXISTS idx_coord_atividades_data ON public.coordenacao_atividades (data DESC);
CREATE INDEX IF NOT EXISTS idx_coord_atividades_status ON public.coordenacao_atividades (status);
CREATE INDEX IF NOT EXISTS idx_coord_atividades_prazo ON public.coordenacao_atividades (prazo);
CREATE INDEX IF NOT EXISTS idx_coord_atividades_categoria ON public.coordenacao_atividades (categoria);
