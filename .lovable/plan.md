# Privacidade dos recados + Check-in com janela de antecedência

Duas entregas conectadas: **isolar o canal de mensagens da família** (hoje vazando recados internos/técnicos) e adicionar um **check-in diário** que precisa ser feito **no dia anterior ou até 1h antes do início (07:00 GMT-3)**, visível ao motorista no painel de pontos.

## 1. Privacidade — recados dedicados à família

Edge function `public-familia-data` hoje seleciona qualquer linha de `recados` ligada ao `participante_id`, expondo correspondência interna sigilosa.

- Nova tabela `recados_familia`: `id`, `participante_id` (FK), `remetente_id` (profile, FK), `conteudo`, `lido_em` (timestamp null), `created_at`.
- RLS: SELECT/INSERT/UPDATE/DELETE só para `coordenacao` OR `tecnico` OR `educador` (família acessa via edge function com token, nunca por RLS).
- `public-familia-data` case `recados` reescrito para ler **apenas** `recados_familia` (e marcar `lido_em = now()`).
- `SendRecadoDialog` ganha prop `paraFamilia` que roteia o insert para `recados_familia`. Botão "Enviar recado à família" no perfil do participante e na listagem.
- Aba Recados do portal da família continua igual visualmente, alimentada pelo novo canal.

## 2. Check-in da família com janela de antecedência

**Regra de negócio (timezone America/Sao_Paulo, GMT-3):**

- Check-in para o dia D pode ser feito a partir de **D-7 até as 06:00 de D** (1h antes das 07:00, horário-padrão de início do turno da manhã).
- Após 06:00 de D, o card fica **bloqueado** com mensagem clara: "Janela de confirmação encerrada — fale com a coordenação".
- Default exibido para a família: **dia seguinte** (após 18:00) ou **dia atual** (entre 00:00 e 06:00). Permitido também escolher os próximos 7 dias úteis.
- Validação dupla: client-side (UX) + server-side na edge function (autoridade), usando `Intl.DateTimeFormat` com `timeZone: 'America/Sao_Paulo'` para evitar bug de fuso do navegador da família.

**Tabela nova `participante_checkins**`:

- `id`, `participante_id` (FK), `data` (date), `periodo` (`manha`|`tarde`), `confirmado` (boolean), `confirmado_em` (timestamptz), `confirmado_por` (text — nome do responsável, opcional), `observacao` (text null), `created_at`, `updated_at`.
- Unique `(participante_id, data, periodo)`.

**RLS**:

- SELECT: `coordenacao` OR `motorista` OR `tecnico` OR `educador` OR `cozinheiro`.
- INSERT/UPDATE: equipe operacional (não-visitante). Família escreve apenas via edge function.
- DELETE: `coordenacao`.

**Edge function `public-familia-data` — 2 novos cases**:

- `checkins` → retorna últimos 14 dias do participante + status do dia atual e do próximo dia útil.
- `registrar_checkin` → upsert idempotente por `(participante_id, data, periodo)`. **Bloqueia** se `now()` (em America/Sao_Paulo) já passou de `data 06:00`. Bloqueia também se `data` está mais de 7 dias no futuro. Aceita `confirmado=true` ou `false` (cancelar). Retorna erro 422 amigável se fora da janela.

**UI no portal da família** (`FamiliaDashboardPage`) — seção **"Confirmar presença"** acima de Atividades:

- Card grande com foto, nome curto e título dinâmico:
  - Antes das 06:00 do dia D: **"Vai hoje? (DD/MM)"**
  - Após 06:00 e antes das 18:00: **"Confirmar amanhã (DD/MM)"** + nota "Hoje já está fechado" - caso o participante tenha atividades no dia seguinte.
  - Após 18:00: **"Vai amanhã? (DD/MM)"**
- Dois botões enormes: **"✅ SIM, vai"** (verde dominante) e **"❌ Hoje não vai"** (vermelho secundário). Períodos manhã/tarde mostrados conforme turma; ambos empilhados se Integral. Se clicar em nao vai, campo de justificativa obrigatorio persuadindo de forma inteligente ao usuario escrever o motivo que nao vai .
- Se check in for Nao Vai, nome da criança ao lancar presenca no relatorio de atividades fica pre selecionado como falta e com a justificativa colocada pelo responsavel. 
- Quando o dia escolhido **não é dia de atividade da criança** (cruzando `turmas.dias_semana`): "Não há atividade neste dia 🌿".
- **Estado bloqueado** (após 06:00 do dia consultado): card cinza, ícone cadeado, texto "Janela encerrada às 06:00 — fale com a coordenação". Botão sutil "Confirmar para amanhã" desloca para D+1.
- Picker discreto "Confirmar para outro dia" abre os próximos 7 dias úteis.
- **Reforço imediato (criação de hábito)**:
  - Confete `canvas-confetti` + toast "Obrigado! O motorista já foi avisado 🚐".
  - Card vira verde com "✅ Confirmado às HH:mm" e botão "Cancelar (até 06:00 de DD/MM)".
  - **Streak** "🔥 X dias confirmando" calculado dos últimos 14 dias.
  - Badge no topo "Última confirmação: DD/MM HH:mm".
  - Lembrete passivo: se houver atividade amanhã e ainda não confirmou após 19:00 do dia anterior, borda âmbar pulsante e texto "⏰ Confirme agora — janela fecha às 06:00".

**Visibilidade para o motorista** (`DashboardTransporteTab`):

- Nova seção **"Embarques de hoje"** no topo (só `motorista` e `coordenacao`).
- Por ponto, lista os participantes do período corrente com 3 estados:
  - 🟢 **Confirmado** — verde, hora e nome de quem confirmou.
  - 🔴 **Não vai** — vermelho riscado.
  - ⚪ **Sem resposta** — cinza, "Sem confirmação até 06:00".
- Cabeçalho de cada ponto: `🟢 X · 🔴 Y · ⚪ Z`.
- Botão "Marcar como embarcou" para confirmação manual. E botao "Nao embarcou". Com registro de horário GMT -3 para as marcações. 
- Auto-refresh 60s + realtime opcional via `postgres_changes` em `participante_checkins`.

## Detalhes técnicos

**Migration única**:

1. `recados_familia` + RLS (4 policies) + trigger `updated_at`.
2. `participante_checkins` + unique `(participante_id, data, periodo)` + RLS (4 policies) + trigger `updated_at` + index `(participante_id, data)` para o painel do motorista.

**Edge function `public-familia-data/index.ts**`:

- Case `recados` → `recados_familia`.
- Cases `checkins` (leitura 14d) e `registrar_checkin` (upsert com **gate de janela** usando `new Date().toLocaleString('en-US', {timeZone:'America/Sao_Paulo'})`).
- Mantém validação HMAC já existente.

**Frontend**:

- `src/pages/familia/FamiliaDashboardPage.tsx` — seção check-in com botões grandes, picker D±7, estados bloqueado/confirmado/pendente, streak, confete (`canvas-confetti`).
- `src/components/SendRecadoDialog.tsx` — prop `paraFamilia` roteando para `recados_familia`. Botão de gatilho em `ParticipantePerfilPage.tsx` e `ParticipantesPage.tsx`.
- `src/pages/dashboard/DashboardTransporteTab.tsx` — seção "Embarques de hoje" com cards por ponto, contadores, badges, auto-refresh, botão "Marcar embarque".
- Helper compartilhado `src/lib/checkinWindow.ts` com `isCheckinAberto(dataAlvo: Date)` e `proximaJanelaTexto()` baseados em America/Sao_Paulo (mesma lógica do server, no client só para UX).

## Diagrama

```text
JANELA DE CHECK-IN (America/Sao_Paulo)
  D-7 ──────────────────────────► D 06:00 ✖ fechado
                                  ▲
                                  │ 1h antes do início (07:00)
PORTAL DA FAMÍLIA
  ├── Card "Vai amanhã?" / "Vai hoje?"  ──[POST registrar_checkin]──► gate servidor
  │     └── ✅ confete + 🔥 streak + "Confirmado HH:mm"
  └── Recados (canal limpo)  ◄──[GET recados]── recados_familia

PAINEL TRANSPORTE (motorista + coord)
  └── Embarques de hoje ── 🟢 confirmado · 🔴 não vai · ⚪ pendente   (refresh 60s)
```

## Fora do escopo

- Notificações push/SMS de lembrete (iteração futura).
- Janela configurável por território (fixa em 06:00 GMT-3 nesta entrega; constante exposta em `src/lib/constants.ts` para ajuste fácil).
- Migração de recados antigos — `recados_familia` nasce vazia e o portal volta limpo na hora.