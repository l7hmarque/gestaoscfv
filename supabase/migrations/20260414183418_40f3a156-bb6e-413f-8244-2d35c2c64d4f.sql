-- Cronograma cenarios
CREATE TABLE public.cronograma_cenarios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  criado_por UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.cronograma_cenarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated select cronograma_cenarios"
  ON public.cronograma_cenarios FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Coord ou tecnico manage cronograma_cenarios"
  ON public.cronograma_cenarios FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'coordenacao'::app_role) OR has_role(auth.uid(), 'tecnico'::app_role))
  WITH CHECK (has_role(auth.uid(), 'coordenacao'::app_role) OR has_role(auth.uid(), 'tecnico'::app_role));

-- Cronograma slots
CREATE TABLE public.cronograma_slots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cenario_id UUID NOT NULL REFERENCES public.cronograma_cenarios(id) ON DELETE CASCADE,
  dia_semana TEXT NOT NULL,
  periodo TEXT NOT NULL DEFAULT 'manha',
  bairro_id UUID REFERENCES public.bairros(id),
  educador_id UUID REFERENCES public.profiles(id),
  oficineiro_id UUID REFERENCES public.profiles(id),
  tipo_atividade TEXT,
  turma_id UUID REFERENCES public.turmas(id),
  notas TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.cronograma_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated select cronograma_slots"
  ON public.cronograma_slots FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Coord ou tecnico manage cronograma_slots"
  ON public.cronograma_slots FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'coordenacao'::app_role) OR has_role(auth.uid(), 'tecnico'::app_role))
  WITH CHECK (has_role(auth.uid(), 'coordenacao'::app_role) OR has_role(auth.uid(), 'tecnico'::app_role));