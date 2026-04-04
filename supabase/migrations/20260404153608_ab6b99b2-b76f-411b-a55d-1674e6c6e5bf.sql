ALTER TABLE public.despesas ADD COLUMN IF NOT EXISTS fornecedor text;
ALTER TABLE public.despesas ADD COLUMN IF NOT EXISTS cnpj_cpf text;
ALTER TABLE public.despesas ADD COLUMN IF NOT EXISTS numero_documento text;
ALTER TABLE public.despesas ADD COLUMN IF NOT EXISTS tipo_documento text DEFAULT 'nota_fiscal';
ALTER TABLE public.despesas ADD COLUMN IF NOT EXISTS comprovante_url text;
ALTER TABLE public.despesas ADD COLUMN IF NOT EXISTS nota_url text;
ALTER TABLE public.despesas ADD COLUMN IF NOT EXISTS boleto_url text;
ALTER TABLE public.despesas ADD COLUMN IF NOT EXISTS status_sit text DEFAULT 'pendente';
ALTER TABLE public.despesas ADD COLUMN IF NOT EXISTS lote_id uuid;