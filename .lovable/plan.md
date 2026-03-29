## Plano: Corrigir exportação DOCX e PDF

### Implementado

1. **DOCX — delimiters corrigidos**: Alterado de `{ }` para `<< >>` para corresponder aos templates reais
2. **DOCX — limpeza de XML runs**: Adicionada função `cleanXmlRuns()` que unifica tags fragmentadas pelo Word antes do `docxtemplater` processar
3. **PDF — fallback inteligente**: Quando template existe, exporta DOCX preenchido com aviso para converter manualmente em PDF. Quando não há template, usa jsPDF com layout simplificado.
