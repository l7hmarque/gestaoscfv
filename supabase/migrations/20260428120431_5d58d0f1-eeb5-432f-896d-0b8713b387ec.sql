
CREATE TABLE public.roteiros_visita (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  data_visita date NOT NULL,
  horario_saida time,
  observacoes text,
  responsaveis uuid[] DEFAULT '{}',
  veiculo text,
  status text NOT NULL DEFAULT 'rascunho',
  criado_por uuid,
  concluido_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.roteiro_visitas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  roteiro_id uuid NOT NULL REFERENCES public.roteiros_visita(id) ON DELETE CASCADE,
  participante_id uuid NOT NULL,
  bairro_nome text,
  origem text NOT NULL DEFAULT 'busca_ativa',
  ordem integer NOT NULL DEFAULT 0,
  status_visita text NOT NULL DEFAULT 'pendente',
  relato text,
  horario_realizado time,
  atendimento_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_roteiro_visitas_roteiro ON public.roteiro_visitas(roteiro_id);
CREATE INDEX idx_roteiro_visitas_participante ON public.roteiro_visitas(participante_id);
CREATE INDEX idx_roteiros_visita_data ON public.roteiros_visita(data_visita DESC);

ALTER TABLE public.roteiros_visita ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roteiro_visitas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tecnico ou coord select roteiros" ON public.roteiros_visita
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'tecnico'::app_role) OR has_role(auth.uid(), 'coordenacao'::app_role));

CREATE POLICY "Tecnico ou coord insert roteiros" ON public.roteiros_visita
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'tecnico'::app_role) OR has_role(auth.uid(), 'coordenacao'::app_role));

CREATE POLICY "Tecnico ou coord update roteiros" ON public.roteiros_visita
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'tecnico'::app_role) OR has_role(auth.uid(), 'coordenacao'::app_role));

CREATE POLICY "Tecnico ou coord delete roteiros" ON public.roteiros_visita
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'tecnico'::app_role) OR has_role(auth.uid(), 'coordenacao'::app_role));

CREATE POLICY "Tecnico ou coord select roteiro_visitas" ON public.roteiro_visitas
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'tecnico'::app_role) OR has_role(auth.uid(), 'coordenacao'::app_role));

CREATE POLICY "Tecnico ou coord insert roteiro_visitas" ON public.roteiro_visitas
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'tecnico'::app_role) OR has_role(auth.uid(), 'coordenacao'::app_role));

CREATE POLICY "Tecnico ou coord update roteiro_visitas" ON public.roteiro_visitas
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'tecnico'::app_role) OR has_role(auth.uid(), 'coordenacao'::app_role));

CREATE POLICY "Tecnico ou coord delete roteiro_visitas" ON public.roteiro_visitas
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'tecnico'::app_role) OR has_role(auth.uid(), 'coordenacao'::app_role));

CREATE TRIGGER trg_roteiros_visita_updated
  BEFORE UPDATE ON public.roteiros_visita
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_roteiro_visitas_updated
  BEFORE UPDATE ON public.roteiro_visitas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
