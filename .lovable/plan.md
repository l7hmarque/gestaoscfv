

## Auditoria — pontos a corrigir

Rodei uma varredura completa de integridade. Encontrei **13 categorias de problemas**, agrupados por criticidade:

### 🔴 Críticos (afetam dashboard/relatórios)

| Item | Qtd | Impacto |
|---|---|---|
| **Turmas ativas sem educador** | 18 | Relatórios desses grupos caem em fallback de coordenação, distorcendo "Top Educadores" e responsabilidade pedagógica |
| **Período divergente turma↔participante** | 18 | Participante cadastrado como "Manhã" mas vinculado a turma "Tarde" (e vice-versa). Quebra REO, lista de presença e cronograma |
| **Desligados sem data_desligamento** | 9 | Não entram em métricas de retenção, REO e relatório de gestão |
| **Desligados sem motivo** | 9 | Viola política de auditoria (motivo é obrigatório) |

### 🟡 Médios (qualidade de dados)

| Item | Qtd | Impacto |
|---|---|---|
| **Participantes ativos sem `iniciou_em`** | 11 | Quebra a métrica de "Novas Inserções" do relatório mensal e o novo delta de Participantes Ativos |
| **Planejamentos sem turma vinculada** | 15 | Não aparecem na agenda da turma e não geram ranking ELO por planejamento |
| **Turmas ativas sem participantes** | 2 | Inflam `totalTurmasAtivas` no dashboard sem produzir atividade |
| **Participantes ativos sem data de nascimento** | 2 | Saem da distribuição por faixa etária |
| **Profile sem role** | 1 | Usuário não consegue acessar nada (sem permissão atribuída) |

### 🟢 Observações (não-bloqueantes)

- **Abril/2026**: só 12 relatórios reais até agora. Mês ainda em curso, mas vale acompanhar.
- **Março/2026**: 100% dos 156 relatórios são sintéticos (consolidados de chamada física). Educadores reais não produziram relatório nenhum no mês — pode indicar problema de adoção ou que os relatórios foram lançados em outro lugar.

---

## Plano de correção em 3 ondas

### Onda 1 — Correções automáticas seguras (SQL direto)
1. **Preencher `iniciou_em` ausente**: usar `created_at::date` como fallback nos 11 participantes (já é o que o RPC faz internamente).
2. **Vincular educador titular nas 18 turmas sem educador**: quando a turma tiver relatórios reais recentes, pegar o `educador_id` mais frequente. Quando não tiver, listar para você atribuir manualmente.
3. **Desativar 2 turmas vazias** (ou listar para revisão sua antes de desativar).
4. **Atribuir role padrão "educador"** ao 1 profile órfão (ou listar nome para você decidir).

### Onda 2 — Reconciliação assistida (gera XLSX para revisão humana)
Gerar **`SysCFV_AuditoriaIntegridade_2026-04.xlsx`** com 4 abas:
- **Periodo_Divergente** (18) — participante, período cadastro, turma atual, período da turma → você decide: muda o cadastro ou troca a turma.
- **Desligados_Incompletos** (9) — você preenche data + motivo de cada um.
- **Planejamentos_Sem_Turma** (15) — quais vincular a quais turmas.
- **Sem_Data_Nascimento** (2) — você completa.

### Onda 3 — Refinos preventivos (código)
Para evitar reincidência:
1. **Validação no formulário de novo participante**: tornar `iniciou_em` obrigatório (default = hoje).
2. **Validação no desligamento**: já existe diálogo, mas garantir que `data_desligamento` seja sempre setado ao mudar status.
3. **Trigger de coerência período↔turma**: ao mudar o período do participante, alertar se turmas vinculadas têm período diferente (já existe parcialmente — reforçar).
4. **Banner no dashboard de coordenação**: mostrar contador de "X pendências de integridade" linkando para um painel de correção (similar ao banner de duplicatas).

---

## Decisão necessária

Vou perguntar 2 pontos via `ask_questions` antes de executar:

1. **Onda 1 — execução automática**: posso (a) executar todas as correções automáticas seguras de uma vez, ou (b) prefere ver XLSX preview antes?
2. **Turmas sem educador (18)**: (a) tentar inferir pelo educador mais frequente nos relatórios da turma, (b) deixar todas para atribuição manual via XLSX, ou (c) atribuir um perfil "Coordenação" temporário e marcar para revisão?

