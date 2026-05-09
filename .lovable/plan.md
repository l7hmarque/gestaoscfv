
# Próxima etapa: ajustes dos comentários + engine de template real + 13 exemplos

Os 2 docs de teste foram gerados por um protótipo one-off da rodada anterior — o worker `drive-sync-worker` ainda usa o caminho antigo "constrói do zero" (`relatorioToBlocks`/`writeDoc`), e a tabela `drive_modelos` está populada mas nunca é consultada. Os comentários que você deixou expõem exatamente os 4 pontos que precisam ser resolvidos antes de escalar para os outros documentos.

## Comentários recebidos e correções

**Relatório de Atividade**
1. *"Conforme a legenda deveria estar com cor de destaque verde, olhe o [4] da legenda"* → pintar a célula da competência com a cor da nota. Mapa: 1=#C0392B, 2=#E67E22, 3=#F1C40F, 4=#27AE60, 5=#16A085 (e SCORE_ELO usa o arredondado).
2. *"Essa é a legenda"* → manter intacta (não substituir nada nela).
3. *"As fotos ficaram todas uma em cima da outra, precisam ficar bem distribuídas"* → cada `{foto1..5}` é substituído por `insertInlineImage` com largura fixa (≈ 16cm = 460pt) e quebra de parágrafo entre elas; placeholders sem foto viram parágrafo vazio (não ficam pendurados). Fotos extras (>5) entram em parágrafos novos abaixo do `{foto5}`.
4. *"Cadê o nome das crianças presentes na atividade?"* → ANEXO II ganha tabela inserida programaticamente (3 colunas: Nº, Nome, P/A) — uma linha por participante presente, ordenada alfabeticamente, e abaixo um bloco "Ausentes com justificativa".

**Planejamento de Atividade**
1. *"Aqui era pra ser o título MATERIAIS NECESSARIOS e não a lista de materiais"* → bug é o `replaceAllText("MATERIAIS", ...)` casando com "Materiais necessários:" (case-insensitive). Correção em **2 frentes**: (a) renomear todos os tokens nos templates para a forma `{TOKEN}` (já fiz para relatório, vou fazer para planejamento); (b) no worker forçar `matchCase: true` em todos os `replaceAllText`. Tokens livres em CAIXA-ALTA tipo `EDUCADOR`, `TURMAS`, `MATERIAIS`, `ROTEIRO`, etc. serão renomeados nos templates para `{EDUCADOR}`, `{TURMAS}`, `{MATERIAIS}`, `{ROTEIRO}`...

## O que muda no código

### Templates (Drive)
- Renomear placeholders soltos nos modelos para a forma `{TOKEN}` exclusivamente. Atualizo via `documents.batchUpdate` com `replaceAllText` em cada modelo:
  - Relatório: `DATA: 00/00/0000` → `{DATA}`, `BAIRRO; BAIRRO2 ; BAIRRO 3.` → `{BAIRROS}`, `PERÍODO` → `{PERIODO}`, `TURMAS` → `{TURMAS}`, `EDUCADOR` → `{EDUCADOR}`, `NOME ATIVIDADE` → `{NOME_ATIVIDADE}`, `TIPO ATIVIDADE` → `{TIPO_ATIVIDADE}`, `NUM PRESENTES` → `{NUM_PRESENTES}`, `NUM MATRICULADOS` → `{NUM_MATRICULADOS}`, `{ATIVIDADES REALIZADAS}` → `{ATIVIDADES_REALIZADAS}` (sem espaço), `{OBSERVAÇÕES}` → `{OBSERVACOES}`, `PCT_ADESAO` → `{PCT_ADESAO}`, mantém `{ENG_*}`, `{SIT_*}`, `{OBJ_1}` (já corretos), `{INICIATIVA}` etc.
  - Planejamento: `EDUCADOR` → `{EDUCADOR}`, `TURMAS` → `{TURMAS}`, `TITULO` → `{TITULO}`, `TEMA` → `{TEMA}`, `QUESTAO_GERADORA` → `{QUESTAO_GERADORA}`, `OBJETIVOS` → `{OBJETIVOS}`, `FORMA AVALIACAO` → `{FORMA_AVALIACAO}`, `ROTEIRO` → `{ROTEIRO}`, `MATERIAIS` → `{MATERIAIS}`, `APOIO_TECNICO` → `{APOIO_TECNICO}`. Os 3 ☐ dos eixos viram `{EIXO_1}` `{EIXO_2}` `{EIXO_3}`.
- Inserir uma tabela esqueleto vazia logo após o título "ANEXO II - REGISTROS DE PRESENÇA" no relatório (1 linha de cabeçalho), para o engine apenas anexar linhas com `insertTableRow`.
- Atualizar `drive_modelos.ultima_atualizacao_origem` e renomear as cópias com a nova data.

### Worker — substituir o ramo "construir do zero" pelo engine de template
Novo módulo no `drive-sync-worker/index.ts`:

```text
cloneFromTemplate(tipo, destFolderId, title)
  → Drive.files.copy(template_doc_id, parents=[destFolderId], name=title)

replacePlaceholders(docId, map)              // matchCase: true sempre
replaceCheckboxesGroup(docId, base, indexMarcado)   // {OBJ_1} pode aparecer 3x; marca o n-ésimo
insertImageAtPlaceholder(docId, token, driveFileId, widthPt=460)
colorCompetenciaCell(docId, token, nota)     // localiza célula que contém token, aplica updateTableCellStyle
appendPresencaRows(docId, anexoTitle, rows)  // localiza tabela após "ANEXO II", insertTableRow + insertText
fillTipoAtividade(docId)                     // {TIPO_ATIVIDADE} renderiza lista compacta
```

Pseudo do `processRelatorio` novo:
1. `cloneFromTemplate('relatorio', folderEducador, titulo)` se `drive_file_id` é null; senão reusa.
2. Constroi `map` com todos os tokens preenchidos (`{DATA}`, `{EDUCADOR}`, `{TURMAS}`, `{NOME_ATIVIDADE}`, `{TIPO_ATIVIDADE}`, `{PERIODO}`, `{NUM_PRESENTES}`, `{NUM_MATRICULADOS}`, `{ATIVIDADES_REALIZADAS}`, `{OBSERVACOES}`, `{PCT_ADESAO}`, `{INICIATIVA}`..`{SCORE_ELO}` com nota 1-5).
3. Para `{ENG_*}`/`{SIT_*}`: substitui por ■ se selecionado, □ caso contrário. Para `{OBJ_1}`: usa `replaceAllText` sequenciais (controla por índice do texto retornado por `documents.get`).
4. `colorCompetenciaCell` para cada uma das 6 células de competência.
5. Para cada `{foto1..5}`: se há foto correspondente, `insertImageAtPlaceholder`; senão substitui por string vazia.
6. `appendPresencaRows` no ANEXO II com participantes presentes (depois ausentes).

Pseudo do `processPlanejamento` novo: igual mas só `replacePlaceholders` + checkboxes dos 3 eixos.

### Listas (Sheets) — chamada e frequência
- `cloneFromTemplate` da `lista_chamada` ou `lista_frequencia` (1 spreadsheet por turma×mês), mover para pasta `Listas de {Chamada|Frequência}/{YYYY-MM}/`.
- `values.update` no header (`Educador`, `Turma`, `Mês`, `Bairro`, `Período`, `Faixa`, `Oficina`).
- `insertDimension` para criar N linhas de participantes; `values.update` com nomes (sufixo `(D DD/MM)` se desligado).
- `repeatCell` por célula de data: `P` = bg preto/texto branco, `A` = bg branco/texto preto, `D` = bg #D9D9D9. Última linha = "Assinatura do Educador: ____" (sem nada abaixo).

### Demais 9 documentos (PDF → Docs/Sheets nativo)
Para Roteiro de Visita, Atendimento, Orçamento/Mapa, Prestação de Contas, REO, RCA, Relatório Mensal, Cardápio + Movimentação, Transporte: gera o PDF/XLSX com o exporter já existente, faz `Drive.files.upload` com `?convert=true`/ ou `files.copy` com `mimeType: application/vnd.google-apps.document` (PDF→Docs) ou `.spreadsheet` (XLSX→Sheets). **Nenhum builder novo nesta etapa.**

## Tabela final entregue para você comentar

Vou enfileirar 1 exemplo real de cada tipo (escolhendo o registro com mais informação/fotos) e responder com a tabela:

| # | Documento | Critério | Link Docs/Sheets |
|---|---|---|---|
| 1 | Relatório de Atividade | mais fotos + presença + observações longas | … |
| 2 | Planejamento | mais campos preenchidos | … |
| 3 | Lista de Frequência (Web) | turma com mais participantes | … |
| 4 | Lista de Chamada (Física) | mesma turma | … |
| 5 | Roteiro de Visita | mais recente | … |
| 6 | Atendimento Equipe Técnica | mais recente | … |
| 7 | Orçamento / Mapa | 3 fornecedores | … |
| 8 | Prestação de Contas | mês com mais despesas | … |
| 9 | REO | último gerado | … |
| 10 | RCA | último gerado | … |
| 11 | Relatório Mensal | último gerado | … |
| 12 | Cardápio + Movimentação | mês corrente | … |
| 13 | Transporte | dia mais recente | … |

Você comenta dentro do próprio Google e na próxima rodada eu releio via `comments.list` e itero.

## Não está nesta etapa

- Substituir os exportadores PDF/DOCX/XLSX atuais (continuam servindo de fonte para os 9 docs convertidos).
- Sincronização bidirecional (Google → SysCFV).
- Templates Google novos para os 9 documentos secundários (mantém PDF/XLSX → conversão nativa).
