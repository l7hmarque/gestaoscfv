
-- 1) Colunas SIT em despesas
ALTER TABLE public.despesas
  ADD COLUMN IF NOT EXISTS sit_tipo_transferencia smallint,
  ADD COLUMN IF NOT EXISTS sit_numero_instrumento varchar(20),
  ADD COLUMN IF NOT EXISTS sit_ano_transferencia smallint,
  ADD COLUMN IF NOT EXISTS sit_codigo_tipo_despesa integer,
  ADD COLUMN IF NOT EXISTS sit_tipo_doc_favorecido varchar(4),
  ADD COLUMN IF NOT EXISTS sit_nome_favorecido varchar(250),
  ADD COLUMN IF NOT EXISTS sit_tipo_doc_despesa smallint,
  ADD COLUMN IF NOT EXISTS sit_numero_doc_despesa varchar(10),
  ADD COLUMN IF NOT EXISTS sit_data_doc_despesa date,
  ADD COLUMN IF NOT EXISTS sit_placa_veiculo varchar(7),
  ADD COLUMN IF NOT EXISTS sit_quilometragem integer,
  ADD COLUMN IF NOT EXISTS sit_numero_empenho varchar(15),
  ADD COLUMN IF NOT EXISTS sit_data_empenho date,
  ADD COLUMN IF NOT EXISTS sit_modalidade_compra smallint,
  ADD COLUMN IF NOT EXISTS sit_numero_processo varchar(10),
  ADD COLUMN IF NOT EXISTS sit_data_processo date,
  ADD COLUMN IF NOT EXISTS sit_tipo_doc_pagamento smallint,
  ADD COLUMN IF NOT EXISTS sit_numero_doc_pagamento varchar(15),
  ADD COLUMN IF NOT EXISTS sit_data_emissao_pagamento date,
  ADD COLUMN IF NOT EXISTS sit_data_debito date,
  ADD COLUMN IF NOT EXISTS sit_descricao_item text,
  ADD COLUMN IF NOT EXISTS sit_completo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pendente_comprovante boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS lote_origem_pdf text;

CREATE INDEX IF NOT EXISTS idx_despesas_sit_completo ON public.despesas(sit_completo);
CREATE INDEX IF NOT EXISTS idx_despesas_pendente_comp ON public.despesas(pendente_comprovante);

-- 2) sit_configuracao (1 linha por OSC)
CREATE TABLE IF NOT EXISTS public.sit_configuracao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj_concedente varchar(14) NOT NULL,
  tipo_transferencia_padrao smallint NOT NULL DEFAULT 1,
  numero_instrumento_padrao varchar(20) NOT NULL,
  ano_transferencia_padrao smallint NOT NULL DEFAULT 2022,
  tipo_doc_pagamento_padrao smallint NOT NULL DEFAULT 3,
  modalidade_compra_padrao smallint NOT NULL DEFAULT 8,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sit_configuracao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sit_config_select_auth" ON public.sit_configuracao
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "sit_config_insert_coord" ON public.sit_configuracao
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'coordenacao'::app_role));
CREATE POLICY "sit_config_update_coord" ON public.sit_configuracao
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'coordenacao'::app_role));
CREATE POLICY "sit_config_delete_coord" ON public.sit_configuracao
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'coordenacao'::app_role));

CREATE TRIGGER trg_sit_config_updated
  BEFORE UPDATE ON public.sit_configuracao
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) sit_codigos (Apêndice A)
CREATE TABLE IF NOT EXISTS public.sit_codigos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria text NOT NULL,
  codigo text NOT NULL,
  descricao text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (categoria, codigo)
);

CREATE INDEX IF NOT EXISTS idx_sit_codigos_cat ON public.sit_codigos(categoria) WHERE ativo;

ALTER TABLE public.sit_codigos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sit_codigos_select_auth" ON public.sit_codigos
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "sit_codigos_insert_coord" ON public.sit_codigos
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'coordenacao'::app_role));
CREATE POLICY "sit_codigos_update_coord" ON public.sit_codigos
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'coordenacao'::app_role));
CREATE POLICY "sit_codigos_delete_coord" ON public.sit_codigos
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'coordenacao'::app_role));

-- Pré-popula códigos comuns
INSERT INTO public.sit_codigos (categoria, codigo, descricao) VALUES
  ('tipo_transferencia','1','Convênio'),
  ('tipo_transferencia','2','Termo de Colaboração'),
  ('tipo_transferencia','3','Termo de Fomento'),
  ('tipo_transferencia','4','Acordo de Cooperação'),
  ('tipo_doc_despesa','1','Nota Fiscal'),
  ('tipo_doc_despesa','2','Cupom Fiscal'),
  ('tipo_doc_despesa','3','Fatura'),
  ('tipo_doc_despesa','4','Recibo'),
  ('tipo_doc_despesa','5','Boleto Bancário'),
  ('tipo_doc_despesa','6','Folha de Pagamento'),
  ('tipo_doc_despesa','7','Recibo de Pagamento Autônomo - RPA'),
  ('tipo_doc_despesa','8','DARF'),
  ('tipo_doc_despesa','9','GPS - Guia da Previdência Social'),
  ('tipo_doc_despesa','10','GFIP'),
  ('tipo_doc_despesa','20','Outros'),
  ('tipo_doc_pagamento','1','Cheque'),
  ('tipo_doc_pagamento','2','Ordem de Pagamento'),
  ('tipo_doc_pagamento','3','Transferência Bancária / TED / DOC / PIX'),
  ('tipo_doc_pagamento','4','Débito Automático'),
  ('tipo_doc_pagamento','5','Boleto'),
  ('modalidade_compra','1','Convite'),
  ('modalidade_compra','2','Tomada de Preços'),
  ('modalidade_compra','3','Concorrência'),
  ('modalidade_compra','4','Pregão'),
  ('modalidade_compra','5','Concurso'),
  ('modalidade_compra','6','Leilão'),
  ('modalidade_compra','7','Dispensa'),
  ('modalidade_compra','8','Inexigibilidade'),
  ('modalidade_compra','9','Não se Aplica'),
  ('tipo_despesa','33903001','Combustíveis e Lubrificantes Automotivos'),
  ('tipo_despesa','33903004','Gás e Outros Materiais Engarrafados'),
  ('tipo_despesa','33903007','Gêneros de Alimentação'),
  ('tipo_despesa','33903021','Material de Copa e Cozinha'),
  ('tipo_despesa','33903022','Material de Limpeza e Produtos de Higienização'),
  ('tipo_despesa','33903023','Uniformes, Tecidos e Aviamentos'),
  ('tipo_despesa','33903024','Material para Manutenção de Bens Imóveis'),
  ('tipo_despesa','33903026','Material Elétrico e Eletrônico'),
  ('tipo_despesa','33903030','Material de Consumo'),
  ('tipo_despesa','33903036','Outros Serviços de Terceiros - Pessoa Física'),
  ('tipo_despesa','33903039','Outros Serviços de Terceiros - Pessoa Jurídica'),
  ('tipo_despesa','33903046','Auxílio Alimentação'),
  ('tipo_despesa','33903049','Auxílio Transporte'),
  ('tipo_despesa','33903620','Locação de Veículos'),
  ('tipo_despesa','33903919','Manutenção e Conservação de Veículos'),
  ('tipo_despesa','31900401','Salários'),
  ('tipo_despesa','31901301','INSS Patronal'),
  ('tipo_despesa','31901302','FGTS'),
  ('tipo_despesa','31901600','Outras Despesas Variáveis - Pessoal Civil')
ON CONFLICT (categoria, codigo) DO NOTHING;

-- 4) Bucket de comprovantes para prestação de contas
INSERT INTO storage.buckets (id, name, public)
VALUES ('prestacao-contas','prestacao-contas', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "prestacao_select_auth" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'prestacao-contas');

CREATE POLICY "prestacao_insert_coord" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'prestacao-contas' AND public.has_role(auth.uid(),'coordenacao'::app_role));

CREATE POLICY "prestacao_update_coord" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'prestacao-contas' AND public.has_role(auth.uid(),'coordenacao'::app_role));

CREATE POLICY "prestacao_delete_coord" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'prestacao-contas' AND public.has_role(auth.uid(),'coordenacao'::app_role));
