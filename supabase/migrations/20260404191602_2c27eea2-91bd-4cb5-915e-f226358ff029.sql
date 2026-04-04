
CREATE TABLE documentos_prestacao_contas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria text NOT NULL,
  titulo text NOT NULL,
  descricao text,
  arquivo_url text NOT NULL,
  nome_arquivo text NOT NULL,
  versao integer NOT NULL DEFAULT 1,
  vigencia_inicio date,
  vigencia_fim date,
  uploaded_by uuid,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE documentos_prestacao_contas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated SELECT docs_pc" ON documentos_prestacao_contas
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Coord ou tecnico CRUD docs_pc" ON documentos_prestacao_contas
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'coordenacao') OR has_role(auth.uid(), 'tecnico'))
  WITH CHECK (has_role(auth.uid(), 'coordenacao') OR has_role(auth.uid(), 'tecnico'));
