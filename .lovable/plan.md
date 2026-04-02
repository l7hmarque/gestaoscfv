

## Plano: Corrigir perda de foco nos campos de texto

### Problema

O componente `Field` está definido **dentro** do corpo do `MatriculaPublicaPage` (linha 313). Cada digitação atualiza o state `form`, o componente re-renderiza, e o React cria uma **nova definição** de `Field` — tratando-o como um componente diferente. Isso faz o React desmontar e remontar o input, perdendo o foco após cada tecla.

### Solução

Mover o componente `Field` para **fora** de `MatriculaPublicaPage`, recebendo `form` e `set` como props. Assim a referência do componente permanece estável entre renders e o input mantém o foco.

### Mudança

**`src/pages/matricula/MatriculaPublicaPage.tsx`**

1. Extrair `Field` para fora do componente principal, antes da definição de `MatriculaPublicaPage`
2. Adicionar props `value` e `onChange` (em vez de acessar `form` e `set` por closure)
3. Atualizar todos os usos de `<Field>` para passar `value={form[field]}` e `onChange={(val) => set(field, val)}`

