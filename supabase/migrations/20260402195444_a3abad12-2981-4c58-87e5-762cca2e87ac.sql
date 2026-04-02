
-- Tabela de atendimentos técnicos
CREATE TABLE public.atendimentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participante_id uuid NOT NULL REFERENCES public.participantes(id) ON DELETE CASCADE,
  profissional_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  data_atendimento date NOT NULL DEFAULT CURRENT_DATE,
  tipo text NOT NULL DEFAULT 'atendimento_individual',
  descricao text NOT NULL DEFAULT '',
  encaminhamento text,
  sigiloso boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.atendimentos ENABLE ROW LEVEL SECURITY;

-- Somente técnicos e coordenação podem acessar
CREATE POLICY "Tecnico ou coord select atendimentos"
ON public.atendimentos FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'tecnico'::app_role) OR has_role(auth.uid(), 'coordenacao'::app_role));

CREATE POLICY "Tecnico ou coord insert atendimentos"
ON public.atendimentos FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'tecnico'::app_role) OR has_role(auth.uid(), 'coordenacao'::app_role));

CREATE POLICY "Tecnico ou coord update atendimentos"
ON public.atendimentos FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'tecnico'::app_role) OR has_role(auth.uid(), 'coordenacao'::app_role));

CREATE POLICY "Tecnico ou coord delete atendimentos"
ON public.atendimentos FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'tecnico'::app_role) OR has_role(auth.uid(), 'coordenacao'::app_role));

-- Tabela de recados entre profissionais
CREATE TABLE public.recados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  remetente_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  destinatario_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  participante_id uuid REFERENCES public.participantes(id) ON DELETE SET NULL,
  conteudo text NOT NULL,
  lido boolean NOT NULL DEFAULT false,
  ciente boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.recados ENABLE ROW LEVEL SECURITY;

-- Recados visíveis para remetente e destinatário
CREATE POLICY "Remetente ou destinatario select recados"
ON public.recados FOR SELECT TO authenticated
USING (
  remetente_id = (SELECT id FROM profiles WHERE user_id = auth.uid() LIMIT 1)
  OR destinatario_id = (SELECT id FROM profiles WHERE user_id = auth.uid() LIMIT 1)
);

CREATE POLICY "Authenticated insert recados"
ON public.recados FOR INSERT TO authenticated
WITH CHECK (NOT has_role(auth.uid(), 'visitante'::app_role));

CREATE POLICY "Destinatario update recados"
ON public.recados FOR UPDATE TO authenticated
USING (destinatario_id = (SELECT id FROM profiles WHERE user_id = auth.uid() LIMIT 1));

CREATE POLICY "Remetente ou coord delete recados"
ON public.recados FOR DELETE TO authenticated
USING (
  remetente_id = (SELECT id FROM profiles WHERE user_id = auth.uid() LIMIT 1)
  OR has_role(auth.uid(), 'coordenacao'::app_role)
);

-- Enable realtime for recados
ALTER PUBLICATION supabase_realtime ADD TABLE public.recados;
