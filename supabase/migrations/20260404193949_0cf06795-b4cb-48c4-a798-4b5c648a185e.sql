
CREATE TABLE public.site_noticias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  subtitulo text,
  conteudo text NOT NULL DEFAULT '',
  imagem_url text,
  status text NOT NULL DEFAULT 'rascunho',
  autor_id uuid REFERENCES public.profiles(id),
  relatorio_id uuid REFERENCES public.relatorios_atividade(id),
  created_at timestamptz DEFAULT now(),
  published_at timestamptz
);

CREATE TABLE public.site_conteudos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL DEFAULT 'guia',
  titulo text NOT NULL,
  descricao text,
  arquivo_url text NOT NULL,
  thumbnail_url text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.site_reunioes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  email text NOT NULL,
  telefone text,
  assunto text NOT NULL,
  data_hora timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pendente',
  google_meet_link text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.site_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  email text NOT NULL,
  interesse text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.site_horarios_disponiveis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dia_semana integer NOT NULL,
  hora_inicio time NOT NULL,
  hora_fim time NOT NULL,
  ativo boolean DEFAULT true
);

ALTER TABLE public.site_noticias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anon select published noticias" ON public.site_noticias FOR SELECT TO anon USING (status = 'publicado');
CREATE POLICY "Authenticated select noticias" ON public.site_noticias FOR SELECT TO authenticated USING (true);
CREATE POLICY "Marketing ou coord CRUD noticias" ON public.site_noticias FOR ALL TO authenticated USING (has_role(auth.uid(), 'coordenacao'::app_role) OR has_role(auth.uid(), 'marketing'::app_role)) WITH CHECK (has_role(auth.uid(), 'coordenacao'::app_role) OR has_role(auth.uid(), 'marketing'::app_role));

ALTER TABLE public.site_conteudos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anon select conteudos" ON public.site_conteudos FOR SELECT TO anon USING (true);
CREATE POLICY "Authenticated select conteudos" ON public.site_conteudos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Marketing ou coord CRUD conteudos" ON public.site_conteudos FOR ALL TO authenticated USING (has_role(auth.uid(), 'coordenacao'::app_role) OR has_role(auth.uid(), 'marketing'::app_role)) WITH CHECK (has_role(auth.uid(), 'coordenacao'::app_role) OR has_role(auth.uid(), 'marketing'::app_role));

ALTER TABLE public.site_reunioes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anon insert reunioes" ON public.site_reunioes FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Authenticated select reunioes" ON public.site_reunioes FOR SELECT TO authenticated USING (has_role(auth.uid(), 'coordenacao'::app_role) OR has_role(auth.uid(), 'marketing'::app_role));
CREATE POLICY "Coord ou marketing update reunioes" ON public.site_reunioes FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'coordenacao'::app_role) OR has_role(auth.uid(), 'marketing'::app_role));

ALTER TABLE public.site_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anon insert leads" ON public.site_leads FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Authenticated select leads" ON public.site_leads FOR SELECT TO authenticated USING (has_role(auth.uid(), 'coordenacao'::app_role) OR has_role(auth.uid(), 'marketing'::app_role));

ALTER TABLE public.site_horarios_disponiveis ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anon select horarios" ON public.site_horarios_disponiveis FOR SELECT TO anon USING (ativo = true);
CREATE POLICY "Authenticated select horarios" ON public.site_horarios_disponiveis FOR SELECT TO authenticated USING (true);
CREATE POLICY "Coord ou marketing CRUD horarios" ON public.site_horarios_disponiveis FOR ALL TO authenticated USING (has_role(auth.uid(), 'coordenacao'::app_role) OR has_role(auth.uid(), 'marketing'::app_role)) WITH CHECK (has_role(auth.uid(), 'coordenacao'::app_role) OR has_role(auth.uid(), 'marketing'::app_role));
