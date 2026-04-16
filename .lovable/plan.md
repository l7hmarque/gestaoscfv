

## Problema identificado

O dashboard esta travado porque a chamada RPC `get_dashboard_stats` retorna erro HTTP 300 (PGRST203):

> "Could not choose the best candidate function between: public.get_dashboard_stats(), public.get_dashboard_stats(_mes => integer, _ano => integer)"

Existem **duas versoes** da funcao no banco: uma sem parametros (antiga) e uma com parametros opcionais (nova). O PostgREST nao consegue escolher quando o cliente envia `{}` sem parametros.

## Correcao

1. **Migracacao SQL**: Dropar a funcao antiga sem parametros (`get_dashboard_stats()`) e manter apenas a versao com parametros DEFAULT NULL.

```sql
DROP FUNCTION IF EXISTS public.get_dashboard_stats();
-- A versao get_dashboard_stats(_mes int, _ano int) com defaults ja existe e sera usada
```

2. **Hook `useDashboardData.ts`**: Garantir que sempre envia os parametros (mesmo que null) para que o PostgREST resolva sem ambiguidade.

### Arquivos editados

| Arquivo | Mudanca |
|---|---|
| Nova migracao SQL | `DROP FUNCTION public.get_dashboard_stats()` (sem params) |
| `src/hooks/useDashboardData.ts` | Sempre passar `_mes` e `_ano` na chamada RPC |

