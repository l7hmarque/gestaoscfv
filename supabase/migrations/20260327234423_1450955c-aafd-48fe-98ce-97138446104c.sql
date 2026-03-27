-- Deny visitante writes on main tables
CREATE POLICY "Deny visitante insert participantes" ON public.participantes FOR INSERT TO authenticated WITH CHECK (NOT has_role(auth.uid(), 'visitante'::app_role));
CREATE POLICY "Deny visitante update participantes" ON public.participantes FOR UPDATE TO authenticated USING (NOT has_role(auth.uid(), 'visitante'::app_role));
CREATE POLICY "Deny visitante delete participantes" ON public.participantes FOR DELETE TO authenticated USING (NOT has_role(auth.uid(), 'visitante'::app_role));

CREATE POLICY "Deny visitante insert turmas" ON public.turmas FOR INSERT TO authenticated WITH CHECK (NOT has_role(auth.uid(), 'visitante'::app_role));
CREATE POLICY "Deny visitante update turmas" ON public.turmas FOR UPDATE TO authenticated USING (NOT has_role(auth.uid(), 'visitante'::app_role));
CREATE POLICY "Deny visitante delete turmas" ON public.turmas FOR DELETE TO authenticated USING (NOT has_role(auth.uid(), 'visitante'::app_role));

CREATE POLICY "Deny visitante insert planejamentos" ON public.planejamentos FOR INSERT TO authenticated WITH CHECK (NOT has_role(auth.uid(), 'visitante'::app_role));
CREATE POLICY "Deny visitante update planejamentos" ON public.planejamentos FOR UPDATE TO authenticated USING (NOT has_role(auth.uid(), 'visitante'::app_role));
CREATE POLICY "Deny visitante delete planejamentos" ON public.planejamentos FOR DELETE TO authenticated USING (NOT has_role(auth.uid(), 'visitante'::app_role));

CREATE POLICY "Deny visitante insert relatorios" ON public.relatorios_atividade FOR INSERT TO authenticated WITH CHECK (NOT has_role(auth.uid(), 'visitante'::app_role));
CREATE POLICY "Deny visitante update relatorios" ON public.relatorios_atividade FOR UPDATE TO authenticated USING (NOT has_role(auth.uid(), 'visitante'::app_role));
CREATE POLICY "Deny visitante delete relatorios" ON public.relatorios_atividade FOR DELETE TO authenticated USING (NOT has_role(auth.uid(), 'visitante'::app_role));

CREATE POLICY "Deny visitante insert presenca" ON public.presenca FOR INSERT TO authenticated WITH CHECK (NOT has_role(auth.uid(), 'visitante'::app_role));
CREATE POLICY "Deny visitante update presenca" ON public.presenca FOR UPDATE TO authenticated USING (NOT has_role(auth.uid(), 'visitante'::app_role));
CREATE POLICY "Deny visitante delete presenca" ON public.presenca FOR DELETE TO authenticated USING (NOT has_role(auth.uid(), 'visitante'::app_role));

CREATE POLICY "Deny visitante insert turma_part" ON public.turma_participantes FOR INSERT TO authenticated WITH CHECK (NOT has_role(auth.uid(), 'visitante'::app_role));
CREATE POLICY "Deny visitante update turma_part" ON public.turma_participantes FOR UPDATE TO authenticated USING (NOT has_role(auth.uid(), 'visitante'::app_role));
CREATE POLICY "Deny visitante delete turma_part" ON public.turma_participantes FOR DELETE TO authenticated USING (NOT has_role(auth.uid(), 'visitante'::app_role));

CREATE POLICY "Deny visitante manage roles" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (NOT has_role(auth.uid(), 'visitante'::app_role));
CREATE POLICY "Deny visitante update profiles" ON public.profiles FOR UPDATE TO authenticated USING (NOT has_role(auth.uid(), 'visitante'::app_role));

CREATE POLICY "Deny visitante insert docs" ON public.participante_documentos FOR INSERT TO authenticated WITH CHECK (NOT has_role(auth.uid(), 'visitante'::app_role));
CREATE POLICY "Deny visitante delete docs" ON public.participante_documentos FOR DELETE TO authenticated USING (NOT has_role(auth.uid(), 'visitante'::app_role));

CREATE POLICY "Deny visitante insert rel_pres" ON public.relatorio_presenca FOR INSERT TO authenticated WITH CHECK (NOT has_role(auth.uid(), 'visitante'::app_role));
CREATE POLICY "Deny visitante insert rel_turmas" ON public.relatorio_turmas FOR INSERT TO authenticated WITH CHECK (NOT has_role(auth.uid(), 'visitante'::app_role));
CREATE POLICY "Deny visitante insert rel_fotos" ON public.relatorio_fotos FOR INSERT TO authenticated WITH CHECK (NOT has_role(auth.uid(), 'visitante'::app_role));
CREATE POLICY "Deny visitante insert plan_turmas" ON public.planejamento_turmas FOR INSERT TO authenticated WITH CHECK (NOT has_role(auth.uid(), 'visitante'::app_role));
CREATE POLICY "Deny visitante manage pontos" ON public.pontos_transporte FOR INSERT TO authenticated WITH CHECK (NOT has_role(auth.uid(), 'visitante'::app_role));