---
name: Vinculação Lógica em Turmas
description: Auto-vínculo via bairros + idade, detecção (sem transferência automática) de participantes fora da faixa etária
type: feature
---

## Faixas etárias oficiais

- 6 a 8 anos → `6-8`
- 9 a 11 anos → `9-11`
- 12 a 17 anos → `12-17`
- 60 anos ou mais → `idosos`
- 18-59 → fora do SCFV (sem faixa)

## Auto-vínculo (apenas ADIÇÃO)

`recalcular_vinculos_turmas()` adiciona participantes ativos em turmas compatíveis por bairro + período + faixa. **Nunca remove vínculos.** A função em `TurmaNovaPage` (criar/gerar lote) também filtra por `calcFaixaFromDate` antes de vincular.

## Detecção de fora da faixa (sem transferência automática)

Quando um participante faz aniversário e muda de faixa (ex.: 11→12), o vínculo antigo NÃO é alterado automaticamente. O sistema apenas DETECTA e AVISA:

- **View `vw_participantes_fora_faixa`**: lista vínculos ativos cuja faixa não bate com a idade atual.
- **RPC `contar_participantes_fora_faixa()`**: retorna `{ total, vinculos, por_faixa }` para badges.
- **Aviso em `/coordenacao` (Ações Pendentes)**: `FilaItem` com link para `/turmas/fora-faixa`.
- **Badge no `TurmaDetalhePage`**: contador "N fora da faixa" no header + badge "{idade}a · fora" inline na linha do participante.
- **Página `/turmas/fora-faixa`**: tabela revisável com filtros e ações **manuais** por linha:
  - **Transferir** para turma compatível (encerra vínculo antigo, cria novo, registra em `participante_transferencias`).
  - **Remover** vínculo (soft: `data_saida` + `motivo_saida = "Fora da faixa etária ..."`). Participante NÃO é desligado.

## Regra inviolável

**Nenhuma transferência ou remoção de vínculo acontece sem ação humana explícita.** Conforme `auto-transferencia-periodo-relatorio`, transferências automáticas em massa já causaram bagunça e são proibidas.