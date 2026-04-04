
-- Part 1: Add new columns to participantes
ALTER TABLE public.participantes 
  ADD COLUMN IF NOT EXISTS vinculo_resp1 text,
  ADD COLUMN IF NOT EXISTS vinculo_resp2 text,
  ADD COLUMN IF NOT EXISTS remedio_continuo text,
  ADD COLUMN IF NOT EXISTS outras_condicoes text;

-- Part 2: Create orcamentos table
CREATE TABLE public.orcamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  objeto text,
  mes_referencia text NOT NULL,
  status text NOT NULL DEFAULT 'rascunho',
  fornecedor_vencedor text,
  cnpj_vencedor text,
  data_aprovacao date,
  categoria_id uuid REFERENCES public.categorias_financeiras(id),
  observacoes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.orcamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated SELECT orcamentos" ON public.orcamentos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Coord ou tecnico CRUD orcamentos" ON public.orcamentos FOR ALL TO authenticated USING (has_role(auth.uid(), 'coordenacao'::app_role) OR has_role(auth.uid(), 'tecnico'::app_role));

-- Part 3: Create orcamento_itens table
CREATE TABLE public.orcamento_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  orcamento_id uuid NOT NULL REFERENCES public.orcamentos(id) ON DELETE CASCADE,
  item_num integer NOT NULL,
  descricao text NOT NULL,
  unidade_medida text DEFAULT 'UNID',
  quantidade numeric NOT NULL DEFAULT 1,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.orcamento_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated SELECT orcamento_itens" ON public.orcamento_itens FOR SELECT TO authenticated USING (true);
CREATE POLICY "Coord ou tecnico CRUD orcamento_itens" ON public.orcamento_itens FOR ALL TO authenticated USING (has_role(auth.uid(), 'coordenacao'::app_role) OR has_role(auth.uid(), 'tecnico'::app_role));

-- Part 4: Create orcamento_cotacoes table
CREATE TABLE public.orcamento_cotacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  orcamento_id uuid NOT NULL REFERENCES public.orcamentos(id) ON DELETE CASCADE,
  fornecedor_nome text NOT NULL,
  cnpj text,
  data_emissao date,
  data_validade date,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.orcamento_cotacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated SELECT orcamento_cotacoes" ON public.orcamento_cotacoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Coord ou tecnico CRUD orcamento_cotacoes" ON public.orcamento_cotacoes FOR ALL TO authenticated USING (has_role(auth.uid(), 'coordenacao'::app_role) OR has_role(auth.uid(), 'tecnico'::app_role));

-- Part 5: Create orcamento_precos table
CREATE TABLE public.orcamento_precos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cotacao_id uuid NOT NULL REFERENCES public.orcamento_cotacoes(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.orcamento_itens(id) ON DELETE CASCADE,
  preco_unitario numeric NOT NULL DEFAULT 0,
  observacao text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.orcamento_precos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated SELECT orcamento_precos" ON public.orcamento_precos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Coord ou tecnico CRUD orcamento_precos" ON public.orcamento_precos FOR ALL TO authenticated USING (has_role(auth.uid(), 'coordenacao'::app_role) OR has_role(auth.uid(), 'tecnico'::app_role));

-- Part 6: Add orcamento_id to despesas
ALTER TABLE public.despesas ADD COLUMN IF NOT EXISTS orcamento_id uuid REFERENCES public.orcamentos(id);
