

## Análise Completa — Erros de Fluxo, Conflitos e Falhas Estruturais

---

### 1. DADOS DUPLICADOS DE BAIRROS (CRÍTICO)

O banco possui bairros duplicados com capitalização diferente:
- `"Jardim Irene"` (id: `578dd974`) **e** `"JARDIM IRENE"` (id: `94f170dd`)
- `"Parque Independência"` (id: `cd1fbd29`) **e** `"PARQUE INDEPENDENCIA"` (id: `0a4af2ab`)
- `"Alvorada"` (id: `3837e7b8`) **e** `"ALVORADA"` (id: `85a31547`)

**Impacto**: Participantes vinculados ao bairro `"Jardim Irene"` (minúsculo) **não aparecem** nos filtros SCFV que comparam com `BAIRROS_SCFV = ["JARDIM IRENE", ...]`. A função `isBairroSCFV` usa `localeCompare` com `sensitivity: "base"` (case-insensitive), mas os filtros de turma usam `bairro_id` — participantes em bairros duplicados não são vinculados a turmas corretas.

**Correção**: Migração SQL para unificar bairros duplicados, atualizando todas as referências (`participantes.bairro_id`, `turmas.bairro_id`, `pontos_transporte.bairro_id`) para o ID canônico (MAIÚSCULO), e deletando os duplicados.

---

### 2. RELATÓRIO MENSAL SEM PAGINAÇÃO (CRÍTICO)

`DashboardRelatorioMensalTab` (linha 96-104) usa `supabase.from("presenca").select("*")` **sem** `fetchAllRows`. Está limitado a 1000 registros por tabela. Com volume real, o relatório mensal terá dados incompletos silenciosamente.

Mesma falha em `RelatoriosPage.loadData()` (linha 56-66): duas queries sem paginação, limitadas a 1000 relatórios.

**Correção**: Usar `fetchAllRows` em ambos os locais.

---

### 3. PRESENÇA DUPLICADA ENTRE PRESENÇA DIGITAL E RELATÓRIO

Ao salvar um relatório (`RelatorioNovoPage`, linhas 240-264), o sistema **deleta e recria** registros na tabela `presenca` para cada turma+data. Se a presença foi registrada separadamente via `PresencaPage` para a mesma turma+data, **os dados são sobrescritos** sem aviso.

**Impacto**: Um educador registra presença às 8h. Outro cria um relatório à tarde para a mesma turma+data — a presença da manhã é apagada e substituída pela do relatório.

**Sugestão**: Ao salvar relatório, verificar se já existe presença registrada para aquela turma+data e perguntar ao usuário se deseja sobrescrever ou manter a existente.

---

### 4. FAIXAS ETÁRIAS INCONSISTENTES

Três implementações diferentes de cálculo de faixa etária:

| Local | Faixa 18-59 | Faixa < 6 |
|---|---|---|
| `useDashboardData` (linha 33-38) | Retorna `"60+"` (errado, pula 18-59) | Retorna `"6-8"` (errado, inclui < 6) |
| `calcFaixaFromDate` em constants.ts (linha 39-46) | Retorna `""` (correto) | Retorna `""` (correto) |
| `PresencaPage` FAIXAS (linha 19-24) | Não tem faixa | Não tem faixa |

No dashboard, uma criança de 4 anos seria contada como `"6-8"`, e um adulto de 30 seria `"60+"`. Isso distorce completamente os gráficos de distribuição por faixa etária.

**Correção**: Unificar para usar `calcFaixaFromDate` em todos os locais. Adicionar faixa para 18-59 se aplicável, ou filtrar participantes fora de faixa.

---

### 5. STATUS "pendente" AUSENTE NO BANCO DE DADOS

`BancoDadosPage` (linha 20) define `statusLabel` sem incluir `"pendente"`:
```
{ ativo: "Ativo", desligado: "Desligado", incompleto: "Incompleto" }
```

Participantes pendentes aparecem sem badge de status na tabela do banco de dados, dificultando a identificação.

**Correção**: Adicionar `pendente: "Pendente"` ao `statusLabel` do `BancoDadosPage`.

---

### 6. PRESENÇA SALVA APENAS PARA PARTICIPANTES FILTRADOS

`PresencaPage` (linha 109): ao salvar, usa `filteredParticipantes` em vez de `participantes`. Se o educador aplicar filtro de bairro ou período, **apenas os participantes filtrados** terão presença registrada. Os demais membros da turma ficam sem registro — nem presentes nem ausentes.

Pior: a linha 119 faz `delete().eq("turma_id", selectedTurma).eq("data", dataStr)` — **apaga TODOS** os registros da turma+data, mas só reinsere os filtrados. Membros não filtrados perdem registros anteriores.

**Correção**: Sempre salvar presença para TODOS os membros da turma, não apenas os filtrados. Os filtros devem ser apenas visuais.

---

### 7. CAMPO CPF: CONFLITO SEMÂNTICO

O campo `responsavel1_cpf` no banco armazena o CPF do **responsável** (evidenciado pelo nome da coluna e dados existentes). Porém, a UI foi renomeada para "CPF do Participante" nas últimas alterações. Isso cria uma inconsistência: o dado armazenado é do responsável, mas o label diz "participante".

**Sugestão**: Se o CPF deve ser do participante, criar uma coluna `cpf` na tabela `participantes`. Se é do responsável, manter o label como "CPF do Responsável".

---

### 8. `PresencaHistoricoPage` NÃO IMPLEMENTADA

A página `/presenca/historico` é apenas um placeholder sem funcionalidade. Não há como visualizar o histórico de presença registrado.

---

### 9. RELATÓRIO MENSAL: "ATENDIDOS" CONTA APENAS PRESENÇAS, NÃO PARTICIPANTES

`DashboardRelatorioMensalTab` (linha 123-127) calcula "atendidos no mês" usando `endereco_bairro` (bairro do endereço pessoal), não `bairro_id` (bairro SCFV/CAIA). Isso gera distribuição por bairro incorreta — mostra onde moram, não onde são atendidos.

---

### 10. DADOS ANTIGOS DE CPF COM FORMATO INCORRETO

Dados importados têm CPFs como `"12372696955.0"` (com `.0` — formato numérico do Excel). A máscara `displayCPF` não trata esse sufixo. Ex: `"12372696955.0"` → `"123.726.969-55.0"` (quebrado).

**Correção**: Migração SQL para limpar: `UPDATE participantes SET responsavel1_cpf = REPLACE(responsavel1_cpf, '.0', '') WHERE responsavel1_cpf LIKE '%.0'`. Mesma limpeza para `responsavel1_whatsapp`.

---

### Priorização

| Prioridade | Item | Impacto |
|---|---|---|
| **CRÍTICO** | 1 — Bairros duplicados | Participantes invisíveis em filtros, turmas erradas |
| **CRÍTICO** | 2 — Relatório mensal sem paginação | Relatório com dados incompletos |
| **CRÍTICO** | 6 — Presença apaga dados de não-filtrados | Perda de dados de presença |
| **ALTO** | 4 — Faixas etárias inconsistentes | Dashboard com números errados |
| **ALTO** | 10 — CPF/Telefone com ".0" | Exibição quebrada |
| **ALTO** | 3 — Presença sobrescrita por relatório | Perda silenciosa de dados |
| **MÉDIO** | 9 — Bairro endereço vs bairro CAIA | Relatório mensal impreciso |
| **MÉDIO** | 7 — CPF responsável vs participante | Confusão de dados |
| **BAIXO** | 5 — Status pendente no banco de dados | UI incompleta |
| **BAIXO** | 8 — Histórico presença não implementado | Funcionalidade faltando |

