
# Templates Google como base oficial dos documentos SysCFV

Você enviou 4 modelos no Google (Relatório, Planejamento, Frequência web, Chamada física) com comentários ricos descrevendo cada placeholder e regra visual. A ideia é parar de "construir do zero" via batchUpdate (que não reproduz fielmente o layout) e passar a usar **copy-from-template + substituição de placeholders**, garantindo que tudo o que você ajustou nos modelos (espaçamento, bordas, tabela de fotos A4, checkboxes, cores Likert, posição de assinatura) seja preservado pixel a pixel.

Para os demais documentos (REO, RCA, Roteiro de Visita, Atendimento Equipe Técnica, Orçamento/Mapa, Prestação de Contas, Cardápio, Movimentações, Transporte, Relatório Mensal) **mantemos o layout PDF atual**, apenas convertido para Docs/Sheets nativo — sem mudar a aparência.

## 1. Pasta de Modelos no Drive

Criar `SysCFV / Modelos de Documentos / Relatorios` e popular com cópias renomeadas dos seus 4 originais:

- `MODELO — Relatório de Atividade — atualizado em DD/MM/AAAA`
- `MODELO — Planejamento de Atividade — atualizado em DD/MM/AAAA`
- `MODELO — Lista de Frequência (Web) — atualizado em DD/MM/AAAA`
- `MODELO — Lista de Chamada (Física) — atualizado em DD/MM/AAAA`

A "última data de alteração" no nome é atualizada automaticamente sempre que detectarmos `modifiedTime` diferente no original (job `refresh_modelos` rodando 1×/dia, idempotente). Os IDs originais ficam guardados em uma tabela `drive_modelos` (`tipo`, `template_doc_id`, `copia_doc_id`, `ultima_atualizacao`) para a worker resolver "qual template copiar" sem hardcode.

## 2. Engine de geração: copy + replace placeholders

Substitui o builder atual (`relatorioToBlocks`/`planejamentoToBlocks`) por um motor genérico:

```text
1. Drive.files.copy(template_id, parents=[pasta_destino], name=título_final)
2. Para Docs:    Docs.batchUpdate com replaceAllText para cada {PLACEHOLDER}
                 + replaceAllText especial para checkboxes (■/□)
                 + insertInlineImage para fotos do ANEXO I
                 + insertTableRow + insertText para linhas dinâmicas (presença, competências)
3. Para Sheets:  Sheets.batchUpdate copyPaste do template para cada turma (nova aba)
                 + values.update preenchendo nomes, datas e marcadores P/A/D
                 + adjusta dimensões de linhas/colunas conforme dados
```

### Mapa de placeholders — Relatório (Doc)
Direto dos seus comentários:

| Placeholder | Origem |
|---|---|
| `{TITULO}` | `nome_atividade` |
| `{DATA}` `{EDUCADOR}` `{TURMAS}` `{PERIODO}` `{TIPO}` | header |
| `{OBJ_1..3}` checkbox preto | `objetivo_alcancado` |
| `{ENG_1..4}` checkbox preto | `engajamento[]` |
| `{SIT_1..5}` checkbox preto | `situacoes_relevantes[]` |
| `{ATIVIDADES_REALIZADAS}` `{OBSERVACOES}` `{INTERVENCOES}` `{RESULTADOS_ALCANCADOS}` | textos |
| `{INICIATIVA}` `{AUTONOMIA}` `{COLABORACAO}` `{COMUNICACAO}` `{RESPEITO_MUTUO}` `{SCORE_ELO}` | competências; cor de fundo da célula aplicada via `updateTableCellStyle` conforme legenda 1–5 |
| `{PCT_ADESAO}` `{NUM_PARTICIPANTES}` `{NUM_MATRICULADOS}` | indicadores |
| ANEXO I — `{foto1}..{foto5}` | substitui cada token por `insertInlineImage` apontando para `contentUri` da foto já no Drive (com watermark); placeholders sem foto ficam em branco |
| ANEXO II — tabela de presença | a tabela já existe no template com 1 linha exemplo; o motor faz `insertTableRow` por participante e preenche nº, nome, P/A, justificativa |

### Mapa de placeholders — Planejamento (Doc)
`{TITULO}` `{EDUCADOR}` `{TURMAS}` `{TEMA}` `{QUESTAO_GERADORA}` `{ROTEIRO}` `{MATERIAIS}` `{APOIO_TECNICO}` `{OBJETIVOS}` `{FORMA_AVALIACAO}` (bullets) + EIXOS ESTRUTURANTES (mantém os 3 checkboxes vazios por enquanto, conforme seu comentário "ainda não tem no relatório do site").

### Modelo Lista de Frequência (Web) e Chamada (Física) — Sheets
- **1 planilha por turma por mês** (não mais 1 workbook com várias abas — seus modelos têm 1 aba só, mais simples e fiel).
  - Pasta: `Listas de Frequência / {YYYY-MM} /` e `Listas de Chamada / {YYYY-MM} /`.
- Workflow: `copy(template)` → renomeia → preenche cabeçalho (`Educador`, `Mês`, `Turma | Bairro | Período | Faixa | Oficina`) via `values.update` em ranges nomeados (`HEADER_EDUCADOR`, `HEADER_TURMA`, `HEADER_MES`).
- Bloco de participantes: insere linhas via `insertDimension`, preenche nomes (com sufixo `(D DD/MM)` se desligado no mês) e para cada coluna de data marca:
  - `P` em célula com fundo preto e texto branco
  - `A` em célula com fundo branco e texto preto
  - `D` em célula com fundo cinza claro (a partir da próxima data pós-desligamento até o fim do mês)
- Última linha = `Assinatura do Educador: _______________________`. **Não inserir nenhuma linha abaixo dela** (regra explícita do seu comentário).
- Auto-fit de altura de linhas conforme conteúdo (já comentado nos modelos).

## 3. Botão "Abrir no Google" + queue

Sem alterar UI atual. Os botões já existem (DriveSyncBadge); o que muda é o que a worker faz por baixo. Quando o tipo for um dos 4 cobertos pelos modelos, ela usa `copyFromTemplate(tipo)`; senão, mantém o builder atual (REO, RCA, etc.).

## 4. Demais documentos (mantém layout PDF)

Para cada um (Roteiro de Visita, Atendimento, Orçamento, Prestação de Contas, Cardápio, Movimentação, Transporte, REO, RCA, Relatório Mensal): **gerar PDF com o builder atual, fazer upload ao Drive e converter para Docs/Sheets nativo** via `files.copy` com `mimeType: application/vnd.google-apps.document` (ou `.spreadsheet`). Isso preserva 100% o layout PDF atual mas dá um arquivo Google editável/comentável. Sem reconstruir templates para esses agora.

## 5. Testes — 1 exemplo real de cada

Vou enfileirar e processar pelo menos 1 exemplo de cada tipo, escolhendo o registro com **maior volume de informação** (e fotos quando aplicável):

| # | Documento | Critério de escolha |
|---|---|---|
| 1 | Relatório de Atividade | maior nº de fotos + presença + observações longas |
| 2 | Planejamento | mais campos preenchidos |
| 3 | Lista de Frequência (Web) | turma com mais participantes do mês corrente |
| 4 | Lista de Chamada (Física) | mesma turma para comparação |
| 5 | Roteiro de Visita | mais recente |
| 6 | Atendimento Equipe Técnica | mais recente |
| 7 | Orçamento / Mapa | com 3 fornecedores |
| 8 | Prestação de Contas | mês com mais despesas |
| 9 | REO | último gerado |
| 10 | RCA | último gerado |
| 11 | Relatório Mensal | último gerado |
| 12 | Cardápio + Movimentação Cozinha | mês corrente |
| 13 | Transporte diário | dia mais recente |

Devolvo a tabela de links Docs/Sheets para você abrir, comentar dentro do próprio Google e na próxima rodada eu leio via `comments.list` e ajusto os modelos.

## Detalhes técnicos

- **Schema novo**: `drive_modelos(tipo PK, template_doc_id, ultima_atualizacao_origem, copia_doc_id, copia_modificada_em)`.
- **Cron `refresh-modelos`** (1×/dia): para cada `template_doc_id` chama `Drive.files.get(fields=modifiedTime)`, se mudou recopia para a pasta de Modelos com nome atualizado (`atualizado em DD/MM/AAAA`).
- **Worker — novo helper `cloneFromTemplate(tipo, destFolderId, title)`**: faz `Drive.files.copy` do `template_doc_id` → retorna novo `documentId`/`spreadsheetId`.
- **Helper `replacePlaceholders(docId, map)`**: gera `replaceAllText` requests para cada par `{KEY}` → `valor`.
- **Helper `replaceCheckboxes(docId, key, marcado)`**: substitui `{OBJ_1}` por `■` ou `□` (caractere unicode, mantém a mesma fonte do template).
- **Helper `insertImageAtPlaceholder(docId, placeholder, driveFileId)`**: 1) busca o índice do placeholder; 2) `deleteContentRange` do placeholder; 3) `insertInlineImage` com `uri` apontando para `https://drive.google.com/uc?id={fileId}` (foto já está pública no Drive interno, ou geramos token temporário via `files.get?fields=webContentLink`).
- **Cores Likert nas células de competências**: `updateTableCellStyle` com `backgroundColor` mapeado: 1=#C0392B, 2=#E67E22, 3=#F1C40F, 4=#27AE60, 5=#16A085 (ajustaremos exato após você comentar).
- **Idempotência**: se `drive_file_id` já existe no registro, em vez de copiar de novo, atualiza o existente com `deleteContentRange` + recopia o body do template (clonando seu conteúdo). Isso evita acumular cópias.
- **Não quebra nada**: exportadores PDF/DOCX/XLSX atuais permanecem; apenas a parte "espelho no Google" muda de "construído do zero" para "copiado do template".

## Não está nesta etapa

- Substituir/remover os exportadores PDF/DOCX/XLSX atuais.
- Construir templates Google para REO/RCA/Roteiro/Atendimento/Orçamento/Prestação/Cardápio/Movimentação/Transporte/Mensal — esses ficam como cópia do PDF convertida para nativo até você decidir desenhar templates específicos.
- Sincronização bidirecional (editar no Google → refletir no SysCFV).
