
CREATE TABLE public.categorias_vulnerabilidade_padrao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  descricao TEXT,
  ordem INTEGER NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.categorias_vulnerabilidade_padrao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados podem ler categorias"
  ON public.categorias_vulnerabilidade_padrao
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Coordenacao pode inserir categorias"
  ON public.categorias_vulnerabilidade_padrao
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'coordenacao'));

CREATE POLICY "Coordenacao pode atualizar categorias"
  ON public.categorias_vulnerabilidade_padrao
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'coordenacao'));

CREATE POLICY "Coordenacao pode deletar categorias"
  ON public.categorias_vulnerabilidade_padrao
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'coordenacao'));

CREATE TRIGGER update_categorias_vulnerabilidade_padrao_updated_at
  BEFORE UPDATE ON public.categorias_vulnerabilidade_padrao
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.categorias_vulnerabilidade_padrao (nome, descricao, ordem) VALUES
  ('Bolsa Família (PBF)', 'Beneficiário do Programa Bolsa Família', 10),
  ('BPC', 'Benefício de Prestação Continuada', 20),
  ('Medida Protetiva (ECA)', 'Cumprimento de medida protetiva prevista no ECA', 30),
  ('Trabalho Infantil', 'Situação identificada de trabalho infantil', 40),
  ('Violação de Direitos Identificada', 'Outras violações de direitos identificadas pela equipe', 50),
  ('Referenciado CRAS', 'Família referenciada ao CRAS do território', 60),
  ('Referenciado CREAS', 'Família acompanhada pelo CREAS', 70),
  ('Acompanhamento Conselho Tutelar', 'Em acompanhamento pelo Conselho Tutelar', 80),
  ('Outro', 'Outras situações de vulnerabilidade ou atenção prioritária', 999);
