
-- 1. Restrict sensitive HR columns on profiles via column-level GRANTs
-- Authenticated users keep row-level access but cannot SELECT sensitive fields directly.
-- Coordenação reads these fields via the existing SECURITY DEFINER RPC list_profiles_rh.

REVOKE SELECT ON public.profiles FROM authenticated;
REVOKE SELECT ON public.profiles FROM anon;

GRANT SELECT (
  id, user_id, nome, cargo, foto_url, ativo, email, carga_horaria, data_inicio, created_at, updated_at
) ON public.profiles TO authenticated;

-- Inserts/updates remain controlled by existing RLS policies.
GRANT INSERT, UPDATE ON public.profiles TO authenticated;

-- 2. Storage: require uploads to /documentos to be under the caller's UID folder
DROP POLICY IF EXISTS "Auth upload documents" ON storage.objects;

CREATE POLICY "Auth upload documents own folder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documentos'
  AND (storage.foldername(name))[1] = (auth.uid())::text
);
