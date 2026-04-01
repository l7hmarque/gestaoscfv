
CREATE TABLE public.template_tag_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key text NOT NULL,
  tag_name text NOT NULL,
  data_field text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(template_key, tag_name)
);

ALTER TABLE public.template_tag_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read mappings" ON public.template_tag_mappings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Coordenacao manage mappings" ON public.template_tag_mappings
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'coordenacao'::app_role));
