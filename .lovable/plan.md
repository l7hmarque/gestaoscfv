
# Integração Google Workspace — Camada Espelho de Documentos

Adicionar uma camada de "espelho no Google" sobre todas as exportações existentes (XLSX, DOCX, PDF), **sem remover** o que já funciona. Cada documento gerado também passa a existir como Google Docs / Sheets na conta institucional, com botão de acesso direto. Ao final, geramos um exemplo de cada tipo e devolvemos os links para você revisar/anotar dentro do próprio Google.

## Princípio geral

- **Não remover nada.** Os botões atuais de Exportar (XLSX/DOCX/PDF) continuam.
- Cada tela ganha um botão extra **"Abrir no Google"** (Docs ou Sheets, conforme o caso) e, nas listagens, um botão **"Abrir pasta no Drive"**.
- A geração no Google é **assíncrona via worker** (já existe `drive-sync-worker`) — o usuário não espera; o badge mostra o estado.
- **Layout institucional** é replicado nativamente em Google Docs/Sheets via `batchUpdate` (sem converter de DOCX/XLSX), preservando estética cinza/vermelha do SysCFV: cabeçalho com título, metadados, headings H1/H2, tabelas com bordas, células mescladas, presença marcada com `■`.

## Como reproduzir o layout institucional no Google

**Google Docs (Relatórios, Planejamentos, REO, RCA, Roteiros de Visita, Atendimentos da Equipe Técnica, Documentos de Prestação):**
- Centralizamos o "tema visual" em `supabase/functions/_shared/gdocsTemplate.ts`:
  - Helpers `insertHeader(title, subtitulo)`, `insertMetaBlock([{label,value}])`, `insertSectionHeading(text)`, `insertParagraph(text, style?)`, `insertTable(rows, opts)`, `insertImageInline(driveFileId, opts)`, `insertFooterHash(hash)`.
  - Aplicam `updateTextStyle` (negrito, tamanhos), `updateParagraphStyle` (HEADING_1/2, alinhamento), `createParagraphBullets` e `updateTableCellStyle` (bordas grayscale 0.5pt).
- Cada tipo de documento tem um builder dedicado que chama esses helpers na ordem correta. Mesma fonte de verdade para conteúdo institucional, mesmo "skin" cinza/preto.

**Google Sheets (Listas de chamada/frequência, Cardápio, Movimentações cozinha, Orçamentos/Mapas, Transporte, Backup):**
- `_shared/gsheetsTemplate.ts` com helpers `applyInstitutionalHeader(sheetId, title, periodo, territorio)`, `applyHeaderRow(sheetId, headers)`, `applyGridBorders(range)`, `applyAutoFit(sheet)`, `freezeRows(n)`, `mergeCells(range)`.
- Reaproveitamos a lógica já existente em `xlsxInstHeader.ts` / `xlsxAutoFit.ts` traduzindo para `spreadsheets.batchUpdate` (mesmas larguras, mesmas cores HSL convertidas para RGB).

**Fotos dentro do Doc (Relatório de Atividade):**
- Após upload das fotos com watermark à pasta `Registros Fotográficos/{YYYY-MM}/`, o builder do relatório insere uma seção **"Registros Fotográficos"** no final do Doc com `insertInlineImage` apontando para a `contentUri` de cada foto, em grid 2 colunas via tabela invisível, com legenda "Educador • Turma • DD/MM HH:mm • #hash".

## Estrutura de pastas no Drive (extensão da atual)

```text
SysCFV/
├── Profissionais/
│   └── {Nome}/
│       ├── Planejamentos/        Google Docs
│       ├── Relatórios/           Google Docs (com fotos embutidas)
│       ├── Atendimentos/         Google Docs (Equipe Técnica)
│       └── Roteiros de Visita/   Google Docs
├── Listas de Chamada/
│   └── {YYYY-MM}/                Google Sheets — 1 planilha/mês com 1 aba por turma
├── Listas de Frequência/
│   └── {YYYY-MM}/                Google Sheets idem
├── Financeiro/
│   ├── Orçamentos/               Google Sheets (mapa comparativo)
│   ├── Prestação de Contas/      Google Docs
│   └── SIT/                      Drive (mantém formato .txt original — não há equivalente nativo)
├── Cozinha/
│   ├── Cardápios/                Google Sheets
│   └── Movimentações/            Google Sheets
├── Transporte/                   Google Sheets diário
├── Relatórios Gerenciais/
│   ├── REO/                      Google Docs (anexa Sheets de indicadores)
│   ├── RCA/                      Google Docs
│   └── Mensal/                   Google Sheets
└── Registros Fotográficos/
    └── {YYYY-MM}/                JPG com watermark
```

## Mudanças por módulo (cada item ganha botão "Abrir no Google" + a pasta correspondente ganha botão "Abrir pasta")

| Módulo | Documento | Tipo Google | Trigger |
|---|---|---|---|
| Relatórios de Atividade | 1 doc por relatório, com fotos embutidas | Docs | ao salvar |
| Planejamentos | 1 doc por planejamento | Docs | ao salvar |
| Listas de Chamada (presença) | 1 planilha/mês, 1 aba por turma | Sheets | ao gerar lote |
| Listas de Frequência preenchidas | idem | Sheets | ao exportar |
| Equipe Técnica — Roteiros de Visita | 1 doc por roteiro | Docs | ao salvar |
| Equipe Técnica — Atendimentos/Relatos | 1 doc por atendimento | Docs | ao salvar |
| Financeiro — Orçamentos/Mapa Comparativo | 1 planilha por orçamento | Sheets | ao finalizar mapa |
| Financeiro — Prestação de Contas | 1 doc por mês de prestação | Docs | ao consolidar |
| Financeiro — SIT (.txt) | mantém .txt, só faz upload ao Drive | Drive raw | ao exportar |
| Cozinha — Cardápio | 1 planilha/mês | Sheets | ao publicar |
| Cozinha — Movimentações de Estoque | 1 planilha/mês | Sheets | ao registrar |
| Transporte — Relatório diário | 1 planilha/dia | Sheets | ao gerar |
| REO | 1 doc + 1 sheet linkado | Docs+Sheets | ao gerar |
| RCA | 1 doc | Docs | ao gerar |
| Relatório Mensal/Gerencial | 1 sheet | Sheets | ao gerar |

## Etapas de implementação

### Etapa 1 — Conector Google Sheets + helpers compartilhados
- Conectar `google_sheets` (Docs e Drive já estão).
- Criar `supabase/functions/_shared/gdocsTemplate.ts` e `_shared/gsheetsTemplate.ts` com os helpers acima.
- Criar `_shared/driveFolders.ts` centralizando a resolução/cache de pastas (estende `drive_folder_cache`).

### Etapa 2 — Schema
- Adicionar colunas `drive_file_id` / `drive_url` em: `roteiros_visita`, `equipe_tecnica_atendimentos` (ou tabela equivalente), `orcamentos`, `prestacao_contas`, `cardapios`, `movimentacoes_estoque`, `transporte_relatorios_diarios`, `relatorios_mensais`, `reo_documentos`, `rca_documentos`.
- Nova tabela `drive_planilhas_mensais` (`tipo`, `ano_mes`, `drive_file_id`, `drive_url`) — chave para listas de chamada/frequência (1 planilha por mês com várias abas).
- Estender enum `tipo` em `drive_sync_queue`: `roteiro_visita`, `atendimento_tecnico`, `orcamento`, `prestacao_contas`, `cardapio`, `movimentacao_cozinha`, `transporte_diario`, `relatorio_mensal`, `reo`, `rca`, `lista_chamada_lote`, `lista_frequencia_lote`, `arquivo_sit`.
- Triggers de enfileiramento ao `INSERT/UPDATE` nas respectivas tabelas (com filtro para evitar loops em campos `drive_*`).

### Etapa 3 — Edge Function `drive-sync-worker` (extensão)
- Adicionar handler para cada novo `tipo`. Cada handler:
  1. Resolve pasta destino.
  2. Busca dados completos via `service_role`.
  3. Chama o builder Docs/Sheets correspondente.
  4. Faz `batchUpdate` e grava `drive_file_id` / `drive_url`.
- **Listas em lote (chamada/frequência):** quando `tipo='lista_chamada_lote'` com `payload={ano_mes, turma_ids[]}`, o worker:
  1. Pega ou cria a planilha mensal em `drive_planilhas_mensais`.
  2. Para cada turma: cria/atualiza uma aba com nome = nome da turma; preenche cabeçalho institucional + grade.
  3. Retorna o link único da planilha.
- **Idempotência mantida** via `drive_file_id` existente.

### Etapa 4 — UI

**Botões "Abrir no Google" (mantém Exportar):**
- `RelatorioDetalhePage`, `PlanejamentoDetalhePage` — já têm `DriveSyncBadge`; adicionar botão `Abrir no Google Docs` ao lado de Exportar Tudo.
- Para cada novo módulo (roteiro, atendimento, orçamento, etc.), adicionar o mesmo padrão `<DriveSyncBadge />` + botão de abrir.

**Botões "Abrir pasta no Drive" nas listagens:**
- `RelatoriosPage`, `PlanejamentosPage`, `RoteirosTab`, `OrcamentosTab`, `DocumentosPrestacaoTab`, `CardapioTab`, `MovimentacoesTab`, `TransportePage`, `PresencaExportarPage`, `ExportarRelatoriosPage`, `ArquivosFinanceirosPage`, `EquipeTecnicaPage`.
- Helper `useDriveFolderUrl(tipo, contexto?)` — chama RPC que devolve a URL da pasta do usuário/módulo (cria se não existir, em background).

**Listas de chamada/frequência em lote:**
- Em `PresencaExportarPage` e onde existe a geração em lote: novo botão **"Gerar no Google Sheets (lote)"** que enfileira `lista_chamada_lote` com as turmas selecionadas e mostra o link único quando pronto.

### Etapa 5 — Teste end-to-end e entrega de exemplos

Vou enfileirar e processar **um exemplo de cada tipo**, depois te enviar a tabela de links:

1. Relatório de Atividade (com fotos embutidas)
2. Planejamento
3. Lista de Chamada (lote — 1 planilha com 3 abas)
4. Lista de Frequência preenchida
5. Roteiro de Visita
6. Atendimento Equipe Técnica
7. Orçamento / Mapa Comparativo
8. Prestação de Contas
9. Cardápio + Movimentação Cozinha
10. Transporte diário
11. REO + RCA + Relatório Mensal

Como você sugeriu, **comentários do Google Docs/Sheets** podem ser deixados diretamente nos arquivos — eu leio via API (`comments.list`) e ajusto layout/conteúdo conforme suas anotações na próxima rodada.

## Detalhes técnicos

- **Sem quebrar nada:** todas as adições são aditivas. Nenhum builder XLSX/DOCX/PDF existente é removido. Os novos botões aparecem ao lado dos atuais.
- **Background-first:** triggers no banco enfileiram; a UI nunca espera o Google. Badges mostram `pendente / sincronizando / pronto / erro` (já existe componente).
- **Conta única OSC:** continua usando os connectors `google_drive`, `google_docs` + agora `google_sheets` ligados à conta do Leonardo. Sem OAuth por usuário.
- **Rate limit / quotas:** worker processa até 10 jobs por invocação, com backoff até 5 tentativas; pg_cron a cada 1 min.
- **SIT (.txt):** não tem equivalente nativo no Google — fica como arquivo bruto no Drive (somente upload), mantendo a exportação atual.
- **Permissões:** RLS em `drive_planilhas_mensais` e novas colunas seguindo o padrão de `drive_sync_queue` (somente coordenação/dev veem a fila; usuários veem o link no detalhe do próprio registro).

## O que NÃO está nesta etapa

- Substituir/remover os exportadores XLSX/DOCX/PDF — fica para depois, após sua validação dos exemplos.
- Edição bidirecional (alterar no Google e refletir no SysCFV). Por ora a sincronização é unidirecional (SysCFV → Google), com comentários do Google lidos para ajustes manuais de template.
