
UPDATE drive_modelos SET copia_doc_id='1tyasgr6ibtvbuupCg-Kyu9K-W5k9YV84-TVpAB-NI_Q', copia_url='https://docs.google.com/document/d/1tyasgr6ibtvbuupCg-Kyu9K-W5k9YV84-TVpAB-NI_Q/edit', ultima_atualizacao_origem='2026-05-08T16:18:22.113Z', copia_renovada_em=now() WHERE tipo='relatorio';
UPDATE drive_modelos SET copia_doc_id='1A7h4EULS4kxouDOiu7wUX8YxPxuuuHcDJTy8W8jXGhU', copia_url='https://docs.google.com/document/d/1A7h4EULS4kxouDOiu7wUX8YxPxuuuHcDJTy8W8jXGhU/edit', ultima_atualizacao_origem='2026-05-08T16:32:13.882Z', copia_renovada_em=now() WHERE tipo='planejamento';
UPDATE drive_modelos SET copia_doc_id='1DKWWCC5j-jd2fFrBCr8T2Ea1dJiVdw_9UWsVhJ5Jwu4', copia_url='https://docs.google.com/spreadsheets/d/1DKWWCC5j-jd2fFrBCr8T2Ea1dJiVdw_9UWsVhJ5Jwu4/edit', ultima_atualizacao_origem='2026-05-08T17:06:30.379Z', copia_renovada_em=now() WHERE tipo='lista_frequencia';
UPDATE drive_modelos SET copia_doc_id='1V9jWzIFfdrQK7SMJ4TDfTpGToxi9Cu1qbBGU4quxZf0', copia_url='https://docs.google.com/spreadsheets/d/1V9jWzIFfdrQK7SMJ4TDfTpGToxi9Cu1qbBGU4quxZf0/edit', ultima_atualizacao_origem='2026-05-08T17:08:28.632Z', copia_renovada_em=now() WHERE tipo='lista_chamada';

INSERT INTO drive_folder_cache (chave, folder_id) VALUES
  ('modelos_root', '1li3aOwGPzQldeWzidBUSbq51ilfa-_d2'),
  ('modelos:relatorios', '1I2115qGer8LbxYdWH5MBRPmpVRa2WDC_')
ON CONFLICT (chave) DO UPDATE SET folder_id = EXCLUDED.folder_id;
