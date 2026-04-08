## Plano: Adicionar nomes manualmente na presença do relatório + vincular ao cadastro

### Problema

Participantes com dados desatualizados (bairro, período, status) não aparecem nas turmas corretas para relatórios. Precisamos permitir adicionar nomes avulsos na presença de relatórios já finalizados, e futuramente vincular esses nomes ao cadastro real.

### Solução

**1. Migração: coluna `nome_avulso` em `relatorio_presenca**`

- Adicionar `nome_avulso text` (nullable) na tabela `relatorio_presenca`
- Tornar `participante_id` nullable (hoje é NOT NULL) para permitir entradas sem cadastro
- Isso permite registros com `participante_id = null` + `nome_avulso = "João Silva"` ou com ambos preenchidos

**2. Na página de detalhe do relatório (`RelatorioDetalhePage.tsx`)**

- Botão "Adicionar Participante" abaixo da lista de presença
- Dialog com dois modos:
  - **Buscar no cadastro**: campo de busca que filtra `participantes` por nome, seleciona e insere `relatorio_presenca` com `participante_id` + `presente = true`
  - **Nome avulso**: campo de texto livre para digitar o nome, insere com `participante_id = null` + `nome_avulso`
- Ao adicionar, também insere na tabela `presenca` (frequência oficial) se houver turma vinculada
- Exibição: mostrar `nome_avulso` quando `participante_id` for null, com badge "Avulso"

**3. Vincular nome avulso ao cadastro**

- Na lista de presença, entradas avulsas terão botão "Vincular"
- Abre busca de participantes, ao selecionar: atualiza `participante_id` e limpa `nome_avulso`
- Isso herda automaticamente todos os dados de turmas/presença do participante
- Essa funcao sera habilitada inclusive em relatorios e listas de presencas anteriores a esse update

**4. Atualizar contadores**

- Ao adicionar/vincular, recalcular `num_participantes`, `num_ausentes`, `pct_adesao` no relatório

### Arquivos afetados


| Arquivo                                         | Mudança                                                   |
| ----------------------------------------------- | --------------------------------------------------------- |
| Migração SQL                                    | `nome_avulso text`, `participante_id` nullable            |
| `src/pages/relatorios/RelatorioDetalhePage.tsx` | Botão adicionar, dialog busca/avulso, vincular, recálculo |
