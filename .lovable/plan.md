

## Plano: Corrigir Erros de Exportação DOCX/PDF

### Problemas identificados

1. **App crash ("encountered an error")**: `Promise.all` na exportação em lote (`useBulkRelatorioExport.ts` L138-142) — se DOCX ou PDF falha, o erro propaga e crashea o app inteiro. O XLSX baixa porque termina antes do crash.

2. **PDF com "& Presente" / "& Ausente"**: Os caracteres Unicode `☑` e `☐` (L625 de `useDocumentExport.ts`) não são suportados pela fonte `helvetica` do jsPDF. O autoTable tenta renderizar e produz artefatos com `&` (HTML entities).

3. **DOCX com lista feia**: Quando existe template `relatorio.docx` no storage (L378-392), o sistema usa Docxtemplater com a variável `PRESENCA` (L365-370) que gera uma lista simples com `☑/☐`. O fallback (L467-499) tem a tabela bonita com cabeçalho colorido, cores condicionais e assinatura — mas nunca é usado quando o template existe.

### Correções

| Arquivo | Correção |
|---|---|
| `src/hooks/useDocumentExport.ts` | (1) `exportRelatorioPdf`: trocar `☑ Presente`/`☐ Ausente` por `Presente`/`Ausente` como texto simples, mantendo cores de fundo condicionais. (2) `exportRelatorioDocx`: forçar fallback para presença mesmo quando template existe — usar template só para o corpo do relatório, não para a lista de presença. (3) Envolver cada export em try/catch individual. |
| `src/hooks/useBulkRelatorioExport.ts` | (1) Trocar `Promise.all` por `Promise.allSettled` para que falha de um formato não impeça os outros. (2) Reportar erros individuais via toast. |
| `src/pages/relatorios/RelatorioDetalhePage.tsx` | Envolver cada botão de export em try/catch individual (já separados, só adicionar catch com toast.error). |

### Detalhes técnicos

**PDF — presença sem Unicode:**
```typescript
// Antes (quebra):
body: presenca.map((p, i) => [i + 1, nome, p.presente ? "☑ Presente" : "☐ Ausente", ...])

// Depois (funciona):
body: presenca.map((p, i) => [i + 1, nome, p.presente ? "Presente" : "Ausente", ...])
// Cor de fundo e texto já aplicados via didParseCell
```

**DOCX — sempre usar tabela bonita para presença:**
Na `exportRelatorioDocx`, após gerar o corpo do relatório via template, sempre gerar a lista de presença via código (fallback), nunca via loop `{#PRESENCA}` do template.

**Bulk — Promise.allSettled:**
```typescript
const results = await Promise.allSettled([
  generateBulkDocx(...),
  generateBulkPdf(...),
  generateBulkXlsx(...),
]);
const failed = results.filter(r => r.status === "rejected");
if (failed.length) toast.error(`${failed.length} formato(s) falharam`);
```

