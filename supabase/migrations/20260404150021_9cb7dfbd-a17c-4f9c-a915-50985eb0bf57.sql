
-- Parcelas financeiras (recursos recebidos)
CREATE TABLE public.parcelas_financeiras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_parcela integer NOT NULL,
  valor numeric NOT NULL,
  data_recebimento date NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.parcelas_financeiras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coord ou tecnico CRUD parcelas" ON public.parcelas_financeiras
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'coordenacao'::app_role) OR has_role(auth.uid(), 'tecnico'::app_role));

CREATE POLICY "Authenticated SELECT parcelas" ON public.parcelas_financeiras
  FOR SELECT TO authenticated
  USING (true);

-- Categorias econômicas (plano de contas)
CREATE TABLE public.categorias_financeiras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL,
  descricao text NOT NULL,
  valor_previsto numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.categorias_financeiras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coord ou tecnico CRUD categorias_fin" ON public.categorias_financeiras
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'coordenacao'::app_role) OR has_role(auth.uid(), 'tecnico'::app_role));

CREATE POLICY "Authenticated SELECT categorias_fin" ON public.categorias_financeiras
  FOR SELECT TO authenticated
  USING (true);

-- Despesas mensais
CREATE TABLE public.despesas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_lancamento text,
  descricao text NOT NULL,
  valor numeric NOT NULL,
  data_lancamento date NOT NULL,
  categoria_id uuid REFERENCES public.categorias_financeiras(id),
  mes_referencia text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.despesas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coord ou tecnico CRUD despesas" ON public.despesas
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'coordenacao'::app_role) OR has_role(auth.uid(), 'tecnico'::app_role));

CREATE POLICY "Authenticated SELECT despesas" ON public.despesas
  FOR SELECT TO authenticated
  USING (true);

-- Estornos
CREATE TABLE public.estornos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria_id uuid REFERENCES public.categorias_financeiras(id),
  valor numeric NOT NULL,
  mes_referencia text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.estornos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coord ou tecnico CRUD estornos" ON public.estornos
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'coordenacao'::app_role) OR has_role(auth.uid(), 'tecnico'::app_role));

CREATE POLICY "Authenticated SELECT estornos" ON public.estornos
  FOR SELECT TO authenticated
  USING (true);
