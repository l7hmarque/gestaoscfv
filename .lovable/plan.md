

## Plano: Corrigir erro "Maximum call stack size exceeded" no upload de documentos

### Causa raiz

Linha 363 de `FinanceiroPage.tsx`:
```typescript
const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
```

O operador spread (`...`) passa cada byte do arquivo como argumento individual para `String.fromCharCode`. Um PDF de 1MB = 1 milhão de argumentos → estouro de pilha.

### Correção

Substituir por conversão em chunks:

```typescript
const bytes = new Uint8Array(buffer);
let binary = "";
const chunkSize = 8192;
for (let j = 0; j < bytes.length; j += chunkSize) {
  binary += String.fromCharCode(...bytes.subarray(j, j + chunkSize));
}
const base64 = btoa(binary);
```

### Alteração

**1 arquivo**: `src/pages/financeiro/FinanceiroPage.tsx`, linhas 362-363 — substituir a conversão base64.

