
CREATE TABLE public.registros_fotograficos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  autor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  arquivo_url TEXT NOT NULL,
  drive_file_id TEXT NOT NULL,
  drive_folder_id TEXT NOT NULL,
  nome_arquivo TEXT NOT NULL,
  mes_ref TEXT NOT NULL,
  seq INTEGER NOT NULL,
  descricao TEXT,
  relatorio_id UUID REFERENCES public.relatorios_atividade(id) ON DELETE SET NULL,
  turma_id UUID REFERENCES public.turmas(id) ON DELETE SET NULL,
  profissionais_marcados UUID[] NOT NULL DEFAULT '{}'::uuid[],
  tamanho_bytes BIGINT,
  feed_post_id UUID REFERENCES public.feed_posts(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_regfotos_autor ON public.registros_fotograficos(autor_id);
CREATE INDEX idx_regfotos_mes ON public.registros_fotograficos(mes_ref);
CREATE INDEX idx_regfotos_created ON public.registros_fotograficos(created_at DESC);
CREATE INDEX idx_regfotos_relatorio ON public.registros_fotograficos(relatorio_id);
CREATE INDEX idx_regfotos_turma ON public.registros_fotograficos(turma_id);

ALTER TABLE public.registros_fotograficos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth view regfotos"
  ON public.registros_fotograficos FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Author insert regfotos"
  ON public.registros_fotograficos FOR INSERT
  TO authenticated WITH CHECK (
    (NOT has_role(auth.uid(), 'visitante'::app_role))
    AND autor_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Author or coord update regfotos"
  ON public.registros_fotograficos FOR UPDATE
  TO authenticated USING (
    autor_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    OR has_role(auth.uid(), 'coordenacao'::app_role)
  );

CREATE POLICY "Author or coord delete regfotos"
  ON public.registros_fotograficos FOR DELETE
  TO authenticated USING (
    autor_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    OR has_role(auth.uid(), 'coordenacao'::app_role)
  );

CREATE TRIGGER trg_regfotos_updated
  BEFORE UPDATE ON public.registros_fotograficos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auditoria (usa função existente)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'fn_audit_changes') THEN
    EXECUTE 'CREATE TRIGGER trg_audit_regfotos
      AFTER INSERT OR UPDATE OR DELETE ON public.registros_fotograficos
      FOR EACH ROW EXECUTE FUNCTION public.fn_audit_changes()';
  END IF;
END$$;

-- RPC para próxima sequência mensal (com lock para evitar duplicidade)
CREATE OR REPLACE FUNCTION public.next_regfoto_seq(_mes_ref TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _next INT;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('regfoto_seq_' || _mes_ref));
  SELECT COALESCE(MAX(seq), 0) + 1 INTO _next
    FROM public.registros_fotograficos
    WHERE mes_ref = _mes_ref;
  RETURN _next;
END;
$$;

GRANT EXECUTE ON FUNCTION public.next_regfoto_seq(TEXT) TO authenticated, service_role;
