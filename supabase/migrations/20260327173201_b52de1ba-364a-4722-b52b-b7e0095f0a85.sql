
CREATE TABLE public.participante_documentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participante_id uuid NOT NULL REFERENCES public.participantes(id) ON DELETE CASCADE,
  categoria text NOT NULL,
  nome_arquivo text NOT NULL,
  arquivo_url text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.participante_documentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Docs viewable by authenticated" ON public.participante_documentos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert docs" ON public.participante_documentos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update docs" ON public.participante_documentos FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Coordenacao delete docs" ON public.participante_documentos FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'coordenacao'));
