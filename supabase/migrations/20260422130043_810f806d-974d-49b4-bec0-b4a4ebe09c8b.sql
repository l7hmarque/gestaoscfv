
-- Módulo Cozinha: tabelas, RLS, trigger, RPCs

-- 1. Tabela de insumos
CREATE TABLE public.cozinha_insumos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  categoria text NOT NULL DEFAULT 'Outros',
  unidade text NOT NULL DEFAULT 'un',
  quantidade_atual numeric NOT NULL DEFAULT 0,
  estoque_minimo numeric NOT NULL DEFAULT 0,
  validade date,
  valor_unitario numeric,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_cozinha_insumos_categoria ON public.cozinha_insumos(categoria);
CREATE INDEX idx_cozinha_insumos_validade ON public.cozinha_insumos(validade) WHERE validade IS NOT NULL;

-- 2. Tabela de movimentações
CREATE TABLE public.cozinha_movimentacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  insumo_id uuid NOT NULL REFERENCES public.cozinha_insumos(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('entrada','saida','ajuste')),
  quantidade numeric NOT NULL,
  motivo text,
  responsavel_id uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_cozinha_mov_insumo ON public.cozinha_movimentacoes(insumo_id);
CREATE INDEX idx_cozinha_mov_created ON public.cozinha_movimentacoes(created_at DESC);

-- 3. Tabela de cardápio
CREATE TABLE public.cozinha_cardapio (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  semana_inicio date NOT NULL,
  dia_semana int NOT NULL CHECK (dia_semana BETWEEN 1 AND 5),
  refeicao text NOT NULL CHECK (refeicao IN ('cafe','almoco','lanche')),
  prato text NOT NULL DEFAULT '',
  insumos_previstos jsonb NOT NULL DEFAULT '[]'::jsonb,
  criado_por uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (semana_inicio, dia_semana, refeicao)
);

-- Triggers updated_at
CREATE TRIGGER tr_cozinha_insumos_updated BEFORE UPDATE ON public.cozinha_insumos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER tr_cozinha_cardapio_updated BEFORE UPDATE ON public.cozinha_cardapio
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger sincronização de estoque
CREATE OR REPLACE FUNCTION public.fn_sincronizar_quantidade_insumo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.tipo = 'entrada' THEN
    UPDATE public.cozinha_insumos SET quantidade_atual = quantidade_atual + NEW.quantidade WHERE id = NEW.insumo_id;
  ELSIF NEW.tipo = 'saida' THEN
    UPDATE public.cozinha_insumos SET quantidade_atual = GREATEST(0, quantidade_atual - NEW.quantidade) WHERE id = NEW.insumo_id;
  ELSIF NEW.tipo = 'ajuste' THEN
    UPDATE public.cozinha_insumos SET quantidade_atual = NEW.quantidade WHERE id = NEW.insumo_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER tr_cozinha_mov_sync AFTER INSERT ON public.cozinha_movimentacoes
  FOR EACH ROW EXECUTE FUNCTION public.fn_sincronizar_quantidade_insumo();

-- RLS
ALTER TABLE public.cozinha_insumos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cozinha_movimentacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cozinha_cardapio ENABLE ROW LEVEL SECURITY;

-- Insumos: cozinheiro + coordenacao
CREATE POLICY "Cozinha insumos select" ON public.cozinha_insumos FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'cozinheiro'::app_role) OR public.has_role(auth.uid(),'coordenacao'::app_role));
CREATE POLICY "Cozinha insumos insert" ON public.cozinha_insumos FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'cozinheiro'::app_role) OR public.has_role(auth.uid(),'coordenacao'::app_role));
CREATE POLICY "Cozinha insumos update" ON public.cozinha_insumos FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'cozinheiro'::app_role) OR public.has_role(auth.uid(),'coordenacao'::app_role));
CREATE POLICY "Cozinha insumos delete" ON public.cozinha_insumos FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'coordenacao'::app_role));

-- Movimentações: select cozinheiro+coord; insert exige responsavel_id casar com profile do auth.uid()
CREATE POLICY "Cozinha mov select" ON public.cozinha_movimentacoes FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'cozinheiro'::app_role) OR public.has_role(auth.uid(),'coordenacao'::app_role));
CREATE POLICY "Cozinha mov insert" ON public.cozinha_movimentacoes FOR INSERT TO authenticated
  WITH CHECK (
    (public.has_role(auth.uid(),'cozinheiro'::app_role) OR public.has_role(auth.uid(),'coordenacao'::app_role))
    AND responsavel_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );
CREATE POLICY "Cozinha mov delete" ON public.cozinha_movimentacoes FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'coordenacao'::app_role));

-- Cardápio
CREATE POLICY "Cozinha cardapio select" ON public.cozinha_cardapio FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'cozinheiro'::app_role) OR public.has_role(auth.uid(),'coordenacao'::app_role));
CREATE POLICY "Cozinha cardapio insert" ON public.cozinha_cardapio FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'cozinheiro'::app_role) OR public.has_role(auth.uid(),'coordenacao'::app_role));
CREATE POLICY "Cozinha cardapio update" ON public.cozinha_cardapio FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'cozinheiro'::app_role) OR public.has_role(auth.uid(),'coordenacao'::app_role));
CREATE POLICY "Cozinha cardapio delete" ON public.cozinha_cardapio FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'coordenacao'::app_role));

-- RPC: stats da cozinha
CREATE OR REPLACE FUNCTION public.get_cozinha_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_estoque_baixo int;
  v_vencendo int;
  v_vencidos int;
  v_total_itens int;
  v_valor_estoque numeric;
  v_total_restricoes int;
  v_top_consumo jsonb;
  v_proximas_refeicoes jsonb;
  v_refeicoes_hoje jsonb;
  v_dia_semana int;
  v_semana_inicio date;
BEGIN
  IF v_uid IS NULL OR NOT (public.has_role(v_uid,'cozinheiro'::app_role) OR public.has_role(v_uid,'coordenacao'::app_role)) THEN
    RETURN jsonb_build_object('error','forbidden');
  END IF;

  SELECT count(*) INTO v_estoque_baixo FROM cozinha_insumos
    WHERE quantidade_atual <= estoque_minimo AND estoque_minimo > 0;
  SELECT count(*) INTO v_vencendo FROM cozinha_insumos
    WHERE validade IS NOT NULL AND validade BETWEEN current_date AND (current_date + interval '7 days');
  SELECT count(*) INTO v_vencidos FROM cozinha_insumos
    WHERE validade IS NOT NULL AND validade < current_date;
  SELECT count(*), COALESCE(sum(quantidade_atual * COALESCE(valor_unitario,0)),0) INTO v_total_itens, v_valor_estoque FROM cozinha_insumos;

  SELECT count(*) INTO v_total_restricoes FROM participantes
    WHERE status='ativo' AND (
      (restricao_alimentar IS NOT NULL AND trim(restricao_alimentar) <> '')
      OR (remedio_continuo IS NOT NULL AND trim(remedio_continuo) <> '')
      OR (outras_condicoes IS NOT NULL AND trim(outras_condicoes) <> '')
    );

  SELECT COALESCE(jsonb_agg(jsonb_build_object('nome', nome, 'total', total) ORDER BY total DESC), '[]'::jsonb)
  INTO v_top_consumo
  FROM (
    SELECT i.nome, sum(m.quantidade) AS total
    FROM cozinha_movimentacoes m
    JOIN cozinha_insumos i ON i.id = m.insumo_id
    WHERE m.tipo='saida' AND m.created_at >= (now() - interval '30 days')
    GROUP BY i.nome
    ORDER BY total DESC
    LIMIT 10
  ) sub;

  -- Refeições hoje (participantes ativos por período)
  SELECT jsonb_build_object(
    'manha', (SELECT count(*) FROM participantes WHERE status='ativo' AND periodo::text IN ('manha','integral')),
    'tarde', (SELECT count(*) FROM participantes WHERE status='ativo' AND periodo::text IN ('tarde','integral'))
  ) INTO v_refeicoes_hoje;

  -- Próximas 3 refeições da semana
  v_dia_semana := EXTRACT(ISODOW FROM current_date)::int;
  v_semana_inicio := current_date - ((v_dia_semana - 1) || ' days')::interval;
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'dia_semana', dia_semana, 'refeicao', refeicao, 'prato', prato
  ) ORDER BY dia_semana, refeicao), '[]'::jsonb)
  INTO v_proximas_refeicoes
  FROM (
    SELECT dia_semana, refeicao, prato
    FROM cozinha_cardapio
    WHERE semana_inicio = v_semana_inicio
      AND dia_semana >= LEAST(v_dia_semana, 5)
    ORDER BY dia_semana, refeicao
    LIMIT 3
  ) sub;

  RETURN jsonb_build_object(
    'estoque_baixo', v_estoque_baixo,
    'vencendo_7d', v_vencendo,
    'vencidos', v_vencidos,
    'total_itens', v_total_itens,
    'valor_estoque', v_valor_estoque,
    'total_restricoes', v_total_restricoes,
    'top_consumo_30d', v_top_consumo,
    'refeicoes_hoje', v_refeicoes_hoje,
    'proximas_refeicoes', v_proximas_refeicoes,
    'semana_inicio', v_semana_inicio
  );
END;
$$;

-- RPC: restrições alimentares
CREATE OR REPLACE FUNCTION public.get_restricoes_alimentares()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_result jsonb;
BEGIN
  IF v_uid IS NULL OR NOT (public.has_role(v_uid,'cozinheiro'::app_role) OR public.has_role(v_uid,'coordenacao'::app_role)) THEN
    RETURN jsonb_build_object('error','forbidden');
  END IF;

  WITH part AS (
    SELECT
      p.id, p.nome_completo, p.data_nascimento, p.periodo, p.foto_url,
      p.restricao_alimentar, p.remedio_continuo, p.outras_condicoes,
      b.nome AS bairro_nome,
      CASE WHEN p.data_nascimento IS NOT NULL
           THEN EXTRACT(YEAR FROM age(current_date, p.data_nascimento))::int
           ELSE NULL END AS idade
    FROM participantes p
    LEFT JOIN bairros b ON b.id = p.bairro_id
    WHERE p.status='ativo' AND (
      (p.restricao_alimentar IS NOT NULL AND trim(p.restricao_alimentar) <> '')
      OR (p.remedio_continuo IS NOT NULL AND trim(p.remedio_continuo) <> '')
      OR (p.outras_condicoes IS NOT NULL AND trim(p.outras_condicoes) <> '')
    )
  ),
  turmas_part AS (
    SELECT tp.participante_id,
           jsonb_agg(jsonb_build_object('id', t.id, 'nome', t.nome, 'dias_semana', COALESCE(t.dias_semana, ARRAY[]::text[]))) AS turmas,
           COALESCE(array_agg(DISTINCT d) FILTER (WHERE d IS NOT NULL), ARRAY[]::text[]) AS dias_uniao
    FROM turma_participantes tp
    JOIN turmas t ON t.id = tp.turma_id AND t.ativa = true
    LEFT JOIN LATERAL unnest(COALESCE(t.dias_semana, ARRAY[]::text[])) AS d ON true
    WHERE tp.participante_id IN (SELECT id FROM part)
    GROUP BY tp.participante_id
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', p.id,
    'nome', p.nome_completo,
    'idade', p.idade,
    'periodo', p.periodo,
    'bairro', p.bairro_nome,
    'foto_url', p.foto_url,
    'restricao_alimentar', p.restricao_alimentar,
    'remedio_continuo', p.remedio_continuo,
    'outras_condicoes', p.outras_condicoes,
    'turmas', COALESCE(tp.turmas, '[]'::jsonb),
    'dias_frequenta', CASE
      WHEN tp.dias_uniao IS NULL OR array_length(tp.dias_uniao,1) IS NULL
        THEN ARRAY['seg','ter','qua','qui','sex']
      ELSE tp.dias_uniao
    END,
    'sem_turma', (tp.turmas IS NULL)
  ) ORDER BY p.nome_completo), '[]'::jsonb)
  INTO v_result
  FROM part p
  LEFT JOIN turmas_part tp ON tp.participante_id = p.id;

  RETURN jsonb_build_object('participantes', v_result);
END;
$$;
