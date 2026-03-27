
-- Enum types
CREATE TYPE public.app_role AS ENUM ('coordenacao', 'educador', 'tecnico', 'motorista', 'cozinheiro');
CREATE TYPE public.status_participante AS ENUM ('ativo', 'desligado', 'incompleto');
CREATE TYPE public.periodo_enum AS ENUM ('manha', 'tarde', 'integral');
CREATE TYPE public.faixa_etaria_enum AS ENUM ('6-8', '9-11', '12-17', 'idosos');
CREATE TYPE public.tipo_turma AS ENUM ('ordinaria', 'extraordinaria');
CREATE TYPE public.objetivo_resultado AS ENUM ('alcancado', 'parcial', 'nao_alcancado');

-- Timestamp updater
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL DEFAULT '',
  cargo TEXT DEFAULT '',
  foto_url TEXT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles viewable by authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, nome)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- User roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;
CREATE POLICY "Roles viewable by authenticated" ON public.user_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Coordenacao manages roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'coordenacao'));

-- Bairros
CREATE TABLE public.bairros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE
);
ALTER TABLE public.bairros ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Bairros viewable by authenticated" ON public.bairros FOR SELECT TO authenticated USING (true);
CREATE POLICY "Coordenacao manages bairros" ON public.bairros FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'coordenacao'));

-- Pontos de transporte
CREATE TABLE public.pontos_transporte (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  bairro_id UUID REFERENCES public.bairros(id) ON DELETE SET NULL
);
ALTER TABLE public.pontos_transporte ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Pontos viewable by authenticated" ON public.pontos_transporte FOR SELECT TO authenticated USING (true);
CREATE POLICY "Coordenacao manages pontos" ON public.pontos_transporte FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'coordenacao'));

-- Participantes
CREATE TABLE public.participantes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_completo TEXT NOT NULL,
  data_nascimento DATE,
  genero TEXT,
  cor_raca TEXT,
  status status_participante DEFAULT 'ativo',
  bairro_id UUID REFERENCES public.bairros(id) ON DELETE SET NULL,
  periodo periodo_enum DEFAULT 'manha',
  ponto_transporte_id UUID REFERENCES public.pontos_transporte(id) ON DELETE SET NULL,
  escola TEXT,
  serie TEXT,
  origem_encaminhamento TEXT,
  iniciou_em DATE,
  foto_url TEXT,
  responsavel1_nome TEXT,
  responsavel1_cpf TEXT,
  responsavel1_whatsapp TEXT,
  responsavel2_nome TEXT,
  responsavel2_whatsapp TEXT,
  endereco_rua TEXT,
  endereco_numero TEXT,
  endereco_bairro TEXT,
  uf_origem TEXT,
  situacao_moradia TEXT,
  laudo TEXT,
  restricao_alimentar TEXT,
  categoria_vulnerabilidade TEXT,
  responsavel_tecnico TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.participantes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participantes viewable by authenticated" ON public.participantes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert participantes" ON public.participantes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update participantes" ON public.participantes FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Coordenacao delete participantes" ON public.participantes FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'coordenacao'));
CREATE TRIGGER update_participantes_updated_at BEFORE UPDATE ON public.participantes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Turmas
CREATE TABLE public.turmas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  bairro_id UUID REFERENCES public.bairros(id) ON DELETE SET NULL,
  periodo periodo_enum,
  faixa_etaria faixa_etaria_enum,
  educador_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  tipo tipo_turma DEFAULT 'ordinaria',
  dias_semana TEXT[] DEFAULT '{}',
  ativa BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.turmas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Turmas viewable by authenticated" ON public.turmas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert turmas" ON public.turmas FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update turmas" ON public.turmas FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Coordenacao delete turmas" ON public.turmas FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'coordenacao'));
CREATE TRIGGER update_turmas_updated_at BEFORE UPDATE ON public.turmas FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Turma participantes
CREATE TABLE public.turma_participantes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  turma_id UUID NOT NULL REFERENCES public.turmas(id) ON DELETE CASCADE,
  participante_id UUID NOT NULL REFERENCES public.participantes(id) ON DELETE CASCADE,
  periodo_override periodo_enum,
  UNIQUE (turma_id, participante_id)
);
ALTER TABLE public.turma_participantes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Turma participantes viewable" ON public.turma_participantes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated manage turma_participantes" ON public.turma_participantes FOR ALL TO authenticated USING (true);

-- Presença
CREATE TABLE public.presenca (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  turma_id UUID NOT NULL REFERENCES public.turmas(id) ON DELETE CASCADE,
  participante_id UUID NOT NULL REFERENCES public.participantes(id) ON DELETE CASCADE,
  data DATE NOT NULL,
  presente BOOLEAN DEFAULT false,
  justificativa TEXT,
  registrado_por UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (turma_id, participante_id, data)
);
ALTER TABLE public.presenca ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Presenca viewable by authenticated" ON public.presenca FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated manage presenca" ON public.presenca FOR ALL TO authenticated USING (true);

-- Planejamentos
CREATE TABLE public.planejamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  educador_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  titulo TEXT NOT NULL,
  tema TEXT,
  questao_geradora TEXT,
  objetivos TEXT,
  forma_avaliacao TEXT[] DEFAULT '{}',
  roteiro TEXT,
  materiais TEXT,
  apoio_tecnico TEXT,
  data_aplicacao DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.planejamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Planejamentos viewable by authenticated" ON public.planejamentos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert planejamentos" ON public.planejamentos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update planejamentos" ON public.planejamentos FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Coordenacao delete planejamentos" ON public.planejamentos FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'coordenacao'));
CREATE TRIGGER update_planejamentos_updated_at BEFORE UPDATE ON public.planejamentos FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Planejamento turmas
CREATE TABLE public.planejamento_turmas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  planejamento_id UUID NOT NULL REFERENCES public.planejamentos(id) ON DELETE CASCADE,
  turma_id UUID NOT NULL REFERENCES public.turmas(id) ON DELETE CASCADE,
  UNIQUE (planejamento_id, turma_id)
);
ALTER TABLE public.planejamento_turmas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Planejamento turmas viewable" ON public.planejamento_turmas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated manage planejamento_turmas" ON public.planejamento_turmas FOR ALL TO authenticated USING (true);

-- Relatórios de atividade
CREATE TABLE public.relatorios_atividade (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  educador_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  data DATE NOT NULL,
  dia_semana TEXT,
  tipo_atividade TEXT,
  nome_atividade TEXT,
  planejamento_id UUID REFERENCES public.planejamentos(id) ON DELETE SET NULL,
  iniciativa INT CHECK (iniciativa BETWEEN 1 AND 5),
  autonomia INT CHECK (autonomia BETWEEN 1 AND 5),
  colaboracao INT CHECK (colaboracao BETWEEN 1 AND 5),
  comunicacao INT CHECK (comunicacao BETWEEN 1 AND 5),
  respeito_mutuo INT CHECK (respeito_mutuo BETWEEN 1 AND 5),
  score_elo DECIMAL(3,2),
  engajamento TEXT[] DEFAULT '{}',
  situacoes_relevantes TEXT[] DEFAULT '{}',
  objetivo_alcancado objetivo_resultado,
  observacoes TEXT,
  intervencoes TEXT,
  num_participantes INT DEFAULT 0,
  num_ausentes INT DEFAULT 0,
  num_matriculados INT DEFAULT 0,
  pct_adesao DECIMAL(5,2) DEFAULT 0,
  analise_ia TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.relatorios_atividade ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Relatorios viewable by authenticated" ON public.relatorios_atividade FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert relatorios" ON public.relatorios_atividade FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update relatorios" ON public.relatorios_atividade FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Coordenacao delete relatorios" ON public.relatorios_atividade FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'coordenacao'));

-- Relatório turmas
CREATE TABLE public.relatorio_turmas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  relatorio_id UUID NOT NULL REFERENCES public.relatorios_atividade(id) ON DELETE CASCADE,
  turma_id UUID NOT NULL REFERENCES public.turmas(id) ON DELETE CASCADE,
  UNIQUE (relatorio_id, turma_id)
);
ALTER TABLE public.relatorio_turmas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Relatorio turmas viewable" ON public.relatorio_turmas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated manage relatorio_turmas" ON public.relatorio_turmas FOR ALL TO authenticated USING (true);

-- Relatório fotos
CREATE TABLE public.relatorio_fotos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  relatorio_id UUID NOT NULL REFERENCES public.relatorios_atividade(id) ON DELETE CASCADE,
  foto_url TEXT NOT NULL,
  ordem INT DEFAULT 0
);
ALTER TABLE public.relatorio_fotos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Relatorio fotos viewable" ON public.relatorio_fotos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated manage relatorio_fotos" ON public.relatorio_fotos FOR ALL TO authenticated USING (true);

-- Relatório presença
CREATE TABLE public.relatorio_presenca (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  relatorio_id UUID NOT NULL REFERENCES public.relatorios_atividade(id) ON DELETE CASCADE,
  participante_id UUID NOT NULL REFERENCES public.participantes(id) ON DELETE CASCADE,
  presente BOOLEAN DEFAULT false,
  justificativa TEXT,
  UNIQUE (relatorio_id, participante_id)
);
ALTER TABLE public.relatorio_presenca ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Relatorio presenca viewable" ON public.relatorio_presenca FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated manage relatorio_presenca" ON public.relatorio_presenca FOR ALL TO authenticated USING (true);

-- Storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('fotos-participantes', 'fotos-participantes', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('fotos-relatorios', 'fotos-relatorios', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('documentos', 'documentos', false);

CREATE POLICY "Public read fotos participantes" ON storage.objects FOR SELECT USING (bucket_id = 'fotos-participantes');
CREATE POLICY "Auth upload fotos participantes" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'fotos-participantes');
CREATE POLICY "Auth update fotos participantes" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'fotos-participantes');
CREATE POLICY "Public read fotos relatorios" ON storage.objects FOR SELECT USING (bucket_id = 'fotos-relatorios');
CREATE POLICY "Auth upload fotos relatorios" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'fotos-relatorios');
CREATE POLICY "Auth read own documents" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'documentos');
CREATE POLICY "Auth upload documents" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'documentos');

-- Seed bairros
INSERT INTO public.bairros (nome) VALUES ('Jardim Irene'), ('Parque Independência'), ('Alvorada');
