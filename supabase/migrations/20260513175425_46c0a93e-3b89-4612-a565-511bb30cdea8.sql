DROP TABLE IF EXISTS public.caixa_entrada_documentos CASCADE;
DROP TABLE IF EXISTS public.controle_bancario_lancamentos CASCADE;
DROP TABLE IF EXISTS public.despesa_lotes_importacao CASCADE;
DROP TABLE IF EXISTS public.sit_codigos CASCADE;
DROP TABLE IF EXISTS public.sit_configuracao CASCADE;
DROP FUNCTION IF EXISTS public.match_controle_bancario_to_despesas() CASCADE;
DROP FUNCTION IF EXISTS public.fn_trg_enqueue_orcamento() CASCADE;