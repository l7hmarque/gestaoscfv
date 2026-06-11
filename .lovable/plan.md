
## Garantia de integridade — Sistema de Relatórios + Frequências

Plano em 4 ondas. Tudo aditivo, validado no preview, e só publicado em `Update` após você aprovar cada etapa.

---

### Princípio de integridade (regra de ouro)

Para qualquer participante **P**, turma **T**, data **D**:
> Se existe relatório de **T** em **D** e **P** estava ativo em **T** naquela data (entre `data_entrada` e `data_saida`, e não bloqueado retroativamente), **deve existir exatamente um registro** em `relatorio_presenca` com `presente ∈ {true, false}` e `justificativa` opcional.

Tudo abaixo serve para garantir, detectar e corrigir desvios dessa regra — sem nunca inventar dado.

---

## Onda A — Auditoria e visibilidade (read-only, sem risco)

**A.1 RPC `auditar_integridade_presencas(_de, _ate)`** — retorna 4 listas:
- `pares_duplicados`: (turma, data) com 2+ relatórios
- `presencas_faltantes`: (turma, data, participante) ativos sem registro
- `presencas_orfas`: registros de participantes que não estavam ativos naquela data
- `relatorios_sem_turma` e `relatorios_sem_presenca`

**A.2 Página `/coordenacao/auditoria-presencas`** (somente coordenação)
Tabela navegável dos 4 grupos, com botões "ver relatório", "ver turma", "ver participante". Sem ações destrutivas — só diagnóstico.

**A.3 Histórico carimbado**
Adicionar coluna `validado_em timestamptz` em `relatorios_atividade` (NULL = não revisado). Servirá para Onda C.

---

## Onda B — Exportação fiel (Opção 2)

**B.1 Função `generate-listas-frequencia-mes-gsheet`**
- Para cada célula vazia, classificar o motivo:
  - `"—"` (cinza) → participante não estava na turma na data, ou bloqueado_chamada
  - `"?"` (amarelo) → relatório existe, participante ativo, mas SEM registro → pendência real
  - `vazio` → não há relatório para essa data (educadora não lançou nada no dia)
- Cada `?` vira nota na célula: "Pendente: revisar com o(a) educador(a)"

**B.2 Aba extra "Pendências"** no mesmo spreadsheet
Lista (Turma, Participante, Data, Motivo). Se zero pendências, aba não é criada.

**B.3 Aba extra "Auditoria"**
Resumo: total de células P/A/J/?/—, relatórios duplicados detectados (com link), datas sem relatório por turma.

**B.4 Mesma lógica replicada** em `generate-lista-frequencia-gsheet` (turma única) e nas exportações DOCX/PDF/XLSX de presença.

---

## Onda C — Prevenção na criação de relatórios (Opção 3)

**C.1 Bloqueio de duplicata na UI** (`CriarRelatorio`, `EditarRelatorio`)
Ao escolher turmas + data, consultar se já existe relatório para qualquer dessas combinações. Se existir:
- Mostrar aviso com link para o relatório existente
- Oferecer 3 opções: **Abrir o existente**, **Mesclar este com o existente** (preserva presenças já lançadas e adiciona as novas), **Criar mesmo assim** (com justificativa obrigatória registrada em `audit_log`)

**C.2 Chamada completa obrigatória**
Ao abrir a tela de presença, carregar **todos os participantes ativos da turma na data do relatório** (via RPC `get_participantes_turma`). Cada um com 3 botões: P / A / J. Botão "Salvar" só habilita quando todos têm status. "Salvar como rascunho" permitido para sair e voltar, mas relatórios em rascunho ficam destacados na listagem como "incompletos".

**C.3 Trigger de integridade no banco** (`relatorios_atividade.iniciado_em`)
Ao marcar relatório como `finalizado_em` (novo campo), validar que toda participação ativa da turma está em `relatorio_presenca`. Se faltar, bloquear com erro claro: "Faltam X participantes sem marcação".

**C.4 Auto-reconciliação ao adicionar/remover participante**
Quando participante é transferido/desligado/adicionado a uma turma com `data_entrada > X`, ajustar `bloqueado_desde` automaticamente para preservar a fidelidade do histórico (já feito parcialmente — vou completar).

---

## Onda D — Reconciliação do histórico (com aprovação humana)

**D.1 Painel `/coordenacao/reconciliacao-presencas`**
Lista os 18 pares duplicados de Maio (e qualquer outro detectado). Para cada par:
- Mostra os dois relatórios lado a lado: participantes em cada um, presenças marcadas, autor, data de criação
- 3 ações: **Mesclar** (consolida em um único relatório, preserva todas as presenças, soft-delete do outro com motivo registrado), **Manter ambos** (assume que eram intervenções legítimas distintas — registra decisão em audit), **Excluir um** (com justificativa obrigatória)

**D.2 Para `presencas_faltantes`**
Painel mostra (Turma × Data × Participante). Coordenação tem 3 opções por linha: marcar **A** com nota "Lançado retroativo pela coordenação", marcar **J** com justificativa, ou marcar como **N/A** (participante estava ausente justificadamente do território — não conta nem como A nem como P). Toda decisão gera entrada em `audit_log` com `decidido_por` e `motivo`.

**D.3 Garantia "nunca apagar dado real"**
Nenhuma ação D destrói presença já lançada. Mesclar = união, não substituição. Exclusão = soft-delete (`deleted_at`, `deleted_by`, `deleted_motivo`) — relatório some das telas mas é recuperável.

---

## Garantias técnicas de integridade

| Risco | Mitigação |
|---|---|
| Lançamento incompleto | Onda C.2 + C.3 (bloqueio em banco) |
| Relatório duplicado | Onda C.1 (bloqueio na UI) + Onda D.1 (limpeza histórico) |
| Célula em branco "silenciosa" | Onda B.1 (passa a sinalizar `?` com nota) |
| Participante transferido aparece como ausente errado | Onda C.4 (`bloqueado_desde` automático) |
| Dado real perdido em correção | Onda D.3 (soft-delete + audit_log obrigatório) |
| Falha de paginação Supabase | Já corrigido na última iteração (validado: 1.980 presenças) |
| Educadora corrige tarde | `validado_em` + tela mostra "Última revisão: X" |

---

## Ordem de execução e validação

1. **Onda A** primeiro (read-only, 0 risco). Mostro relatório de Maio antes/depois com tabela completa.
2. **Onda B** em paralelo (só a função de exportação). Geramos planilha de Maio e comparamos a atual lado a lado.
3. **Onda C** com flag `bloqueio_chamada_completa` em `configuracoes_gerais` (você liga quando quiser começar a exigir).
4. **Onda D** apenas após você usar a auditoria da Onda A e confirmar os casos a tratar.
5. Cada onda passa pelo seu preview antes de `Update`.

---

## O que NÃO vou fazer (compromissos)

- Não vou marcar ninguém como "A" automaticamente sem decisão humana.
- Não vou deletar relatório existente — só soft-delete com motivo.
- Não vou alterar `relatorio_presenca` em massa sem você aprovar registro a registro.
- Não vou mudar lógica de KPIs/indicadores nesta fase (isso ficará na Onda 2 do plano maior, já combinada).

---

## Aprovação solicitada

Posso começar pela **Onda A** (auditoria, sem mexer em nada) já neste push? Assim você vê a foto real do banco antes de decidirmos qualquer correção. Se aprovar, sigo direto para B em seguida.
