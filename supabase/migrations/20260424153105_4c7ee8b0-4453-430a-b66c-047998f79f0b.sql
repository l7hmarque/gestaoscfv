INSERT INTO storage.buckets (id, name, public)
VALUES ('biblioteca-docx', 'biblioteca-docx', false)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.biblioteca_documentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL CHECK (tipo IN ('relatorio','planejamento')),
  origem_id uuid NOT NULL,
  titulo text NOT NULL,
  data_referencia date NOT NULL,
  ano int NOT NULL,
  mes int NOT NULL,
  educador_id uuid,
  educador_nome text,
  turma_nome text,
  storage_path text NOT NULL,
  file_size_bytes int,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','gerado','erro')),
  erro_mensagem text,
  gerado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tipo, origem_id)
);

CREATE INDEX IF NOT EXISTS idx_biblioteca_tipo_ano_mes ON public.biblioteca_documentos(tipo, ano, mes);
CREATE INDEX IF NOT EXISTS idx_biblioteca_educador ON public.biblioteca_documentos(educador_id);
CREATE INDEX IF NOT EXISTS idx_biblioteca_origem ON public.biblioteca_documentos(tipo, origem_id);

ALTER TABLE public.biblioteca_documentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "biblioteca_select_gestao"
ON public.biblioteca_documentos FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'coordenacao'::app_role)
  OR public.has_role(auth.uid(), 'tecnico'::app_role)
);

CREATE POLICY "biblioteca_select_educador_propios"
ON public.biblioteca_documentos FOR SELECT
TO authenticated
USING (
  educador_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
);

CREATE POLICY "biblioteca_coord_write"
ON public.biblioteca_documentos FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'coordenacao'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'coordenacao'::app_role));

CREATE TRIGGER biblioteca_documentos_updated_at
BEFORE UPDATE ON public.biblioteca_documentos
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "biblioteca_docx_select_gestao"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'biblioteca-docx' AND (
    public.has_role(auth.uid(), 'coordenacao'::app_role)
    OR public.has_role(auth.uid(), 'tecnico'::app_role)
  )
);

CREATE POLICY "biblioteca_docx_select_educador"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'biblioteca-docx' AND
  EXISTS (
    SELECT 1 FROM public.biblioteca_documentos bd
    JOIN public.profiles pr ON pr.id = bd.educador_id
    WHERE bd.storage_path = storage.objects.name
      AND pr.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "prestacao_contas_select_gestao" ON storage.objects;
CREATE POLICY "prestacao_contas_select_gestao"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'prestacao-contas' AND (
    public.has_role(auth.uid(), 'coordenacao'::app_role)
    OR public.has_role(auth.uid(), 'tecnico'::app_role)
  )
);

CREATE OR REPLACE FUNCTION public.enqueue_biblioteca_doc(
  _tipo text,
  _origem_id uuid
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_titulo text;
  v_data date;
  v_educador_id uuid;
  v_educador_nome text;
  v_turma_nome text;
BEGIN
  IF _tipo = 'relatorio' THEN
    SELECT
      COALESCE(r.nome_atividade, r.tipo_atividade_detalhe, 'Relatório'),
      r.data,
      r.educador_id,
      pr.nome,
      (SELECT string_agg(t.nome, ', ') FROM relatorio_turmas rt JOIN turmas t ON t.id = rt.turma_id WHERE rt.relatorio_id = r.id)
    INTO v_titulo, v_data, v_educador_id, v_educador_nome, v_turma_nome
    FROM relatorios_atividade r
    LEFT JOIN profiles pr ON pr.id = r.educador_id
    WHERE r.id = _origem_id;
  ELSIF _tipo = 'planejamento' THEN
    SELECT
      COALESCE(p.titulo, 'Planejamento'),
      COALESCE(p.data_aplicacao, current_date),
      p.educador_id,
      pr.nome,
      (SELECT string_agg(t.nome, ', ') FROM planejamento_turmas pt JOIN turmas t ON t.id = pt.turma_id WHERE pt.planejamento_id = p.id)
    INTO v_titulo, v_data, v_educador_id, v_educador_nome, v_turma_nome
    FROM planejamentos p
    LEFT JOIN profiles pr ON pr.id = p.educador_id
    WHERE p.id = _origem_id;
  ELSE
    RAISE EXCEPTION 'tipo invalido';
  END IF;

  IF v_titulo IS NULL THEN
    RAISE EXCEPTION 'origem nao encontrada';
  END IF;

  INSERT INTO public.biblioteca_documentos (
    tipo, origem_id, titulo, data_referencia, ano, mes,
    educador_id, educador_nome, turma_nome, storage_path, status
  ) VALUES (
    _tipo, _origem_id, v_titulo, v_data,
    EXTRACT(YEAR FROM v_data)::int, EXTRACT(MONTH FROM v_data)::int,
    v_educador_id, v_educador_nome, v_turma_nome,
    _tipo || 's/' || EXTRACT(YEAR FROM v_data)::int || '/' ||
      LPAD(EXTRACT(MONTH FROM v_data)::text, 2, '0') || '/' ||
      _origem_id::text || '.docx',
    'pendente'
  )
  ON CONFLICT (tipo, origem_id) DO UPDATE SET
    titulo = EXCLUDED.titulo,
    data_referencia = EXCLUDED.data_referencia,
    ano = EXCLUDED.ano,
    mes = EXCLUDED.mes,
    educador_id = EXCLUDED.educador_id,
    educador_nome = EXCLUDED.educador_nome,
    turma_nome = EXCLUDED.turma_nome,
    storage_path = EXCLUDED.storage_path,
    status = 'pendente',
    erro_mensagem = NULL,
    updated_at = now()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;