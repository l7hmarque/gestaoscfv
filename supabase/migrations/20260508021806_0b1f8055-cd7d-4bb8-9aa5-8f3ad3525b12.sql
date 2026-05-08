
-- =========================================================
-- 1. Tabelas de suporte
-- =========================================================
CREATE TABLE IF NOT EXISTS public.drive_sync_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL CHECK (tipo IN ('relatorio','planejamento','foto')),
  origem_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','processando','sincronizado','erro')),
  drive_file_id text,
  drive_url text,
  tentativas int NOT NULL DEFAULT 0,
  ultimo_erro text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  synced_at timestamptz,
  UNIQUE (tipo, origem_id)
);

CREATE INDEX IF NOT EXISTS idx_drive_sync_queue_status ON public.drive_sync_queue (status, created_at);

CREATE TABLE IF NOT EXISTS public.drive_folder_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chave text NOT NULL UNIQUE, -- ex: profissional:{uuid}:relatorios | fotos:2026-04 | root
  folder_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.drive_sync_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drive_folder_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coord_view_queue" ON public.drive_sync_queue
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'coordenacao'::app_role));

CREATE POLICY "coord_manage_queue" ON public.drive_sync_queue
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'coordenacao'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'coordenacao'::app_role));

CREATE POLICY "coord_view_folder_cache" ON public.drive_folder_cache
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'coordenacao'::app_role));

-- =========================================================
-- 2. Colunas de rastreamento
-- =========================================================
ALTER TABLE public.planejamentos
  ADD COLUMN IF NOT EXISTS drive_file_id text,
  ADD COLUMN IF NOT EXISTS drive_url text;

ALTER TABLE public.relatorios_atividade
  ADD COLUMN IF NOT EXISTS drive_file_id text,
  ADD COLUMN IF NOT EXISTS drive_url text;

ALTER TABLE public.relatorio_fotos
  ADD COLUMN IF NOT EXISTS drive_file_id text,
  ADD COLUMN IF NOT EXISTS drive_url text,
  ADD COLUMN IF NOT EXISTS veracidade_hash text,
  ADD COLUMN IF NOT EXISTS exif_metadata jsonb;

CREATE INDEX IF NOT EXISTS idx_relatorio_fotos_veracidade_hash ON public.relatorio_fotos (veracidade_hash);

-- =========================================================
-- 3. Trigger genérico de updated_at
-- =========================================================
CREATE TRIGGER trg_drive_sync_queue_updated
BEFORE UPDATE ON public.drive_sync_queue
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- 4. Função para enfileirar
-- =========================================================
CREATE OR REPLACE FUNCTION public.enqueue_drive_sync(_tipo text, _origem_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.drive_sync_queue (tipo, origem_id, status, tentativas, ultimo_erro)
  VALUES (_tipo, _origem_id, 'pendente', 0, NULL)
  ON CONFLICT (tipo, origem_id) DO UPDATE SET
    status = 'pendente',
    tentativas = 0,
    ultimo_erro = NULL,
    updated_at = now();
END;
$$;

-- =========================================================
-- 5. Triggers em relatorios / planejamentos / fotos
-- =========================================================
CREATE OR REPLACE FUNCTION public.fn_trigger_drive_sync_relatorio()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.enqueue_drive_sync('relatorio', NEW.id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_trigger_drive_sync_planejamento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.enqueue_drive_sync('planejamento', NEW.id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_trigger_drive_sync_foto()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.enqueue_drive_sync('foto', NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_drive_sync_relatorio ON public.relatorios_atividade;
CREATE TRIGGER trg_drive_sync_relatorio
AFTER INSERT OR UPDATE ON public.relatorios_atividade
FOR EACH ROW EXECUTE FUNCTION public.fn_trigger_drive_sync_relatorio();

DROP TRIGGER IF EXISTS trg_drive_sync_planejamento ON public.planejamentos;
CREATE TRIGGER trg_drive_sync_planejamento
AFTER INSERT OR UPDATE ON public.planejamentos
FOR EACH ROW EXECUTE FUNCTION public.fn_trigger_drive_sync_planejamento();

DROP TRIGGER IF EXISTS trg_drive_sync_foto ON public.relatorio_fotos;
CREATE TRIGGER trg_drive_sync_foto
AFTER INSERT ON public.relatorio_fotos
FOR EACH ROW EXECUTE FUNCTION public.fn_trigger_drive_sync_foto();
