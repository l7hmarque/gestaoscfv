---
name: auto-transferencia-periodo-relatorio
description: REMOVIDA. Sistema NÃO realoca turmas automaticamente — nem por relatório, nem por mudança cadastral.
type: constraint
---
**Toda transferência automática de turma foi REMOVIDA.**

**Histórico:**
- **17/04/2026:** removida a automação que realocava participantes ao salvar relatórios com `periodo_atividade` divergente.
- **14/05/2026:** removida a "Automação 3" do perfil do participante (`ParticipantePerfilPage.tsx`) que abria dialog de transferência ao alterar bairro, período ou data de nascimento. Causava vínculos duplicados — o participante ficava na turma origem **e** na destino simultaneamente, bagunçando chamadas (5 casos limpos retroativamente em audit_log).

**Comportamento atual:**
- `periodo_atividade` no relatório é apenas informativo.
- Mudanças de bairro/período/idade no perfil **apenas atualizam o cadastro**. Nenhum vínculo de turma é alterado.
- Realocação de turma é **manual**, feita pela coordenação via fluxo explícito (`participante_transferencias` com aprovação) ou pela aba de turmas.

**Por que removidas:** a realocação automática deixava participantes em múltiplas turmas, sumia alunos quando não havia turma compatível, e fazia "vinculação compatível" puxar oficinas (ex: KARATÊ) indevidamente.
