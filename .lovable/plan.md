

## Plano: Exportação em lote + melhorias nos documentos exportados

### 3 mudanças principais

---

### 1. Exportação em lote na página de Relatórios (`RelatoriosPage.tsx`)

Adicionar nova aba "Exportar" ou dialog com:
- **Seletor de intervalo de datas** (de/até)
- **Filtro de educador** (combobox com opção "Todos")
- **Botão único "Exportar Todos"** que gera simultaneamente:
  - **DOCX**: Um documento com todos os relatórios do período + listas de presença preenchidas (tabela, formato REO)
  - **PDF**: Mesmo conteúdo em PDF via jsPDF
  - **XLSX**: Planilha com aba de resumo + abas de lista de presença preenchida por turma

O botão busca os relatórios filtrados, carrega presença/fotos/turmas de cada um, e chama as funções de exportação em paralelo (Promise.all). Progresso exibido com toast.

**Dados necessários**: `relatorios_atividade` + `relatorio_presenca` + `relatorio_turmas` + `relatorio_fotos` + `profiles` (educadores) — tudo via queries Supabase client-side.

---

### 2. Melhorar exportação individual do relatório (`useDocumentExport.ts`)

Na função `exportRelatorioDocx` e `exportRelatorioPdf`, substituir a lista de presença atual (Nº / Nome / ☑/☐ / Justificativa) por uma **tabela no formato do REO**: cabeçalho institucional, nome da turma, colunas de data com ✓ para presente. Uma tabela por turma vinculada ao relatório.

Isso requer buscar os dados de `presenca` (tabela principal) para a data do relatório e turmas vinculadas, além do `relatorio_presenca` já existente.

---

### 3. Eliminar "Undefined" em todos os documentos exportados

Revisar `useDocumentExport.ts`:
- Na função `infoRow`: já usa `value || "—"`, mas o problema pode vir de valores que são literalmente a string `"undefined"` passados como parâmetro
- Na função `buildRelatorioTemplateData`: campos como `item.profiles?.nome` podem ser `undefined` e passados diretamente
- Adicionar sanitização: criar helper `safe(v)` que retorna `""` se o valor for `undefined`, `null`, ou a string `"undefined"`/`"Undefined"`
- Aplicar em `exportRelatorioDocx`, `exportRelatorioPdf`, `exportPlanejamentoDocx`, `exportPlanejamentoPdf`, e nos templates de dados

---

### Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `src/pages/relatorios/RelatoriosPage.tsx` | Adicionar dialog/aba de exportação em lote com filtro de datas e educador |
| `src/hooks/useDocumentExport.ts` | (1) Substituir lista de presença por tabela formato REO; (2) Adicionar funções de exportação em lote; (3) Sanitizar undefined→branco |

### Detalhes técnicos

- Helper `safeStr(v)`: `return (v == null || v === "undefined" || v === "Undefined") ? "" : String(v)`
- Exportação em lote XLSX: usa `xlsx-js-style` com múltiplas abas (Resumo + 1 aba por turma com presença preenchida)
- Exportação em lote DOCX: concatena seções com PageBreak entre relatórios, cada um com sua tabela de presença
- Exportação em lote PDF: jsPDF com addPage entre relatórios
- Filtro de educador: query `profiles` com roles educador/coordenacao, Select com opção "Todos"

