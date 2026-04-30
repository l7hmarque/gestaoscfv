---
name: Monitoramento Portal Família
description: Logs de acesso da família com sessão, heartbeat e painel de coordenação
type: feature
---
Tabela `familia_acessos` registra cada login no /familia (participante, duração, ações, user-agent, match_type).
- Edge `public-familia-auth` insere o registro no login e retorna `acesso_id`.
- Edge `public-familia-data` faz heartbeat: a cada chamada (incluindo tipo "heartbeat" enviado a cada 60s pelo dashboard) atualiza `ultimo_ping_em`, `duracao_segundos`, incrementa `total_acoes` e anexa em `acoes` (jsonb, máx 50).
- `acesso_id` fica em sessionStorage da família.
- Aba "Portal Família" em /coordenacao mostra KPIs (total, hoje, famílias únicas, duração média), heatmap por hora e tabela de sessões recentes.
- RLS: SELECT só coordenacao; INSERT/UPDATE só via service role (sem policy).
