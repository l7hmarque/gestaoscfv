## Plano: Vincular Participantes Órfãos às Turmas

### Mapeamento completo (18 participantes)


| #   | Participante                          | Bairro           | Idade | Período | Turma Sugerida                      | Turma ID   |
| --- | ------------------------------------- | ---------------- | ----- | ------- | ----------------------------------- | ---------- |
| 1   | **KAROLAINE CAMILE ALVES DA CRUZ**    | PQ INDEPENDENCIA | 13    | Manhã   | PQ INDEPENDENCIA — 12-17 — Manhã    | `fcc71eb7` |
| 2   | EDUARDO FABIAN CARNEIRO DOS SANTOS    | JD IRENE         | 13    | Tarde   | JD IRENE — 12-17 — Tarde            | `881ee00c` |
| 3   | EVERTON SAMUEL DOS SANTOS             | JD IRENE         | 15    | Manhã   | JD IRENE — 12-17 — Manhã            | `89aad7a3` |
| 4   | ISABELLY VITORIA DOS SANTOS MELO      | JD IRENE         | 9     | Manhã   | JD IRENE — 9-11 — Manhã             | `82097e6d` |
| 5   | JOSE OTAVIO BARONI                    | ALVORADA         | 9     | Manhã   | ALVORADA — 9-11 — Manhã             | `5a774f7a` |
| 6   | JULIA MOURA                           | PQ INDEPENDENCIA | 14    | Tarde   | PQ INDEPENDENCIA — 12-17 — Tarde    | `c6b7aabd` |
| 7   | KAIQUE DOS SANTOS BALLMANN            | JD IRENE         | 7     | Tarde   | JD IRENE — 6-8 — Tarde              | `a03889ba` |
| 8   | KMILA RIVAS GRAU                      | JD IRENE         | 10    | Tarde   | JD IRENE — 9-11 — Tarde             | `43fb6266` |
| 9   | MARIA EDUARDA DOS SANTOS              | JD IRENE         | 11    | Manhã   | JD IRENE — 9-11 — Manhã             | `82097e6d` |
| 10  | NYCOLLAS GABRIEL DO NASCIMENTO DIAS   | JD IRENE         | 7     | Manhã   | JD IRENE — 6-8 — Manhã              | `2de44d84` |
| 11  | PEDRO HENRIQUE DE SOUZA GOMES         | JD IRENE         | 9     | Tarde   | JD IRENE — 9-11 — Tarde             | `43fb6266` |
| 12  | PIETRO HENRIQUE CARNEIRO DE ANDRADE   | JD IRENE         | 7     | Manhã   | JD IRENE — 6-8 — Manhã              | `2de44d84` |
| 13  | **RAFAEL WILLIAM DO NASCIMENTO DIAS** | JD IRENE         | **5** | Manhã   | JD IRENE — 6-8 — Manhã (provisório) | `2de44d84` |
| 14  | SOPHIA DE TOLEDO MELO                 | JD IRENE         | 7     | Manhã   | JD IRENE — 6-8 — Manhã              | `2de44d84` |


### Participantes sem turma possível (4)


| Participante                   | Problema                                                                                                                  |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| **ANTONIO MARCOS DE OLIVEIRA** | Sem bairro e sem data de nascimento — impossível determinar turma. EDIT: ESSE EU SEI QUE E DO PARQUE INDEPENDENCIA 9 A 11 |
| **GABRIEL DA SILVA MARCHETTI** | 25 anos — fora de qualquer faixa SCFV. EDIT: ELE TEM 15 ANOS FOI ERRO DIGITACAO, CORRIGIR E ATRIBUIR.                     |
| **NICOLLY GABRYELLY**          | Sem data de nascimento — impossível calcular faixa                                                                        |
| **WILFRID SCHALN**             | 60 anos (Idosos) — não existe turma de idosos no JD IRENE                                                                 |


### Execução

14 INSERTs em `turma_participantes` (participante_id + turma_id). Nenhuma alteração de schema, nenhuma exclusão de turmas de Karatê.

### Detalhes técnicos

- Cada INSERT: `INSERT INTO turma_participantes (participante_id, turma_id) VALUES (...)`
- Sem `data_saida` (vínculo ativo)
- Os 4 participantes sem turma possível serão listados ao final para decisão manual