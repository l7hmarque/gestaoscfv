# Corrigir loading infinito em /coordenacao

## Causa raiz (confirmada)

A RPC `get_coordenacao_stats` no banco tem a assinatura:

```
get_coordenacao_stats(_user_id uuid, _periodo_dias integer)
```

Mas o hook `src/hooks/useCoordenacaoData.ts` está chamando passando **apenas** `_periodo_dias`:

```ts
supabase.rpc("get_coordenacao_stats", { _periodo_dias: periodoDias })
```

Resultado: o Postgres responde `function ... does not exist` (sem match de assinatura). O `useQuery` entra em erro, `data` fica `undefined`, e a página tem a guarda `isLoading || !data` que renderiza o `Loader2` para sempre — sem nenhum feedback de erro.

Nenhuma aba abre porque todo o conteúdo das `TabsContent` está dentro desse mesmo guard.

## Correções

### 1. `src/hooks/useCoordenacaoData.ts`
- Passar `_user_id: user.id` na chamada da RPC.
- Manter `enabled: !!user?.id` para evitar disparo antes da auth pronta.
- Incluir `user.id` na `queryKey`.

### 2. `src/pages/coordenacao/CoordenacaoPage.tsx`
- Capturar `error` do `useCoordenacaoData` e renderizar uma `Card` de erro com botão "Tentar novamente" (`refetch`) em vez do spinner eterno quando `error` existir.
- Manter o spinner apenas durante `isLoading` real.

### 3. Validação
- Após a correção, abrir `/coordenacao` e confirmar que as abas Painel / Ações / Decisões / Qualidade / Registros / Família / Permissões / Desligamento / Relatório renderizam.
- Conferir logs do navegador — não deve haver erro 404/400 da RPC.

## Fora de escopo

- Não mexer em `RegistrosTab`, `PermissoesTab`, `AcessosFamiliaTab`, `PainelCoordenadorTab` — eles só dependem do `data` chegar.
- Não alterar a função SQL (assinatura permanece como está; a correção é só no client).
