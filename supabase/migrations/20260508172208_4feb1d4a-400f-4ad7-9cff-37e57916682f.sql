
CREATE TABLE IF NOT EXISTS public.drive_modelos (
  tipo TEXT PRIMARY KEY,
  template_doc_id TEXT NOT NULL,
  template_url TEXT,
  copia_doc_id TEXT,
  copia_url TEXT,
  ultima_atualizacao_origem TIMESTAMPTZ,
  copia_renovada_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.drive_modelos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "drive_modelos_select_all" ON public.drive_modelos
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "drive_modelos_admin_all" ON public.drive_modelos
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'coordenacao'))
  WITH CHECK (public.has_role(auth.uid(), 'coordenacao'));

CREATE TRIGGER trg_drive_modelos_updated_at
  BEFORE UPDATE ON public.drive_modelos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.drive_modelos (tipo, template_doc_id, template_url) VALUES
  ('relatorio',        '1LWF4wRZ-wDltlpsIWuJ5cI25oahCLKuZnbbU60c6Yd4', 'https://docs.google.com/document/d/1LWF4wRZ-wDltlpsIWuJ5cI25oahCLKuZnbbU60c6Yd4/edit'),
  ('planejamento',     '15vDJlnhPULlAEs1orE6SFS05-iyOWsxU5My9yXpmktc', 'https://docs.google.com/document/d/15vDJlnhPULlAEs1orE6SFS05-iyOWsxU5My9yXpmktc/edit'),
  ('lista_frequencia', '1LShqXw37UktgZyuDf26wb2rMw4GQ1xlekAbI_lUTVYY', 'https://docs.google.com/spreadsheets/d/1LShqXw37UktgZyuDf26wb2rMw4GQ1xlekAbI_lUTVYY/edit'),
  ('lista_chamada',    '1zbEPL21HRu0AblNiGbEMHkdIEsgnE8oGEfYi8Vw-3PU', 'https://docs.google.com/spreadsheets/d/1zbEPL21HRu0AblNiGbEMHkdIEsgnE8oGEfYi8Vw-3PU/edit')
ON CONFLICT (tipo) DO NOTHING;
