## Contexto

O painel de "Gaps" da página `/turmas` está acusando **49 vínculos órfãos**: participantes ainda marcados como ativos (status `ativo`, `busca_ativa`, `pendente` ou `incompleto`) que continuam vinculados (`turma_participantes.data_saida IS NULL`) a **10 turmas inativas** (`turmas.ativa = false`). Distribuição atual (confirmada no banco):

```text
ALVORADA — 12-17 — Tarde            17
ALVORADA — 9-11  — Tarde             9
ALVORADA — 6-8   — Manhã             7
ALVORADA — 9-11  — Manhã             6
ALVORADA — 12-17 — Manhã             5
ALVORADA — 6-8   — Tarde             1
PARQUE INDEP. — 6-8  — Manhã         1
PARQUE INDEP. — 9-11 — Manhã         1
JARDIM IRENE  — 6-8  — Manhã         1
JARDIM IRENE  — 12-17 — Manhã        1
TOTAL                                49
```

Isso aconteceu porque as turmas foram desativadas sem realocar os participantes (provavelmente um redesenho do quadro de oficinas em ALVORADA). Eles ainda contam como "ativos" no sistema, mas não aparecem em nenhuma chamada — quebra indicadores, relatório mensal e busca ativa.

## Solução proposta — wizard "Resolver Vínculos Órfãos"

Adicionar um botão **"Resolver 49 vínculos órfãos"** no card de Gaps que abre um diálogo de revisão linha-a-linha. Para cada participante órfão a coordenação escolhe **uma** das três ações:

1. **Transferir para turma ativa** — combobox pré-filtrado com turmas ativas compatíveis por **bairro + faixa etária + período** (sugestão automática quando há exatamente uma). Grava em `turma_participantes` (data_saida na origem + nova linha na destino) e registra em `participante_transferencias` com motivo "Realocação por desativação de turma".
2. **Registrar saída** (sem transferência) — apenas seta `turma_participantes.data_saida = hoje`. Útil quando o participante de fato não migrou para nenhuma oficina ativa.
3. **Desligar participante** — seta `participantes.status = 'desligado'`, `data_desligamento = hoje`, motivo "Encerramento de turma sem realocação" e fecha o vínculo (mesma regra do Painel de Desligamento). Já existe RPC para isso.

Padrão pré-selecionado:
- Se houver **exatamente uma** turma ativa compatível → "Transferir" pré-selecionada com ela.
- Se houver **mais de uma** → "Transferir" pré-selecionada, combobox aberto.
- Se **não houver nenhuma** → "Registrar saída" pré-selecionada.

A coordenação pode mudar livremente. O botão **"Aplicar tudo"** dispara as 49 ações dentro de uma única transação RPC com auditoria (`audit_log` por participante, justificativa única no topo do diálogo).

### Diagrama do fluxo

```text
Painel Gaps  ──►  [Resolver 49 vínculos órfãos]
                       │
                       ▼
            ┌──────────────────────────────┐
            │  Diálogo (agrupado por       │
            │  turma inativa)              │
            │                              │
            │  • Participante A  [Transf ▼ a Turma X ]│
            │  • Participante B  [Saída            ] │
            │  • Participante C  [Desligar         ] │
            │  ...                         │
            │                              │
            │  Justificativa: __________   │
            │  [Cancelar]   [Aplicar tudo] │
            └──────────────────────────────┘
                       │
                       ▼
              RPC resolver_orfaos_lote
              (transacional + audit_log)
                       │
                       ▼
       Invalida caches  →  Gap volta a 0
```

## Detalhes técnicos

**Backend (migration nova):**
- RPC `get_orfaos_turmas_inativas()` → retorna `[{ turma_id, turma_nome, bairro_id, faixa_etaria, periodo, participantes: [{ id, nome, status, idade }], sugestoes_turmas: [{ id, nome }] }]`. Sugestão = turmas com `ativa = true` AND mesmo período AND faixa etária compatível AND (bairro do participante ∈ `bairro_ids` da turma OU `turmas.bairro_id` = bairro do participante).
- RPC `resolver_orfaos_lote(_acoes jsonb, _justificativa text)` recebe `[{ participante_id, turma_origem_id, acao: 'transferir'|'saida'|'desligar', turma_destino_id?: uuid }]` e:
  - `transferir`: fecha vínculo origem (`data_saida = CURRENT_DATE`) + insere vínculo destino + insere `participante_transferencias` (origem, destino, motivo).
  - `saida`: só fecha vínculo origem.
  - `desligar`: fecha vínculo origem + atualiza `participantes` (status, data_desligamento, motivo).
  - Todas as ações gravam `audit_log` por participante.
  - Bloqueia se `auth.uid()` não tem role `coordenacao`.
- Segurança: `security definer`, `set search_path = public`, `grant execute … to authenticated`.

**Frontend (`src/pages/turmas/TurmasPage.tsx` + novo `ResolverOrfaosDialog.tsx`):**
- Botão dentro do card de Gaps quando `totalOrfaos > 0`.
- Diálogo agrupado por turma inativa, com toggle de ação por participante (Radio + Combobox de destino).
- `Promise` única chamando a RPC; toast com resumo (`X transferidos, Y saídas, Z desligados`).
- Invalida `["turmas-list"]`, `["participantes"]`, `["pendencias-integridade"]`.

**Impacto em fluxos / indicadores:**
- ✅ Indicadores de presença e relatórios mensais voltam a contar corretamente esses 49.
- ✅ Busca ativa para de ignorar (eles não tinham chamada → não tinham presença → eram "fantasmas").
- ✅ Histórico preservado: `participante_transferencias` registra a realocação; status anteriores não são apagados.
- ⚠️ Quem for marcado como "saída sem transferência" some das chamadas, mas continua ativo no cadastro — útil só se a coordenação realmente quiser depois transferir manualmente. Mensagem de aviso no diálogo.
- ⚠️ Desligamento é irreversível pelo fluxo normal (precisa de coordenação para reativar).

**Riscos / mitigação:**
- Conflito com a turma de destino: a RPC bloqueia inserção se já existir vínculo ativo do mesmo participante naquela turma (`unique (participante_id, turma_id) WHERE data_saida IS NULL` — adicionar índice se ainda não existir).
- Reentrada: a RPC é idempotente — se um participante já tem `data_saida` na origem, é ignorado com aviso no resultado.
- Auditoria: tudo passa por `audit_log` com a justificativa única do diálogo, sem perda de rastreabilidade.

## Alternativas que descartei

- **Reativar as turmas em massa**: não resolve o problema real (a coordenação já decidiu desativá-las) e ainda confunde o cronograma.
- **Cron job automático que fecha vínculo quando turma vira inativa**: perigoso — perderia a chance de transferir e desativaria participantes sem revisão humana. Pode entrar como segunda fase **depois** desta limpeza, como trigger que só fecha o vínculo se a turma já estiver inativa há > 30 dias e nenhuma ação tiver sido tomada.
- **Script SQL one-shot**: corrige hoje mas não evita reincidência e não dá revisão participante a participante.

## Confirmações antes de implementar

Antes de partir para a build, preciso que você confirme:

1. **OK criar a RPC + diálogo de revisão** (recomendado), ou prefere apenas um script SQL de limpeza one-shot agora e a gente trata reincidência depois?
2. **Padrão sugerido para ALVORADA**: as 5 turmas inativas de ALVORADA têm equivalentes ativos (oficina "ATIVIDADES CULTURAIS E ARTISTICAS" e "DANCA E POESIA" 12-17). Você quer que a sugestão automática **distribua entre as oficinas ativas do mesmo bairro/faixa/período** (round-robin) ou **deixe a coordenação escolher manualmente uma a uma** (default mais seguro)?
