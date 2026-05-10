## Diagnóstico

Hoje existem **dois caminhos diferentes** para gerar o Google Doc do Relatório de Atividade — e eles produzem resultados distintos:

### Caminho A — Botão "Abrir no Drive" do relatório (`/relatorios/:id`) ✅ correto

`DriveSyncBadge` lê `drive_sync_queue.drive_url`, que é populado pela edge function `**drive-sync-worker → processRelatorio()**`. Esse processo:

1. **Clona o template** cadastrado em `drive_modelos.template_doc_id` (tipo `relatorio`) — preserva timbre, cabeçalho, rodapé, tabelas formatadas, células coloridas das competências, ANEXO I/II, etc.
2. **Substitui placeholders** (`{DATA}`, `{EDUCADOR}`, `{NOME_ATIVIDADE}`, `{ENG_1..4}`, `{SIT_1..5}`, `{OBJ_*}`, `{INICIATIVA}`...`{SCORE_ELO}`) via `fillRelatorioTemplate()`.
3. Aplica **cores nas células de competência**, insere até 5 fotos nos placeholders `{foto1..5}` e a **tabela de presença** após o âncora "ANEXO II".
4. Salva no Drive na pasta do educador.

### Caminho B — "Sincronizar mês ao Drive" (Dashboard → Admin) ❌ produz layout errado

`DashboardAdminTab.sincronizarDrive()` chama `**sync-drive-modelos**` que, para cada relatório do mês, invoca `**generate-relatorio-gdoc**`. Essa função:

1. Clona um template **hardcoded** (`GDOCS_RELATORIOS_TEMPLATE_ID = "1in9wpXN6kS..."`), diferente do que está em `drive_modelos`.
2. **Apaga o conteúdo do template** (`deleteContentRange`) e reescreve tudo via `insertText`/`updateTextStyle` — perde toda a formatação institucional, tabelas, células coloridas e placeholders de fotos.
3. Move o arquivo para `SysCFV_Workspace/02_Relatorios_Atividade`.

É por isso que a pasta `02` no Drive aparece "fora do padrão" mesmo o botão individual estando correto.

## O que mudar

Fazer a sincronização mensal usar **o mesmo motor do `drive-sync-worker**` (clone do template em `drive_modelos` + `fillRelatorioTemplate`), em vez de `generate-relatorio-gdoc`.

### Passos

1. **Edge function `drive-sync-worker**` — adicionar uma ação síncrona expondo `processRelatorio` para um único id, retornando `{ drive_file_id, drive_url }`. (Hoje essa função roda processando a fila inteira; precisamos de um modo "processa este id agora e responde".)
  - Adicionar handler: `if (action === "process_relatorio_now") { return await processRelatorio(origem_id) }`.
  - Mantém todo o comportamento atual (cache de pasta, idempotência por `drive_file_id`, fotos, ANEXO II).
2. **Edge function `sync-drive-modelos**` — no bloco `if (tipos.includes("relatorios"))`:
  - Substituir a chamada `invokeFn("generate-relatorio-gdoc", ...)` por `invokeFn("drive-sync-worker", { action: "process_relatorio_now", origem_id: rel.id })`.
  - Receber `drive_file_id` retornado e, em seguida:
    - **Copiar** (`POST /files/{id}/copy`) para a pasta `SysCFV_Workspace/02_Relatorios_Atividade` com o nome institucional `SysCFV_Relatorio_{YYYY-MM-DD}_{NomeAtividade}` (mantendo a cópia original na pasta do educador, que continua sendo o que o botão "Abrir no Drive" abre).
    - Aplicar `resolveNome` + `trashFile` da versão antiga (mesma lógica de versionar já existente).
  - Manter a coleta de erros e o `result.sincronizados.relatorios`.
3. **Sem mudanças** em `generate-relatorio-gdoc` (mantém compatibilidade com qualquer outro consumidor); pode ficar como fallback ou ser depreciado num passo posterior se você confirmar que não é usado em outro lugar.
4. **Frontend** — nenhuma mudança visual. O botão "Sincronizar mês ao Drive" continua igual; apenas o conteúdo gerado passa a respeitar o template institucional.

## Resultado esperado

Após a mudança:

- `02_Relatorios_Atividade` no Drive passa a conter Google Docs **idênticos** ao que o botão "Abrir no Drive" do relatório individual gera (mesmo timbre, cabeçalho, ANEXO I/II, células coloridas, fotos).
- O botão "Abrir no Drive" do `/relatorios/:id` continua funcionando exatamente como hoje (a sincronização mensal agora usa o mesmo motor por baixo).

## Confirmação

Antes de implementar, só preciso confirmar uma coisa: você quer que a sincronização mensal **copie** o doc do educador para `02_Relatorios_Atividade` (mantendo os dois locais), ou prefere que apenas adicione a pasta `02_...` como **segundo pai** do mesmo arquivo (sem duplicação física)? Vou seguir com **cópia** por padrão se não houver objeção. Mantem os dois locais.