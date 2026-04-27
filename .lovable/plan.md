# Correções: Coordenação fora do Lovable e Delta de participantes

## Problema 1 — "Failed to fetch dynamically imported module" para CoordenacaoPage

**Diagnóstico**: O arquivo `src/pages/coordenacao/CoordenacaoPage.tsx` existe, compila sem erros (`vite build` gera o chunk normalmente: `CoordenacaoPage-8-8bCsJN.js`), e a rota está registrada em `App.tsx`. O erro acontece quando o navegador tem cache de uma versão anterior do `index.html` apontando para um chunk que não existe mais (hash mudou após os deploys recentes de edge functions e correções).

**Solução**: Não há bug de código a corrigir. O preview do Lovable resolve com hard-refresh (Ctrl+Shift+R). O ambiente publicado (`gestaoscfv.lovable.app`) precisa de **Publish/Update** para receber as mudanças de frontend mais recentes — alterações de frontend não são aplicadas automaticamente como as de backend.

**Ação**: Após este plano, indicarei ao usuário fazer hard-refresh + Publish para garantir que o módulo da Coordenação seja servido com hash atualizado.

## Problema 2 — Menu "Coordenação" não aparece no site publicado

**Diagnóstico**: O item está corretamente condicionado a `isCoord` em `AppSidebar.tsx` (linha 82) e aparece no preview do Lovable. Se não aparece em produção é porque o build publicado é mais antigo.

**Solução**: Mesmo Publish acima resolve.

## Problema 3 — Delta negativo (-107) de participantes ativos

**Causa raiz** (confirmada via query):
- `now_ativos` = 86 (participantes com status='ativo' hoje)
- `count_30d` = 193 (TODOS os participantes cadastrados antes de 30 dias atrás, independentemente do status atual)
- A fórmula em `get_dashboard_stats` conta como "ativos há 30 dias" qualquer registro com `iniciou_em <= hoje-30d` cujo `data_desligamento` ainda não foi preenchido. Como muitos desligamentos legados (status diferente de 'ativo') não têm `data_desligamento`, eles entram na contagem.
- Resultado: 86 − 193 = **−107** (falsamente negativo).

**Correção** (migration SQL):
Reescrever o cálculo de `v_count_30d` em `get_dashboard_stats` para:

```sql
SELECT count(*) INTO v_count_30d
FROM participantes
WHERE coalesce(iniciou_em, created_at::date) <= (current_date - interval '30 days')::date
  AND status IN ('ativo','busca_ativa')   -- considera apenas quem segue ativo no sistema
  AND (data_desligamento IS NULL OR data_desligamento > (current_date - interval '30 days')::date);
```

Adicionalmente, respeitar o marco operacional `v_data_corte` (01/04/2026): se `(current_date - 30 days) < v_data_corte`, retornar `v_delta_participantes = 0` (não há histórico anterior ao marco para comparação significativa).

## Arquivos afetados

- `supabase/migrations/<timestamp>_fix_dashboard_delta.sql` — atualizar função `get_dashboard_stats`.

Nenhuma alteração de frontend necessária para os 3 problemas além do Publish.
