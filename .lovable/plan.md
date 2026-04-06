## Plano: Detecção e Merge de Participantes com Nomes Similares (Typos)

### Problema

Pais digitam nomes com pequenos erros de digitação na matrícula online (ex: "ANDRE ALESANDO" vs "ANDRE ALESSANDRO"). O sistema atual só detecta duplicatas por nome **exato** + data de nascimento, então variações com 1-2 caracteres diferentes criam cadastros novos.

### Duplicatas identificadas agora no banco


| Manter (ativo/mais completo)                | Deletar (pendente/typo)                       |
| ------------------------------------------- | --------------------------------------------- |
| ANDRE ALESSANDRO DOS SANTOS RAMIREZ (ativo) | ANDRE ALESANDO DOS SANTOS RAMIREZ (pendente)  |
| ANDRE ALESSANDRO DOS SANTOS RAMIREZ (ativo) | ANDRE ALESSADRO DOS SANTOS RAMIREZ (pendente) |
| SOFIA DE LIMA SILVA (ativo)                 | SOFIA DE LI A SILVA (pendente)                |


### Solução: 2 partes

#### Parte 1 — Merge imediato das duplicatas conhecidas (SQL)

Migração SQL que:

- Transfere vínculos (turma_participantes, presenca, participante_documentos, atendimentos, relatorio_presenca) dos registros typo para o registro correto
- Deleta os registros duplicados

#### Parte 2 — Painel de "Possíveis Duplicatas" na listagem de participantes

Adicionar na `ParticipantesPage.tsx` um alerta/seção que mostra pares de participantes com **mesma data de nascimento** e **nome similar** (distância de Levenshtein ≤ 3 ou similaridade trigram ≥ 0.4).

**Implementação:**

- Criar uma função SQL `find_similar_participants()` que usa `pg_trgm` (extensão de trigramas do Postgres) para encontrar pares de participantes com mesma `data_nascimento` e `similarity(nome_completo, nome_completo) > 0.4`
- Na UI, exibir um banner "X possíveis duplicatas encontradas" com botão para expandir
- Cada par mostra os dois nomes lado a lado com botões: **"Mesclar →"** (mantém o da esquerda, transfere vínculos, deleta o da direita) e **"Ignorar"**
- A ação de merge chama uma Edge Function `merge-participantes` que faz o merge server-side com service_role

#### Parte 3 — Prevenção: busca fuzzy na matrícula online

Melhorar o `public-check-participante` para, além da busca exata, fazer uma busca por similaridade quando a busca exata não encontrar resultado. Se encontrar nome com similarity > 0.6 e mesma data de nascimento, retornar como sugestão de rematrícula.

### Arquivos afetados


| Arquivo                                                 | Alteração                                                                                     |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Migração SQL                                            | Merge dos 3 pares conhecidos + habilitar `pg_trgm` + criar função `find_similar_participants` |
| `supabase/functions/merge-participantes/index.ts`       | Nova Edge Function para merge seguro                                                          |
| `src/pages/participantes/ParticipantesPage.tsx`         | Banner de duplicatas + UI de merge                                                            |
| `supabase/functions/public-check-participante/index.ts` | Busca fuzzy como fallback                                                                     |


### O que NÃO muda

- Fluxo normal de matrícula, aprovação e gestão de participantes continua idêntico
- Nenhuma tabela existente é alterada estruturalmente
- O merge só acontece por ação manual do coordenador (exceto os 3 pares já confirmados)  
  
Poderia mudar uma copisa no fluxo da matricula, solicitar nome e data de nascimento antes de abrir os campos pra preencher as demais opcoes, assim o sistema ja busca a similaridade no sistema com as duas informacoes e solicita ao usuario confirmacao de que se trata daquele participante. Se o usuario confirma, abrem os campos pra preenchimento das demais informacoes.