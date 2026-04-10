

## Plano: Corrigir Exportações REO, PDFs com Paleta B&W e Listas de Presença

### Problemas Identificados

1. **REO DOCX retorna 500**: A variável `tableWidth` é definida na linha 932 dentro de um loop `for` (escopo local), mas usada nas linhas 1050 e 1061 fora desse escopo → `tableWidth is not defined`. O XLSX funciona porque usa caminho de código separado.

2. **Relatório Mensal PDF sem listas de presença**: O PDF gerado em `DashboardRelatorioMensalTab.tsx` e `ExportarRelatoriosPage.tsx` contém apenas resumos estatísticos, não anexa as matrizes de frequência preenchidas por turma.

3. **Relatório individual de atividade (PDF/DOCX)**: A lista de presença existe mas não identifica claramente a qual atividade pertence — precisa de cabeçalho com nome da atividade, data, turma e educador.

4. **Paleta de cores dos PDFs**: Atualmente usa vermelho (#C62828), azul (#1565C0), verde (#E8F5E9) e rosa (#FFEBEE). O usuário quer **branco, preto e cinza** para máxima legibilidade.

---

### Correções

#### 1. REO DOCX — Fix scoping de `tableWidth`
**Arquivo**: `supabase/functions/generate-reo/index.ts`
- Mover `const tableWidth = 9360` para fora do loop (antes da linha 862, no escopo do handler principal)
- Isso resolve o erro 500

#### 2. Relatório Mensal PDF — Anexar listas de presença
**Arquivo**: `src/pages/dashboard/DashboardRelatorioMensalTab.tsx` (função `generatePdf`)
- Após as seções de resumo, adicionar ANEXO com matrizes de frequência por turma
- Para cada turma ativa: cabeçalho (turma, educador, bairro, período), tabela com participantes × datas do mês, marcando presença com "■"
- Page break entre turmas

**Arquivo**: `src/pages/relatorios/ExportarRelatoriosPage.tsx` (função `exportarRelatorioMensal`)
- Mesma lógica: adicionar anexo de frequência ao XLSX/PDF existente

#### 3. Identificação da lista de presença nos relatórios individuais
**Arquivo**: `src/hooks/useDocumentExport.ts` (funções `exportRelatorioPdf` e `exportRelatorioDocx`)
- Já tem cabeçalho com atividade/data/turma na lista de presença — apenas reforçar com uma linha de destaque ("Referente à atividade: X — Data: Y — Turma(s): Z — Educador(a): W")

**Arquivo**: `src/hooks/useBulkRelatorioExport.ts` (funções `generateBulkPdf` e `generateBulkDocx`)
- Adicionar linha de educador no cabeçalho da lista de presença

#### 4. Paleta de cores — Branco, Preto e Cinza
Alteração em **todos** os PDFs gerados:

**Arquivos afetados**:
- `src/hooks/useDocumentExport.ts` — `exportRelatorioPdf`, `exportPlanejamentoPdf`, etc.
- `src/hooks/useBulkRelatorioExport.ts` — `generateBulkPdf`
- `src/pages/dashboard/DashboardRelatorioMensalTab.tsx` — `generatePdf`
- `src/pages/relatorios/ExportarRelatoriosPage.tsx` — todas as funções de PDF

**Substituições de cores nos PDFs**:
- Cabeçalho de tabela: `[26, 82, 118]` (azul) → `[50, 50, 50]` (cinza escuro) com texto branco
- Linhas alternadas: `[227, 242, 253]` (azul claro) → `[245, 245, 245]` (cinza claro)
- Títulos de seção: `[198, 40, 40]` (vermelho) → `[0, 0, 0]` (preto)
- Barras decorativas: vermelho/azul → `[60, 60, 60]` / `[120, 120, 120]` (cinzas)
- Score ELO: vermelho → preto bold
- Presença "Presente"/"Ausente": verde/rosa → cinza claro / branco (com texto preto normal)
- Competências: colormap Likert → escala de cinza (1=muito claro a 5=escuro)
- Cards de resumo: azul/vermelho claro → cinza claro uniforme

---

### Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `supabase/functions/generate-reo/index.ts` | Fix `tableWidth` scoping |
| `src/pages/dashboard/DashboardRelatorioMensalTab.tsx` | Anexar listas de presença ao PDF; paleta B&W |
| `src/pages/relatorios/ExportarRelatoriosPage.tsx` | Paleta B&W no PDF de relatório mensal |
| `src/hooks/useDocumentExport.ts` | Paleta B&W; reforçar identificação na lista de presença |
| `src/hooks/useBulkRelatorioExport.ts` | Paleta B&W; educador no cabeçalho da presença |

