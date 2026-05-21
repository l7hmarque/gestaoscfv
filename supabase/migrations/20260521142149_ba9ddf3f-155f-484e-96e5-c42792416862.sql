
-- 1) Criar usuário auth da Laila
DO $$
DECLARE
  v_user_id uuid := gen_random_uuid();
  v_profile_id uuid;
  v_fabio uuid := '6a84afbe-6d08-4b5c-9be4-70a505993ef6';
  v_felipe uuid := '323c918a-79be-4d42-b028-7bbcae3328c4';
  v_jenifer uuid := '99384c69-8ed3-42b2-9557-508dda792082';
  v_laila uuid;
  v_jardim uuid := '94f170dd-59f8-46a0-92fb-0ba293920a70';
  v_parque uuid := '0a4af2ab-6606-4495-8328-93a60f9a511e';
  v_alvorada uuid := '85a31547-058a-43cb-8e37-995a0ff91a02';
  v_periodo text;
  v_faixa text;
BEGIN
  -- Auth user da Laila (se ainda não existe)
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'educadorcaiamedianeira@gmail.com') THEN
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', v_user_id, 'authenticated', 'authenticated',
      'educadorcaiamedianeira@gmail.com', crypt('Caia@2026', gen_salt('bf')),
      now(), '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name','Laila'),
      now(), now(), '', '', '', ''
    );
    INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    VALUES (gen_random_uuid(), v_user_id,
      jsonb_build_object('sub', v_user_id::text, 'email','educadorcaiamedianeira@gmail.com'),
      'email', v_user_id::text, now(), now(), now());
  ELSE
    SELECT id INTO v_user_id FROM auth.users WHERE email = 'educadorcaiamedianeira@gmail.com';
  END IF;

  -- Profile
  SELECT id INTO v_profile_id FROM profiles WHERE user_id = v_user_id;
  IF v_profile_id IS NULL THEN
    INSERT INTO profiles (user_id, nome, cargo, email, ativo)
    VALUES (v_user_id, 'Laila', 'Oficineiro', 'educadorcaiamedianeira@gmail.com', true)
    RETURNING id INTO v_profile_id;
  END IF;
  v_laila := v_profile_id;

  -- Role
  INSERT INTO user_roles (user_id, role) VALUES (v_user_id, 'educador')
  ON CONFLICT (user_id, role) DO NOTHING;

  ----------------------------------------------------------------
  -- 2) Turmas
  -- Helper inline: criamos cada turma sem duplicar (mesma oficina+bairro+faixa+periodo+dias)
  ----------------------------------------------------------------

  -- DANCA E POESIA — Fabio
  -- 6-8 e 9-11 PARQUE INDEPENDENCIA (Quintas)
  FOREACH v_faixa IN ARRAY ARRAY['6-8','9-11'] LOOP
    FOREACH v_periodo IN ARRAY ARRAY['manha','tarde'] LOOP
      INSERT INTO turmas (nome, oficina, bairro_id, periodo, faixa_etaria, faixas_etarias, dias_semana, educador_id, ativa)
      SELECT 'DANCA E POESIA — '||v_faixa||' — PARQUE INDEPENDENCIA', 'DANCA E POESIA', v_parque, v_periodo::periodo_enum, v_faixa::faixa_etaria_enum, ARRAY[v_faixa], ARRAY['quinta'], v_fabio, true
      WHERE NOT EXISTS (SELECT 1 FROM turmas WHERE oficina='DANCA E POESIA' AND bairro_id=v_parque AND faixa_etaria=v_faixa::faixa_etaria_enum AND periodo=v_periodo::periodo_enum);
    END LOOP;
  END LOOP;
  -- 6-8 e 9-11 JARDIM IRENE (Terças)
  FOREACH v_faixa IN ARRAY ARRAY['6-8','9-11'] LOOP
    FOREACH v_periodo IN ARRAY ARRAY['manha','tarde'] LOOP
      INSERT INTO turmas (nome, oficina, bairro_id, periodo, faixa_etaria, faixas_etarias, dias_semana, educador_id, ativa)
      SELECT 'DANCA E POESIA — '||v_faixa||' — JARDIM IRENE', 'DANCA E POESIA', v_jardim, v_periodo::periodo_enum, v_faixa::faixa_etaria_enum, ARRAY[v_faixa], ARRAY['terca'], v_fabio, true
      WHERE NOT EXISTS (SELECT 1 FROM turmas WHERE oficina='DANCA E POESIA' AND bairro_id=v_jardim AND faixa_etaria=v_faixa::faixa_etaria_enum AND periodo=v_periodo::periodo_enum);
    END LOOP;
  END LOOP;
  -- 12-17 MULTI (Seg + Qua)
  FOREACH v_periodo IN ARRAY ARRAY['manha','tarde'] LOOP
    INSERT INTO turmas (nome, oficina, bairro_id, bairro_ids, periodo, faixa_etaria, faixas_etarias, dias_semana, educador_id, ativa)
    SELECT 'DANCA E POESIA — 12-17 — TODOS OS BAIRROS', 'DANCA E POESIA', NULL, ARRAY[v_jardim, v_parque, v_alvorada], v_periodo::periodo_enum, '12-17'::faixa_etaria_enum, ARRAY['12-17'], ARRAY['segunda','quarta'], v_fabio, true
    WHERE NOT EXISTS (SELECT 1 FROM turmas WHERE oficina='DANCA E POESIA' AND faixa_etaria='12-17' AND periodo=v_periodo::periodo_enum AND bairro_id IS NULL);
  END LOOP;

  -- KARATE — Felipe
  -- P.IND (Qui)
  FOREACH v_faixa IN ARRAY ARRAY['6-8','9-11'] LOOP
    FOREACH v_periodo IN ARRAY ARRAY['manha','tarde'] LOOP
      INSERT INTO turmas (nome, oficina, bairro_id, periodo, faixa_etaria, faixas_etarias, dias_semana, educador_id, ativa)
      SELECT 'KARATE — '||v_faixa||' — PARQUE INDEPENDENCIA','KARATE', v_parque, v_periodo::periodo_enum, v_faixa::faixa_etaria_enum, ARRAY[v_faixa], ARRAY['quinta'], v_felipe, true
      WHERE NOT EXISTS (SELECT 1 FROM turmas WHERE oficina='KARATE' AND bairro_id=v_parque AND faixa_etaria=v_faixa::faixa_etaria_enum AND periodo=v_periodo::periodo_enum);
    END LOOP;
  END LOOP;
  -- J.IRENE (Seg + Ter)
  FOREACH v_faixa IN ARRAY ARRAY['6-8','9-11'] LOOP
    FOREACH v_periodo IN ARRAY ARRAY['manha','tarde'] LOOP
      INSERT INTO turmas (nome, oficina, bairro_id, periodo, faixa_etaria, faixas_etarias, dias_semana, educador_id, ativa)
      SELECT 'KARATE — '||v_faixa||' — JARDIM IRENE','KARATE', v_jardim, v_periodo::periodo_enum, v_faixa::faixa_etaria_enum, ARRAY[v_faixa], ARRAY['segunda','terca'], v_felipe, true
      WHERE NOT EXISTS (SELECT 1 FROM turmas WHERE oficina='KARATE' AND bairro_id=v_jardim AND faixa_etaria=v_faixa::faixa_etaria_enum AND periodo=v_periodo::periodo_enum);
    END LOOP;
  END LOOP;
  -- ALVORADA (Qua)
  FOREACH v_faixa IN ARRAY ARRAY['6-8','9-11'] LOOP
    FOREACH v_periodo IN ARRAY ARRAY['manha','tarde'] LOOP
      INSERT INTO turmas (nome, oficina, bairro_id, periodo, faixa_etaria, faixas_etarias, dias_semana, educador_id, ativa)
      SELECT 'KARATE — '||v_faixa||' — ALVORADA','KARATE', v_alvorada, v_periodo::periodo_enum, v_faixa::faixa_etaria_enum, ARRAY[v_faixa], ARRAY['quarta'], v_felipe, true
      WHERE NOT EXISTS (SELECT 1 FROM turmas WHERE oficina='KARATE' AND bairro_id=v_alvorada AND faixa_etaria=v_faixa::faixa_etaria_enum AND periodo=v_periodo::periodo_enum);
    END LOOP;
  END LOOP;

  -- ESPORTE E RECREACAO — Jenifer
  -- P.IND (Ter)
  FOREACH v_faixa IN ARRAY ARRAY['6-8','9-11'] LOOP
    FOREACH v_periodo IN ARRAY ARRAY['manha','tarde'] LOOP
      INSERT INTO turmas (nome, oficina, bairro_id, periodo, faixa_etaria, faixas_etarias, dias_semana, educador_id, ativa)
      SELECT 'ESPORTE E RECREACAO — '||v_faixa||' — PARQUE INDEPENDENCIA','ESPORTE E RECREACAO', v_parque, v_periodo::periodo_enum, v_faixa::faixa_etaria_enum, ARRAY[v_faixa], ARRAY['terca'], v_jenifer, true
      WHERE NOT EXISTS (SELECT 1 FROM turmas WHERE oficina='ESPORTE E RECREACAO' AND bairro_id=v_parque AND faixa_etaria=v_faixa::faixa_etaria_enum AND periodo=v_periodo::periodo_enum);
    END LOOP;
  END LOOP;
  -- J.IRENE (Qui)
  FOREACH v_faixa IN ARRAY ARRAY['6-8','9-11'] LOOP
    FOREACH v_periodo IN ARRAY ARRAY['manha','tarde'] LOOP
      INSERT INTO turmas (nome, oficina, bairro_id, periodo, faixa_etaria, faixas_etarias, dias_semana, educador_id, ativa)
      SELECT 'ESPORTE E RECREACAO — '||v_faixa||' — JARDIM IRENE','ESPORTE E RECREACAO', v_jardim, v_periodo::periodo_enum, v_faixa::faixa_etaria_enum, ARRAY[v_faixa], ARRAY['quinta'], v_jenifer, true
      WHERE NOT EXISTS (SELECT 1 FROM turmas WHERE oficina='ESPORTE E RECREACAO' AND bairro_id=v_jardim AND faixa_etaria=v_faixa::faixa_etaria_enum AND periodo=v_periodo::periodo_enum);
    END LOOP;
  END LOOP;
  -- ALVORADA (Seg + Qua)
  FOREACH v_faixa IN ARRAY ARRAY['6-8','9-11'] LOOP
    FOREACH v_periodo IN ARRAY ARRAY['manha','tarde'] LOOP
      INSERT INTO turmas (nome, oficina, bairro_id, periodo, faixa_etaria, faixas_etarias, dias_semana, educador_id, ativa)
      SELECT 'ESPORTE E RECREACAO — '||v_faixa||' — ALVORADA','ESPORTE E RECREACAO', v_alvorada, v_periodo::periodo_enum, v_faixa::faixa_etaria_enum, ARRAY[v_faixa], ARRAY['segunda','quarta'], v_jenifer, true
      WHERE NOT EXISTS (SELECT 1 FROM turmas WHERE oficina='ESPORTE E RECREACAO' AND bairro_id=v_alvorada AND faixa_etaria=v_faixa::faixa_etaria_enum AND periodo=v_periodo::periodo_enum);
    END LOOP;
  END LOOP;

  -- ATIVIDADES CULTURAIS E ARTISTICAS — Laila — ALVORADA (Seg + Qua)
  FOREACH v_faixa IN ARRAY ARRAY['6-8','9-11'] LOOP
    FOREACH v_periodo IN ARRAY ARRAY['manha','tarde'] LOOP
      INSERT INTO turmas (nome, oficina, bairro_id, periodo, faixa_etaria, faixas_etarias, dias_semana, educador_id, ativa)
      SELECT 'ATIVIDADES CULTURAIS E ARTISTICAS — '||v_faixa||' — ALVORADA','ATIVIDADES CULTURAIS E ARTISTICAS', v_alvorada, v_periodo::periodo_enum, v_faixa::faixa_etaria_enum, ARRAY[v_faixa], ARRAY['segunda','quarta'], v_laila, true
      WHERE NOT EXISTS (SELECT 1 FROM turmas WHERE oficina='ATIVIDADES CULTURAIS E ARTISTICAS' AND bairro_id=v_alvorada AND faixa_etaria=v_faixa::faixa_etaria_enum AND periodo=v_periodo::periodo_enum);
    END LOOP;
  END LOOP;
END $$;

-- 3) Auto-vincular participantes ativos
SELECT public.recalcular_vinculos_turmas();
