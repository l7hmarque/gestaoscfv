## Plano: Corrigir exportação DOCX (preencher template) e PDF (usar mesmo modelo)

### Diagnóstico

**Problema 1 — DOCX não preenche:** O `docxtemplater` está configurado corretamente, mas o Word frequentemente divide tags como `{TITULO}` em múltiplos "runs" XML internos (ex: `{`, `TITULO`, `}`), impedindo o reconhecimento. A lib trata isso parcialmente, mas formatação aplicada dentro da tag quebra o match. Solução: usar o módulo `angular-parser` do docxtemplater ou limpar os runs antes de renderizar.

**Problema 2 — PDF não usa o modelo:** A função `exportPlanejamentoPdf` e `exportRelatorioPdf` ignoram o template completamente — geram o PDF do zero com jsPDF. Para o PDF sair igual ao modelo DOCX, precisamos converter o DOCX preenchido em PDF.

---

### Solução

#### 1. Corrigir preenchimento do DOCX template

**Arquivo:** `src/hooks/useDocumentExport.ts`

- Instalar e usar o módulo `**docxtemplater-utils**` de inspeção OU forçar a limpeza de runs XML antes do render
- Adicionar um `parser` customizado no `Docxtemplater` para aceitar tags com espaços/formatação interna
- Adicionar `try/catch` com log de erros detalhado (quais tags foram encontradas vs esperadas)

```typescript
import expressionParser from "docxtemplater/expressions.js";

const doc = new Docxtemplater(zip, {
  paragraphLoop: true,
  linebreaks: true,
  parser: expressionParser,  // lida com tags quebradas pelo Word
});
```

Se `expressions.js` não estiver disponível, alternativa: usar a opção `delimiters` com regex ou pré-processar o XML para unificar runs fragmentados.

#### 2. PDF a partir do DOCX preenchido (Edge Function)

**Novo arquivo:** `supabase/functions/convert-docx-pdf/index.ts`

- Recebe o DOCX preenchido (blob base64) via POST
- Usa a API do CloudConvert, LibreOffice headless, ou a API do Gotenberg para converter DOCX → PDF
- Retorna o PDF como blob

**Alternativa sem edge function (mais simples):**

- Usar a lib `docx-pdf` ou `libreoffice-convert` no browser não é viável
- Alternativa pragmática: usar a API gratuita do ConvertAPI ou similar direto do frontend

#### 3. Atualizar funções de exportação PDF

**Arquivo:** `src/hooks/useDocumentExport.ts`

- `exportRelatorioPdf`: primeiro preenche o template DOCX, depois envia para a edge function converter em PDF
- `exportPlanejamentoPdf`: mesma lógica
- `exportFichaInscricaoPdf`: mesma lógica
- Se a conversão falhar, mantém o fallback atual com jsPDF

---

### Arquivos modificados


| Arquivo                                        | Mudança                                                           |
| ---------------------------------------------- | ----------------------------------------------------------------- |
| `package.json`                                 | Adicionar `docxtemplater` expressions parser se necessário        |
| `src/hooks/useDocumentExport.ts`               | Fix parser do docxtemplater; PDF via conversão do DOCX preenchido |
| `supabase/functions/convert-docx-pdf/index.ts` | Nova edge function para conversão DOCX → PDF                      |


### Pergunta antes de implementar

Preciso confirmar: os templates DOCX que você subiu usam as tags exatamente como listado (ex: `{TITULO}`, `{EDUCADOR}`)? Ou usam outro formato como `<<TITULO>>` ou `[TITULO]`? Isso é essencial para configurar o parser corretamente.  
RESPOSTA: usam tags com " <<exemplo>>" 