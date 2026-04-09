

## Plano: Adicionar Anexos ao REO (DOCX) e Corrigir Cabeçalhos XLSX

### Problemas identificados

1. **REO DOCX**: Fotos já estão sendo inseridas (ANEXO I), mas sem formatação adequada (sem page breaks entre fotos, sem legenda do relatório). Listas de presença preenchidas não existem como anexo.
2. **REO DOCX**: Não há ANEXO II com listas de presença preenchidas.
3. **XLSX (listas de presença)**: O cabeçalho "Centro de Atenção Integral ao Adolescente" fica cortado porque a largura da coluna mesclada não é suficiente e o texto não tem `wrapText`. Faltam bordas visíveis no cabeçalho.

---

### Mudanças

#### 1. `supabase/functions/generate-reo/index.ts` — Anexos no DOCX

**ANEXO I - REGISTROS FOTOGRÁFICOS** (já parcialmente existe, melhorar):
- Agrupar fotos por relatório de atividade, com legenda incluindo nome da atividade e data
- Adicionar page break a cada 2-3 fotos para não sobrecarregar uma página

**ANEXO II - LISTAS DE PRESENÇA** (novo):
- Após as fotos, adicionar nova seção "ANEXO II - LISTAS DE PRESENÇA"
- Para cada turma ativa no mês, gerar uma tabela DOCX com:
  - Cabeçalho institucional (SCNSA / CAIA Medianeira)
  - Nome da turma, período, educador
  - Colunas: Nº, Nome do Participante, datas do mês (baseado em `dias_semana` da turma)
  - Células preenchidas com ✓ (presente) ou vazio (ausente), usando dados da tabela `presenca`
  - Desligados marcados com riscado
  - Page break entre turmas (1 turma por página)
- Dados necessários já estão sendo fetched: `turmas`, `turmaParticipantes`, `presenca`, `participantes`, `bairros`, `profiles`

#### 2. `src/lib/exportListaPresenca.ts` — Corrigir cabeçalho cortado + bordas

- Nas linhas 50-65 (`institutionStyle` e `subtitleStyle`): garantir que `wrapText: true` está presente (já está no `institutionStyle`, verificar `subtitleStyle`)
- O problema real é que a soma das colunas mescladas (`4 + maxNameLen + datas*6`) pode ser menor que o comprimento do texto "Centro de Atenção Integral ao Adolescente - CAIA Medianeira" (~55 chars). Quando as datas são poucas, o merge não cobre o texto todo.
- **Correção**: Calcular a largura total das colunas e garantir que a coluna do nome tenha pelo menos a largura necessária para comportar o texto do cabeçalho institucional dividido pelo número de colunas. Ou seja, `totalWidth = 4 + nameCol + (datas.length * 6)` deve ser >= 58 chars. Se não for, aumentar a coluna do nome.
- Adicionar bordas (`borders`) nos estilos `institutionStyle` e `subtitleStyle` em vez de `bordersLight`

### Resumo de arquivos alterados

| Arquivo | Mudança |
|---|---|
| `supabase/functions/generate-reo/index.ts` | Adicionar ANEXO II (listas de presença preenchidas como tabelas DOCX); melhorar ANEXO I com agrupamento por relatório |
| `src/lib/exportListaPresenca.ts` | Garantir largura mínima para cabeçalho não cortar; usar bordas visíveis no cabeçalho |

