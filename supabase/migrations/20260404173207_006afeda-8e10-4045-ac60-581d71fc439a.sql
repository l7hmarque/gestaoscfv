
ALTER TABLE turmas ADD COLUMN nome_grupo text;

ALTER TABLE participantes ADD COLUMN justificativa_desligamento text;
ALTER TABLE participantes ADD COLUMN motivo_desligamento text;

CREATE TABLE participante_transferencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participante_id uuid NOT NULL REFERENCES participantes(id) ON DELETE CASCADE,
  turma_origem_id uuid REFERENCES turmas(id),
  turma_destino_id uuid REFERENCES turmas(id),
  data_transferencia date NOT NULL DEFAULT CURRENT_DATE,
  motivo text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE participante_transferencias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read transferencias" ON participante_transferencias FOR SELECT TO authenticated USING (true);
CREATE POLICY "Non-visitante manage transferencias" ON participante_transferencias FOR INSERT TO authenticated WITH CHECK (NOT public.has_role(auth.uid(), 'visitante'::app_role));
CREATE POLICY "Non-visitante update transferencias" ON participante_transferencias FOR UPDATE TO authenticated USING (NOT public.has_role(auth.uid(), 'visitante'::app_role));
CREATE POLICY "Non-visitante delete transferencias" ON participante_transferencias FOR DELETE TO authenticated USING (NOT public.has_role(auth.uid(), 'visitante'::app_role));
