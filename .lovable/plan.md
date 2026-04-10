

## Plano: Renomear Turmas de Karatê Duplicadas

### Situação
Existem 3 turmas com nome idêntico `KARATE - TERÇA-FEIRA - MANHA`. Duas delas têm a mesma faixa etária (9-11) mas bairros diferentes, então o nome precisa incluir faixa **e** bairro.

### Renomeações

| Turma (ID) | Nome novo |
|---|---|
| `b093ff...` (6-8, Pq. Independência) | `KARATE - TERÇA-FEIRA - MANHÃ — 6-8 — PQ. INDEPENDÊNCIA` |
| `bb9053...` (9-11, Pq. Independência) | `KARATE - TERÇA-FEIRA - MANHÃ — 9-11 — PQ. INDEPENDÊNCIA` |
| `e1420c...` (9-11, Jardim Irene) | `KARATE - TERÇA-FEIRA - MANHÃ — 9-11 — JD. IRENE` |

### Execução
3 UPDATEs na tabela `turmas` via ferramenta de inserção/atualização. Nenhuma alteração de código necessária.

