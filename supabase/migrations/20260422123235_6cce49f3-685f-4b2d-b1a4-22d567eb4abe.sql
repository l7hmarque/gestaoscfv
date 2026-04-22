-- 1. PROFILES: restringir SELECT (owner + coordenacao apenas)
DROP POLICY IF EXISTS "Profiles viewable by authenticated" ON public.profiles;
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles viewable" ON public.profiles;

CREATE POLICY "Owner or coordenacao select profiles"
ON public.profiles FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'coordenacao'::app_role));

-- View pública com colunas não sensíveis para uso operacional (nome, cargo, foto)
CREATE OR REPLACE VIEW public.profiles_public
WITH (security_invoker = true)
AS
SELECT id, user_id, nome, cargo, foto_url, ativo, created_at
FROM public.profiles;

GRANT SELECT ON public.profiles_public TO authenticated, anon;

-- Política adicional para permitir leitura dos campos não-sensíveis via subqueries
-- (mantendo joins de feed/recados/relatórios funcionais)
CREATE POLICY "Authenticated read non-sensitive profile fields"
ON public.profiles FOR SELECT TO authenticated
USING (true);

-- A política acima reabre SELECT, então invertemos a abordagem:
DROP POLICY IF EXISTS "Authenticated read non-sensitive profile fields" ON public.profiles;
DROP POLICY IF EXISTS "Owner or coordenacao select profiles" ON public.profiles;

-- Estratégia final: manter SELECT amplo (necessário para joins de feed/recados/turmas/relatórios)
-- mas mover dados realmente sensíveis para column-level revoke não é trivial em PG sem refatorar.
-- Aplicamos uma view restrita e mantemos a tabela acessível, MAS removendo colunas sensíveis
-- da exposição via revogação de SELECT em colunas específicas.
CREATE POLICY "Profiles base select"
ON public.profiles FOR SELECT TO authenticated
USING (true);

-- Revogar SELECT em colunas sensíveis para authenticated; somente coordenacao via has_role poderá ler via RPC
REVOKE SELECT (salario, cpf, rg, rg_data_expedicao, rg_orgao_expedidor, endereco, telefone, registro_profissional, data_inicio, data_desligamento)
ON public.profiles FROM authenticated, anon;

-- Função SECURITY DEFINER para o próprio usuário ou coordenação ler dados sensíveis
CREATE OR REPLACE FUNCTION public.get_profile_sensitive(_profile_id uuid)
RETURNS TABLE(
  id uuid, user_id uuid, salario numeric, cpf text, rg text,
  rg_data_expedicao date, rg_orgao_expedidor text, endereco text,
  telefone text, registro_profissional text, data_inicio date, data_desligamento date
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.user_id, p.salario, p.cpf, p.rg, p.rg_data_expedicao, p.rg_orgao_expedidor,
         p.endereco, p.telefone, p.registro_profissional, p.data_inicio, p.data_desligamento
  FROM public.profiles p
  WHERE p.id = _profile_id
    AND (p.user_id = auth.uid() OR public.has_role(auth.uid(), 'coordenacao'::app_role));
$$;

-- 2. USER_ROLES: remover política permissiva que dava INSERT a qualquer não-visitante
DROP POLICY IF EXISTS "Deny visitante manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Non-visitante insert roles" ON public.user_roles;
-- Manter apenas "Coordenacao manages roles" (ALL para coordenacao)

-- 3. STORAGE: bucket fotos-participantes -> privado
UPDATE storage.buckets SET public = false WHERE id = 'fotos-participantes';

-- Remover políticas antigas e recriar com auth + role checks
DROP POLICY IF EXISTS "Public read fotos participantes" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated upload fotos participantes" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated update fotos participantes" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete fotos participantes" ON storage.objects;

CREATE POLICY "Authenticated read fotos participantes"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'fotos-participantes' AND NOT public.has_role(auth.uid(), 'visitante'::app_role));

CREATE POLICY "Operational upload fotos participantes"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'fotos-participantes'
  AND (public.has_role(auth.uid(), 'coordenacao'::app_role)
       OR public.has_role(auth.uid(), 'tecnico'::app_role)
       OR public.has_role(auth.uid(), 'educador'::app_role))
);

CREATE POLICY "Operational update fotos participantes"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'fotos-participantes'
  AND (public.has_role(auth.uid(), 'coordenacao'::app_role)
       OR public.has_role(auth.uid(), 'tecnico'::app_role)
       OR public.has_role(auth.uid(), 'educador'::app_role))
);

CREATE POLICY "Coordenacao delete fotos participantes"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'fotos-participantes' AND public.has_role(auth.uid(), 'coordenacao'::app_role));

-- 4. STORAGE: fotos-relatorios — upload com role check
DROP POLICY IF EXISTS "Authenticated upload fotos relatorios" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated update fotos relatorios" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete fotos relatorios" ON storage.objects;

CREATE POLICY "Operational upload fotos relatorios"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'fotos-relatorios'
  AND (public.has_role(auth.uid(), 'coordenacao'::app_role)
       OR public.has_role(auth.uid(), 'tecnico'::app_role)
       OR public.has_role(auth.uid(), 'educador'::app_role))
);

CREATE POLICY "Operational update fotos relatorios"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'fotos-relatorios'
  AND (public.has_role(auth.uid(), 'coordenacao'::app_role)
       OR public.has_role(auth.uid(), 'tecnico'::app_role)
       OR public.has_role(auth.uid(), 'educador'::app_role))
);

CREATE POLICY "Coordenacao delete fotos relatorios"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'fotos-relatorios' AND public.has_role(auth.uid(), 'coordenacao'::app_role));

-- 5. REALTIME: políticas em realtime.messages para escopo de canal
-- Habilitar RLS (idempotente)
ALTER TABLE IF EXISTS realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated realtime by topic ownership" ON realtime.messages;

CREATE POLICY "Authenticated realtime by topic ownership"
ON realtime.messages FOR SELECT TO authenticated
USING (
  -- Coordenação enxerga tudo
  public.has_role(auth.uid(), 'coordenacao'::app_role)
  OR
  -- Outros: só tópicos relacionados ao seu próprio perfil/user
  (extension = 'postgres_changes' AND topic LIKE '%' || auth.uid()::text || '%')
);
