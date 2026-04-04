
-- Merge duplicate participantes (keep most recently updated, transfer relations)
-- Duplicate 1: ARUNA AMAIA SILVA FERREIRA
-- Keep: 5ffe0dc8 (most recent), Remove: b5b8419c

-- Transfer relations from old to new
UPDATE turma_participantes SET participante_id = '5ffe0dc8-4831-4dc9-9431-38ec4e47afb8' WHERE participante_id = 'b5b8419c-d21f-4fdc-b37e-77f4d1c55d88' AND NOT EXISTS (SELECT 1 FROM turma_participantes WHERE participante_id = '5ffe0dc8-4831-4dc9-9431-38ec4e47afb8' AND turma_id = turma_participantes.turma_id);
DELETE FROM turma_participantes WHERE participante_id = 'b5b8419c-d21f-4fdc-b37e-77f4d1c55d88';

UPDATE presenca SET participante_id = '5ffe0dc8-4831-4dc9-9431-38ec4e47afb8' WHERE participante_id = 'b5b8419c-d21f-4fdc-b37e-77f4d1c55d88';
UPDATE participante_documentos SET participante_id = '5ffe0dc8-4831-4dc9-9431-38ec4e47afb8' WHERE participante_id = 'b5b8419c-d21f-4fdc-b37e-77f4d1c55d88';
UPDATE atendimentos SET participante_id = '5ffe0dc8-4831-4dc9-9431-38ec4e47afb8' WHERE participante_id = 'b5b8419c-d21f-4fdc-b37e-77f4d1c55d88';
UPDATE relatorio_presenca SET participante_id = '5ffe0dc8-4831-4dc9-9431-38ec4e47afb8' WHERE participante_id = 'b5b8419c-d21f-4fdc-b37e-77f4d1c55d88';
UPDATE participante_transferencias SET participante_id = '5ffe0dc8-4831-4dc9-9431-38ec4e47afb8' WHERE participante_id = 'b5b8419c-d21f-4fdc-b37e-77f4d1c55d88';
UPDATE recados SET participante_id = '5ffe0dc8-4831-4dc9-9431-38ec4e47afb8' WHERE participante_id = 'b5b8419c-d21f-4fdc-b37e-77f4d1c55d88';

DELETE FROM participantes WHERE id = 'b5b8419c-d21f-4fdc-b37e-77f4d1c55d88';

-- Duplicate 2: SOPHIA DE TOLEDO MELO
-- Keep: dc8210f1 (most recent), Remove: 79b85216

UPDATE turma_participantes SET participante_id = 'dc8210f1-a732-4494-8dfa-7d436b5cde4e' WHERE participante_id = '79b85216-5d9a-4b64-b1df-3eec0a4f3872' AND NOT EXISTS (SELECT 1 FROM turma_participantes WHERE participante_id = 'dc8210f1-a732-4494-8dfa-7d436b5cde4e' AND turma_id = turma_participantes.turma_id);
DELETE FROM turma_participantes WHERE participante_id = '79b85216-5d9a-4b64-b1df-3eec0a4f3872';

UPDATE presenca SET participante_id = 'dc8210f1-a732-4494-8dfa-7d436b5cde4e' WHERE participante_id = '79b85216-5d9a-4b64-b1df-3eec0a4f3872';
UPDATE participante_documentos SET participante_id = 'dc8210f1-a732-4494-8dfa-7d436b5cde4e' WHERE participante_id = '79b85216-5d9a-4b64-b1df-3eec0a4f3872';
UPDATE atendimentos SET participante_id = 'dc8210f1-a732-4494-8dfa-7d436b5cde4e' WHERE participante_id = '79b85216-5d9a-4b64-b1df-3eec0a4f3872';
UPDATE relatorio_presenca SET participante_id = 'dc8210f1-a732-4494-8dfa-7d436b5cde4e' WHERE participante_id = '79b85216-5d9a-4b64-b1df-3eec0a4f3872';
UPDATE participante_transferencias SET participante_id = 'dc8210f1-a732-4494-8dfa-7d436b5cde4e' WHERE participante_id = '79b85216-5d9a-4b64-b1df-3eec0a4f3872';
UPDATE recados SET participante_id = 'dc8210f1-a732-4494-8dfa-7d436b5cde4e' WHERE participante_id = '79b85216-5d9a-4b64-b1df-3eec0a4f3872';

DELETE FROM participantes WHERE id = '79b85216-5d9a-4b64-b1df-3eec0a4f3872';

-- Normalize all existing names to UPPERCASE
UPDATE participantes SET nome_completo = UPPER(TRIM(nome_completo)) WHERE nome_completo != UPPER(TRIM(nome_completo));
