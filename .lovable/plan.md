## Diagnóstico

Investigando a função `generate-relatorio-mensal/index.ts` (matrizes de frequência, linhas 312-348) e o schema de `turma_participantes`, encontrei **duas causas distintas**:

### Causa 1 — Nomes em duas turmas

A query monta a lista de cada turma assim:

```ts
const tpIds = turmaParticipantes
  .filter(tp => tp.turma_id === t.id)
  .map(tp => tp.participante_id);
```

Não há nenhum filtro por `data_saida`. Verificando o banco:

- A tabela `turma_participantes` tem coluna `data_saida` (nullable) — quando preenchida indica que o vínculo foi encerrado.
- **77 participantes hoje têm 2 vínculos ativos simultâneos** (`data_saida IS NULL` em duas turmas). Provavelmente vieram de transferências aprovadas onde o vínculo antigo não recebeu `data_saida`, ou de re-matrículas.

Resultado: o mesmo aluno aparece em duas matrizes do mesmo mês.

### Causa 2 — Participantes que entraram em maio na lista de abril

O único filtro temporal existente é:

```ts
.filter(p => !p.created_at || p.created_at < endDate)
```

Isso usa `participantes.created_at` (criação do **cadastro do participante**), não a data em que ele foi **matriculado na turma**. A tabela `turma_participantes` **não possui `created_at` nem `data_entrada**`, então hoje é impossível saber se o vínculo existia em abril.

Casos típicos que causam o bug:

- Participante cadastrado em fev, vinculado a uma turma só em maio → aparece em abril.
- Participante transferido em maio para outra turma → aparece naquela turma já em abril.

---

## Solução proposta

### Passo 1 — Adicionar `data_entrada` em `turma_participantes` (migração)

```sql
ALTER TABLE turma_participantes
  ADD COLUMN data_entrada date NOT NULL DEFAULT CURRENT_DATE;
```

Backfill conservador para os vínculos existentes: usar `participantes.created_at` como melhor estimativa (ou `2026-01-01` para todos os pré-existentes — o usuário decide).

Atualizar todos os pontos do código que fazem `INSERT` em `turma_participantes` (matrícula pública, transferências, novo participante, importação) para gravar `data_entrada = CURRENT_DATE` (já é o default, então só precisa garantir que ninguém esteja sobrescrevendo).

### Passo 2 — Corrigir a função `generate-relatorio-mensal`

No bloco da matriz de frequência (linha ~312), trocar:

```ts
const tpIds = turmaParticipantes
  .filter(tp => tp.turma_id === t.id)
  .map(tp => tp.participante_id);
```

por:

```ts
const tpIds = turmaParticipantes
  .filter(tp =>
    tp.turma_id === t.id &&
    (!tp.data_entrada || tp.data_entrada < endDate) &&
    (!tp.data_saida   || tp.data_saida   >= startDate)
  )
  .map(tp => tp.participante_id);
```

E remover o filtro frágil `participantes.created_at < endDate` da linha 314 (passa a ser redundante).

Isso resolve simultaneamente:

- **Duas turmas**: se o aluno foi transferido em 02/maio, em abril o vínculo antigo ainda estava ativo (`data_saida >= startDate`) e o novo ainda não existia (`data_entrada >= endDate`) → aparece só na turma certa.
- **Entrou em maio**: `data_entrada` do vínculo será maio, filtrado fora de abril.

### Passo 3 — Aplicar o mesmo filtro em outras superfícies

Os mesmos critérios devem ser usados em:

- `src/lib/listaFrequencia.ts` (carrega `turma_participantes` para listas individuais — hoje só filtra por `participantes.created_at`).
- `supabase/functions/generate-reo/index.ts` (lista de presença do REO — verificar e alinhar).
- Qualquer outro lugar que renderize chamadas/frequências históricas.

### Passo 4 — Higienização dos 77 vínculos duplicados existentes

Script de coordenação (uma só vez): para cada participante com 2 vínculos `data_saida IS NULL`, manter o mais recente (heurística: maior `id` ou último `relatorio_presenca` que o citou) e marcar `data_saida` no(s) outro(s) com a data da transferência aprovada (ou o início do mês corrente).

Posso entregar isso como um botão no painel de Coordenação ("Higienizar vínculos duplicados") ou como uma migração única.

---

## Detalhes técnicos

- A migração adiciona `data_entrada` (NOT NULL DEFAULT CURRENT_DATE) — não quebra inserts existentes.
- O backfill será feito com `UPDATE turma_participantes tp SET data_entrada = COALESCE(p.created_at::date, '2026-01-01') FROM participantes p WHERE p.id = tp.participante_id`.
- Após a migração, redeployar `generate-relatorio-mensal` e `generate-reo`.
- Nenhuma alteração de UI é necessária para o relatório mensal — só corrige a lógica.

---

## Pergunta antes de implementar

Posso confirmar os 4 passos? Especificamente:

1. Backfill de `data_entrada` = `participantes.created_at` (estimativa) ou data fixa `2026-01-01`? BACKFILL DE DATA ENTRADA = PARTICIPANTES.CREATED_AT
2. Os 77 duplicados — você quer que eu rode a higienização automaticamente ou só listar para revisão manual? AUTO