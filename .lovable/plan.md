## Leitura dos 78 comentários do Sheets

Consegui extrair todos via Drive Comments API. Eles caem em **5 grupos** distintos. Boa parte do grupo 4 (vínculos duplicados / participantes ausentes do mês) **já foi resolvida** pela migração anterior (`data_entrada`/`data_saida` + higienização dos 78 duplicados). Falta resolver o resto.

---

### Grupo 1 — Aba **Atividades** (2 colunas com lógica errada)

- **"Atividades Propostas"**: hoje está vazia/parcial. Deve listar **todos** os planejamentos do mês (`planejamentos` com `data_planejada` no mês, independentemente de terem virado relatório).
- **"Atividades Desenvolvidas"**: hoje só traz o **título** do relatório. Deve trazer **descrição breve até 250 caracteres** (campo `descricao_atividade` ou equivalente do `relatorios_atividades`).
- Total **364/440** ao final precisa recálculo após corrigir as duas colunas acima.

### Grupo 2 — Aba **Metas** (3 células com **43%**)

- Os 3 valores de "% atingido" estão errados — provavelmente usando denominador anual em vez do **mensal** (ou vice-versa). Revisar fórmula em `generate-relatorio-mensal/index.ts` na seção Metas.

### Grupo 3 — Aba **Monitoramento** (3 valores de "Atendidos por bairro")

- 113 / 125 / 126 hoje contam **registros de presença**. Devem contar **participantes únicos com ≥1 presença no mês** (`COUNT(DISTINCT participante_id) WHERE presente=true AND mês`).

### Grupo 4 — Listas de frequência por turma (~65 comentários)

Padrões observados:


| Padrão do comentário                                                      | Causa raiz                                                                           | Status                                                                                                    |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| "nenhuma presença antes do dia 09/04?" (≈25x)                             | participante entrou na turma no meio do mês, mas a matriz não diferencia visualmente | **falta fix visual**                                                                                      |
| "participante repetido em 2 turmas" (4x)                                  | vínculos duplicados                                                                  | **resolvido** (78 higienizados)                                                                           |
| "verifique se já estava inserido em abril" (≈20x)                         | sem `data_entrada` antes da migração                                                 | **resolvido** retroativamente, mas precisa **relatório de auditoria** para a coordenação validar os casos |
| "preencher células anteriores ao dia X/04 em cinza claro" (3x explícitos) | pedido visual recorrente                                                             | **falta implementar**                                                                                     |
| Aba inteira sem nenhuma presença                                          | turma sem chamadas no mês                                                            | **falta marcar visualmente** ("Sem chamadas no período")                                                  |
| "tenho certeza que veio mas não tem presença" (≈5x)                       | falha de lançamento de chamada — não é bug de software                               | gerar **lista de auditoria** para coordenação                                                             |


**Fix visual proposto** (uma única regra que resolve a maioria dos comentários do grupo):

- Para cada participante na matriz, pintar de **cinza claro** (`#E5E7EB`) toda célula cuja **data da chamada < `data_entrada**` ou **> `data_saida`/`data_desligamento**`.
- Acrescentar legenda no topo: "■ presente · vazio = ausente · cinza = ainda não estava matriculado / já desligado · — sem aula" ; BA = Busca Ativa; D = Desligado"
- Quando a turma não tem **nenhuma** presença no mês, render um aviso "Sem chamadas registradas no período" no topo da aba (em vez de matriz totalmente vazia).

### Grupo 5 — Auditoria operacional (saída)

Como suporte aos comentários "verifique X", gerar um **anexo XLSX de auditoria** dentro do mesmo arquivo (nova aba **"Auditoria — Pendências"**) listando automaticamente:

1. Participantes com `data_entrada` no mês corrente (entradas novas).
2. Participantes com `data_saida` no mês corrente (saídas/transferências/higienizações).
3. Participantes com **0 presenças** no mês mas vínculo ativo o mês todo (candidatos a busca ativa / desligamento não registrado).
4. Turmas com **0 chamadas** no mês.
5. Participantes ainda com nome aparecendo em >1 aba do mês (sanidade pós-higienização — espera-se 0).

Isso entrega um diagnóstico objetivo para a coordenação revisar caso a caso, em vez de o documento ficar com ambiguidade visual.

---

## Implementação

### 1. `supabase/functions/generate-relatorio-mensal/index.ts`

- **Atividades** — query nova: `planejamentos` do mês para coluna "Propostas"; `relatorios_atividades.descricao_atividade` truncada a 250 chars para "Desenvolvidas".
- **Metas** — corrigir denominador (usar meta mensal, não anual) e recálculo do total `364/440`.
- **Monitoramento** — `COUNT(DISTINCT participante_id)` filtrado por `presente=true` e mês.
- **Matrizes de frequência por turma**:
  - manter o filtro já implementado (`data_entrada < endDate && (!data_saida || data_saida >= startDate)`);
  - **adicionar coloração cinza** nas células fora da janela de vínculo (usar `xlsx-js-style` `fill: { fgColor: { rgb: "E5E7EB" } }`);
  - se `datasComChamadas.length === 0`, renderizar 1 linha com "Sem chamadas registradas neste mês" e pular a matriz;
  - atualizar a legenda no topo da aba.
- **Nova aba "Auditoria — Pendências"** com as 5 listas do Grupo 5.

### 2. `src/lib/listaFrequencia.ts` e `supabase/functions/generate-reo/index.ts`

Aplicar a mesma coloração cinza nas matrizes geradas por estes dois caminhos (DOCX/PDF/XLSX), para consistência com o REO e listas avulsas.

### 3. Validação

- Re-exportar Abril/2026 e conferir contra os 78 comentários originais (espera-se que ≥90% se resolvam visualmente ou apareçam na nova aba de Auditoria).
- Comparar totais de Metas e Monitoramento com o `monthly_dashboard_metrics` da coordenação.

---

## O que **não** vou fazer

- Marcar manualmente cada um dos ~50 participantes citados — a higienização já foi feita; o que falta é a coordenação revisar a aba de Auditoria.
- Mudar a cor padrão do "presente" (■) ou a tipografia institucional.
- Tocar em cores/temas globais — o cinza E5E7EB já está alinhado com a paleta cold gray do sistema.