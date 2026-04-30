
-- 1) PROFILES: revogar SELECT em colunas sensíveis
REVOKE SELECT (salario, cpf, rg, rg_data_expedicao, rg_orgao_expedidor,
               endereco, telefone, registro_profissional, data_desligamento)
  ON public.profiles FROM authenticated;

-- RPC RH (coordenação) — carga_horaria é text na tabela
CREATE OR REPLACE FUNCTION public.list_profiles_rh()
RETURNS TABLE(
  id uuid, user_id uuid, nome text, cargo text, ativo boolean,
  email text, telefone text, carga_horaria text,
  data_inicio date, data_desligamento date, salario numeric,
  cpf text, rg text, rg_data_expedicao date, rg_orgao_expedidor text,
  endereco text, registro_profissional text, foto_url text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id, user_id, nome, cargo, ativo, email, telefone, carga_horaria,
         data_inicio, data_desligamento, salario, cpf, rg, rg_data_expedicao,
         rg_orgao_expedidor, endereco, registro_profissional, foto_url
  FROM public.profiles
  WHERE public.has_role(auth.uid(), 'coordenacao'::app_role)
  ORDER BY nome;
$$;

CREATE OR REPLACE FUNCTION public.get_profile_full(_profile_id uuid)
RETURNS SETOF public.profiles
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT * FROM public.profiles
  WHERE id = _profile_id
    AND (user_id = auth.uid() OR public.has_role(auth.uid(), 'coordenacao'::app_role));
$$;

REVOKE EXECUTE ON FUNCTION public.list_profiles_rh() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.list_profiles_rh() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_profile_full(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_profile_full(uuid) TO authenticated;

-- 2) sit_configuracao
DROP POLICY IF EXISTS "sit_config_select_auth" ON public.sit_configuracao;
CREATE POLICY "sit_config_select_gestao" ON public.sit_configuracao FOR SELECT
  USING (public.has_role(auth.uid(),'coordenacao'::app_role) OR public.has_role(auth.uid(),'tecnico'::app_role));

-- 3) turmas: remover UPDATE (true)
DROP POLICY IF EXISTS "Authenticated update turmas" ON public.turmas;
CREATE POLICY "Operational update turmas" ON public.turmas FOR UPDATE
  USING (public.has_role(auth.uid(),'coordenacao'::app_role) OR public.has_role(auth.uid(),'educador'::app_role) OR public.has_role(auth.uid(),'tecnico'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'coordenacao'::app_role) OR public.has_role(auth.uid(),'educador'::app_role) OR public.has_role(auth.uid(),'tecnico'::app_role));

-- 4) user_roles
DROP POLICY IF EXISTS "Roles viewable by authenticated" ON public.user_roles;
CREATE POLICY "Users see own role, coord sees all" ON public.user_roles FOR SELECT
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'coordenacao'::app_role));

-- 5) storage: prestacao-contas
DROP POLICY IF EXISTS "prestacao_select_auth" ON storage.objects;

-- 6) storage: documentos com checagem de propriedade
DROP POLICY IF EXISTS "Auth read own documents" ON storage.objects;
CREATE POLICY "Auth read own documents" ON storage.objects FOR SELECT
  USING (
    bucket_id = 'documentos'
    AND (auth.uid()::text = (storage.foldername(name))[1] OR public.has_role(auth.uid(),'coordenacao'::app_role))
  );

-- 7) storage: fotos-relatorios — remove INSERTs abertos
DROP POLICY IF EXISTS "Auth insert fotos-relatorios" ON storage.objects;
DROP POLICY IF EXISTS "Auth upload fotos relatorios" ON storage.objects;
