CREATE TABLE public.despesa_lotes_importacao (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lote_id uuid NOT NULL,
  confirmado_por uuid NOT NULL,
  confirmado_por_nome text,
  confirmado_em timestamp with time zone NOT NULL DEFAULT now(),
  mes_referencia text NOT NULL,
  total_despesas integer NOT NULL DEFAULT 0,
  total_ok integer NOT NULL DEFAULT 0,
  total_ajustes integer NOT NULL DEFAULT 0,
  total_bloqueadas integer NOT NULL DEFAULT 0,
  arquivos jsonb NOT NULL DEFAULT '[]'::jsonb,
  resumo_warnings jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX idx_despesa_lotes_importacao_lote_id ON public.despesa_lotes_importacao(lote_id);
CREATE INDEX idx_despesa_lotes_importacao_mes_ref ON public.despesa_lotes_importacao(mes_referencia);
CREATE INDEX idx_despesa_lotes_importacao_confirmado_em ON public.despesa_lotes_importacao(confirmado_em DESC);

ALTER TABLE public.despesa_lotes_importacao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated select despesa_lotes_importacao"
ON public.despesa_lotes_importacao
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Coord ou tecnico insert despesa_lotes_importacao"
ON public.despesa_lotes_importacao
FOR INSERT
TO authenticated
WITH CHECK (
  (has_role(auth.uid(), 'coordenacao'::app_role) OR has_role(auth.uid(), 'tecnico'::app_role))
  AND confirmado_por = auth.uid()
);