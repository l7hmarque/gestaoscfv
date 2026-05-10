## Diagnóstico atual

Hoje os geradores estão divididos:


| Documento                           | Função                                       | Usa template `drive_modelos`? |
| ----------------------------------- | -------------------------------------------- | ----------------------------- |
| Relatório de Atividade (Google Doc) | `drive-sync-worker → processRelatorio`       | ✅ `relatorio`                 |
| Planejamento (Google Doc)           | `drive-sync-worker → processPlanejamento`    | ✅ `planejamento`              |
| Lista de Chamada (Google Sheet)     | `generate-lista-chamada-gsheet`              | ❌ monta do zero               |
| Relatório Mensal Consolidado        | `generate-relatorio-mensal`                  | ❌ XLSX cru                    |
| REO                                 | `generate-reo`                               | ❌ DOCX/XLSX cru               |
| Lista de Frequência mensal (matriz) | `drive-sync-worker → processListaFrequencia` | ✅ `lista_frequencia`          |


A pasta de destino do botão "Sincronizar mês ao Drive" é `SysCFV_Workspace/...` fixa, sem mensalização.

## Fase 1 — Sincronização institucional única para Abril/2026

### 1.1 Pasta-alvo mensal

Em `sync-drive-modelos`:

- Trocar `ensureFolder("SysCFV_Workspace")` por `ensureFolder` parametrizado: `SYSCFV - {MES_UPPER} - {ANO}` (ex.: `SYSCFV - ABRIL - 2026`), criada na raiz do Drive da OSC.
- Manter as 8 subpastas já existentes (`01_Modelos_Institucionais` … `08_Cronogramas`).
- A função aceita opcionalmente `{ rootName }` no body para sobrescrever o padrão.

### 1.2 Lista de Chamada — passar a clonar o template institucional

Refatorar `generate-lista-chamada-gsheet`:

- Em vez de construir o sheet do zero, **copiar** `drive_modelos.lista_chamada.template_doc_id` (`1zbEPL21HRu0AblNiGbEMHkdIEsgnE8oGEfYi8Vw-3PU`) via Drive API e preencher placeholders/intervalos do template (título, dias, nomes, marcadores).
- Mantém todos os comentários/correções que você já aplicou no template (título, marcadores `(BA)/(D)/(T)`, símbolo `■`, etc.).

### 1.3 Relatório Mensal e REO — converter para Google Sheets nativos via templates

- Criar 2 novos tipos em `drive_modelos` (caso ainda não existam): `relatorio_mensal` e `reo`. Você cadastra os IDs dos seus Google Sheets institucionais já comentados.
- Refatorar `generate-relatorio-mensal` e `generate-reo` para:
  1. Clonar o template via Drive API (`/files/{id}/copy`).
  2. Preencher abas e intervalos via `spreadsheets.values:batchUpdate` (Google Sheets API).
  3. Retornar `drive_file_id` + `drive_url` em vez de XLSX bruto.
- O XLSX/DOCX legado fica como fallback opcional até a Fase 2.

### 1.4 Regras de filtro aplicadas em todos os geradores

Em **todos** os pontos que listam participantes (`generate-lista-chamada-gsheet`, `generate-relatorio-mensal`, `generate-reo`, `drive-sync-worker → processListaFrequencia`):

- **Excluir desligados**: ignorar quando `status = 'desligado'` **e** `data_desligamento < dataIni do mês`. Quem desligou dentro do próprio mês continua aparecendo, com marcador `(D)` (já existe).
- **Marcar entrantes do mês**: anexar marcador `**(N)**` (Novo) ao nome do participante quando `iniciou_em >= 2026-04-01 AND iniciou_em < 2026-05-01`. Centralizar a lógica num helper compartilhado.

### 1.5 Endpoint orquestrador "Exportar mês completo"

Em `sync-drive-modelos`, adicionar `tipos: "all"` (ou já passar todos os tipos) e incluir o tipo novo `**planejamentos**`:

- Itera todos os planejamentos com `data_aplicacao` no mês → `drive-sync-worker → process_planejamento_now` → cópia para `03_Planejamentos`.

Resultado: uma única chamada gera Relatórios (02), Planejamentos (03), Listas de Chamada (04), Relatório Mensal (05), REO (06), Equipe Técnica (07) — tudo dentro de `SYSCFV - ABRIL - 2026/`.

### 1.6 UI — botão único na aba Admin do Dashboard

Em `DashboardAdminTab`, simplificar para um botão "Exportar mês completo ao Drive" que chama `sync-drive-modelos` com todos os tipos e mostra os links das subpastas geradas no toast/log.

### 1.7 Verificação

Após o deploy, eu rodo a sincronização para Abril/2026 e te devolvo:

- Link da pasta `SYSCFV - ABRIL - 2026/`
- Links de cada subpasta
- Lista de arquivos gerados com link direto

Você confere e aprova antes da Fase 2.

## Fase 2 — Substituir XLSX/DOCX por Google Docs/Sheets em todo o app

**Só inicio depois da sua aprovação visual da Fase 1.** Escopo:

- Em cada página com botão "Exportar XLSX/DOCX/PDF" (Relatórios, Planejamentos, Lista de Chamada, Mensal, REO, Hub `/relatorios/exportar`, Dashboard, Detalhe de Turma, etc.):
  - Remover os botões `Download XLSX/DOCX/PDF` e o hook correspondente.
  - Substituir por **"Abrir no Drive"** (já existe via `DriveSyncBadge`) que dispara o gerador apropriado e abre o Google Doc/Sheet em nova aba.
  - Manter o cache de `drive_url` em `drive_sync_queue` para evitar reprocessamento.
- Remover gradualmente os hooks `useDocumentExport`, `useBulkRelatorioExport`, `useDataExport`, `useOrcamentoExport` e funções `generate-*-gdoc`/`-pdf` que ficarem órfãs.
- Atualizar memória (`mem://constraints/nomenclatura-arquivos`) para refletir que o sistema agora padroniza tudo no Drive.

## Detalhes técnicos importantes

- **Templates como source of truth**: nenhum gerador novo monta documento do zero — todos clonam o ID em `drive_modelos` e fazem `batchUpdate` (Sheets) ou substituição de placeholders (Docs).
- **Idempotência**: usar `resolveNome` + `trashFile` já existentes em `sync-drive-modelos` para versionar (`_v2`, `_v3`) ou sobrescrever conforme `modo`.
- **Performance**: paralelizar com `Promise.allSettled` por tipo, mantendo limite de ~5 chamadas simultâneas para evitar 429 do Drive.
- **Helper compartilhado** `marcadorParticipante(p, dataIniMes)` colocado em `supabase/functions/_shared/participanteMarcadores.ts` para uniformizar `(D)/(T)/(N)`.

## Confirmações necessárias antes de implementar

1. **Marcador para entrantes do mês**: confirma `(N)` ou prefere outro símbolo (★, *, (E))? confirma.
2. **Templates `relatorio_mensal` e `reo**`: você já tem os Google Sheets institucionais comentados? Se sim, me passa os links que eu cadastro em `drive_modelos`. Se não, posso usar o XLSX atual como base e converter — mas aí não terá o layout que você comentou. ainda nao tenho, deixar pra depois.
3. **Pasta única vs por mês**: confirmo que o padrão será `SYSCFV - {MES} - {ANO}` (uma pasta nova a cada mês). Mantenho ou prefere uma raiz `SYSCFV/` com subpastas mensais dentro? subpastas dentro organizadas por mes.