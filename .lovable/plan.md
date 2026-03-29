
## Plano: fazer os downloads voltarem a funcionar

### Diagnóstico
O problema principal está no motor de template em `src/hooks/useDocumentExport.ts`.

Hoje a função `cleanXmlRuns()` troca `&lt;&lt;` / `&gt;&gt;` por `<<` / `>>` direto no XML do `.docx`. Isso deixa o XML inválido e bate exatamente com o erro que apareceu no console:

```text
TemplateError: An XML file has invalid xml
```

Com isso:
- `exportPlanejamentoDocx()` e `exportRelatorioDocx()` quebram antes do `saveAs()`
- o usuário clica em exportar e não baixa nada
- no PDF o fallback até existe, mas o fluxo fica inconsistente e sem feedback claro

### O que vou ajustar
1. **Corrigir o pré-processamento do DOCX**
   - reescrever/remover a parte de `cleanXmlRuns()` que corrompe o XML
   - manter os delimitadores de forma segura no XML (`&lt;&lt;TAG&gt;&gt;`), sem transformar em `<` bruto

2. **Blindar a exportação DOCX**
   - colocar `try/catch` em `exportPlanejamentoDocx()` e `exportRelatorioDocx()`
   - se o template falhar, gerar automaticamente o DOCX fallback já existente
   - mostrar toast explicando o que aconteceu

3. **Deixar o PDF previsível**
   - manter o fluxo: tenta template primeiro
   - se falhar, cai no PDF simplificado com aviso claro
   - evitar falha silenciosa no clique de exportação

4. **Melhorar feedback de erro**
   - toast tipo: “Modelo institucional inválido. Exportando versão padrão.”
   - log mais claro para saber se o problema foi template, preenchimento ou download

5. **Alinhar a interface admin**
   - atualizar os textos do `DashboardAdminTab` para mostrar `<<TAG>>` em vez de `{TAG}`
   - isso evita subir modelos com o padrão errado

### Arquivos envolvidos
- `src/hooks/useDocumentExport.ts`
- `src/pages/planejamentos/PlanejamentoDetalhePage.tsx`
- `src/pages/relatorios/RelatorioDetalhePage.tsx`
- `src/pages/dashboard/DashboardAdminTab.tsx`

### Resultado esperado
Depois disso:
- clicar em **DOCX** sempre baixa algum arquivo
- clicar em **PDF** sempre baixa algum PDF ou, no pior caso, mostra aviso claro e gera a versão fallback
- o modelo institucional volta a ser preenchido quando o template estiver válido
- o sistema para de “não fazer nada” ao exportar

### Detalhe técnico importante
A causa não parece ser permissão nem botão quebrado. O erro está no XML do template sendo invalidado pelo próprio código antes do `Docxtemplater` renderizar. O conserto principal é no processamento do `.docx`, não na tela.
