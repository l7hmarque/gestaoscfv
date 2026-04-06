
-- Part 1: Merge known duplicates
-- Transfer relations from typo records to correct records

-- ANDRE ALESANDO -> ANDRE ALESSANDRO
UPDATE turma_participantes SET participante_id = '28756dc6-d69b-4811-986f-b657a0479c8a' WHERE participante_id = '18aa21db-22cc-41d9-b09f-df18e917d6b7' AND NOT EXISTS (SELECT 1 FROM turma_participantes WHERE participante_id = '28756dc6-d69b-4811-986f-b657a0479c8a' AND turma_id = turma_participantes.turma_id);
DELETE FROM turma_participantes WHERE participante_id = '18aa21db-22cc-41d9-b09f-df18e917d6b7';
UPDATE presenca SET participante_id = '28756dc6-d69b-4811-986f-b657a0479c8a' WHERE participante_id = '18aa21db-22cc-41d9-b09f-df18e917d6b7';
UPDATE participante_documentos SET participante_id = '28756dc6-d69b-4811-986f-b657a0479c8a' WHERE participante_id = '18aa21db-22cc-41d9-b09f-df18e917d6b7';
UPDATE atendimentos SET participante_id = '28756dc6-d69b-4811-986f-b657a0479c8a' WHERE participante_id = '18aa21db-22cc-41d9-b09f-df18e917d6b7';
UPDATE relatorio_presenca SET participante_id = '28756dc6-d69b-4811-986f-b657a0479c8a' WHERE participante_id = '18aa21db-22cc-41d9-b09f-df18e917d6b7';
DELETE FROM participantes WHERE id = '18aa21db-22cc-41d9-b09f-df18e917d6b7';

-- ANDRE ALESSADRO -> ANDRE ALESSANDRO
UPDATE turma_participantes SET participante_id = '28756dc6-d69b-4811-986f-b657a0479c8a' WHERE participante_id = '8e55bd53-e90a-4269-b04f-83bdd3256532' AND NOT EXISTS (SELECT 1 FROM turma_participantes WHERE participante_id = '28756dc6-d69b-4811-986f-b657a0479c8a' AND turma_id = turma_participantes.turma_id);
DELETE FROM turma_participantes WHERE participante_id = '8e55bd53-e90a-4269-b04f-83bdd3256532';
UPDATE presenca SET participante_id = '28756dc6-d69b-4811-986f-b657a0479c8a' WHERE participante_id = '8e55bd53-e90a-4269-b04f-83bdd3256532';
UPDATE participante_documentos SET participante_id = '28756dc6-d69b-4811-986f-b657a0479c8a' WHERE participante_id = '8e55bd53-e90a-4269-b04f-83bdd3256532';
UPDATE atendimentos SET participante_id = '28756dc6-d69b-4811-986f-b657a0479c8a' WHERE participante_id = '8e55bd53-e90a-4269-b04f-83bdd3256532';
UPDATE relatorio_presenca SET participante_id = '28756dc6-d69b-4811-986f-b657a0479c8a' WHERE participante_id = '8e55bd53-e90a-4269-b04f-83bdd3256532';
DELETE FROM participantes WHERE id = '8e55bd53-e90a-4269-b04f-83bdd3256532';

-- SOFIA DE LI A -> SOFIA DE LIMA
UPDATE turma_participantes SET participante_id = '13257c30-90cd-48b9-9a83-34db4c9489c0' WHERE participante_id = '0033937e-f883-49bf-90e2-c5763e6def10' AND NOT EXISTS (SELECT 1 FROM turma_participantes WHERE participante_id = '13257c30-90cd-48b9-9a83-34db4c9489c0' AND turma_id = turma_participantes.turma_id);
DELETE FROM turma_participantes WHERE participante_id = '0033937e-f883-49bf-90e2-c5763e6def10';
UPDATE presenca SET participante_id = '13257c30-90cd-48b9-9a83-34db4c9489c0' WHERE participante_id = '0033937e-f883-49bf-90e2-c5763e6def10';
UPDATE participante_documentos SET participante_id = '13257c30-90cd-48b9-9a83-34db4c9489c0' WHERE participante_id = '0033937e-f883-49bf-90e2-c5763e6def10';
UPDATE atendimentos SET participante_id = '13257c30-90cd-48b9-9a83-34db4c9489c0' WHERE participante_id = '0033937e-f883-49bf-90e2-c5763e6def10';
UPDATE relatorio_presenca SET participante_id = '13257c30-90cd-48b9-9a83-34db4c9489c0' WHERE participante_id = '0033937e-f883-49bf-90e2-c5763e6def10';
DELETE FROM participantes WHERE id = '0033937e-f883-49bf-90e2-c5763e6def10';

-- Part 2: Enable pg_trgm extension
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Part 3: Create function to find similar participants
CREATE OR REPLACE FUNCTION public.find_similar_participants()
RETURNS TABLE(
  id1 uuid,
  nome1 text,
  status1 text,
  id2 uuid,
  nome2 text,
  status2 text,
  data_nascimento date,
  similaridade numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p1.id AS id1,
    p1.nome_completo AS nome1,
    p1.status::text AS status1,
    p2.id AS id2,
    p2.nome_completo AS nome2,
    p2.status::text AS status2,
    p1.data_nascimento,
    round(similarity(p1.nome_completo, p2.nome_completo)::numeric, 2) AS similaridade
  FROM participantes p1
  JOIN participantes p2
    ON p1.id < p2.id
    AND p1.data_nascimento IS NOT NULL
    AND p1.data_nascimento = p2.data_nascimento
    AND similarity(p1.nome_completo, p2.nome_completo) > 0.4
  ORDER BY similaridade DESC
  LIMIT 50;
$$;
