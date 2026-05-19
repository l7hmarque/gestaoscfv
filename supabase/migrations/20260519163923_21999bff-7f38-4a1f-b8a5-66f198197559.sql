-- 1) Novas colunas
ALTER TABLE public.participantes
  ADD COLUMN IF NOT EXISTS desligado_registrado_em timestamptz,
  ADD COLUMN IF NOT EXISTS busca_ativa_desde timestamptz;

-- 2) Triggers para preencher automaticamente em mudança de status
CREATE OR REPLACE FUNCTION public.fn_participante_marca_status_timestamps()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'desligado'::participante_status
     AND (OLD.status IS NULL OR OLD.status IS DISTINCT FROM NEW.status) THEN
    NEW.desligado_registrado_em := COALESCE(NEW.desligado_registrado_em, now());
  END IF;
  IF NEW.status = 'busca_ativa'::participante_status
     AND (OLD.status IS NULL OR OLD.status IS DISTINCT FROM NEW.status) THEN
    NEW.busca_ativa_desde := COALESCE(NEW.busca_ativa_desde, now());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_participante_status_timestamps ON public.participantes;
CREATE TRIGGER trg_participante_status_timestamps
BEFORE INSERT OR UPDATE OF status ON public.participantes
FOR EACH ROW EXECUTE FUNCTION public.fn_participante_marca_status_timestamps();

-- 3) Backfill preciso: usa audit_log da última transição de status quando disponível;
--    fallback para updated_at do participante.
WITH ult_deslig AS (
  SELECT
    al.registro_id::uuid AS pid,
    max(al.created_at) AS quando
  FROM public.audit_log al
  WHERE al.tabela = 'participantes'
    AND (
      al.acao ILIKE '%deslig%'
      OR al.acao ILIKE '%status%deslig%'
      OR (al.detalhes IS NOT NULL AND al.detalhes ILIKE '%desligado%')
    )
    AND al.registro_id ~* '^[0-9a-f-]{36}$'
  GROUP BY al.registro_id
)
UPDATE public.participantes p
SET desligado_registrado_em = COALESCE(u.quando, p.updated_at, p.data_desligamento::timestamptz, now())
FROM (
  SELECT p2.id, ul.quando
  FROM public.participantes p2
  LEFT JOIN ult_deslig ul ON ul.pid = p2.id
) u
WHERE p.id = u.id
  AND p.status = 'desligado'
  AND p.desligado_registrado_em IS NULL;

WITH ult_ba AS (
  SELECT
    al.registro_id::uuid AS pid,
    max(al.created_at) AS quando
  FROM public.audit_log al
  WHERE al.tabela = 'participantes'
    AND (
      al.acao ILIKE '%busca%ativa%'
      OR (al.detalhes IS NOT NULL AND al.detalhes ILIKE '%busca_ativa%')
    )
    AND al.registro_id ~* '^[0-9a-f-]{36}$'
  GROUP BY al.registro_id
)
UPDATE public.participantes p
SET busca_ativa_desde = COALESCE(u.quando, p.updated_at, now())
FROM (
  SELECT p2.id, ub.quando
  FROM public.participantes p2
  LEFT JOIN ult_ba ub ON ub.pid = p2.id
) u
WHERE p.id = u.id
  AND p.status = 'busca_ativa'
  AND p.busca_ativa_desde IS NULL;

-- 4) Índices
CREATE INDEX IF NOT EXISTS idx_participantes_status ON public.participantes(status);
CREATE INDEX IF NOT EXISTS idx_participantes_deslig_reg ON public.participantes(desligado_registrado_em);
CREATE INDEX IF NOT EXISTS idx_participantes_ba_desde ON public.participantes(busca_ativa_desde);

-- 5) RPC unificada: participantes elegíveis para chamada
CREATE OR REPLACE FUNCTION public.get_participantes_turma(
  _turma_id uuid,
  _ref_date date DEFAULT current_date
)
RETURNS TABLE(
  participante_id uuid,
  nome text,
  status text,
  data_desligamento date,
  desligado_registrado_em timestamptz,
  busca_ativa_desde timestamptz,
  marcador text,
  bloqueado_chamada boolean,
  bloqueado_desde date,
  turma_destino_nome text,
  data_transferencia date
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH base AS (
    SELECT
      tp.participante_id,
      p.nome_completo AS nome,
      p.status::text AS status,
      p.data_desligamento,
      p.desligado_registrado_em,
      p.busca_ativa_desde
    FROM turma_participantes tp
    JOIN participantes p ON p.id = tp.participante_id
    WHERE tp.turma_id = _turma_id
      AND p.is_teste = false
  ),
  ult_transf AS (
    SELECT DISTINCT ON (pt.participante_id)
      pt.participante_id,
      pt.data_transferencia,
      pt.turma_destino_id,
      td.nome AS turma_destino_nome
    FROM participante_transferencias pt
    LEFT JOIN turmas td ON td.id = pt.turma_destino_id
    WHERE pt.turma_origem_id = _turma_id
    ORDER BY pt.participante_id, pt.data_transferencia DESC NULLS LAST, pt.created_at DESC
  )
  SELECT
    b.participante_id,
    b.nome,
    b.status,
    b.data_desligamento,
    b.desligado_registrado_em,
    b.busca_ativa_desde,
    CASE
      WHEN b.status = 'busca_ativa' THEN '(BA)'
      WHEN b.status = 'desligado' THEN '(Desligado)'
      WHEN ut.data_transferencia IS NOT NULL
           AND ut.data_transferencia >= (_ref_date - INTERVAL '30 days')::date
        THEN '(Transferido ' || to_char(ut.data_transferencia, 'DD/MM') || ' para "'
             || COALESCE(ut.turma_destino_nome, '—') || '")'
      ELSE ''
    END AS marcador,
    CASE
      WHEN b.status = 'desligado' THEN true
      WHEN ut.data_transferencia IS NOT NULL
           AND ut.data_transferencia >= (_ref_date - INTERVAL '30 days')::date THEN true
      ELSE false
    END AS bloqueado_chamada,
    CASE
      WHEN b.status = 'desligado' THEN COALESCE(b.data_desligamento, b.desligado_registrado_em::date)
      WHEN ut.data_transferencia IS NOT NULL THEN ut.data_transferencia
      ELSE NULL
    END AS bloqueado_desde,
    ut.turma_destino_nome,
    ut.data_transferencia
  FROM base b
  LEFT JOIN ult_transf ut ON ut.participante_id = b.participante_id
  WHERE
    b.status IN ('ativo','cadastro_incompleto','busca_ativa')
    OR (
      b.status = 'desligado'
      AND b.desligado_registrado_em IS NOT NULL
      AND b.desligado_registrado_em >= (_ref_date - INTERVAL '30 days')
    )
  ORDER BY b.nome;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_participantes_turma(uuid, date) TO authenticated, anon;