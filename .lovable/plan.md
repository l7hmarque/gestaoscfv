## Plano: Corrigir download da Lista de Presença

### Problema identificado

O PDF não é gerado porque o mapeamento de dias da semana está errado. O banco de dados armazena valores abreviados (`"seg"`, `"ter"`, `"qua"`, `"qui"`, `"sex"`, `"sab"`) mas o código em `useDocumentExport.ts` espera valores por extenso (`"segunda"`, `"terca"`, `"quarta"`...). Resultado: nenhuma data é calculada, a função retorna silenciosamente sem gerar nada.

### Correção

**Arquivo:** `src/hooks/useDocumentExport.ts` (linha 664)

Alterar o `DIAS_MAP` para usar as abreviações corretas do banco:

```typescript
// DE:
const DIAS_MAP: Record<string, number> = {
  segunda: 1, terca: 2, quarta: 3, quinta: 4, sexta: 5, sabado: 6, domingo: 0,
};

// PARA:
const DIAS_MAP: Record<string, number> = {
  seg: 1, ter: 2, qua: 3, qui: 4, sex: 5, sab: 6, dom: 0,
  segunda: 1, terca: 2, quarta: 3, quinta: 4, sexta: 5, sabado: 6, domingo: 0,
};
```

Inclui ambas as formas para robustez e precisao dos dados.  
Opcao de unificar em um unico PDF.  
Deslocar essa funcionalidade pro endereco das Turmas em aba separada.  
Nenhuma outra alteração necessária.