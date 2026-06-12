# Correção: "Sem permissão ou erro ao carregar a auditoria"

## Causa

As três RPCs criadas na Fase 3 (`auditar_datas_invertidas`, `corrigir_data_participante`, `corrigir_cluster_desligamentos`) restringem acesso a:

```sql
IF v_uid IS NULL OR NOT public.has_role(v_uid, 'coordenacao') THEN
  RETURN jsonb_build_object('error', 'forbidden');
END IF;
```

Porém a rota `/coordenacao/auditoria-datas` está protegida por `ModuleRoute module="coordenacao" level="admin"`, que **autoriza super_admins** (via `get_my_module_access` → `is_super_admin`) mesmo quando o usuário não tem a role `coordenacao` em `user_roles`. Resultado: o super_admin entra na página mas a RPC devolve `forbidden`, e a UI mostra "Sem permissão ou erro ao carregar a auditoria."

Confirmações:
- `enum app_role` não possui valor `admin` — só `coordenacao`, `educador`, `tecnico`, `motorista`, `cozinheiro`, `visitante`, `marketing`.
- `public.is_super_admin(uuid)` já existe e é usado em outras RPCs sensíveis.
- A função `auditar_datas_invertidas` é `SECURITY DEFINER` com `EXECUTE` para PUBLIC — o único bloqueio é o `IF` interno.

## Mudança

Nova migration que substitui as três RPCs (mesma assinatura, mesma lógica) trocando o gate por:

```sql
IF v_uid IS NULL OR NOT (
     public.has_role(v_uid, 'coordenacao'::app_role)
     OR public.is_super_admin(v_uid)
) THEN
  RETURN jsonb_build_object('error', 'forbidden');
END IF;
```

Aplicado em:
1. `auditar_datas_invertidas()`
2. `corrigir_data_participante(uuid, text, date, text, text)`
3. `corrigir_cluster_desligamentos(timestamptz, text)`

Os logs em `audit_log` continuam registrando `auth.uid()` do executor (rastro preservado, independentemente da role usada para autorizar).

## Não muda

- Frontend (`AuditoriaDatasPage.tsx`) — fica igual.
- Rota e `ModuleRoute` — já permitem super_admin corretamente.
- Demais RPCs/políticas RLS.
- Dados — apenas redefinição de funções (`CREATE OR REPLACE`).

## Verificação

Após aplicar, recarregar `/coordenacao/auditoria-datas`:
- Super_admin: KPIs carregam, botões Corrigir/Manter funcionam.
- Coordenação: continua funcionando como antes.
- Demais perfis: continuam recebendo `forbidden` (e ModuleRoute nem deixa abrir a rota).
