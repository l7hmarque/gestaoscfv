
-- Enums
CREATE TYPE public.tipo_mural AS ENUM ('aviso', 'lembrete', 'informativo');
CREATE TYPE public.tipo_feed_post AS ENUM ('manual', 'relatorio_auto', 'conquista');
CREATE TYPE public.tipo_reacao AS ENUM ('like', 'amei');

-- Mural posts
CREATE TABLE public.mural_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  autor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tipo tipo_mural NOT NULL DEFAULT 'informativo',
  titulo TEXT NOT NULL,
  conteudo TEXT NOT NULL DEFAULT '',
  fixado BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.mural_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Mural viewable by authenticated" ON public.mural_posts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert mural" ON public.mural_posts FOR INSERT TO authenticated WITH CHECK (NOT has_role(auth.uid(), 'visitante'::app_role));
CREATE POLICY "Author or coordenacao update mural" ON public.mural_posts FOR UPDATE TO authenticated USING (
  autor_id = (SELECT id FROM profiles WHERE user_id = auth.uid() LIMIT 1) OR has_role(auth.uid(), 'coordenacao'::app_role)
);
CREATE POLICY "Author or coordenacao delete mural" ON public.mural_posts FOR DELETE TO authenticated USING (
  autor_id = (SELECT id FROM profiles WHERE user_id = auth.uid() LIMIT 1) OR has_role(auth.uid(), 'coordenacao'::app_role)
);

-- Feed posts
CREATE TABLE public.feed_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  autor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  conteudo TEXT NOT NULL DEFAULT '',
  tipo tipo_feed_post NOT NULL DEFAULT 'manual',
  relatorio_id UUID REFERENCES public.relatorios_atividade(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.feed_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Feed viewable by authenticated" ON public.feed_posts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert feed" ON public.feed_posts FOR INSERT TO authenticated WITH CHECK (NOT has_role(auth.uid(), 'visitante'::app_role));
CREATE POLICY "Author or coordenacao update feed" ON public.feed_posts FOR UPDATE TO authenticated USING (
  autor_id = (SELECT id FROM profiles WHERE user_id = auth.uid() LIMIT 1) OR has_role(auth.uid(), 'coordenacao'::app_role)
);
CREATE POLICY "Author or coordenacao delete feed" ON public.feed_posts FOR DELETE TO authenticated USING (
  autor_id = (SELECT id FROM profiles WHERE user_id = auth.uid() LIMIT 1) OR has_role(auth.uid(), 'coordenacao'::app_role)
);

-- Feed fotos
CREATE TABLE public.feed_fotos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feed_post_id UUID NOT NULL REFERENCES public.feed_posts(id) ON DELETE CASCADE,
  foto_url TEXT NOT NULL,
  ordem INT DEFAULT 0
);
ALTER TABLE public.feed_fotos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Feed fotos viewable" ON public.feed_fotos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert feed fotos" ON public.feed_fotos FOR INSERT TO authenticated WITH CHECK (NOT has_role(auth.uid(), 'visitante'::app_role));
CREATE POLICY "Author or coord delete feed fotos" ON public.feed_fotos FOR DELETE TO authenticated USING (
  feed_post_id IN (SELECT id FROM feed_posts WHERE autor_id = (SELECT id FROM profiles WHERE user_id = auth.uid() LIMIT 1))
  OR has_role(auth.uid(), 'coordenacao'::app_role)
);

-- Feed reações
CREATE TABLE public.feed_reacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feed_post_id UUID NOT NULL REFERENCES public.feed_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tipo tipo_reacao NOT NULL DEFAULT 'like',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(feed_post_id, user_id)
);
ALTER TABLE public.feed_reacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Feed reacoes viewable" ON public.feed_reacoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert reacoes" ON public.feed_reacoes FOR INSERT TO authenticated WITH CHECK (NOT has_role(auth.uid(), 'visitante'::app_role));
CREATE POLICY "Own reacao delete" ON public.feed_reacoes FOR DELETE TO authenticated USING (
  user_id = (SELECT id FROM profiles WHERE user_id = auth.uid() LIMIT 1)
);
CREATE POLICY "Own reacao update" ON public.feed_reacoes FOR UPDATE TO authenticated USING (
  user_id = (SELECT id FROM profiles WHERE user_id = auth.uid() LIMIT 1)
);

-- Feed comentários
CREATE TABLE public.feed_comentarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feed_post_id UUID NOT NULL REFERENCES public.feed_posts(id) ON DELETE CASCADE,
  autor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  conteudo TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.feed_comentarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Feed comentarios viewable" ON public.feed_comentarios FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert comentarios" ON public.feed_comentarios FOR INSERT TO authenticated WITH CHECK (NOT has_role(auth.uid(), 'visitante'::app_role));
CREATE POLICY "Author or coord delete comentarios" ON public.feed_comentarios FOR DELETE TO authenticated USING (
  autor_id = (SELECT id FROM profiles WHERE user_id = auth.uid() LIMIT 1) OR has_role(auth.uid(), 'coordenacao'::app_role)
);

-- Conquistas
CREATE TABLE public.conquistas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  nivel INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(perfil_id, tipo, nivel)
);
ALTER TABLE public.conquistas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Conquistas viewable" ON public.conquistas FOR SELECT TO authenticated USING (true);
CREATE POLICY "System insert conquistas" ON public.conquistas FOR INSERT TO authenticated WITH CHECK (NOT has_role(auth.uid(), 'visitante'::app_role));

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.mural_posts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.feed_posts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.feed_comentarios;
ALTER PUBLICATION supabase_realtime ADD TABLE public.feed_reacoes;
