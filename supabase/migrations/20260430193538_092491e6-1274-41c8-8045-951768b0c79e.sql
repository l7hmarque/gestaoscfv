
CREATE TABLE public.familia_acessos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  participante_id uuid,
  participante_nome text,
  participante_ids uuid[] DEFAULT '{}'::uuid[],
  iniciado_em timestamp with time zone NOT NULL DEFAULT now(),
  ultimo_ping_em timestamp with time zone NOT NULL DEFAULT now(),
  encerrado_em timestamp with time zone,
  duracao_segundos integer,
  total_acoes integer NOT NULL DEFAULT 0,
  acoes jsonb NOT NULL DEFAULT '[]'::jsonb,
  user_agent text,
  ip_address text,
  match_type text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_familia_acessos_iniciado ON public.familia_acessos (iniciado_em DESC);
CREATE INDEX idx_familia_acessos_participante ON public.familia_acessos (participante_id);
CREATE INDEX idx_familia_acessos_ultimo_ping ON public.familia_acessos (ultimo_ping_em DESC);

ALTER TABLE public.familia_acessos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coordenacao select familia_acessos"
  ON public.familia_acessos
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'coordenacao'::app_role));
