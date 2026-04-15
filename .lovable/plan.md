

## Diagnóstico: Por que o site está lento

Analisei o código, as requisições de rede e os logs. Os principais gargalos são:

### Problema 1 — Dashboard puxa TODAS as linhas do banco para o navegador

O `useDashboardData` faz `fetchAllRows` em **6 tabelas inteiras** (participantes, turmas, relatorios_atividade, planejamentos, bairros, relatorio_presenca) e faz toda a agregação no JavaScript do navegador. A tabela `relatorio_presenca` cresce com cada registro de presença — centenas/milhares de linhas sendo baixadas e processadas no browser a cada visita ao dashboard.

### Problema 2 — Cronograma re-renderiza demais

O componente `CronogramaPage` (870 linhas) tem um `useEffect` de detecção de conflitos que roda a cada mudança de `slots`, iterando todos os slots múltiplas vezes. As funções `countSlots` e `getTurmaFreq` são chamadas inline no render sem memoização.

### Problema 3 — Requisições em cascata (waterfall)

No Feed, após buscar `feed_posts`, uma segunda rodada de requests busca `feed_fotos`, `feed_reacoes` e `feed_comentarios`. No Index, busca-se `profiles` para achar o `user_id` e depois `recados` — sequencial.

---

## Plano de Otimização

### 1. Mover agregação do Dashboard para o banco (maior impacto)

Criar uma **função SQL (RPC)** `get_dashboard_stats` que retorna os dados já agregados. Em vez de baixar milhares de linhas de `relatorio_presenca` e `participantes`, o banco faz os counts, agrupamentos e médias e retorna um JSON pequeno.

- **Migration**: criar função `get_dashboard_stats()` que retorna JSON com totais, agrupamentos por faixa/gênero/bairro/período, médias ELO/adesão, presença mensal, delta, alertas
- **`useDashboardData.ts`**: trocar 6x `fetchAllRows` por 1x `supabase.rpc("get_dashboard_stats")`

### 2. Memoizar cálculos pesados do Cronograma

- Envolver `countSlots` e `getTurmaFreq` em `useMemo` dependendo de `slots`
- Memoizar a lista de conflitos com `useMemo` em vez de `useEffect` + `setState` (evita re-render duplo)
- Extrair componentes menores (`SlotCell`, `TurmaStrip`) com `React.memo`

### 3. Selecionar apenas colunas necessárias

- Dashboard: se mantiver client-side como fallback, usar `select` específico em vez de `select("*")` para reduzir payload
- Feed: usar `select("id,autor_id,conteudo,tipo,created_at")` em vez de `*`
- Cronograma: `profiles` já usa `select("id, nome, cargo, ativo")` — OK

### 4. Lazy load de dados secundários

- No Index (página inicial): os `pinnedPosts` e contagens podem usar `staleTime` do React Query para não re-buscar a cada navegação
- Feed: carregar fotos/reações/comentários só dos posts visíveis (virtualização futura), não de todos os 100

---

### Arquivos editados

| Arquivo | Mudança |
|---|---|
| Migration SQL | Função RPC `get_dashboard_stats` |
| `src/hooks/useDashboardData.ts` | Trocar fetchAllRows por RPC |
| `src/pages/cronograma/CronogramaPage.tsx` | useMemo para conflitos, countSlots, getTurmaFreq |
| `src/pages/feed/FeedPage.tsx` | Select específico, limitar fetch de fotos/reações |

### Resultado esperado

- Dashboard: de ~6 requests (milhares de rows) para 1 request (1 JSON pequeno)
- Cronograma: menos re-renders, cálculos memoizados
- Feed: payloads menores

### Detalhes técnicos da RPC

```sql
CREATE OR REPLACE FUNCTION get_dashboard_stats()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE result jsonb;
BEGIN
  -- Agregações diretas no banco:
  -- COUNT participantes ativos, turmas ativas, relatórios, planejamentos
  -- GROUP BY faixa etária, gênero, bairro, período
  -- AVG score_elo, pct_adesao por mês
  -- Presença mensal: JOIN relatorio_presenca com relatorios_atividade
  -- Tudo retornado em um único JSON
  RETURN result;
END; $$;
```

