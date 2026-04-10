

## Plano: Auditoria de Relatórios + Correção do Bug "%"

### Problemas Identificados

#### 1. Bug "%" nas listas de presença PDF
**Causa raiz**: O caractere `☐` (U+2610) é usado em `exportListaPresencaPdf` (linha 1070 de `useDocumentExport.ts`) como conteúdo de célula no jsPDF/autoTable. A fonte Helvetica embutida no jsPDF não suporta esse glyph Unicode, e o renderiza como `%`.

**Correção**: Substituir `"☐"` por `"[ ]"` (texto ASCII simples) em todas as ocorrências dentro de PDFs gerados via jsPDF. O DOCX e XLSX usam fontes que suportam Unicode, então não precisam de alteração.

**Arquivos afetados**:
- `src/hooks/useDocumentExport.ts` — linha 1070: `"☐"` → `"[ ]"`

#### 2. REO DOCX retorna 500: `tableWidth is not defined`
**Causa raiz**: `const tableWidth = 9360` está na linha 862 dentro do bloco `if (turmasAtivas.length > 0)` (linhas 855-996). As referências nas linhas 1051 e 1062 estão **fora** desse bloco `if`.

**Correção**: Mover `const tableWidth = 9360` para antes do `if` (por exemplo, na linha 854).

**Arquivo**: `supabase/functions/generate-reo/index.ts`

#### 3. Paleta de cores pendente na `exportListaPresencaPdf`
A última atualização de paleta B&W não foi aplicada à função `exportListaPresencaPdf` (linha 1072): `headStyles: { fillColor: [26, 82, 118] }` — ainda usa azul escuro.

**Correção**: Trocar para `[50, 50, 50]` (cinza escuro).

#### 4. Auditoria de dados
Baseado na consulta ao banco:
- 2 relatórios de atividade (abril/2026)
- 0 registros na tabela `presenca` (toda presença vem via `relatorio_presenca`: 63 registros)
- 21 turmas ativas

Os dados parecem consistentes — presença registrada exclusivamente via relatórios, conforme esperado pelo fluxo do sistema.

### Arquivos a alterar

| Arquivo | Mudança |
|---|---|
| `supabase/functions/generate-reo/index.ts` | Mover `tableWidth` para fora do `if` |
| `src/hooks/useDocumentExport.ts` | `☐` → `[ ]` no PDF; paleta cinza na lista de presença |

### Geração e inspeção dos relatórios
Após as correções, testarei o REO DOCX via edge function e inspecionarei o resultado.

