
-- 1. Tabela de alertas (nunca executa, só sugere)
CREATE TABLE IF NOT EXISTS public.alertas_desligamento_sugerido (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participante_id uuid NOT NULL REFERENCES public.participantes(id) ON DELETE CASCADE,
  dias_sem_presenca integer NOT NULL,
  sugerido_em date NOT NULL DEFAULT CURRENT_DATE,
  decisao text NOT NULL DEFAULT 'pendente' CHECK (decisao IN ('pendente','desligar','manter')),
  revisado_em timestamptz,
  revisado_por uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (participante_id, sugerido_em)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.alertas_desligamento_sugerido TO authenticated;
GRANT ALL ON public.alertas_desligamento_sugerido TO service_role;

ALTER TABLE public.alertas_desligamento_sugerido ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated select alertas_desligamento"
  ON public.alertas_desligamento_sugerido FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Coord/tecnico manage alertas_desligamento"
  ON public.alertas_desligamento_sugerido FOR ALL
  TO authenticated
  USING (has_role(auth.uid(),'coordenacao'::app_role) OR has_role(auth.uid(),'tecnico'::app_role))
  WITH CHECK (has_role(auth.uid(),'coordenacao'::app_role) OR has_role(auth.uid(),'tecnico'::app_role));

CREATE TRIGGER update_alertas_desligamento_updated_at
  BEFORE UPDATE ON public.alertas_desligamento_sugerido
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_alertas_desligamento_decisao
  ON public.alertas_desligamento_sugerido(decisao);

-- 2. Parâmetros configuráveis
INSERT INTO public.configuracoes_gerais (chave, valor) VALUES
  ('recompute_dias_inatividade_busca_ativa', '21'),
  ('recompute_dias_alerta_desligamento', '30'),
  ('recompute_dias_reativacao', '7'),
  ('recompute_ultima_execucao', ''),
  ('recompute_ultimo_resultado', '')
ON CONFLICT (chave) DO NOTHING;

-- 3. RPC de KPIs
CREATE OR REPLACE FUNCTION public.get_link_health_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inativ int;
  v_alerta int;
  v_ativos_sem_vinculo int;
  v_deslig_com_vinculo int;
  v_ba_velha int;
  v_ativos_sem_presenca int;
BEGIN
  SELECT COALESCE(NULLIF(valor,'')::int, 21) INTO v_inativ FROM configuracoes_gerais WHERE chave='recompute_dias_inatividade_busca_ativa';
  SELECT COALESCE(NULLIF(valor,'')::int, 30) INTO v_alerta FROM configuracoes_gerais WHERE chave='recompute_dias_alerta_desligamento';

  -- 1) Ativos sem vínculo aberto
  SELECT count(*) INTO v_ativos_sem_vinculo
  FROM participantes p
  WHERE p.status = 'ativo'
    AND NOT EXISTS (
      SELECT 1 FROM turma_participantes tp
      WHERE tp.participante_id = p.id AND tp.data_saida IS NULL
    );

  -- 2) Desligados/transferidos com vínculo ainda aberto
  SELECT count(*) INTO v_deslig_com_vinculo
  FROM participantes p
  WHERE p.status IN ('desligado','transferido')
    AND EXISTS (
      SELECT 1 FROM turma_participantes tp
      WHERE tp.participante_id = p.id AND tp.data_saida IS NULL
    );

  -- 3) busca_ativa há mais de v_alerta dias sem presença
  SELECT count(*) INTO v_ba_velha
  FROM participantes p
  WHERE p.status = 'busca_ativa'
    AND COALESCE((
      SELECT max(data) FROM presenca pr
      WHERE pr.participante_id = p.id AND pr.presente = true
    ), '1900-01-01'::date) < CURRENT_DATE - v_alerta;

  -- 4) Ativos sem presença há mais de v_inativ dias
  SELECT count(*) INTO v_ativos_sem_presenca
  FROM participantes p
  WHERE p.status = 'ativo'
    AND COALESCE((
      SELECT max(data) FROM presenca pr
      WHERE pr.participante_id = p.id AND pr.presente = true
    ), '1900-01-01'::date) < CURRENT_DATE - v_inativ;

  RETURN jsonb_build_object(
    'ativos_sem_vinculo', v_ativos_sem_vinculo,
    'desligados_com_vinculo', v_deslig_com_vinculo,
    'busca_ativa_stale', v_ba_velha,
    'ativos_sem_presenca', v_ativos_sem_presenca,
    'parametros', jsonb_build_object(
      'dias_inatividade', v_inativ,
      'dias_alerta', v_alerta
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_link_health_stats() TO authenticated;

-- 4. RPC que lista os participantes de cada bucket (para a planilha)
CREATE OR REPLACE FUNCTION public.get_link_health_list(_bucket text)
RETURNS TABLE (
  participante_id uuid,
  nome text,
  status text,
  bairro text,
  periodo text,
  ultima_presenca date,
  dias_sem_presenca int
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inativ int;
  v_alerta int;
BEGIN
  SELECT COALESCE(NULLIF(valor,'')::int, 21) INTO v_inativ FROM configuracoes_gerais WHERE chave='recompute_dias_inatividade_busca_ativa';
  SELECT COALESCE(NULLIF(valor,'')::int, 30) INTO v_alerta FROM configuracoes_gerais WHERE chave='recompute_dias_alerta_desligamento';

  RETURN QUERY
  WITH ult AS (
    SELECT p.id,
           (SELECT max(data) FROM presenca pr WHERE pr.participante_id = p.id AND pr.presente = true) AS up
    FROM participantes p
  )
  SELECT p.id, p.nome, p.status::text, p.bairro, p.periodo::text,
         u.up,
         CASE WHEN u.up IS NULL THEN NULL ELSE (CURRENT_DATE - u.up)::int END
  FROM participantes p
  JOIN ult u ON u.id = p.id
  WHERE
    (_bucket = 'ativos_sem_vinculo' AND p.status='ativo' AND NOT EXISTS (
        SELECT 1 FROM turma_participantes tp WHERE tp.participante_id=p.id AND tp.data_saida IS NULL))
    OR (_bucket = 'desligados_com_vinculo' AND p.status IN ('desligado','transferido') AND EXISTS (
        SELECT 1 FROM turma_participantes tp WHERE tp.participante_id=p.id AND tp.data_saida IS NULL))
    OR (_bucket = 'busca_ativa_stale' AND p.status='busca_ativa'
        AND COALESCE(u.up, '1900-01-01'::date) < CURRENT_DATE - v_alerta)
    OR (_bucket = 'ativos_sem_presenca' AND p.status='ativo'
        AND COALESCE(u.up, '1900-01-01'::date) < CURRENT_DATE - v_inativ)
  ORDER BY p.nome;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_link_health_list(text) TO authenticated;
