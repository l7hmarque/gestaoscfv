-- Create public bucket for public documents
INSERT INTO storage.buckets (id, name, public) VALUES ('documentos-publicos', 'documentos-publicos', true);

-- Allow anonymous read access
CREATE POLICY "Public read documentos-publicos" ON storage.objects FOR SELECT TO anon USING (bucket_id = 'documentos-publicos');
CREATE POLICY "Public read documentos-publicos auth" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'documentos-publicos');