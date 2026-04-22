
-- 1. Restrict participantes SELECT to operational roles only (deny visitante)
DROP POLICY IF EXISTS "Participantes viewable by authenticated" ON public.participantes;
DROP POLICY IF EXISTS "Participantes select operational roles" ON public.participantes;

CREATE POLICY "Participantes select operational roles"
ON public.participantes
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'coordenacao'::app_role)
  OR public.has_role(auth.uid(), 'tecnico'::app_role)
  OR public.has_role(auth.uid(), 'educador'::app_role)
  OR public.has_role(auth.uid(), 'motorista'::app_role)
  OR public.has_role(auth.uid(), 'cozinheiro'::app_role)
);

-- 2. Remove overlapping permissive INSERT/UPDATE policies on fotos-participantes bucket
DROP POLICY IF EXISTS "Auth insert fotos-participantes" ON storage.objects;
DROP POLICY IF EXISTS "Auth upload fotos participantes" ON storage.objects;
DROP POLICY IF EXISTS "Auth update fotos-participantes" ON storage.objects;
DROP POLICY IF EXISTS "Auth update fotos participantes" ON storage.objects;
DROP POLICY IF EXISTS "Auth delete fotos-participantes" ON storage.objects;
DROP POLICY IF EXISTS "Auth delete fotos participantes" ON storage.objects;
DROP POLICY IF EXISTS "Auth select fotos-participantes" ON storage.objects;
DROP POLICY IF EXISTS "Auth select fotos participantes" ON storage.objects;
