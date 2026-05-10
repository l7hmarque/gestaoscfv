CREATE TABLE IF NOT EXISTS public.auditoria_abril_desligamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participante_id uuid NOT NULL REFERENCES public.participantes(id) ON DELETE CASCADE,
  turma_id uuid REFERENCES public.turmas(id) ON DELETE SET NULL,
  data_saida_efetiva date NOT NULL DEFAULT '2026-04-30',
  motivo text DEFAULT 'Identificado via auditoria da planilha de Abril/2026 (linha tachada)',
  revisado boolean NOT NULL DEFAULT false,
  revisado_em timestamptz,
  revisado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.auditoria_abril_desligamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coordenacao gere auditoria abril"
  ON public.auditoria_abril_desligamentos
  FOR ALL
  USING (public.has_role(auth.uid(), 'coordenacao'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'coordenacao'::app_role));

CREATE INDEX IF NOT EXISTS idx_aud_abril_desl_participante ON public.auditoria_abril_desligamentos(participante_id);