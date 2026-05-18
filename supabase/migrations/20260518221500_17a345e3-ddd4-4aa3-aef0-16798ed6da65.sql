
-- 1. Multi-profissional por slot
CREATE TABLE IF NOT EXISTS public.cronograma_slot_profissionais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id uuid NOT NULL REFERENCES public.cronograma_slots(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  papel text NOT NULL DEFAULT 'educador',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (slot_id, profile_id)
);
CREATE INDEX IF NOT EXISTS idx_csp_slot ON public.cronograma_slot_profissionais(slot_id);
CREATE INDEX IF NOT EXISTS idx_csp_profile ON public.cronograma_slot_profissionais(profile_id);

ALTER TABLE public.cronograma_slot_profissionais ENABLE ROW LEVEL SECURITY;
CREATE POLICY "csp select" ON public.cronograma_slot_profissionais FOR SELECT TO authenticated USING (true);
CREATE POLICY "csp manage" ON public.cronograma_slot_profissionais FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'coordenacao'::app_role) OR has_role(auth.uid(), 'tecnico'::app_role))
  WITH CHECK (has_role(auth.uid(), 'coordenacao'::app_role) OR has_role(auth.uid(), 'tecnico'::app_role));

-- 2. Atividades manuais (Lanche, Embarque, etc.)
CREATE TABLE IF NOT EXISTS public.cronograma_atividades_manuais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cenario_id uuid NOT NULL REFERENCES public.cronograma_cenarios(id) ON DELETE CASCADE,
  bairro_id uuid REFERENCES public.bairros(id),
  dia_semana text NOT NULL,
  periodo text NOT NULL,
  titulo text NOT NULL,
  horario_inicio text,
  horario_fim text,
  cor text DEFAULT 'slate',
  icone text,
  notas text,
  ordem int NOT NULL DEFAULT 0,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cam_cenario ON public.cronograma_atividades_manuais(cenario_id);
CREATE INDEX IF NOT EXISTS idx_cam_cell ON public.cronograma_atividades_manuais(cenario_id, bairro_id, dia_semana, periodo);

ALTER TABLE public.cronograma_atividades_manuais ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cam select" ON public.cronograma_atividades_manuais FOR SELECT TO authenticated USING (true);
CREATE POLICY "cam manage" ON public.cronograma_atividades_manuais FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'coordenacao'::app_role) OR has_role(auth.uid(), 'tecnico'::app_role))
  WITH CHECK (has_role(auth.uid(), 'coordenacao'::app_role) OR has_role(auth.uid(), 'tecnico'::app_role));

-- 3. Intervenções (overlay)
CREATE TABLE IF NOT EXISTS public.cronograma_intervencoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cenario_id uuid REFERENCES public.cronograma_cenarios(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  descricao text,
  cor text DEFAULT 'red',
  data_inicio date NOT NULL DEFAULT current_date,
  data_fim date,
  dias_semana text[] DEFAULT '{}',
  periodos text[] DEFAULT '{}',
  bairros uuid[] DEFAULT '{}',
  profissionais uuid[] DEFAULT '{}',
  prioridade text NOT NULL DEFAULT 'alta',
  criado_por uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cint_cenario ON public.cronograma_intervencoes(cenario_id);
CREATE INDEX IF NOT EXISTS idx_cint_data ON public.cronograma_intervencoes(data_inicio, data_fim);

ALTER TABLE public.cronograma_intervencoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cint select" ON public.cronograma_intervencoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "cint manage" ON public.cronograma_intervencoes FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'coordenacao'::app_role) OR has_role(auth.uid(), 'tecnico'::app_role))
  WITH CHECK (has_role(auth.uid(), 'coordenacao'::app_role) OR has_role(auth.uid(), 'tecnico'::app_role));

-- 4. Cientes de intervenção
CREATE TABLE IF NOT EXISTS public.cronograma_intervencao_cientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  intervencao_id uuid NOT NULL REFERENCES public.cronograma_intervencoes(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  ciente_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (intervencao_id, profile_id)
);
CREATE INDEX IF NOT EXISTS idx_cic_intervencao ON public.cronograma_intervencao_cientes(intervencao_id);
CREATE INDEX IF NOT EXISTS idx_cic_profile ON public.cronograma_intervencao_cientes(profile_id);

ALTER TABLE public.cronograma_intervencao_cientes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cic select own or coord" ON public.cronograma_intervencao_cientes FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'coordenacao'::app_role)
    OR profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );
CREATE POLICY "cic insert self" ON public.cronograma_intervencao_cientes FOR INSERT TO authenticated
  WITH CHECK (profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));
CREATE POLICY "cic delete coord" ON public.cronograma_intervencao_cientes FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'coordenacao'::app_role));

-- 5. recados: requer_ciente + prioridade
ALTER TABLE public.recados ADD COLUMN IF NOT EXISTS requer_ciente boolean NOT NULL DEFAULT false;
ALTER TABLE public.recados ADD COLUMN IF NOT EXISTS prioridade text NOT NULL DEFAULT 'normal';

-- 6. Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.cronograma_intervencoes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.cronograma_intervencao_cientes;
