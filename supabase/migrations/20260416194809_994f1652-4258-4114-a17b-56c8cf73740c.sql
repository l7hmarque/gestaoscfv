-- Vínculos em atendimentos
ALTER TABLE public.atendimentos
  ADD COLUMN IF NOT EXISTS recado_origem_id uuid,
  ADD COLUMN IF NOT EXISTS relato_origem_id uuid,
  ADD COLUMN IF NOT EXISTS busca_ativa_origem_id uuid;

CREATE INDEX IF NOT EXISTS idx_atendimentos_recado_origem ON public.atendimentos(recado_origem_id);
CREATE INDEX IF NOT EXISTS idx_atendimentos_relato_origem ON public.atendimentos(relato_origem_id);
CREATE INDEX IF NOT EXISTS idx_atendimentos_ba_origem ON public.atendimentos(busca_ativa_origem_id);

-- Vínculo busca ativa -> atendimento gerado
ALTER TABLE public.busca_ativa_registros
  ADD COLUMN IF NOT EXISTS atendimento_id uuid;

CREATE INDEX IF NOT EXISTS idx_ba_atendimento ON public.busca_ativa_registros(atendimento_id);

-- Encaminhamentos externos (rede de proteção)
CREATE TABLE IF NOT EXISTS public.encaminhamentos_externos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participante_id uuid NOT NULL,
  atendimento_id uuid,
  profissional_id uuid NOT NULL,
  orgao text NOT NULL,
  tipo text NOT NULL DEFAULT 'cras',
  motivo text NOT NULL DEFAULT '',
  data_encaminhamento date NOT NULL DEFAULT CURRENT_DATE,
  data_retorno date,
  status text NOT NULL DEFAULT 'aberto',
  observacoes_retorno text,
  contato text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_enc_ext_participante ON public.encaminhamentos_externos(participante_id);
CREATE INDEX IF NOT EXISTS idx_enc_ext_atendimento ON public.encaminhamentos_externos(atendimento_id);
CREATE INDEX IF NOT EXISTS idx_enc_ext_status ON public.encaminhamentos_externos(status);

ALTER TABLE public.encaminhamentos_externos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tecnico ou coord select enc_ext"
ON public.encaminhamentos_externos FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'tecnico'::app_role) OR has_role(auth.uid(), 'coordenacao'::app_role));

CREATE POLICY "Tecnico ou coord insert enc_ext"
ON public.encaminhamentos_externos FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'tecnico'::app_role) OR has_role(auth.uid(), 'coordenacao'::app_role));

CREATE POLICY "Tecnico ou coord update enc_ext"
ON public.encaminhamentos_externos FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'tecnico'::app_role) OR has_role(auth.uid(), 'coordenacao'::app_role));

CREATE POLICY "Tecnico ou coord delete enc_ext"
ON public.encaminhamentos_externos FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'tecnico'::app_role) OR has_role(auth.uid(), 'coordenacao'::app_role));

CREATE TRIGGER enc_ext_updated_at
BEFORE UPDATE ON public.encaminhamentos_externos
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();