## Implementação: Recompute Job + Health Card no /dev

### 1. Edge Function `recompute-participantes-status`

Função agendada (diária, 03:00) que executa em transação:

- **Regra A — Reativação automática**: `busca_ativa` com presença registrada nos últimos 7 dias → volta para `ativo`. Registra em `audit_log` com motivo "Retorno detectado via presença".
- **Regra B — Sinalização de inatividade**: `ativo` sem nenhuma presença há mais de 21 dias (considerando apenas dias com chamada feita na turma dele) → muda para `busca_ativa`. Cria registro em `busca_ativa_registros` com motivo automático.
- **Regra C — Alerta de desligamento sugerido** (NÃO executa): `busca_ativa` há mais de 30 dias sem presença → grava em nova tabela `alertas_desligamento_sugerido` para coordenação revisar manualmente. Nunca desliga sozinho.

Parâmetros (dias) ficam em `configuracoes_gerais` para ajuste sem deploy.

### 2. Tabela `alertas_desligamento_sugerido`

Campos: participante_id, dias_sem_presenca, sugerido_em, revisado_em, revisado_por, decisao (`desligar` | `manter` | `pendente`). RLS: coordenação lê/escreve.

### 3. Cron job (pg_cron + pg_net)

Agendamento diário às 03:00 chamando a edge function.

### 4. Health Card em `/dev`

Novo card "Saúde dos Vínculos" com 4 KPIs em tempo real (RPC `get_link_health_stats`):

1. Ativos sem vínculo aberto em turma
2. Desligados/transferidos com vínculo ainda aberto
3. `busca_ativa` há mais de 30 dias (candidatos a desligamento)
4. Ativos sem presença há mais de 21 dias

Cada KPI tem botão "Baixar planilha" (XLSX com lista dos participantes afetados) e link para a página relevante. Mostra também data da última execução do recompute e quantas mudanças foram feitas.

### Detalhes técnicos

- **Arquivos novos**: 
  - `supabase/functions/recompute-participantes-status/index.ts`
  - Migration: tabela `alertas_desligamento_sugerido` + RPC `get_link_health_stats` + parâmetros default em `configuracoes_gerais`
  - `src/components/dev/LinkHealthCard.tsx`
- **Arquivos editados**: `src/pages/dev/DevPage.tsx` (montar o card)
- **Cron**: via `supabase--insert` (pg_cron schedule) após deploy da função
- **Auditoria**: toda transição automática vai para `audit_log` com `acao = 'recompute_status'` para rastreabilidade total
- **Idempotente**: rodar várias vezes no mesmo dia não duplica registros nem alertas (usa `ON CONFLICT` em `alertas_desligamento_sugerido` por participante+dia)
