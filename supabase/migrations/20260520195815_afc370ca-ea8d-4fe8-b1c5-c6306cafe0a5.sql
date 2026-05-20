
-- Hardening aditivo: super_admin sempre passa; overrides de module_access ganham efeito
-- Estratégia: criar policies PERMISSIVAS adicionais (OR lógico com as existentes)

-- ===== participantes =====
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='participantes') THEN
    DROP POLICY IF EXISTS "super_admin_all_participantes" ON public.participantes;
    CREATE POLICY "super_admin_all_participantes" ON public.participantes
      FOR ALL TO authenticated
      USING (public.is_super_admin(auth.uid()) OR public.has_module_access(auth.uid(),'participantes','read'))
      WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_module_access(auth.uid(),'participantes','write'));
  END IF;
END $$;

-- ===== turmas =====
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='turmas') THEN
    DROP POLICY IF EXISTS "super_admin_all_turmas" ON public.turmas;
    CREATE POLICY "super_admin_all_turmas" ON public.turmas
      FOR ALL TO authenticated
      USING (public.is_super_admin(auth.uid()) OR public.has_module_access(auth.uid(),'turmas','read'))
      WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_module_access(auth.uid(),'turmas','write'));
  END IF;
END $$;

-- ===== relatorios_atividade =====
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='relatorios_atividade') THEN
    DROP POLICY IF EXISTS "super_admin_all_relatorios" ON public.relatorios_atividade;
    CREATE POLICY "super_admin_all_relatorios" ON public.relatorios_atividade
      FOR ALL TO authenticated
      USING (public.is_super_admin(auth.uid()) OR public.has_module_access(auth.uid(),'relatorios','read'))
      WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_module_access(auth.uid(),'relatorios','write'));
  END IF;
END $$;

-- ===== planejamentos =====
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='planejamentos') THEN
    DROP POLICY IF EXISTS "super_admin_all_planejamentos" ON public.planejamentos;
    CREATE POLICY "super_admin_all_planejamentos" ON public.planejamentos
      FOR ALL TO authenticated
      USING (public.is_super_admin(auth.uid()) OR public.has_module_access(auth.uid(),'planejamentos','read'))
      WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_module_access(auth.uid(),'planejamentos','write'));
  END IF;
END $$;

-- ===== presencas =====
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='presencas') THEN
    DROP POLICY IF EXISTS "super_admin_all_presencas" ON public.presencas;
    CREATE POLICY "super_admin_all_presencas" ON public.presencas
      FOR ALL TO authenticated
      USING (public.is_super_admin(auth.uid()) OR public.has_module_access(auth.uid(),'presenca','read'))
      WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_module_access(auth.uid(),'presenca','write'));
  END IF;
END $$;

-- ===== audit_log: super_admin pode ler =====
DROP POLICY IF EXISTS "super_admin_select_audit_log" ON public.audit_log;
CREATE POLICY "super_admin_select_audit_log" ON public.audit_log
  FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_module_access(auth.uid(),'auditoria','read'));

-- ===== configuracoes_gerais =====
DROP POLICY IF EXISTS "super_admin_all_configuracoes" ON public.configuracoes_gerais;
CREATE POLICY "super_admin_all_configuracoes" ON public.configuracoes_gerais
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_module_access(auth.uid(),'configuracoes','read'))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_module_access(auth.uid(),'configuracoes','admin'));

-- ===== user_module_access (auto-proteção): apenas super_admin ou módulo 'permissoes' admin =====
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='user_module_access') THEN
    DROP POLICY IF EXISTS "super_admin_all_uma" ON public.user_module_access;
    CREATE POLICY "super_admin_all_uma" ON public.user_module_access
      FOR ALL TO authenticated
      USING (public.is_super_admin(auth.uid()) OR public.has_module_access(auth.uid(),'permissoes','admin'))
      WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_module_access(auth.uid(),'permissoes','admin'));
  END IF;
END $$;
