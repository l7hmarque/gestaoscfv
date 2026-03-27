
DROP POLICY IF EXISTS "Coordenacao delete planejamentos" ON public.planejamentos;
CREATE POLICY "Author or coordenacao delete planejamentos" ON public.planejamentos
  FOR DELETE TO authenticated
  USING (
    educador_id = (SELECT id FROM profiles WHERE user_id = auth.uid() LIMIT 1)
    OR has_role(auth.uid(), 'coordenacao')
  );

DROP POLICY IF EXISTS "Coordenacao delete relatorios" ON public.relatorios_atividade;
CREATE POLICY "Author or coordenacao delete relatorios" ON public.relatorios_atividade
  FOR DELETE TO authenticated
  USING (
    educador_id = (SELECT id FROM profiles WHERE user_id = auth.uid() LIMIT 1)
    OR has_role(auth.uid(), 'coordenacao')
  );
