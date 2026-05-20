
-- ============================================================
-- ONDA 1 — Sistema de Capabilities Granulares por Módulo
-- ============================================================

-- 1) Tabela de overrides por usuário/módulo
CREATE TABLE IF NOT EXISTS public.user_module_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  module text NOT NULL,
  level text NOT NULL CHECK (level IN ('none','read','write','admin')),
  granted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, module)
);

CREATE INDEX IF NOT EXISTS idx_user_module_access_user ON public.user_module_access(user_id);

ALTER TABLE public.user_module_access ENABLE ROW LEVEL SECURITY;

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.tg_user_module_access_touch()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_user_module_access_touch ON public.user_module_access;
CREATE TRIGGER trg_user_module_access_touch
BEFORE UPDATE ON public.user_module_access
FOR EACH ROW EXECUTE FUNCTION public.tg_user_module_access_touch();

-- 2) Super admin (por email)
CREATE OR REPLACE FUNCTION public.is_super_admin(_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = _user
      AND lower(email) IN ('l7hmarque@gmail.com')
  );
$$;

-- 3) Default por role (matriz pacote-por-papel)
-- Retorna level default; 'none' se nada se aplica.
CREATE OR REPLACE FUNCTION public.default_module_level(_user uuid, _module text)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_lvl text := 'none';
  v_is_coord boolean;
  v_is_tec boolean;
  v_is_edu boolean;
  v_is_mot boolean;
  v_is_coz boolean;
  v_is_vis boolean;
  v_is_mkt boolean;
BEGIN
  IF public.is_super_admin(_user) THEN RETURN 'admin'; END IF;

  SELECT
    bool_or(role = 'coordenacao'),
    bool_or(role = 'tecnico'),
    bool_or(role = 'educador'),
    bool_or(role = 'motorista'),
    bool_or(role = 'cozinheiro'),
    bool_or(role = 'visitante'),
    bool_or(role = 'marketing')
  INTO v_is_coord, v_is_tec, v_is_edu, v_is_mot, v_is_coz, v_is_vis, v_is_mkt
  FROM public.user_roles WHERE user_id = _user;

  IF v_is_coord THEN RETURN 'admin'; END IF;

  -- Visitante = read em tudo
  IF v_is_vis AND NOT (v_is_tec OR v_is_edu OR v_is_mot OR v_is_coz OR v_is_mkt) THEN
    RETURN 'read';
  END IF;

  -- Matriz por módulo
  CASE _module
    WHEN 'dashboard' THEN
      IF v_is_tec OR v_is_edu OR v_is_mot OR v_is_coz OR v_is_mkt THEN v_lvl := 'read'; END IF;

    WHEN 'participantes' THEN
      IF v_is_tec THEN v_lvl := 'write';
      ELSIF v_is_edu OR v_is_mot THEN v_lvl := 'read'; END IF;

    WHEN 'turmas' THEN
      IF v_is_edu OR v_is_tec THEN v_lvl := 'read'; END IF;

    WHEN 'presenca' THEN
      IF v_is_edu THEN v_lvl := 'write';
      ELSIF v_is_tec THEN v_lvl := 'read'; END IF;

    WHEN 'planejamentos' THEN
      IF v_is_edu OR v_is_tec THEN v_lvl := 'write'; END IF;

    WHEN 'relatorios' THEN
      IF v_is_edu OR v_is_tec THEN v_lvl := 'write'; END IF;

    WHEN 'registros_fotograficos' THEN
      IF v_is_edu OR v_is_tec OR v_is_mkt THEN v_lvl := 'write'; END IF;

    WHEN 'cronograma' THEN
      IF v_is_edu OR v_is_tec OR v_is_mot THEN v_lvl := 'read'; END IF;

    WHEN 'transporte' THEN
      IF v_is_mot THEN v_lvl := 'write';
      ELSIF v_is_tec OR v_is_edu THEN v_lvl := 'read'; END IF;

    WHEN 'cozinha' THEN
      IF v_is_coz THEN v_lvl := 'write'; END IF;

    WHEN 'feed' THEN
      IF v_is_tec OR v_is_edu OR v_is_mot OR v_is_coz OR v_is_mkt THEN v_lvl := 'write'; END IF;

    WHEN 'equipe_tecnica' THEN
      IF v_is_tec THEN v_lvl := 'write'; END IF;

    WHEN 'integridade' THEN
      IF v_is_tec THEN v_lvl := 'read'; END IF;

    WHEN 'banco_dados' THEN v_lvl := 'none';
    WHEN 'configuracoes' THEN v_lvl := 'none';
    WHEN 'auditoria' THEN v_lvl := 'none';
    WHEN 'permissoes' THEN v_lvl := 'none';
    WHEN 'coordenacao' THEN v_lvl := 'none';

    WHEN 'site_publico' THEN
      IF v_is_mkt THEN v_lvl := 'write'; END IF;

    ELSE v_lvl := 'none';
  END CASE;

  RETURN v_lvl;
END;
$$;

-- 4) Função principal de checagem
CREATE OR REPLACE FUNCTION public.has_module_access(_user uuid, _module text, _min_level text DEFAULT 'read')
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_override text;
  v_lvl text;
  v_score int;
  v_min int;
BEGIN
  IF _user IS NULL THEN RETURN false; END IF;
  IF public.is_super_admin(_user) THEN RETURN true; END IF;

  SELECT level INTO v_override FROM public.user_module_access
  WHERE user_id = _user AND module = _module LIMIT 1;

  v_lvl := COALESCE(v_override, public.default_module_level(_user, _module));

  v_score := CASE v_lvl WHEN 'admin' THEN 3 WHEN 'write' THEN 2 WHEN 'read' THEN 1 ELSE 0 END;
  v_min   := CASE _min_level WHEN 'admin' THEN 3 WHEN 'write' THEN 2 WHEN 'read' THEN 1 ELSE 0 END;

  RETURN v_score >= v_min;
END;
$$;

-- 5) Função pra ler todas capabilities efetivas (usada pelo frontend)
CREATE OR REPLACE FUNCTION public.get_my_module_access()
RETURNS TABLE(module text, level text, source text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_mod text;
  v_override text;
  v_default text;
  v_modules text[] := ARRAY[
    'dashboard','participantes','turmas','presenca','planejamentos','relatorios',
    'registros_fotograficos','cronograma','transporte','cozinha','feed',
    'equipe_tecnica','integridade','banco_dados','configuracoes',
    'auditoria','permissoes','site_publico','coordenacao'
  ];
BEGIN
  IF v_uid IS NULL THEN RETURN; END IF;

  IF public.is_super_admin(v_uid) THEN
    FOREACH v_mod IN ARRAY v_modules LOOP
      module := v_mod; level := 'admin'; source := 'super_admin'; RETURN NEXT;
    END LOOP;
    RETURN;
  END IF;

  FOREACH v_mod IN ARRAY v_modules LOOP
    SELECT uma.level INTO v_override FROM public.user_module_access uma
    WHERE uma.user_id = v_uid AND uma.module = v_mod LIMIT 1;
    v_default := public.default_module_level(v_uid, v_mod);
    module := v_mod;
    level := COALESCE(v_override, v_default);
    source := CASE WHEN v_override IS NOT NULL THEN 'override' ELSE 'role_default' END;
    RETURN NEXT;
  END LOOP;
END;
$$;

-- 6) RLS para user_module_access
DROP POLICY IF EXISTS uma_select ON public.user_module_access;
DROP POLICY IF EXISTS uma_admin_write ON public.user_module_access;

CREATE POLICY uma_select ON public.user_module_access
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR public.has_role(auth.uid(), 'coordenacao'::app_role)
  OR public.is_super_admin(auth.uid())
);

CREATE POLICY uma_admin_write ON public.user_module_access
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'coordenacao'::app_role) OR public.is_super_admin(auth.uid()))
WITH CHECK (public.has_role(auth.uid(), 'coordenacao'::app_role) OR public.is_super_admin(auth.uid()));
