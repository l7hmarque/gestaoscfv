

## Plano: Corrigir DOCX/PDF export e remover preambulo IA do Instagram

### Problema 1 — DOCX template nao preenche / nao baixa

A funcao `cleanXmlRuns` tenta unificar runs fragmentados com regex, mas o padrao e fragil e pode falhar silenciosamente ou corromper o XML. O `docxtemplater` tem um modulo nativo para isso: **`InspectModule`** nao, mas a solucao mais robusta e usar o parser da propria lib para lidar com tags quebradas.

A abordagem correta: em vez de tentar remontar o XML manualmente, configurar o `docxtemplater` com a opcao `parser` que use `angular-expressions` ou, mais simples, usar a funcionalidade built-in do `docxtemplater` que ja lida com runs fragmentados quando os delimiters sao configurados corretamente.

O problema real pode ser que o `docxtemplater` com delimiters `<<` e `>>` interpreta os `<` e `>` como XML. A solucao e:

1. **Trocar delimiters para `{` e `}`** no template E no codigo — OU
2. **Pre-processar o XML** para substituir `&lt;&lt;TAG&gt;&gt;` por `{TAG}` antes do render, e usar delimiters `{ }` padrao

**Solucao escolhida**: Pre-processar o XML para converter `&lt;&lt;...&gt;&gt;` em `{...}` (que e seguro em XML) e usar os delimiters padrao `{ }` do docxtemplater. Isso elimina toda a complexidade de lidar com `<<>>` dentro de XML.

**Arquivo**: `src/hooks/useDocumentExport.ts`

```typescript
function cleanXmlRuns(zip: PizZip): void {
  const xmlFiles = Object.keys(zip.files).filter(f => f.endsWith(".xml"));
  for (const fileName of xmlFiles) {
    let content = zip.file(fileName)?.asText();
    if (!content) continue;

    // Step 1: Merge adjacent runs that split a tag
    // Remove run boundaries between opening and closing delimiters
    for (let pass = 0; pass < 15; pass++) {
      const before = content;
      content = content.replace(
        /(&lt;&lt;[^&]*?)(<\/w:t><\/w:r><w:r[^>]*>(?:<w:rPr>[^<]*(?:<[^/][^<]*)*<\/w:rPr>)?<w:t[^>]*>)([^&]*?&gt;&gt;)/g,
        (_, a, _b, c) => a + c
      );
      if (content === before) break;
    }

    // Step 2: Convert <<TAG>> to {TAG} so docxtemplater default delimiters work
    content = content.replace(/&lt;&lt;(\w+)&gt;&gt;/g, '{$1}');
    
    zip.file(fileName, content);
  }
}
```

E remover a config de `delimiters` do Docxtemplater (voltar ao padrao `{ }`).

Tambem adicionar `try/catch` robusto com fallback em TODAS as funcoes de export.

### Problema 2 — PDF nao baixa

O PDF de relatorio tenta usar template primeiro (exporta DOCX em vez de PDF). Se o template falha, o fallback jsPDF deveria funcionar, mas se o `cleanXmlRuns` corromper o XML, pode dar erro antes.

A correcao do problema 1 resolve isso tambem. O fallback jsPDF ja existe e funciona.

### Problema 3 — Instagram post com preambulo de IA

A edge function `generate-instagram-post` precisa de instrucao mais forte no prompt para evitar a intro padrao da IA.

**Arquivo**: `supabase/functions/generate-instagram-post/index.ts`

Adicionar ao prompt:
```
- NÃO inicie com frases introdutórias como "Aqui está", "Segue o texto", "Com base no relatório" etc.
- Comece DIRETAMENTE com "CAIA MEDIANEIRA 🌍" sem nenhuma frase antes
- Retorne APENAS o texto da publicação, sem explicações ou comentários
```

E no system message reforcar:
```
Retorne SOMENTE o texto da publicação. Nunca adicione frases introdutórias, explicações ou comentários antes ou depois do texto.
```

### Arquivos modificados

| Arquivo | Mudanca |
|---|---|
| `src/hooks/useDocumentExport.ts` | Reescrever `cleanXmlRuns` para converter `<<TAG>>` em `{TAG}`; remover `delimiters` customizado; blindar todos exports com try/catch |
| `supabase/functions/generate-instagram-post/index.ts` | Adicionar instrucoes anti-preambulo no prompt e system message |

### Nota sobre o build error 503

O erro `failed to acquire sandbox config: scheduler http error: status code 503` e um erro transitorio de infraestrutura, nao relacionado ao codigo. Resolve sozinho ao recarregar.

