## Diagnóstico

Investiguei a edge function `generate-listas-frequencia-mes-gsheet` (linhas 218–225). O "?" só é colocado quando, para aquela data:
1. **Existe** um relatório registrado para a turma; **e**
2. **Não existe** nenhum registro de P/A/J para aquele participante.

A RPC `get_participantes_turma` hoje devolve `vinculo_saida` (corte na saída), mas **não devolve `vinculo_entrada` (data em que o participante foi vinculado à turma)**. Por isso a edge function não consegue distinguir:

- Participante que entrou na turma **depois** da data do relatório → o sistema acha que ele "faltou de marcar" e pinta "?".
- Participante que estava em **Busca Ativa** naquela data e voltou ao status `ativo` depois → mesma confusão.

Não há histórico de status `ativo ↔ busca_ativa` no banco (apenas `busca_ativa_desde` do estado atual), mas há um proxy confiável: **a primeira data em que esse participante teve algum P/A/J nesta turma** marca o início efetivo da participação. Antes disso, ele não estava operacionalmente ativo na turma, seja por vínculo recente, seja por retorno de BA.

## Solução

Introduzir um novo marcador **"/"** com semântica clara:

> **/** = participante não constava como ativo na turma nesta data (vínculo posterior à data **ou** em busca ativa no período).

### 1. RPC `get_participantes_turma`

Migração para incluir uma nova coluna no retorno:

- `vinculo_entrada date` — `tp.data_entrada` da turma_participantes.

Mantém todo o resto inalterado. Atualizar `types.ts`, `ParticipanteTurma` em `src/lib/participantesTurma.ts` e `MemberRow` na edge function para receber o campo.

### 2. Edge function `generate-listas-frequencia-mes-gsheet`

No loop de células (linhas 212–235), antes de cair no ramo de "?", calcular:

```ts
const primeiroLancamento = primeiroDiaComPAJ(m.id); // min(data) em presença para esta turma+participante (em qualquer mês)
const cutoffEntrada = m.vinculo_entrada ?? null;
const naoEstavaAtivo =
  (cutoffEntrada && dtIso < cutoffEntrada) ||
  (primeiroLancamento && dtIso < primeiroLancamento);

if (!rec) {
  if (relatorioDates.has(dtIso)) {
    if (naoEstavaAtivo) {
      arr.push(plainCell("/", inativoFmt,
        "Participante não constava como ativo nesta data " +
        "(vínculo posterior ou em busca ativa)."));
      // NÃO adiciona em pendenciasOut — não é pendência do educador.
    } else {
      arr.push(plainCell("?", pendenteFmt, nota)); // pendência real
      pendenciasOut.push(...);
    }
  } else {
    arr.push(plainCell("", semRelFmt));
  }
}
```

Para alimentar `primeiroLancamento`, ampliar a query de presenças no início da função para também buscar **todas** as presenças do participante naquela turma (não só do mês), reduzindo client-side para um `Map<participante_id, minDate>`. Custo baixo (uma única query por turma com `SELECT participante_id, MIN(data)` agrupado).

Novo estilo `inativoFmt`: fundo cinza-claro, texto cinza médio (não amarelo de pendência), para sinalizar visualmente que não é problema.

### 3. Legenda

Acrescentar ao bloco de legenda (linhas 247–258):

```
/ = Participante não constava como ativo na turma nesta data
    (vínculo posterior à data ou em busca ativa no período)
```

Manter "?" reservado para o caso legítimo: relatório existe, vínculo já estava ativo e mesmo assim o educador não marcou.

### 4. Aba de Pendências

A aba de pendências consolidadas (já gerada pela função) passa a listar **apenas "?"** — os casos "/" não viram pendência, pois são esperados.

## Validação

Regerar a planilha de Maio/2026 e conferir, no Google Drive:
- Participantes que entraram na turma depois do início do mês: dias anteriores ficam com "/" cinza.
- Participantes retornados de BA: dias anteriores ao primeiro P/A/J ficam com "/" cinza.
- Pendências reais (relatório existe, vínculo ativo, sem marcação) continuam como "?" amarelo e na aba Pendências.
- Legenda da planilha mostra a entrada nova.
