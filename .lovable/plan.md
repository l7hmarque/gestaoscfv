## Plano: Correções REO, Exportação de Relatórios e Dashboard

### Problemas identificados e correções

---

### 1. REO DOCX e XLSX não baixam / falham silenciosamente

**Problema**: O edge function `generate-reo` parece funcionar (sem logs de erro), mas os arquivos não abrem. Investigando o código, o DOCX é gerado corretamente com `tableWidth = 9360` (linha 828), mas a chamada no `ExportarRelatoriosPage` usa `Promise.all` para DOCX+XLSX simultaneamente — se uma falha silenciosa ocorre no `window.open`, o toast de sucesso aparece mas o download não acontece. Também, o signed URL pode expirar ou o popup blocker impede.

**Correção**: 

- Testar o edge function diretamente para confirmar se retorna URL válida
- Trocar `window.open` por `fetch` + download direto via `saveAs` para evitar popup blocker
- Adicionar melhor tratamento de erros com logs detalhados

### 2. XLSX do REO sem abas de presença preenchida

**Problema**: O formato XLSX do REO (linhas 516-678) não inclui abas de presença por turma. Só tem: Atividades, Equipe Técnica, Metas, RH, Monitoramento, Financeiro. O DOCX tem o Anexo II com listas de presença, mas o XLSX não.

**Correção**: Adicionar abas de presença por turma no XLSX do REO, usando a mesma lógica do DOCX (linhas 746-891): para cada turma ativa, gerar uma aba com a matriz de frequência preenchida (datas nas colunas, participantes nas linhas, ✓ para presente, estilo com quadradinho preto).

### 3. PDF do REO não é gerado

**Problema**: Não existe lógica para gerar PDF do REO. O edge function só suporta "docx" e "xlsx". O PDF deveria ser gerado a partir do DOCX.

**Correção**: No client-side (`ExportarRelatoriosPage`), após baixar o DOCX do REO, não é possível converter DOCX→PDF no browser. A solução é adicionar suporte a PDF no edge function usando `jsPDF` no Deno, ou informar ao usuário para converter manualmente. Alternativa prática: gerar um PDF separado via `jsPDF` + `autoTable` no servidor com o mesmo conteúdo do REO (sem anexo de fotos).

### 4. Exportação individual do relatório gera 2 DOCX + lista grotesca + undefined

**Problema** (em `RelatorioDetalhePage.tsx` linha 555-560):

```js
await Promise.all([
  exportRelatorioDocx(item, turmaNames, presenca, fotos),
  exportRelatorioPdf(item, turmaNames, presenca).catch(() => {}),
]);
```

A função `exportRelatorioPdf` (linha 522-531) tenta usar template DOCX e, quando encontra, gera um DOCX em vez de PDF, resultando em 2 DOCX downloads. A lista de presença no fallback DOCX (linha 467-499) está no formato correto com tabela, mas a versão template (linha 365-370) usa loop PRESENCA com ☑/☐ que é a "lista grotesca".

**Problemas de undefined**: Os campos como `item.profiles?.nome` passam undefined quando o template não tem tag mapping, e o `safeStr` está implementado mas não aplicado em todos os lugares (ex: `item.dia_semana || "—"` na linha 548 do PDF).

**Correções**:

- `exportRelatorioPdf`: Remover a tentativa de usar template DOCX e ir direto para jsPDF com a lista de presença formatada (tabela bonita com ✓/vazio, cores condicionais)
- Aplicar `safeStr` em todos os campos do PDF que usam `|| "—"`
- No fallback DOCX, a lista já está boa (formato REO), manter assim

### 5. Dashboard Relatório Mensal — muitos botões

**Problema**: A página tem 5 cards separados: XLSX local, PDF profissional, XLSX servidor, Relatório Completo, REO. É confuso.

**Correção**: Consolidar em 2-3 cards:

- **Relatório Mensal** (um botão "Exportar" que gera XLSX + PDF simultaneamente)
- **Relatório Completo** (todo o período, servidor)
- **REO** (um botão que gera DOCX + XLSX + PDF)

### 6. Listas de presença preenchidas em todos os REO

**Problema**: As listas de presença no XLSX do REO não existem. No DOCX estão com ✓ mas o user quer "quadradinho preto" (■).

**Correção**: Usar ■ (U+25A0) para presente e em branco para ausentes.

---

### Arquivos alterados


| Arquivo                                               | Mudança                                                                                           |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `supabase/functions/generate-reo/index.ts`            | Adicionar abas de presença por turma no XLSX; usar ■/□; deploy                                    |
| `src/hooks/useDocumentExport.ts`                      | Corrigir `exportRelatorioPdf` para gerar PDF direto (não DOCX); aplicar safeStr em tudo; usar ■/□ |
| `src/pages/relatorios/ExportarRelatoriosPage.tsx`     | Trocar `window.open` por fetch+saveAs; melhor error handling                                      |
| `src/pages/dashboard/DashboardRelatorioMensalTab.tsx` | Consolidar UI: 3 cards com botões unificados                                                      |
| `src/pages/relatorios/RelatorioDetalhePage.tsx`       | Ajustar chamada de export para não duplicar DOCX                                                  |
