-- Tabela principal de relatos para equipe técnica
CREATE TABLE public.relato_equipe_tecnica (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  relatorio_id uuid NOT NULL REFERENCES public.relatorios_atividade(id) ON DELETE CASCADE,
  motivo text NOT NULL,
  descricao text NOT NULL DEFAULT '',
  criado_por uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.relato_equipe_tecnica ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated select relato_equipe"
  ON public.relato_equipe_tecnica FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Non-visitante insert relato_equipe"
  ON public.relato_equipe_tecnica FOR INSERT
  TO authenticated WITH CHECK (NOT has_role(auth.uid(), 'visitante'::app_role));

CREATE POLICY "Coordenacao delete relato_equipe"
  ON public.relato_equipe_tecnica FOR DELETE
  TO authenticated USING (has_role(auth.uid(), 'coordenacao'::app_role));

-- Tabela de participantes vinculados ao relato
CREATE TABLE public.relato_equipe_participantes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  relato_id uuid NOT NULL REFERENCES public.relato_equipe_tecnica(id) ON DELETE CASCADE,
  participante_id uuid NOT NULL REFERENCES public.participantes(id) ON DELETE CASCADE
);

ALTER TABLE public.relato_equipe_participantes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated select relato_participantes"
  ON public.relato_equipe_participantes FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Non-visitante insert relato_participantes"
  ON public.relato_equipe_participantes FOR INSERT
  TO authenticated WITH CHECK (NOT has_role(auth.uid(), 'visitante'::app_role));

CREATE POLICY "Coordenacao delete relato_participantes"
  ON public.relato_equipe_participantes FOR DELETE
  TO authenticated USING (has_role(auth.uid(), 'coordenacao'::app_role));