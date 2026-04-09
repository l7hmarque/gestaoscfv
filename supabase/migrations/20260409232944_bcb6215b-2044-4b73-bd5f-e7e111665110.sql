CREATE TABLE public.busca_ativa_registros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participante_id uuid NOT NULL REFERENCES public.participantes(id) ON DELETE CASCADE,
  profissional_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  data_registro date NOT NULL DEFAULT CURRENT_DATE,
  tipo_contato text NOT NULL DEFAULT 'telefone',
  descricao text NOT NULL DEFAULT '',
  resultado text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.busca_ativa_registros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tecnico ou coord manage busca_ativa" ON public.busca_ativa_registros
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'tecnico'::app_role) OR has_role(auth.uid(), 'coordenacao'::app_role))
  WITH CHECK (has_role(auth.uid(), 'tecnico'::app_role) OR has_role(auth.uid(), 'coordenacao'::app_role));

CREATE POLICY "Authenticated select busca_ativa" ON public.busca_ativa_registros
  FOR SELECT TO authenticated USING (true);