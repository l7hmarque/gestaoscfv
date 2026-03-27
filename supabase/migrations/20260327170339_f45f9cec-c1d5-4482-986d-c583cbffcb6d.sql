
-- Create templates storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('templates', 'templates', false)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to read templates
CREATE POLICY "Authenticated read templates"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'templates');

-- Allow coordenacao to upload/manage templates
CREATE POLICY "Coordenacao manage templates"
ON storage.objects FOR ALL
TO authenticated
USING (bucket_id = 'templates' AND public.has_role(auth.uid(), 'coordenacao'))
WITH CHECK (bucket_id = 'templates' AND public.has_role(auth.uid(), 'coordenacao'));
