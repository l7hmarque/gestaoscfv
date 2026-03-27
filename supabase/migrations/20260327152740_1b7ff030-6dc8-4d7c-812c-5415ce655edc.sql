
-- 1. Refine planejamentos UPDATE: author or coordenacao only
DROP POLICY IF EXISTS "Authenticated update planejamentos" ON public.planejamentos;
CREATE POLICY "Author or coordenacao update planejamentos" ON public.planejamentos
FOR UPDATE TO authenticated USING (
  educador_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
  OR public.has_role(auth.uid(), 'coordenacao')
);

-- 2. Refine relatorios UPDATE: author or coordenacao only
DROP POLICY IF EXISTS "Authenticated update relatorios" ON public.relatorios_atividade;
CREATE POLICY "Author or coordenacao update relatorios" ON public.relatorios_atividade
FOR UPDATE TO authenticated USING (
  educador_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
  OR public.has_role(auth.uid(), 'coordenacao')
);

-- 3. Profiles: own user or coordenacao can update
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
CREATE POLICY "Own or coordenacao update profile" ON public.profiles
FOR UPDATE TO authenticated USING (
  auth.uid() = user_id OR public.has_role(auth.uid(), 'coordenacao')
);

-- 4. Turmas INSERT restricted to coordenacao
DROP POLICY IF EXISTS "Authenticated insert turmas" ON public.turmas;
CREATE POLICY "Coordenacao insert turmas" ON public.turmas
FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'coordenacao'));

-- 5. Storage: protect uploads/deletes on photo buckets
CREATE POLICY "Auth insert fotos-participantes" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'fotos-participantes');
CREATE POLICY "Coord delete fotos-participantes" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'fotos-participantes' AND public.has_role(auth.uid(), 'coordenacao'));
CREATE POLICY "Auth insert fotos-relatorios" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'fotos-relatorios');
CREATE POLICY "Coord delete fotos-relatorios" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'fotos-relatorios' AND public.has_role(auth.uid(), 'coordenacao'));
