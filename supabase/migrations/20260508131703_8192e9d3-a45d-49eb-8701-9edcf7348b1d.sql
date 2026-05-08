
-- Estender tipos aceitos na fila de sincronização
ALTER TABLE public.drive_sync_queue DROP CONSTRAINT IF EXISTS drive_sync_queue_tipo_check;
ALTER TABLE public.drive_sync_queue ADD CONSTRAINT drive_sync_queue_tipo_check
  CHECK (tipo = ANY (ARRAY[
    'relatorio','planejamento','foto',
    'roteiro_visita','atendimento','orcamento','prestacao_contas',
    'cardapio_mensal','movimentacao_mensal','transporte_diario',
    'lista_chamada_lote','lista_frequencia_lote'
  ]));

-- Permitir payload (para lotes etc.)
ALTER TABLE public.drive_sync_queue ADD COLUMN IF NOT EXISTS payload jsonb;

-- Colunas drive_* nas tabelas alvo
ALTER TABLE public.roteiros_visita ADD COLUMN IF NOT EXISTS drive_file_id text, ADD COLUMN IF NOT EXISTS drive_url text;
ALTER TABLE public.atendimentos ADD COLUMN IF NOT EXISTS drive_file_id text, ADD COLUMN IF NOT EXISTS drive_url text;
ALTER TABLE public.orcamentos ADD COLUMN IF NOT EXISTS drive_file_id text, ADD COLUMN IF NOT EXISTS drive_url text;
ALTER TABLE public.documentos_prestacao_contas ADD COLUMN IF NOT EXISTS drive_file_id text, ADD COLUMN IF NOT EXISTS drive_url text;

-- Tabela para planilhas mensais consolidadas (listas de chamada/frequência, cardápio, movimentações, transporte)
CREATE TABLE IF NOT EXISTS public.drive_planilhas_mensais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL CHECK (tipo IN ('lista_chamada','lista_frequencia','cardapio','movimentacao','transporte')),
  ano_mes text NOT NULL,
  drive_file_id text,
  drive_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tipo, ano_mes)
);

ALTER TABLE public.drive_planilhas_mensais ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Coordenacao ve planilhas mensais" ON public.drive_planilhas_mensais
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'coordenacao'::app_role) OR true);
-- (todos autenticados podem ler o link; o conteúdo é controlado pelo Drive)

CREATE TRIGGER trg_drive_planilhas_mensais_updated
  BEFORE UPDATE ON public.drive_planilhas_mensais
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Triggers de enfileiramento para os novos tipos (idempotente, com guarda anti-loop)
CREATE OR REPLACE FUNCTION public.fn_enqueue_drive_sync(_tipo text, _origem_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
  INSERT INTO public.drive_sync_queue (tipo, origem_id, status, tentativas)
  VALUES (_tipo, _origem_id, 'pendente', 0)
  ON CONFLICT (tipo, origem_id) DO UPDATE SET status='pendente', tentativas=0, ultimo_erro=NULL;
$$;

CREATE OR REPLACE FUNCTION public.fn_trg_enqueue_roteiro() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN PERFORM public.fn_enqueue_drive_sync('roteiro_visita', NEW.id); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS trg_enqueue_roteiro ON public.roteiros_visita;
CREATE TRIGGER trg_enqueue_roteiro AFTER INSERT OR UPDATE OF titulo, observacoes, status, concluido_em ON public.roteiros_visita
FOR EACH ROW EXECUTE FUNCTION public.fn_trg_enqueue_roteiro();

CREATE OR REPLACE FUNCTION public.fn_trg_enqueue_atendimento() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN PERFORM public.fn_enqueue_drive_sync('atendimento', NEW.id); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS trg_enqueue_atendimento ON public.atendimentos;
CREATE TRIGGER trg_enqueue_atendimento AFTER INSERT OR UPDATE OF descricao, encaminhamento, tipo ON public.atendimentos
FOR EACH ROW EXECUTE FUNCTION public.fn_trg_enqueue_atendimento();

CREATE OR REPLACE FUNCTION public.fn_trg_enqueue_orcamento() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN PERFORM public.fn_enqueue_drive_sync('orcamento', NEW.id); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS trg_enqueue_orcamento ON public.orcamentos;
CREATE TRIGGER trg_enqueue_orcamento AFTER INSERT OR UPDATE OF status, fornecedor_vencedor ON public.orcamentos
FOR EACH ROW EXECUTE FUNCTION public.fn_trg_enqueue_orcamento();

CREATE OR REPLACE FUNCTION public.fn_trg_enqueue_prestacao() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN PERFORM public.fn_enqueue_drive_sync('prestacao_contas', NEW.id); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS trg_enqueue_prestacao ON public.documentos_prestacao_contas;
CREATE TRIGGER trg_enqueue_prestacao AFTER INSERT OR UPDATE OF titulo, descricao, arquivo_url ON public.documentos_prestacao_contas
FOR EACH ROW EXECUTE FUNCTION public.fn_trg_enqueue_prestacao();
