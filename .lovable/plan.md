## Diagnóstico

Confirmei via banco que **os dados existem e estão íntegros**: 260 participantes com nome, 6 atendimentos no mês, 195 documentos na biblioteca, 128 registros de busca ativa, 2.006 presenças. Logo, todos os sintomas de "sumiço" são problemas de **leitura/render no frontend** ou de **exportação**, não perda de dados.

Causa raiz dos problemas reportados:

1. **PDF de presença com "%" e "&"** — As linhas usam `"■"` e `"☐"` (Unicode `U+25A0` / `U+2610`). A fonte padrão `helvetica` do jsPDF é Latin-1: glyphs ausentes saem como caracteres aleatórios (`%`, `&`, `'`). Mesmo bug ocorre em `useBulkRelatorioExport` (PDF do bulk) e em `useDocumentExport.exportMatrizFrequenciaPdf` (lista mensal).

2. **DOCX/PDF de presença "sem nomes"** — A lista anexa só é desenhada se `presenca.length > 0`. Quando o relatório foi salvo sem nenhuma linha em `relatorio_presenca` (caso comum quando o educador apenas informa `num_participantes` no formulário sem marcar a chamada), o anexo aparece vazio mesmo havendo turma vinculada. Precisamos: (a) carregar fallback de `turma_participantes` quando `relatorio_presenca` está vazio; (b) ocultar a seção quando realmente não há participantes; (c) garantir que o nome venha do alias correto em todos os builders (já é `participantes.nome_completo`).

3. **Listas de chamada de Turmas "sem nomes"** — `exportListaPresencaPdf` e o XLSX em `exportListaPresenca.ts` recebem o array `participantes`/`members` da página. Vou auditar a página `TurmaDetalhePage` / `TurmasPage` para confirmar que ela faz o `select` com `participantes(nome_completo)` e não está filtrando por `data_saida` de modo a esvaziar o resultado.

4. **"Atendimentos sumiram" na Equipe Técnica** + **"Biblioteca vazia"** — Banco tem dados (6 atendimentos no mês; 195 docs). Vou auditar `EquipeTecnicaPage` (filtro por mês/educador/profissional pode estar zerado por bug recente) e `BibliotecaPage` (filtro por status/educador pode estar excluindo `pendente`). Possível efeito colateral de uma das edições recentes do hot-swap/coordenação.

5. **Exportação de Atendimentos Técnicos: "nenhum atendimento no período"** — `ExportarRelatoriosPage` usa filtro de período padrão "mês atual". Há 6 atendimentos com `created_at` em abril/2026 mas a query provavelmente filtra por `data_atendimento` (campo correto). Se o frontend monta range `2026-04-01..2026-04-30` mas os dados estão em outro mês, ou se o filtro virou string vazia após o último refactor, retorna vazio. Vou conferir e corrigir.

6. **REO no Dashboard baixa só XLSX mesmo com DOCX marcado** — A aba `Rel.Mensal` do Dashboard chama a edge `generate-reo`, que retorna apenas XLSX. O checkbox de DOCX é ignorado. Vou (a) remover o checkbox DOCX se realmente não há geração DOCX no edge, ou (b) gerar DOCX local equivalente. Decisão: **remover o checkbox** (REO é planilha técnica, DOCX não tem sentido — coerente com a remoção da aba REO em Exportar Relatórios).

7. **REO/Relatório Mensal XLSX "feio e cinza"** — A edge `generate-reo` e `generate-relatorio-mensal` aplicam estilos `fgColor` cinza (`D9D9D9`, `F2F2F2`) e a paleta atual exige preto/branco. Vou alterar essas duas edge functions.

8. **Relatório Mensal XLSX "sem presenças"** — A edge `generate-relatorio-mensal` agrupa presença lendo `relatorio_presenca` + `presenca`. Vou validar o JOIN para garantir que cada participante apareça em todas as turmas a que pertence e que o cabeçalho de datas cubra todos os dias com aula registrada.

---

## Mudanças por arquivo

### A. Glyphs em PDF (corrige "%" e "&")

Substituir `"■"`/`"☐"` por `"P"`/`"A"` (ou `"X"`/`""`) **somente em PDFs**, mantendo `■`/`☐` em DOCX (Word renderiza Segoe UI Symbol corretamente):

- `src/hooks/useDocumentExport.ts`
  - `exportRelatorioPdf` (linha ~695): `p.presente ? "P" : "A"` + atualizar legenda.
  - `exportMatrizFrequenciaPdf` (linha ~1071): trocar `"■"` por `"P"` e `"—"` (D) por `"D"`.
  - `exportListaPresencaPdf`: garantir células vazias.
- `src/hooks/useBulkRelatorioExport.ts` (`generateBulkPdf`): mesma troca.
- `src/hooks/useRelatorioGestao.ts` (`exportRelatorioGestaoPDF`): se houver glyphs Unicode, trocar.

### B. Lista de presença vazia em DOCX/PDF (anexo do Relatório de Atividade)

Em `RelatorioDetalhePage.tsx`, antes de chamar `exportRelatorioDocx/Pdf`:
- Se `presenca.length === 0`, **carregar fallback** de `turma_participantes` (via `relatorio_turmas`) preenchendo todos como ausentes; ou
- **Ocultar a seção** "Lista de Frequência" se ainda assim ficar zero (em vez de gerar tabela só com cabeçalho).

Mesmo tratamento em `useBulkRelatorioExport.ts` (`generateBulkDocx`/`Pdf`) — hoje monta a lista direto do `presenca` que vem do select; quando o relatório não tem `relatorio_presenca`, o builder precisa puxar de `turma_participantes`.

### C. Listas de Turmas (chamada) "sem nomes"

Auditar `TurmasPage.tsx` e `TurmaDetalhePage.tsx`:
- Confirmar que `select` traz `participantes(nome_completo)`.
- Confirmar que `is("data_saida", null)` não está derrubando todos por dado legado (data_saida pode ter sido preenchido em massa por alguma migration de desligamento administrativo). Se for o caso, ajustar para `or(data_saida.is.null, data_saida.gt.${endOfMonth})`.

### D. Equipe Técnica — "atendimentos sumiram"

`EquipeTecnicaPage.tsx`: revisar o estado `mesFiltro/anoFiltro/profissionalFiltro`. Provavelmente o último commit de hot-swap mexeu em `useEffect`/dependências e zerou o filtro. Restaurar default = mês corrente, sem filtro de profissional.

### E. Biblioteca vazia

`BibliotecaPage.tsx` / `BibliotecaAccordion.tsx`: a tabela tem 195 linhas. Se a página filtra por `status = 'gerado'`, a maioria está `pendente` (precisam ser geradas pelo worker, que ainda não roda). Ajustar a UI para listar **todos os status** com badge (Pendente / Gerado / Erro) e botão "Regenerar".

### F. Exportar Atendimentos Técnicos — "nenhum no período"

`ExportarRelatoriosPage.tsx`: corrigir o filtro de data para usar `data_atendimento` (ou `created_at`, conferir) e validar que `dataFrom`/`dataTo` não estão vazios. Adicionar log de diagnóstico. Garantir que o toast de "vazio" só aparece se realmente vazio.

### G. REO no Dashboard — DOCX ignorado

`DashboardRelatorioMensalTab.tsx`:
- Remover checkbox DOCX do REO (REO é XLSX-only).
- Aplicar paleta preto/branco no REO chamando a edge `generate-reo` com flag de estilo, **OU** reescrever a edge para usar paleta P&B.

### H. Edges `generate-reo` e `generate-relatorio-mensal` — paleta + presenças

- `supabase/functions/generate-reo/index.ts` e `generate-relatorio-mensal/index.ts`:
  - Substituir todos `fgColor: "D9D9D9"|"F2F2F2"|"333333"` por `"000000"` (cabeçalhos) com `font.color: "FFFFFF"`; corpo em `"FFFFFF"` puro.
  - Auditar a query de presenças: garantir que retorna `participantes.nome_completo` para cada turma e cada data, sem filtros que excluam participantes ativos.

### I. Memória

Atualizar `mem://estilo/documentos-institucionais-padrao` para refletir a paleta correta por formato (DOCX azul/vermelho SCNSA; PDF/XLSX preto e branco) — já constava na plano anterior, garantir aplicação.

---

## Critério de aceite

1. PDF de presença mostra `P`/`A` (sem `%`, `&`) e legenda atualizada.
2. DOCX e PDF de relatório SEMPRE listam os nomes dos participantes da(s) turma(s) vinculada(s), mesmo quando o educador não marcou chamada.
3. Página de Turmas → "Baixar Lista" mostra todos os participantes da turma.
4. Página Equipe Técnica volta a exibir os 6 atendimentos do mês.
5. Página Biblioteca lista os 195 documentos (com status Pendente/Gerado).
6. Exportar Atendimentos retorna o XLSX preenchido.
7. REO do Dashboard baixa apenas XLSX (sem checkbox DOCX) e em preto/branco.
8. Relatório Mensal XLSX traz nomes e marcações de presença em todas as listas das turmas.
