## Objetivo

1. Trazer **todo** o DOCX de Relatório de Atividade ao formato do modelo `1BSf2Gz...UJUg` (Google Doc), em todos os pontos do sistema que exportam relatório de atividade.
2. Ler do Sheets `1J1Qr5...arjk` as **edições manuais** que você fez em Abril/2026 (presenças marcadas a mão, desligamentos com "D" tachado, datas em cinza para entradas no meio do mês) e refletir no banco.
3. Regerar o **Relatório Mensal de Abril/2026** já com tudo isso aplicado e com as células cinza para vínculos fora da janela do mês.

---

## Parte 1 — DOCX do Relatório de Atividade (alinhar ao modelo)

### Diferenças entre o gerado hoje e o modelo

| Bloco | Hoje | Modelo (alvo) |
|---|---|---|
| Cabeçalho institucional | 3 linhas + faixa vermelha "RELATÓRIO DE ATIVIDADE" | Igual, manter |
| Tabela "Dados da Atividade" | 6 linhas (Data, Dia, Educador, Turmas, Tipo, Nome) — OK | Mesma estrutura |
| Engajamento | Render só se houver opção marcada | **Sempre renderizar** as 4 opções com ■/☐ inline na mesma linha |
| Competências | Tabela 5x3 + linha "Score ELO: X.XX" à direita | Igual, **sem coluna colorida**, célula central só com nº (3) e label ("Moderado") |
| Resumo | Tabela 1x3 "Presentes / Ausentes / % Adesão" | Igual |
| Objetivo | Render como bloco com label | "Objetivo: Alcançado" inline |
| Atividades Realizadas | Texto puro | Texto puro (mantém) |
| Observações | "não há" se vazio | **Renderizar sempre**, com "não há" se vazio |
| Situações Relevantes | Render bloco se houver | **Remover** do DOCX (não está no modelo) |
| Score ELO destacado | Linha à direita em vermelho | Linha à direita, **preto bold** (sem cor de marca) |
| Anexo I — Lista de Frequência | Página nova, título "LISTA DE FREQUÊNCIA" + meta-linha | **Faixa "ANEXO I - LISTA DE FREQUÊNCIA"** (tabela 1x1 cinza claro) seguida de meta-linha "Atividade: ... | Data: ... | Turma(s): ...", "Educador(a): ...", e tabela Nº/Nome/Presença |
| Linha "Educador" | Está no corpo | Manter no anexo + assinatura ao final |
| Anexo II — Fotos | Bloco de fotos sem faixa | **Faixa "ANEXO II - REGISTROS FOTOGRÁFICOS"** (tabela 1x1) antes das fotos |

### Onde aplicar

A função `buildRelatorioDocxBlob` em `src/hooks/useDocumentExport.ts` já é a única superfície usada por:
- Botão "Exportar DOCX" em `RelatorioDetalhePage`
- Hub de exportação em massa (`useBulkRelatorioExport`)
- Biblioteca de Documentos (`bibliotecaDocx.ts` → `gerarDocxRelatorioBlob`)
- Exportação por lote em `RelatoriosPage`

Logo, **todas as origens** ganham o novo formato com uma única edição.

> Observação: o template `relatorio.docx` carregado por `loadTemplate()` será desabilitado para esse fluxo — o caminho "from scratch" passa a ser o oficial, garantindo paridade exata com o modelo. Mantenho o template como fallback inerte para não quebrar a Biblioteca de Tags.

---

## Parte 2 — Extração das edições manuais do Sheets de Abril

A planilha tem 21 abas (3 institucionais + 18 turmas). Vou rodar um script único (executado fora do build, no sandbox) que para cada aba de turma:

1. Lê a matriz de presença (linhas = participantes, colunas = datas) via Sheets API.
2. Detecta **células marcadas manualmente como "■"** que não existem na tabela `presenca` do banco e prepara `INSERT` (presente=true, com flag `origem='auditoria_abril_manual'` em coluna `observacao` ou similar para rastreabilidade).
3. Detecta **linhas com strikethrough no nome** (formatação `textFormatRuns[].format.strikethrough=true`) — gera lista CSV "Participantes a desligar manualmente" para sua revisão (não mexe em cadastros agora).
4. Para o **regerar do relatório**: aplica esses desligamentos como `data_saida` retroativa (último dia em que aparecem no Sheets) **somente em memória dentro da edge function**, via uma tabela auxiliar `auditoria_abril_desligamentos` que a função consulta ao montar matrizes — assim você revisa caso a caso depois sem perder o vínculo real.

**Entregáveis desta parte (em /mnt/documents/):**
- `auditoria_abril_presencas_inseridas.csv` — log do que foi inserido em `presenca`.
- `auditoria_abril_desligamentos_pendentes.csv` — nomes/datas com "D" tachado, para sua revisão.
- Migration criando `auditoria_abril_desligamentos` (id, participante_id, data_saida_efetiva, motivo, revisado_em).

> Não vou desligar de fato no `participantes`/`turma_participantes` até você revisar o CSV.

---

## Parte 3 — Células cinza para datas anteriores ao `data_entrada`

Já implementado parcialmente no último loop. **Faltava**:

- Aplicar a regra também para participantes com `data_saida` no meio do mês → cinza após a saída.
- Para os "desligados manualmente" da Parte 2, ler `auditoria_abril_desligamentos.data_saida_efetiva` e pintar cinza a partir desse ponto.
- Verificar consistência entre as 3 superfícies de matriz: `generate-relatorio-mensal/index.ts`, `ExportarRelatoriosPage.tsx` e `generate-reo/index.ts`.

---

## Parte 4 — Regerar Relatório Mensal Abril/2026

1. Aplicar Parte 2 (inserts de presença) no banco.
2. Aplicar Parte 3 (cinza fora-da-janela em todas as matrizes).
3. Disparar `generate-relatorio-mensal` para Abril/2026 a partir da UI atual (`/relatorios/exportar`).
4. Comparar XLSX gerado contra o Sheets anotado e listar discrepâncias residuais na aba **Auditoria — Pendências**.

---

## Detalhes técnicos

**Arquivos editados**
- `src/hooks/useDocumentExport.ts` — reescrever `buildRelatorioDocxBlob` para casar com o modelo (remover Situações, sempre renderizar Engajamento e Observações, faixas "ANEXO I/II", trocar cor do Score ELO para preto, ajustar tabela de competências sem coluna colorida).
- `supabase/functions/generate-relatorio-mensal/index.ts` — consumir `auditoria_abril_desligamentos` ao montar matrizes; pintar cinza pós-`data_saida` além do pré-`data_entrada`.
- `src/pages/relatorios/ExportarRelatoriosPage.tsx` e `supabase/functions/generate-reo/index.ts` — paridade de regra cinza.

**Migrations**
- `auditoria_abril_desligamentos` (sem RLS aberta — só coordenação lê/escreve).

**Scripts one-off (sandbox, não vão para o repo)**
- `extract_april_manual_edits.py` — Sheets API → CSVs + INSERTs em `presenca`.

**Validação**
- Re-exportar Abril/2026 e validar contra os 78 comentários originais.
- Exportar 1 relatório de atividade qualquer e abrir em Word para comparar com o modelo (faixas Anexo I/II presentes; Engajamento sempre visível; sem bloco Situações; Score ELO em preto).

---

## Fora de escopo (confirmar se quer adicionar)

- Replicar o mesmo modelo para o **PDF** do relatório de atividade (`exportRelatorioPdf`) — hoje ele tem layout próprio. Posso alinhar também, mas dobra o trabalho.
- Migrar a Biblioteca de Documentos para gerar via Google Docs API em vez de DOCX local — você mencionou "agora em google docs" no doc; se for isso, vira projeto à parte (precisa OAuth por usuário, não cabe aqui).