

## Plano: Corrigir scroll na janela de mapeamento de tags

**Problema:** O `DialogContent` usa `max-h-[85vh]` e `flex flex-col`, e o `ScrollArea` usa `max-h-[55vh]`, mas o scroll do Radix `ScrollArea` pode não funcionar corretamente dentro de um Dialog com essas restrições. O `overflow-hidden` do `ScrollArea.Root` combinado com o layout flex pode impedir o scroll visível.

**Correção em `src/components/TemplateTagMapper.tsx` (linha 270 e 290):**

1. No `DialogContent`, manter `max-h-[85vh] flex flex-col` mas adicionar `overflow-hidden`
2. No `ScrollArea`, trocar `max-h-[55vh]` por `flex-1 min-h-0` — isso permite que o flex container calcule corretamente a altura disponível e o ScrollArea ocupe o espaço restante
3. Adicionar `overflow-y-auto` como fallback no container interno caso o Radix ScrollArea falhe

Mudança concreta:
- Linha 270: `className="max-w-2xl max-h-[85vh] flex flex-col overflow-hidden"`
- Linha 290: `<ScrollArea className="flex-1 min-h-0 pr-2">`

Isso garante que o flex layout dê ao ScrollArea uma altura calculada real (em vez de "auto"), permitindo o scroll interno funcionar.

