

# Endurecimento de segurança + Painel de Permissões + Atividades da Coordenação

Três entregas conectadas: blindar o RPC `get_coordenacao_stats` e tabelas críticas com checagem real de role; criar um painel visual de gestão de permissões dentro do módulo de Coordenação; e adicionar uma aba de Registro de Atividades Livres do coordenador.

## 1. Segurança (corrige avisos do linter)

### RPC `get_coordenacao_stats` — blindagem dupla
- Hoje: depende do `_user_id` enviado pelo cliente. Vulnerável (qualquer autenticado pode passar o `user_id` de um coordenador).
- Migration: refatorar para **ignorar** `_user_id` recebido e usar `auth.uid()` internamente; manter `SECURITY DEFINER` + `SET search_path = public`; retornar `forbidden` se `has_role(auth.uid(), 'coordenacao')` for falso. `_user_id` vira parâmetro opcional ignorado (mantém compatibilidade do hook).

### RLS — eliminar políticas `WITH CHECK (true)` (warns 2–7)
Substituir por checagens de role concretas nas tabelas hoje permissivas:
- `audit_log` INSERT: trocar `true` por `auth.uid() = user_id` (impede falsificação de autoria).
- `chamadas_assinadas` INSERT: `uploaded_by = auth.uid() AND NOT has_role(auth.uid(), 'visitante')`.
- `conquistas` INSERT: restringir a coordenação/sistema (`has_role(auth.uid(), 'coordenacao')`).
- `feed_posts` / `feed_comentarios` / `feed_fotos` / `feed_reacoes` / `mural_posts` INSERT: amarrar `autor_id`/`user_id` ao perfil do `auth.uid()` via subquery em `profiles`.
- `participante_documentos` INSERT/UPDATE: bloquear visitante + exigir role operacional (`coordenacao`, `tecnico`, `educador`).
- `participantes`, `presenca`, `planejamentos`, `planejamento_turmas`, `participante_transferencias`: trocar `NOT visitante` puro por `(NOT visitante) AND (has_role coordenacao OR tecnico OR educador)` no INSERT/UPDATE/DELETE.

Cada role passa a operar **apenas** no que lhe compete:
- `coordenacao`: tudo.
- `tecnico`: prontuário, atendimentos, financeiro, formulários, encaminhamentos (já correto).
- `educador`: cria/edita seus próprios relatórios, planejamentos, presença e participantes; sem deletar exceto próprios.
- `motorista`: só leitura geral + INSERT/UPDATE em transporte (sem mutar participantes/relatórios).
- `cozinheiro`: somente leitura.
- `visitante`: somente SELECT.

Avisos do linter fora do escopo (e já tratados via produto): Extension in Public, Public Bucket Listing, Leaked Password Protection — mantidos como estão (o usuário não pediu).

## 2. Nova aba **Permissões** dentro de `/coordenacao`

Painel intuitivo para alterar acessos sem ir ao `/dev`:
- Tabela: linhas = profissionais ativos (de `profiles`); colunas = roles (`coordenacao`, `tecnico`, `educador`, `motorista`, `cozinheiro`, `visitante`).
- Cada célula é um Switch. Marcar/desmarcar dispara `INSERT`/`DELETE` em `user_roles` com auditoria automática em `audit_log` (acao=`role_concedida`/`role_revogada`).
- Filtro por nome, badge de quantas roles cada pessoa acumula, busca instantânea.
- Painel-resumo no topo: matriz de capacidades (mesma de `DevPage`, em modo leitura) explicando o que cada role pode.
- Acesso restrito a `coordenacao` (já protegido pela página).
- Confirmação ao remover a última role de coordenação do sistema (anti lock-out).

## 3. Nova aba **Atividades** (registro livre da coordenação)

Diário de atividades realizadas pela coordenação, separado de auditoria automática:
- Tabela nova `coordenacao_atividades`: `id`, `coordenador_id` (profile), `data` (default hoje), `categoria` (enum textual: `reuniao`, `visita_tecnica`, `articulacao_rede`, `formacao_equipe`, `documento`, `outro`), `titulo`, `descricao`, `duracao_minutos` (opcional), `created_at`, `updated_at`.
- RLS: SELECT/INSERT/UPDATE/DELETE somente para `coordenacao` (próprio ou equipe — visível a todos os coordenadores).
- UI: formulário inline (categoria, título, descrição, data, duração) + lista cronológica reversa com filtros por categoria e mês. Cards minimalistas com badge de categoria e ações editar/excluir.
- KPI agregado nos contadores do Painel: nº de atividades registradas no período + tempo total dedicado.
- Cada criação grava também em `audit_log` para rastreabilidade.

## Detalhes técnicos

- **Migration única** com:
  1. `CREATE OR REPLACE FUNCTION public.get_coordenacao_stats` ignorando `_user_id` e usando `auth.uid()`.
  2. `DROP POLICY` + `CREATE POLICY` para todas as tabelas listadas acima (substitui `true` por checagem real).
  3. `CREATE TABLE public.coordenacao_atividades` + `ENABLE ROW LEVEL SECURITY` + 4 policies role-restritas + trigger `update_updated_at_column`.
- **Frontend**:
  - `src/pages/coordenacao/PermissoesTab.tsx` — tabela + switches + auditoria.
  - `src/pages/coordenacao/AtividadesTab.tsx` — formulário + lista + filtros.
  - `src/pages/coordenacao/CoordenacaoPage.tsx` — adiciona 2 abas (`permissoes`, `atividades`); `TabsList grid-cols-7`.
  - `src/hooks/useCoordenacaoData.ts` — não envia mais `_user_id` real (mantém parâmetro só para compat) e aceita o novo bloco `atividades_periodo` retornado pelo RPC.
- **Validação pós-migration**: rodar `supabase--linter` e confirmar que warns 2–7 sumiram.

## Diagrama

```text
/coordenacao (role-gated)
  ├── Painel (KPIs unificados — inalterado)
  ├── Ações Pendentes
  ├── Decisões (audit_log)
  ├── Qualidade (KPIs gestão)
  ├── Atividades (NOVO — registro livre + filtros)
  ├── Permissões (NOVO — switches por role)
  └── Relatório

RPC get_coordenacao_stats
  ├── auth.uid() ← server-side (não confia no cliente)
  ├── has_role(auth.uid(),'coordenacao') ← gate
  └── retorna {dashboard, pendencias, gestao, atividades_periodo}
```

## Fora do escopo
- Avisos do linter sobre `extension in public`, `public bucket listing` e `leaked password protection` (configurações de produto/Auth, não pedidos).
- Edição de roles fora da aba Permissões (continua existindo `/dev` e `/configuracoes`).

