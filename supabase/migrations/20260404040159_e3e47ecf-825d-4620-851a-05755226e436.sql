
-- 1. Update recados SELECT policy to include coordenacao
DROP POLICY "Remetente ou destinatario select recados" ON public.recados;
CREATE POLICY "Remetente destinatario ou coord select recados"
  ON public.recados FOR SELECT TO authenticated
  USING (
    remetente_id = (SELECT id FROM profiles WHERE user_id = auth.uid() LIMIT 1)
    OR destinatario_id = (SELECT id FROM profiles WHERE user_id = auth.uid() LIMIT 1)
    OR has_role(auth.uid(), 'coordenacao')
  );

-- 2. Update recados UPDATE policy to include coordenacao
DROP POLICY "Destinatario update recados" ON public.recados;
CREATE POLICY "Destinatario ou coord update recados"
  ON public.recados FOR UPDATE TO authenticated
  USING (
    destinatario_id = (SELECT id FROM profiles WHERE user_id = auth.uid() LIMIT 1)
    OR has_role(auth.uid(), 'coordenacao')
  );

-- 3. Add mencoes columns to feed_posts and feed_comentarios
ALTER TABLE public.feed_posts ADD COLUMN IF NOT EXISTS mencoes text[] DEFAULT '{}';
ALTER TABLE public.feed_comentarios ADD COLUMN IF NOT EXISTS mencoes text[] DEFAULT '{}';
