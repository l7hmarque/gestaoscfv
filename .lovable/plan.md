## Decisões confirmadas

1. **Reativar as 18 turmas "normais"** (sem oficina) e matricular nelas todo participante elegível por **bairro + faixa etária + período**. Oficinas ficam como estão.
2. **Consolidar status** de participante para apenas **3 valores**:
   - `ativo` — frequentando
   - `busca_ativa` — educador marcou que precisa ser procurado
   - `desligado` — família confirmou saída
3. **Eliminar `pendente` e `transferido`** do sistema (do enum, das telas, dos filtros, das RPCs).
4. **`incompleto` deixa de ser status** — vira **flag derivada** (`is_incompleto`) calculada a partir de campos faltantes do cadastro. Continua aparecendo como **aviso visual** e como **filtro** na listagem, mas independente do status.

## Estado atual (do banco)

```text
status      | participantes
------------+--------------
busca_ativa | 110
ativo       | 105
desligado   |  55
incompleto  |   2   ← migrar para 'ativo' + flag
pendente    |   0   ← só remover do enum
(transferido nunca existiu como status — só como marcador de vínculo)
```

45 participantes sem `data_nascimento` (candidatos naturais ao alerta "incompleto").

## Passo 1 — Migration de schema (status consolidado)

Uma migration:

- Migrar dados: `UPDATE participantes SET status='ativo' WHERE status IN ('incompleto','pendente')` (preserva os 2 incompletos como ativos; eles continuarão sinalizados pela flag derivada).
- Criar novo enum `status_participante_v2` com apenas `ativo | busca_ativa | desligado`.
- `ALTER TABLE participantes ALTER COLUMN status TYPE status_participante_v2 USING status::text::status_participante_v2`.
- `DROP TYPE status_participante` + renomear o v2 para `status_participante`.
- Criar **função geradora** `public.is_participante_incompleto(p participantes) RETURNS boolean` (immutable): retorna `true` quando faltar `data_nascimento` OU `bairro_id` OU `periodo` OU `nome_completo` vazio (ajustar a lista final com base nos campos obrigatórios reais).
- Atualizar/recriar RPCs que filtram por status para usar apenas o conjunto novo (`get_pendencias_integridade`, `get_orfaos_turmas_inativas`, `get_participantes_turma`, `desligar_participante`, qualquer trigger). Onde antes havia `IN ('ativo','busca_ativa','pendente','incompleto')` passa a ser `IN ('ativo','busca_ativa')`.

## Passo 2 — Limpeza de dados em lote (operação solicitada)

Em `supabase--insert` separado (após migration aprovada):

a) **Reativar as 18 turmas normais**: `UPDATE turmas SET ativa=true WHERE oficina IS NULL OR oficina=''`.

b) **Matricular elegíveis**: para cada turma normal, inserir em `turma_participantes` (data_entrada=hoje, data_saida=NULL) todo participante onde:
   - `status IN ('ativo','busca_ativa')`
   - `bairro_id = turma.bairro_id`
   - `periodo = turma.periodo`
   - idade (de `data_nascimento`) cai dentro de `faixa_etaria`
   - `NOT EXISTS` vínculo aberto duplicado.

c) **Fechar vínculos abertos de desligados**: `UPDATE turma_participantes SET data_saida = CURRENT_DATE` onde participante.status='desligado' e data_saida IS NULL.

d) **Registro de auditoria** em `audit_log` com a justificativa "Reativação das turmas normais, consolidação de status e limpeza de vínculos".

## Passo 3 — Frontend: substituir status legados

Substituir literais `'incompleto'` / `'pendente'` / `'transferido'` em:

- `src/components/StatusBadge.tsx` — remover variantes incompleto/pendente; manter só ativo/busca_ativa/desligado. Adicionar nova prop `isIncompleto?: boolean` que renderiza um chip **adicional** (não substitui o status).
- `src/pages/participantes/ParticipantesPage.tsx` — filtros: troca o filtro "Incompleto" por um filtro independente "Cadastro incompleto" baseado na flag derivada; remove "Pendente" e "Transferido".
- `src/pages/participantes/ParticipantePerfilPage.tsx` — onde mostrava status incompleto/pendente, passa a mostrar status real + alerta separado.
- `src/pages/participantes/PainelDesligamentoPage.tsx`, `src/components/RecadosEquipeCards.tsx`, `src/components/NotificationBell.tsx`, `src/hooks/useRoteirosVisita.ts`, `src/pages/equipe-tecnica/*`, `src/pages/profissional/ProfissionalPerfilPage.tsx`, `src/components/DriveSyncBadge.tsx`, `src/lib/offlineDB.ts`, `src/pages/site-admin/SiteAdminPage.tsx`, `src/pages/Index.tsx` — qualquer comparação/filtro por esses literais é atualizada.
- A flag `is_incompleto` deve ser exposta pelas RPCs/queries de listagem (computada via `SELECT … , public.is_participante_incompleto(p.*) AS is_incompleto`).

## Passo 4 — Atualizar memórias do projeto

- Atualizar `mem://funcionalidades/gestao-participantes-status-unificada` removendo `Pendente` e `Incompleto` da lista de status e descrevendo `is_incompleto` como flag derivada.

## Garantias

- **Idempotente**: passo 2 pode rodar várias vezes sem duplicar (NOT EXISTS) e sem reabrir vínculos (data_saida IS NULL).
- **Histórico preservado**: nenhum `desligado` vira `ativo`; nenhum vínculo é deletado, só fechado.
- **Sem perda de informação**: os 2 atuais `incompleto` continuam sinalizados — só que agora como `ativo` + flag.
- A migration roda em uma única transação; se algo falhar, nada é aplicado.

## Resultado esperado

```text
ANTES                                       DEPOIS
5 status (ativo/busca/desl/inc/pend)   ⇒    3 status (ativo/busca/desl)
'incompleto' como status                ⇒    flag is_incompleto + filtro
18 turmas normais inativas              ⇒    18 ativas com participantes
49 órfãos em turmas inativas            ⇒    0
1 desligado com vínculo aberto          ⇒    0
```
