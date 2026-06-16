## Problema

Na planilha de Listas de Frequência Preenchidas (Maio/2026 e demais meses), abas de cada turma trazem linhas com "?" em várias datas. Hoje a regra do `get_participantes_turma` (modo `frequencia`) inclui todo participante cujo vínculo `turma_participantes` tenha qualquer interseção com o mês — mesmo que `data_saida` seja antes do 1º dia do mês ou que ele nunca tenha presença lançada.

Resultado: aparecem na lista pessoas que já não pertenciam à turma e linhas inteiras com colunas "?" sem motivo institucional (sem desligamento, sem transferência registrada).

## Decisão de comportamento

Aplicar 3 regras combinadas, que valem para **todos os geradores** que usam a RPC `get_participantes_turma` em modo `frequencia` (Google Sheets mensal, DOCX/PDF/XLSX em `listaFrequencia.ts`, e a versão preview):

1. **Excluir quem saiu antes do mês** — se `tp.data_saida` existir e for `< primeiro_dia_do_mês`, não aparece.
2. **Suprimir "?" fora do período de vínculo** — quando existir `tp.data_saida` dentro do mês, células de datas posteriores a essa saída viram "—" (cinza, sem aula), em vez de "?".
3. **Remover linhas totalmente vazias** — se um participante terminou com **nenhum** P/A/J no mês inteiro e **não tem marcador institucional** ((BA), (Desligado), (Transferido)), a linha é omitida do arquivo gerado. Pessoas com marcador continuam aparecendo (bloqueadas/cinza) mesmo sem lançamentos.

## Implementação

### Camada de banco — RPC `get_participantes_turma`

Migration alterando a função (mode `frequencia` apenas):

- No CTE `base`, devolver também `tp.data_saida` como `vinculo_saida`.
- Trocar o filtro de janela para:
  ```
  tp.data_entrada <= v_last
  AND (tp.data_saida IS NULL OR tp.data_saida >= v_first)
  ```
  (já é assim — mantém)
- Adicionar coluna de saída do retorno: `vinculo_saida date`.
- Regra de `bloqueado_desde`: passar a usar `LEAST(bloqueado_desde_existente, vinculo_saida + 1)` quando `vinculo_saida` cair dentro do mês, para que o "—" comece logo após a saída.
- Não alterar `chamada_branco`.

Atualizar `src/integrations/supabase/types.ts` (regerado) e `participantesTurma.ts` para tipar `vinculo_saida`.

### Edge function `generate-listas-frequencia-mes-gsheet`

Em `buildTurmaSheet` (linhas ~185-229):

1. **Filtro de saída pré-mês**: a RPC já cuida com o filtro `>= v_first`. Sem mudança.
2. **Bloqueio por `vinculo_saida`**: tratar `vinculo_saida` como bloqueio adicional. Em vez de só `bloqueado_chamada`, calcular `cutoff = bloqueado_desde ?? (vinculo_saida + 1d)`. Para `dtIso >= cutoff`, renderizar "—" sem gerar pendência.
3. **Drop de linhas vazias**: após montar `ordered`, percorrer e calcular para cada `m`:
   - `temLancamento` = existe algum `presencasMap[m.id][dt]` no mês;
   - `temMarcador` = `m.marcador` não-vazio (BA / Desligado / Transferido);
   - se `!temLancamento && !temMarcador` → descartar a linha (e não emitir pendências para ela).
4. Recalcular numeração sequencial após o filtro.

### `src/lib/listaFrequencia.ts`

Mesma lógica do (2) e (3) acima em `carregarDadosTurma`:
- Calcular `temLancamento` por participante via `presData`.
- Filtrar `elegiveis` removendo quem `!temLancamento && !marcador && !bloqueado_chamada`.
- Repassar `vinculo_saida` ao `celulaPresenca` para forçar `—` em datas pós-saída.

Pequena extensão em `marcadoresFrequencia.celulaPresenca`: aceitar `vinculoSaida` opcional; se a data for posterior, retorna `MARCADOR_BLOQUEADO`.

### Edge `generate-listas-frequencia-mes-preview-gsheet`

Mesmo tratamento (gera o mesmo HTML/preview a partir da mesma RPC). Aplicar o filtro de linhas vazias e o cutoff por `vinculo_saida`.

### Pendências reportadas

Hoje o array `pendenciasOut` recebe entradas para cada "?" gerado. Com as novas regras:
- Não criar pendência para datas após `cutoff`.
- Não criar pendência para participantes que serão omitidos por estarem totalmente vazios + sem marcador.

## Não muda

- Lista de Chamada em branco (`chamada_branco`) continua igual: só `ativo` + `busca_ativa` ≤30d.
- Marcadores (BA), (Desligado), (Transferido) continuam aparecendo conforme regra atual da RPC.
- Janela de 30 dias de visibilidade de desligados não é alterada.

## Como validar depois da implementação

1. Regenerar a planilha de Maio/2026 pelo /documentos.
2. Conferir nas abas:
   - Participantes com `tp.data_saida < 2026-05-01` não aparecem mais.
   - Participantes desligados/transferidos no meio do mês aparecem com "—" a partir do dia seguinte à saída.
   - Linhas com "?" em todas as colunas (zero lançamentos e sem marcador) sumiram.
3. Conferir que pendências exportadas só listam casos legítimos (educador esqueceu de marcar alguém ainda ativo).
