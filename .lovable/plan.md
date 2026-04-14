## Plano: Importação de frequência de Março + transferências de período + desligamentos

### Resumo do PDF analisado

O documento contém listas de presença de **março/2025** para 3 bairros (Jardim Irene, Parque Independência, Alvorada) com ~80 participantes e datas específicas de presença. Também lista 4 desligados. Atualmente **zero** registros de presença existem para março no banco.

### Mapeamento de períodos (lógica de continuidade)

Seguindo a regra de "continuidade da lista anterior":

**Seções com período explícito:** JD Irene 9-11 Tarde, JD Irene 9-11 Manhã, JD Irene 12-17 Manhã, PQ Indep 6-8 Manhã, Alvorada 12-17 Tarde, Alvorada 6-8 Manhã.

**Seções por continuidade → Manhã:** JD Irene 12-17 complementar, JD Irene lista complementar, PQ Indep 9-11 principal/complementar, PQ Indep 12-17/complementar.

**Seções por continuidade → Tarde (após "Alvorada 12-17 Tarde"):** Alvorada 12-17 Quinta.

**Seção ambígua:** Alvorada 9-11 (primeira lista, sem dia/período). Todos os 8 participantes estão cadastrados como "tarde". Se for continuidade do PQ Indep, seria "manhã" e todos precisariam transferência. Se for uma lista independente do turno da tarde, mantém. **Idem para Alvorada 9-11 Quarta** (todos manhã).

### Transferências de período identificadas (~35 participantes)


| Grupo                                                            | De → Para     | Qtd                 |
| ---------------------------------------------------------------- | ------------- | ------------------- |
| JD Irene lista complementar (Daniely, Deivid, Isabelli, Willian) | tarde → manhã | 4                   |
| PQ Indep 9-11 principal + complementar                           | tarde → manhã | 13                  |
| Alvorada 9-11 primeira lista (Andre, Isabela, etc.)              | tarde → manhã | 8 (se continuidade) |
| Alvorada 12-17 Quinta (Damaris, Daniela, Edgar, etc.)            | manhã → tarde | 10                  |


### Participantes pendentes que precisam ativação

- **Pedro Henrique de Souza Gomes** (pendente) — aparece com presença
- **Sophia de Toledo Melo** (pendente) — aparece com presença

### Participantes desligados no PDF

Os 4 (Emilly, Davi Henrique, Maria Laura, Maria Vitória) **já constam como desligados**. Verificar que não tenham presença registrada e excluir de quaisquer cálculos de indicadores.

Também: **Lais Vitória** e **Sofia Fonseca** (PQ Indep 12-17) e **Agatha** estão desligadas — ignorar presenças dessas (conforme decisão anterior).

### Etapas de execução

1. **Script Python** que:
  - Mapeia todos os ~80 nomes do PDF aos IDs do banco via fuzzy match
  - Para cada participante com presença: INSERT em `presenca` (turma correspondente, data, presente=true)
  - Para participantes ativos **sem presença** nas datas de atividade da sua turma: INSERT com presente=false (ausência)
  - Desligados e inativos: **nenhum registro** de presença (nem falta)
2. **Ativar pendentes** (Pedro Henrique e Sophia) — UPDATE status para 'ativo', vincular a turmas
3. **Transferências de período** — Para cada participante com período diferente:
  - UPDATE `participantes.periodo`
  - Preencher `data_saida` nas turmas antigas
  - INSERT em turmas do novo período
  - INSERT em `participante_transferencias`
4. **Verificação final** — Conferir contagens e indicadores

### Pergunta pendente

Preciso confirmar: a lista "Alvorada 9-11" (sem período/dia, participantes: Andre, Isabela, Isabelle, João Rafael, Kaua, Laura, Luana, Maico — todos cadastrados como "tarde") é uma lista do turno da **manhã** (continuidade do PQ Independência) ou do turno da **tarde** (lista própria)?  
R: lista propria, periodo da tarde.

E a "Alvorada 9-11 Quarta" (Caio, Carlos, Emeli, José Otávio, Victor Hugo, Yuri — todos cadastrados como "manhã") é manhã ou tarde?  
R: Manha