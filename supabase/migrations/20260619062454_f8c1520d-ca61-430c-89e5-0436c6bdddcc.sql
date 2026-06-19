
-- ============================================================
-- FRENTE 1: Catálogos controlados + backfill audit_log
-- ============================================================

-- 1) Enum tipo_oficina
DO $$ BEGIN
  CREATE TYPE public.tipo_oficina AS ENUM ('karate','esporte','artistica','danca_poesia','convivencia');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) Enum papel_profissional
DO $$ BEGIN
  CREATE TYPE public.papel_profissional AS ENUM ('oficineiro','educador_social','tecnico','coordenacao','apoio','visitante');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3) Adicionar colunas (nullable, sem quebrar nada)
ALTER TABLE public.relatorios_atividade
  ADD COLUMN IF NOT EXISTS tipo_oficina public.tipo_oficina;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS papel_profissional public.papel_profissional;

-- 4) Backfill tipo_oficina a partir do array tipo_atividade
UPDATE public.relatorios_atividade SET tipo_oficina =
  CASE
    WHEN 'karate' = ANY(tipo_atividade) THEN 'karate'::public.tipo_oficina
    WHEN 'futebol_esportes' = ANY(tipo_atividade) THEN 'esporte'::public.tipo_oficina
    WHEN 'arte_cultura' = ANY(tipo_atividade) THEN 'artistica'::public.tipo_oficina
    WHEN educador_id = '6a84afbe-6d08-4b5c-9be4-70a505993ef6'::uuid THEN 'danca_poesia'::public.tipo_oficina
    ELSE 'convivencia'::public.tipo_oficina
  END
WHERE tipo_oficina IS NULL;

-- 5) Backfill papel_profissional a partir do cargo (string livre)
UPDATE public.profiles SET papel_profissional =
  CASE
    WHEN cargo ILIKE 'oficineir%' THEN 'oficineiro'::public.papel_profissional
    WHEN cargo ILIKE 'educador%' THEN 'educador_social'::public.papel_profissional
    WHEN cargo ILIKE 'psic%' OR cargo ILIKE 'assistente social%' THEN 'tecnico'::public.papel_profissional
    WHEN cargo ILIKE 'adm%' OR cargo ILIKE 'coorden%' THEN 'coordenacao'::public.papel_profissional
    WHEN cargo ILIKE 'motorista%' OR cargo ILIKE 'cozinheir%' OR cargo ILIKE 'apoio%' THEN 'apoio'::public.papel_profissional
    WHEN cargo ILIKE 'visitante%' THEN 'visitante'::public.papel_profissional
    ELSE NULL
  END
WHERE papel_profissional IS NULL;

-- 6) Índices auxiliares para os exports
CREATE INDEX IF NOT EXISTS idx_relatorios_tipo_oficina ON public.relatorios_atividade(tipo_oficina);
CREATE INDEX IF NOT EXISTS idx_profiles_papel ON public.profiles(papel_profissional);

-- 7) Backfill de audit_log para relatórios sem registro de INSERT
INSERT INTO public.audit_log (user_id, user_nome, acao, tabela, registro_id, detalhes, created_at)
SELECT
  p.user_id,
  p.nome,
  'INSERT_relatorios_atividade',
  'relatorios_atividade',
  r.id::text,
  'autor_inferido=true; origem=backfill_frente1; baseado_em=educador_id',
  COALESCE(r.created_at, r.data::timestamptz)
FROM public.relatorios_atividade r
JOIN public.profiles p ON p.id = r.educador_id
LEFT JOIN public.audit_log a
  ON a.registro_id = r.id::text
 AND a.tabela = 'relatorios_atividade'
 AND a.acao = 'INSERT_relatorios_atividade'
WHERE a.id IS NULL;
