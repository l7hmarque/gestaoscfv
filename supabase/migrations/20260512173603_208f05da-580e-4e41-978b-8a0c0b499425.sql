CREATE TABLE public.caixa_entrada_documentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mes_ref text NOT NULL,
  file_name text NOT NULL,
  storage_path text,
  storage_url text,
  mime_type text,
  status text NOT NULL DEFAULT 'fila',
  total_chunks int,
  done_chunks int DEFAULT 0,
  despesas_json jsonb DEFAULT '[]'::jsonb,
  erro text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_caixa_entrada_mes ON public.caixa_entrada_documentos(mes_ref, status);
CREATE INDEX idx_caixa_entrada_created_by ON public.caixa_entrada_documentos(created_by);

ALTER TABLE public.caixa_entrada_documentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coord pode ver caixa de entrada"
  ON public.caixa_entrada_documentos FOR SELECT
  USING (public.has_role(auth.uid(), 'coordenacao'::app_role));

CREATE POLICY "Coord pode inserir caixa de entrada"
  ON public.caixa_entrada_documentos FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'coordenacao'::app_role));

CREATE POLICY "Coord pode atualizar caixa de entrada"
  ON public.caixa_entrada_documentos FOR UPDATE
  USING (public.has_role(auth.uid(), 'coordenacao'::app_role));

CREATE POLICY "Coord pode deletar caixa de entrada"
  ON public.caixa_entrada_documentos FOR DELETE
  USING (public.has_role(auth.uid(), 'coordenacao'::app_role));

CREATE TRIGGER trg_caixa_entrada_updated
  BEFORE UPDATE ON public.caixa_entrada_documentos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();