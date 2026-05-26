
-- 1) Dados: incompleto/pendente -> ativo
UPDATE public.participantes
   SET status = 'ativo'
 WHERE status::text IN ('incompleto', 'pendente');

-- 2) Trigger off, drop default, troca enum
DROP TRIGGER IF EXISTS trg_participante_status_timestamps ON public.participantes;
ALTER TABLE public.participantes ALTER COLUMN status DROP DEFAULT;

ALTER TYPE public.status_participante RENAME TO status_participante_old;
CREATE TYPE public.status_participante AS ENUM ('ativo', 'busca_ativa', 'desligado');

ALTER TABLE public.participantes
  ALTER COLUMN status TYPE public.status_participante
  USING status::text::public.status_participante;

ALTER TABLE public.participantes ALTER COLUMN status SET DEFAULT 'ativo'::public.status_participante;
DROP TYPE public.status_participante_old;

CREATE TRIGGER trg_participante_status_timestamps
BEFORE INSERT OR UPDATE OF status ON public.participantes
FOR EACH ROW EXECUTE FUNCTION public.fn_participante_marca_status_timestamps();

-- 3) Função is_participante_incompleto
CREATE OR REPLACE FUNCTION public.is_participante_incompleto(_participante_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.participantes p
    WHERE p.id = _participante_id
      AND (
        p.data_nascimento IS NULL
        OR p.bairro_id IS NULL
        OR p.periodo IS NULL
        OR coalesce(btrim(p.nome_completo), '') = ''
      )
  );
$$;

-- 4) Atualiza get_pendencias_integridade
CREATE OR REPLACE FUNCTION public.get_pendencias_integridade()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
  v_periodo_div int; v_deslig_incomp int; v_planej_sem_turma int;
  v_sem_nasc int; v_turmas_sem_edu int; v_turmas_vazias int;
  v_cadastros_incompletos int; v_total int;
BEGIN
  SELECT count(DISTINCT p.id) INTO v_periodo_div
  FROM participantes p JOIN turma_participantes tp ON tp.participante_id = p.id
  JOIN turmas t ON t.id = tp.turma_id
  WHERE p.status = 'ativo' AND p.is_teste = false AND t.ativa = true
    AND p.periodo IS NOT NULL AND t.periodo IS NOT NULL
    AND p.periodo::text <> t.periodo::text
    AND p.periodo::text <> 'integral' AND t.periodo::text <> 'integral';

  SELECT count(*) INTO v_deslig_incomp FROM participantes
  WHERE status = 'desligado' AND is_teste = false
    AND (data_desligamento IS NULL OR motivo_desligamento IS NULL OR motivo_desligamento = '');

  SELECT count(*) INTO v_planej_sem_turma FROM planejamentos p
  WHERE NOT EXISTS (SELECT 1 FROM planejamento_turmas pt WHERE pt.planejamento_id = p.id);

  SELECT count(*) INTO v_sem_nasc FROM participantes
  WHERE status IN ('ativo','busca_ativa') AND is_teste = false AND data_nascimento IS NULL;

  SELECT count(*) INTO v_turmas_sem_edu FROM turmas WHERE ativa = true AND educador_id IS NULL;

  SELECT count(*) INTO v_turmas_vazias FROM turmas t WHERE t.ativa = true
    AND NOT EXISTS (SELECT 1 FROM turma_participantes tp JOIN participantes p ON p.id = tp.participante_id
      WHERE tp.turma_id = t.id AND p.status IN ('ativo','busca_ativa') AND p.is_teste = false);

  SELECT count(*) INTO v_cadastros_incompletos FROM participantes p
  WHERE p.is_teste = false AND p.status IN ('ativo','busca_ativa')
    AND public.is_participante_incompleto(p.id);

  v_total := v_periodo_div + v_deslig_incomp + v_planej_sem_turma + v_sem_nasc + v_turmas_sem_edu + v_turmas_vazias;

  RETURN jsonb_build_object(
    'total', v_total,
    'periodo_divergente', v_periodo_div,
    'desligados_incompletos', v_deslig_incomp,
    'planejamentos_sem_turma', v_planej_sem_turma,
    'sem_data_nascimento', v_sem_nasc,
    'turmas_sem_educador', v_turmas_sem_edu,
    'turmas_vazias', v_turmas_vazias,
    'cadastros_incompletos', v_cadastros_incompletos
  );
END;
$function$;

-- 5) Reativar turmas normais
UPDATE public.turmas SET ativa = true, updated_at = now()
 WHERE ativa = false AND (oficina IS NULL OR btrim(oficina) = '');

-- 6) Matricular elegíveis (ON CONFLICT por causa do unique antigo)
INSERT INTO public.turma_participantes (participante_id, turma_id, data_entrada)
SELECT p.id, t.id, current_date
FROM public.turmas t
JOIN public.participantes p
  ON p.is_teste = false
 AND p.status IN ('ativo','busca_ativa')
 AND p.bairro_id = t.bairro_id
 AND p.periodo::text = t.periodo::text
 AND p.data_nascimento IS NOT NULL
 AND (
   (t.faixa_etaria::text = '6-8'   AND extract(year FROM age(current_date, p.data_nascimento))::int BETWEEN 6 AND 8)
   OR (t.faixa_etaria::text = '9-11'  AND extract(year FROM age(current_date, p.data_nascimento))::int BETWEEN 9 AND 11)
   OR (t.faixa_etaria::text = '12-17' AND extract(year FROM age(current_date, p.data_nascimento))::int BETWEEN 12 AND 17)
   OR (t.faixa_etaria::text = '60+'   AND extract(year FROM age(current_date, p.data_nascimento))::int >= 60)
 )
WHERE t.ativa = true AND (t.oficina IS NULL OR btrim(t.oficina) = '')
ON CONFLICT (turma_id, participante_id) DO NOTHING;

-- 6b) Reabrir vínculos fechados em turmas normais para participantes elegíveis (caso o conflito tenha encontrado uma linha fechada)
UPDATE public.turma_participantes tp
   SET data_saida = NULL, data_entrada = current_date
  FROM public.turmas t, public.participantes p
 WHERE tp.turma_id = t.id
   AND tp.participante_id = p.id
   AND tp.data_saida IS NOT NULL
   AND t.ativa = true AND (t.oficina IS NULL OR btrim(t.oficina) = '')
   AND p.is_teste = false AND p.status IN ('ativo','busca_ativa')
   AND p.bairro_id = t.bairro_id
   AND p.periodo::text = t.periodo::text
   AND p.data_nascimento IS NOT NULL
   AND (
     (t.faixa_etaria::text = '6-8'   AND extract(year FROM age(current_date, p.data_nascimento))::int BETWEEN 6 AND 8)
     OR (t.faixa_etaria::text = '9-11'  AND extract(year FROM age(current_date, p.data_nascimento))::int BETWEEN 9 AND 11)
     OR (t.faixa_etaria::text = '12-17' AND extract(year FROM age(current_date, p.data_nascimento))::int BETWEEN 12 AND 17)
     OR (t.faixa_etaria::text = '60+'   AND extract(year FROM age(current_date, p.data_nascimento))::int >= 60)
   )
   AND NOT EXISTS (
     SELECT 1 FROM public.turma_participantes tp2
     WHERE tp2.turma_id = tp.turma_id AND tp2.participante_id = tp.participante_id
       AND tp2.id <> tp.id AND tp2.data_saida IS NULL
   );

-- 7) Fechar vínculos abertos de desligados
UPDATE public.turma_participantes tp
   SET data_saida = COALESCE((SELECT data_desligamento FROM public.participantes WHERE id = tp.participante_id), current_date)
 WHERE tp.data_saida IS NULL
   AND EXISTS (SELECT 1 FROM public.participantes p WHERE p.id = tp.participante_id AND p.status = 'desligado');

-- 8) Auditoria
INSERT INTO public.audit_log (user_id, user_nome, acao, tabela, justificativa, detalhes)
VALUES (
  '00000000-0000-0000-0000-000000000000'::uuid,
  'sistema',
  'consolidacao_status_e_reativacao_turmas_normais',
  'participantes,turmas,turma_participantes',
  'Consolidação de status (apenas ativo/busca_ativa/desligado), reativação das 18 turmas normais sem oficina e matrícula em lote por bairro+faixa+período.',
  'Migration aplicada automaticamente.'
);
