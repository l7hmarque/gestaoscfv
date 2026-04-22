
-- 1. Tabela de recados dedicados à família (canal isolado)
CREATE TABLE public.recados_familia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participante_id uuid NOT NULL REFERENCES public.participantes(id) ON DELETE CASCADE,
  remetente_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  conteudo text NOT NULL,
  lido_em timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_recados_familia_participante ON public.recados_familia(participante_id, created_at DESC);

ALTER TABLE public.recados_familia ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Equipe vê recados família"
  ON public.recados_familia FOR SELECT
  USING (
    public.has_role(auth.uid(), 'coordenacao'::app_role)
    OR public.has_role(auth.uid(), 'tecnico'::app_role)
    OR public.has_role(auth.uid(), 'educador'::app_role)
  );

CREATE POLICY "Equipe cria recados família"
  ON public.recados_familia FOR INSERT
  WITH CHECK (
    (public.has_role(auth.uid(), 'coordenacao'::app_role)
      OR public.has_role(auth.uid(), 'tecnico'::app_role)
      OR public.has_role(auth.uid(), 'educador'::app_role))
    AND remetente_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Autor ou coord edita recados família"
  ON public.recados_familia FOR UPDATE
  USING (
    public.has_role(auth.uid(), 'coordenacao'::app_role)
    OR remetente_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Autor ou coord deleta recados família"
  ON public.recados_familia FOR DELETE
  USING (
    public.has_role(auth.uid(), 'coordenacao'::app_role)
    OR remetente_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

CREATE TRIGGER trg_recados_familia_updated_at
  BEFORE UPDATE ON public.recados_familia
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Tabela de check-ins de presença
CREATE TABLE public.participante_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participante_id uuid NOT NULL REFERENCES public.participantes(id) ON DELETE CASCADE,
  data date NOT NULL,
  periodo text NOT NULL CHECK (periodo IN ('manha','tarde')),
  confirmado boolean NOT NULL DEFAULT true,
  confirmado_em timestamptz NOT NULL DEFAULT now(),
  confirmado_por text NULL,
  observacao text NULL,
  embarcou boolean NULL,
  embarcou_em timestamptz NULL,
  embarcou_por uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (participante_id, data, periodo)
);

CREATE INDEX idx_checkins_data ON public.participante_checkins(data, periodo);
CREATE INDEX idx_checkins_participante_data ON public.participante_checkins(participante_id, data DESC);

ALTER TABLE public.participante_checkins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Equipe operacional vê checkins"
  ON public.participante_checkins FOR SELECT
  USING (
    public.has_role(auth.uid(), 'coordenacao'::app_role)
    OR public.has_role(auth.uid(), 'motorista'::app_role)
    OR public.has_role(auth.uid(), 'tecnico'::app_role)
    OR public.has_role(auth.uid(), 'educador'::app_role)
    OR public.has_role(auth.uid(), 'cozinheiro'::app_role)
  );

CREATE POLICY "Equipe operacional cria checkins"
  ON public.participante_checkins FOR INSERT
  WITH CHECK (
    public.has_role(auth.uid(), 'coordenacao'::app_role)
    OR public.has_role(auth.uid(), 'motorista'::app_role)
    OR public.has_role(auth.uid(), 'tecnico'::app_role)
    OR public.has_role(auth.uid(), 'educador'::app_role)
  );

CREATE POLICY "Equipe operacional edita checkins"
  ON public.participante_checkins FOR UPDATE
  USING (
    public.has_role(auth.uid(), 'coordenacao'::app_role)
    OR public.has_role(auth.uid(), 'motorista'::app_role)
    OR public.has_role(auth.uid(), 'tecnico'::app_role)
    OR public.has_role(auth.uid(), 'educador'::app_role)
  );

CREATE POLICY "Coord deleta checkins"
  ON public.participante_checkins FOR DELETE
  USING (public.has_role(auth.uid(), 'coordenacao'::app_role));

CREATE TRIGGER trg_checkins_updated_at
  BEFORE UPDATE ON public.participante_checkins
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
