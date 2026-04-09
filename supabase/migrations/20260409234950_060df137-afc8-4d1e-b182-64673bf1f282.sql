
-- =============================================================
-- PARTE 1: CORRIGIR RLS — remover policies "true" que anulam deny
-- =============================================================

-- ---- participantes ----
DROP POLICY IF EXISTS "Authenticated insert participantes" ON public.participantes;
DROP POLICY IF EXISTS "Authenticated update participantes" ON public.participantes;
DROP POLICY IF EXISTS "Deny visitante insert participantes" ON public.participantes;
DROP POLICY IF EXISTS "Deny visitante update participantes" ON public.participantes;
DROP POLICY IF EXISTS "Deny visitante delete participantes" ON public.participantes;

CREATE POLICY "Non-visitante insert participantes" ON public.participantes
  FOR INSERT TO authenticated
  WITH CHECK (NOT has_role(auth.uid(), 'visitante'::app_role));

CREATE POLICY "Non-visitante update participantes" ON public.participantes
  FOR UPDATE TO authenticated
  USING (NOT has_role(auth.uid(), 'visitante'::app_role));

CREATE POLICY "Non-visitante delete participantes" ON public.participantes
  FOR DELETE TO authenticated
  USING (
    (NOT has_role(auth.uid(), 'visitante'::app_role))
    AND has_role(auth.uid(), 'coordenacao'::app_role)
  );

-- ---- presenca ----
DROP POLICY IF EXISTS "Authenticated manage presenca" ON public.presenca;
DROP POLICY IF EXISTS "Deny visitante insert presenca" ON public.presenca;
DROP POLICY IF EXISTS "Deny visitante update presenca" ON public.presenca;
DROP POLICY IF EXISTS "Deny visitante delete presenca" ON public.presenca;

CREATE POLICY "Non-visitante insert presenca" ON public.presenca
  FOR INSERT TO authenticated
  WITH CHECK (NOT has_role(auth.uid(), 'visitante'::app_role));

CREATE POLICY "Non-visitante update presenca" ON public.presenca
  FOR UPDATE TO authenticated
  USING (NOT has_role(auth.uid(), 'visitante'::app_role));

CREATE POLICY "Non-visitante delete presenca" ON public.presenca
  FOR DELETE TO authenticated
  USING (NOT has_role(auth.uid(), 'visitante'::app_role));

-- ---- planejamento_turmas ----
DROP POLICY IF EXISTS "Authenticated manage planejamento_turmas" ON public.planejamento_turmas;
DROP POLICY IF EXISTS "Deny visitante insert plan_turmas" ON public.planejamento_turmas;

CREATE POLICY "Non-visitante manage planejamento_turmas" ON public.planejamento_turmas
  FOR ALL TO authenticated
  USING (NOT has_role(auth.uid(), 'visitante'::app_role))
  WITH CHECK (NOT has_role(auth.uid(), 'visitante'::app_role));

-- ---- relatorio_presenca ----
DROP POLICY IF EXISTS "Authenticated manage relatorio_presenca" ON public.relatorio_presenca;
DROP POLICY IF EXISTS "Deny visitante insert rel_pres" ON public.relatorio_presenca;

CREATE POLICY "Non-visitante manage relatorio_presenca" ON public.relatorio_presenca
  FOR ALL TO authenticated
  USING (NOT has_role(auth.uid(), 'visitante'::app_role))
  WITH CHECK (NOT has_role(auth.uid(), 'visitante'::app_role));

-- ---- relatorio_turmas ----
DROP POLICY IF EXISTS "Authenticated manage relatorio_turmas" ON public.relatorio_turmas;
DROP POLICY IF EXISTS "Deny visitante insert rel_turmas" ON public.relatorio_turmas;

CREATE POLICY "Non-visitante manage relatorio_turmas" ON public.relatorio_turmas
  FOR ALL TO authenticated
  USING (NOT has_role(auth.uid(), 'visitante'::app_role))
  WITH CHECK (NOT has_role(auth.uid(), 'visitante'::app_role));

-- ---- relatorio_fotos ----
DROP POLICY IF EXISTS "Authenticated manage relatorio_fotos" ON public.relatorio_fotos;
DROP POLICY IF EXISTS "Deny visitante insert rel_fotos" ON public.relatorio_fotos;

CREATE POLICY "Non-visitante manage relatorio_fotos" ON public.relatorio_fotos
  FOR ALL TO authenticated
  USING (NOT has_role(auth.uid(), 'visitante'::app_role))
  WITH CHECK (NOT has_role(auth.uid(), 'visitante'::app_role));

-- ---- participante_documentos ----
DROP POLICY IF EXISTS "Authenticated insert docs" ON public.participante_documentos;
DROP POLICY IF EXISTS "Authenticated update docs" ON public.participante_documentos;
DROP POLICY IF EXISTS "Deny visitante insert docs" ON public.participante_documentos;
DROP POLICY IF EXISTS "Deny visitante delete docs" ON public.participante_documentos;

CREATE POLICY "Non-visitante insert docs" ON public.participante_documentos
  FOR INSERT TO authenticated
  WITH CHECK (NOT has_role(auth.uid(), 'visitante'::app_role));

CREATE POLICY "Non-visitante update docs" ON public.participante_documentos
  FOR UPDATE TO authenticated
  USING (NOT has_role(auth.uid(), 'visitante'::app_role));

-- ---- planejamentos (fix deny policies) ----
DROP POLICY IF EXISTS "Authenticated insert planejamentos" ON public.planejamentos;
DROP POLICY IF EXISTS "Deny visitante insert planejamentos" ON public.planejamentos;
DROP POLICY IF EXISTS "Deny visitante update planejamentos" ON public.planejamentos;
DROP POLICY IF EXISTS "Deny visitante delete planejamentos" ON public.planejamentos;

CREATE POLICY "Non-visitante insert planejamentos" ON public.planejamentos
  FOR INSERT TO authenticated
  WITH CHECK (NOT has_role(auth.uid(), 'visitante'::app_role));

-- =============================================================
-- PARTE 2: ÍNDICES DE PERFORMANCE
-- =============================================================

CREATE INDEX IF NOT EXISTS idx_presenca_participante_id ON public.presenca (participante_id);
CREATE INDEX IF NOT EXISTS idx_presenca_data ON public.presenca (data);
CREATE INDEX IF NOT EXISTS idx_atendimentos_participante_id ON public.atendimentos (participante_id);
CREATE INDEX IF NOT EXISTS idx_despesas_mes_referencia ON public.despesas (mes_referencia);
CREATE INDEX IF NOT EXISTS idx_relatorios_atividade_data ON public.relatorios_atividade (data);
CREATE INDEX IF NOT EXISTS idx_relatorios_atividade_educador_id ON public.relatorios_atividade (educador_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON public.audit_log (created_at);
CREATE INDEX IF NOT EXISTS idx_recados_destinatario_id ON public.recados (destinatario_id);
CREATE INDEX IF NOT EXISTS idx_participantes_status ON public.participantes (status);
CREATE INDEX IF NOT EXISTS idx_relatorio_presenca_relatorio_id ON public.relatorio_presenca (relatorio_id);
