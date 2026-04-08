

## Plano: Turma unificada com múltiplas faixas etárias e bairros

### Problema atual
O campo `faixa_etaria` (enum único) e `bairro_id` (UUID único) na tabela `turmas` só suportam um valor cada. Por isso, ao marcar várias opções no formulário individual, o sistema cria uma turma separada por combinação.

### Solução

**1. Migração de banco de dados**
- Adicionar coluna `faixas_etarias text[]` na tabela `turmas` (array de faixas)
- Adicionar coluna `bairro_ids uuid[]` na tabela `turmas` (array de bairros)
- Manter as colunas originais (`faixa_etaria`, `bairro_id`) para compatibilidade com turmas existentes e com a geração em lote

**2. Formulário individual (`TurmaNovaPage.tsx`)**
- No `handleSubmit`, criar apenas UMA turma, salvando as faixas selecionadas em `faixas_etarias[]` e os bairros selecionados em `bairro_ids[]`
- Preencher `faixa_etaria` e `bairro_id` com o primeiro valor de cada array (compatibilidade)

**3. Exibição nas páginas**
- `TurmasPage.tsx`: exibir múltiplas badges de faixa etária e bairro quando existirem os arrays
- `TurmaDetalhePage.tsx`: exibir todas as faixas/bairros, e na edição permitir alterar os arrays
- Listas de presença e exportações: usar os arrays quando disponíveis, fallback para campos singulares

**4. Vínculo de participantes**
- Na página da turma, ao adicionar participantes, considerar todas as faixas etárias do array para filtrar participantes compatíveis
- Presença digital: participantes de qualquer faixa/bairro do array são elegíveis

### Arquivos afetados
| Arquivo | Mudança |
|---|---|
| Migração SQL | Adicionar `faixas_etarias text[]` e `bairro_ids uuid[]` |
| `src/pages/turmas/TurmaNovaPage.tsx` | Individual: criar 1 turma com arrays |
| `src/pages/turmas/TurmasPage.tsx` | Exibir múltiplas badges |
| `src/pages/turmas/TurmaDetalhePage.tsx` | Edição e exibição com arrays |
| `src/pages/presenca/PresencaPage.tsx` | Considerar arrays na filtragem |

