
ALTER TABLE public.relatorios_atividade
  ADD COLUMN IF NOT EXISTS flag_divergencia boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS motivos_divergencia text[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_relatorios_flag_divergencia
  ON public.relatorios_atividade (flag_divergencia)
  WHERE flag_divergencia = true;

-- Inferência do período predominante a partir da presença
CREATE OR REPLACE FUNCTION public.fn_relatorio_periodo_predominante(_rel_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE p.periodo::text
           WHEN 'manha' THEN 'Manhã'
           WHEN 'tarde' THEN 'Tarde'
           WHEN 'integral' THEN 'Integral'
         END
  FROM public.relatorio_presenca rp
  JOIN public.participantes p ON p.id = rp.participante_id
  WHERE rp.relatorio_id = _rel_id
    AND rp.presente = true
    AND p.periodo IS NOT NULL
  GROUP BY p.periodo
  ORDER BY COUNT(*) DESC
  LIMIT 1;
$$;

-- Divergência territorial
CREATE OR REPLACE FUNCTION public.fn_relatorio_tem_divergencia_territorial(_rel_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH turma_bairros AS (
    SELECT DISTINCT unnest(COALESCE(NULLIF(t.bairro_ids, '{}'), ARRAY[t.bairro_id])) AS bairro_id
    FROM public.relatorio_turmas rt
    JOIN public.turmas t ON t.id = rt.turma_id
    WHERE rt.relatorio_id = _rel_id
  ),
  presentes AS (
    SELECT DISTINCT p.bairro_id
    FROM public.relatorio_presenca rp
    JOIN public.participantes p ON p.id = rp.participante_id
    WHERE rp.relatorio_id = _rel_id
      AND rp.presente = true
      AND p.bairro_id IS NOT NULL
  )
  SELECT EXISTS (SELECT 1 FROM turma_bairros)
     AND EXISTS (
       SELECT 1 FROM presentes pr
       WHERE NOT EXISTS (SELECT 1 FROM turma_bairros tb WHERE tb.bairro_id = pr.bairro_id)
     );
$$;

-- Recálculo central
CREATE OR REPLACE FUNCTION public.fn_recompute_relatorio_flags(_rel_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_periodo_inferido text;
  v_periodo_atual text;
  v_tipo tipo_oficina;
  v_motivos text[] := '{}';
BEGIN
  SELECT periodo_atividade, tipo_oficina
    INTO v_periodo_atual, v_tipo
  FROM public.relatorios_atividade
  WHERE id = _rel_id;

  IF NOT FOUND THEN RETURN; END IF;

  IF v_periodo_atual IS NULL THEN
    v_periodo_inferido := public.fn_relatorio_periodo_predominante(_rel_id);
    IF v_periodo_inferido IS NOT NULL THEN
      UPDATE public.relatorios_atividade
         SET periodo_atividade = v_periodo_inferido
       WHERE id = _rel_id;
      v_periodo_atual := v_periodo_inferido;
    ELSE
      v_motivos := array_append(v_motivos, 'periodo_atividade_indefinido');
    END IF;
  END IF;

  IF v_tipo IS NULL THEN
    v_motivos := array_append(v_motivos, 'tipo_oficina_indefinido');
  END IF;

  IF public.fn_relatorio_tem_divergencia_territorial(_rel_id) THEN
    v_motivos := array_append(v_motivos, 'participantes_fora_do_territorio_da_turma');
  END IF;

  UPDATE public.relatorios_atividade
     SET flag_divergencia = (COALESCE(array_length(v_motivos, 1), 0) > 0),
         motivos_divergencia = v_motivos
   WHERE id = _rel_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_relatorio_recompute_flags()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.fn_recompute_relatorio_flags(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_relatorios_atividade_flags ON public.relatorios_atividade;
CREATE TRIGGER trg_relatorios_atividade_flags
AFTER INSERT OR UPDATE OF periodo_atividade, tipo_oficina
ON public.relatorios_atividade
FOR EACH ROW
EXECUTE FUNCTION public.trg_relatorio_recompute_flags();

CREATE OR REPLACE FUNCTION public.trg_presenca_recompute_relatorio()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rel uuid;
BEGIN
  v_rel := COALESCE(NEW.relatorio_id, OLD.relatorio_id);
  PERFORM public.fn_recompute_relatorio_flags(v_rel);
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_relatorio_presenca_recompute ON public.relatorio_presenca;
CREATE TRIGGER trg_relatorio_presenca_recompute
AFTER INSERT OR UPDATE OR DELETE
ON public.relatorio_presenca
FOR EACH ROW
EXECUTE FUNCTION public.trg_presenca_recompute_relatorio();

CREATE OR REPLACE FUNCTION public.trg_relatorio_turmas_recompute()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rel uuid;
BEGIN
  v_rel := COALESCE(NEW.relatorio_id, OLD.relatorio_id);
  PERFORM public.fn_recompute_relatorio_flags(v_rel);
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_relatorio_turmas_recompute ON public.relatorio_turmas;
CREATE TRIGGER trg_relatorio_turmas_recompute
AFTER INSERT OR UPDATE OR DELETE
ON public.relatorio_turmas
FOR EACH ROW
EXECUTE FUNCTION public.trg_relatorio_turmas_recompute();

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.relatorios_atividade LOOP
    PERFORM public.fn_recompute_relatorio_flags(r.id);
  END LOOP;
END$$;
