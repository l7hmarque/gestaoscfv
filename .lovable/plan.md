## Objetivo

Resolver de vez "esse participante está realmente ativo?". Duas frentes:

- **A.** Aplicar as regras de "lista limpa" nas chamadas em branco e no seletor de Novo Relatório (já combinado).
- **B.** Criar uma **fonte única de verdade** para "está frequentando", com normalização do histórico e recálculo automático do status. Assim todo lugar do sistema (listas, relatórios, dashboards, busca ativa) usa a mesma resposta.

---

## Parte A — Regras de lista limpa (já aprovado)

Para uma turma na data `D`, aparece quem:

1. Tem vínculo aberto: `tp.data_entrada <= D` e (`tp.data_saida IS NULL` ou `> D`).
2. Status atual é `ativo`, `cadastro_incompleto`, **ou** `busca_ativa` com `busca_ativa_desde >= D - 30 dias`.
3. **Não** filtra por `data_desligamento`/`data_transferencia` (são históricos — quem voltou tem status atualizado e vínculo novo).

Aplica em:
- RPC `get_participantes_turma` modo `chamada_branco` (reescrita).
- Edge `generate-listas-chamada-mes-gsheet`: `_ref_date` = último dia do mês, layout limpo.
- `RelatorioNovoPage` e `PresencaPage` herdam sem mudança de código.

Preview Google Sheets (A: chamada em branco maio/26; B: seletor novo relatório hoje) antes de aplicar.

---

## Parte B — Fonte única de verdade ("está frequentando?")

### B1. View canônica `vw_participante_frequencia_status`

Uma view materializada por consulta que, para cada `(participante_id, turma_id)`, devolve:

```text
participante_id, turma_id,
status_atual,                 -- da tabela participantes
vinculo_aberto (bool),        -- tp.data_saida IS NULL
ultima_presenca_em (date),    -- max(presenca.data) onde marcacao = 'P'
dias_sem_presenca (int),
frequentando (bool),          -- regra única (abaixo)
motivo_exclusao (text)        -- 'desligado' | 'transferido' | 'sem_vinculo' | 'ba_excedida' | null
```

Regra `frequentando = true`:
- `vinculo_aberto = true` **e**
- `status_atual IN ('ativo','cadastro_incompleto')` **ou** (`status_atual = 'busca_ativa'` e `dias_em_busca_ativa <= 30`)

Todo lugar do sistema (RPCs, edge functions, telas) passa a perguntar a essa view, em vez de reimplementar a regra.

### B2. Recompute automático de status (job diário)

Edge function agendada `recompute-participantes-status` (1x/dia, madrugada). Para cada participante com `status IN ('ativo','busca_ativa')`:

| Sinal observado | Ação |
|---|---|
| Sem presença há ≥ X dias úteis (config, default 7) e status = `ativo` | vira `busca_ativa`, grava `busca_ativa_desde = hoje`, registra em `busca_ativa_registros` |
| Em `busca_ativa` há > 30 dias sem nenhuma presença | sugere `desligado` → entra em fila de aprovação da coordenação (não desliga sozinho) |
| Em `busca_ativa` e voltou a ter presença | volta para `ativo`, limpa `busca_ativa_desde` |

Limites:
- Janela X configurável em `configuracoes_gerais`.
- Nada é desligado automaticamente — só sinalizado, evita perda de dado.

### B3. Normalização de retornos (trigger)

Trigger `BEFORE UPDATE` em `participantes`:

- Quando `status` muda de `desligado`/`transferido` para `ativo`/`busca_ativa`/`cadastro_incompleto`:
  - Grava `data_retorno = now()` (nova coluna nullable).
  - **Mantém** `data_desligamento`/`data_transferencia` históricas (não apaga — viram registro de "último desligamento").
  - Garante que exista um `turma_participantes` com `data_saida IS NULL` (alerta se não houver).

Assim a UI mostra "Retornou em DD/MM" no prontuário, sem ambiguidade.

### B4. Auditoria + correção pontual

Antes de ligar o recompute automático, rodo uma **auditoria one-shot** que lista:

- Participantes com `status` ativo mas **sem vínculo aberto** em nenhuma turma.
- Participantes `desligado`/`transferido` mas com vínculo aberto.
- `busca_ativa` com `busca_ativa_desde` nulo ou antigo demais.
- `ativo` sem presença há > 30 dias.

Entrego em planilha. Coordenação revisa caso a caso. Só depois o job entra no ar.

### B5. Página de saúde no `/dev`

Card "Saúde dos vínculos" mostrando contagem dos 4 problemas acima em tempo real, com link para a planilha de auditoria. Mantém o problema visível em vez de virar dívida silenciosa.

---

## Ordem de execução

1. **Previews A e B** (lista limpa) → você aprova.
2. **Migration**: nova RPC `chamada_branco`, view `vw_participante_frequencia_status`, coluna `data_retorno`, trigger de retorno.
3. **Edge** `generate-listas-chamada-mes-gsheet` atualizada.
4. **Auditoria one-shot** entregue em planilha.
5. **Recompute job** ativado após você revisar a auditoria.
6. **Card de saúde** no `/dev`.

---

## Detalhes técnicos

Arquivos previstos:
- Migration: `vw_participante_frequencia_status`, redefinição de `get_participantes_turma` (modo `chamada_branco`), coluna `participantes.data_retorno`, trigger `trg_participantes_retorno`.
- `supabase/functions/recompute-participantes-status/index.ts` (nova, agendada).
- `supabase/functions/audit-vinculos-frequencia/index.ts` (nova, sob demanda — gera planilha).
- `supabase/functions/generate-listas-chamada-mes-gsheet/index.ts` (ajuste de `_ref_date`).
- Card de saúde em `src/pages/dev/...` consumindo a view.

Não muda: `RelatorioNovoPage.tsx`, `PresencaPage.tsx`, `participantesTurma.ts`.

## Riscos e mitigação

- **Job desligar quem voltou recentemente**: por isso o auto-desligamento é **sugestão**, não execução.
- **View pesada**: começa como view comum; se travar, vira `MATERIALIZED VIEW` com refresh a cada 15 min.
- **Trigger quebrar updates legados**: feito como `BEFORE UPDATE` defensivo, só age na transição de status — testes incluídos na migration.
