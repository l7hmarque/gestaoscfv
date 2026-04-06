
-- Create formularios_familia table
CREATE TABLE public.formularios_familia (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo text NOT NULL,
  descricao text,
  tipo text NOT NULL DEFAULT 'pesquisa',
  campos jsonb NOT NULL DEFAULT '[]'::jsonb,
  criado_por uuid REFERENCES public.profiles(id),
  ativo boolean NOT NULL DEFAULT true,
  destinatario_ids uuid[] DEFAULT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create formulario_respostas table
CREATE TABLE public.formulario_respostas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  formulario_id uuid NOT NULL REFERENCES public.formularios_familia(id) ON DELETE CASCADE,
  participante_id uuid NOT NULL REFERENCES public.participantes(id) ON DELETE CASCADE,
  responsavel_nome text,
  respostas jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- RLS for formularios_familia
ALTER TABLE public.formularios_familia ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated select formularios"
  ON public.formularios_familia FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Coord ou tecnico CRUD formularios"
  ON public.formularios_familia FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'coordenacao'::app_role) OR has_role(auth.uid(), 'tecnico'::app_role))
  WITH CHECK (has_role(auth.uid(), 'coordenacao'::app_role) OR has_role(auth.uid(), 'tecnico'::app_role));

-- RLS for formulario_respostas
ALTER TABLE public.formulario_respostas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated select respostas"
  ON public.formulario_respostas FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Coord ou tecnico CRUD respostas"
  ON public.formulario_respostas FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'coordenacao'::app_role) OR has_role(auth.uid(), 'tecnico'::app_role))
  WITH CHECK (has_role(auth.uid(), 'coordenacao'::app_role) OR has_role(auth.uid(), 'tecnico'::app_role));
