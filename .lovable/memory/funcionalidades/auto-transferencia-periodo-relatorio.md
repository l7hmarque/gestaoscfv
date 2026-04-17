---
name: auto-transferencia-periodo-relatorio
description: REMOVIDA em 17/04/2026. Relatórios NÃO alteram vínculos turma_participantes nem o período do participante.
type: constraint
---
**REMOVIDA em 17/04/2026.**

Antes, ao salvar relatório de atividade com `periodo_atividade` diferente do período cadastrado de um participante presente, o sistema atualizava automaticamente `participantes.periodo` e movia o vínculo em `turma_participantes` para outra turma do período correto.

**Por que removida:** quando não havia turma compatível, o aluno ficava sem nenhum vínculo ativo (sumia da chamada). Também causava aparecimento de desligados em listas de presença por inconsistências relacionadas.

**Comportamento atual:** o campo `periodo_atividade` no relatório é apenas informativo. Mudanças de período do participante devem ser feitas explicitamente via perfil do participante (com aprovação da coordenação em `participante_transferencias`).
