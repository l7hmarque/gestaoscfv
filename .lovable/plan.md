

## Plano: Correções múltiplas no perfil do participante + investigação de frequência

### 1. Campos escapando ao editar perfil (input perde foco)

**Causa raiz**: Os componentes `EditField` e `Info` estão definidos **dentro** da função de renderização do componente `ParticipantePerfilPage` (linhas 266-271). Cada vez que `setForm` é chamado (a cada letra digitada), o React recria esses componentes como novas funções, causando unmount/remount e perda de foco.

**Correção**: Mover `EditField` e `Info` para **fora** do componente principal, como componentes standalone que recebem `form`, `set` via props. Isso segue o padrão já documentado na memória `tecnico/padroes-componentes`.

### 2. Erro "invalid input syntax for type timestamp with time zone: ''"

**Causa raiz**: Na linha 112, todos os campos do participante são convertidos para string no form state (`f[k] = v == null ? "" : String(v)`). Quando o save acontece (linha 130), o payload inclui `visualizado_em: ""` (string vazia) que é um timestamp. A linha 132 só nullifica `bairro_id`, `ponto_transporte_id`, `data_nascimento`, `iniciou_em`, `data_desligamento` — mas falta `visualizado_em` e `updated_at` (que foi deletado mas `visualizado_em` não).

**Correção**: Adicionar `visualizado_em` à lista de campos que devem ser nullificados quando vazios, ou melhor, excluí-lo do payload (assim como `created_at`/`updated_at`). Também garantir que qualquer campo de data/timestamp vazio seja convertido para `null`.

### 3. Capitalização padronizada dos dados

**Correção**: No `handleSave`, antes de enviar o payload:
- `nome_completo` → Title Case (Nome e Sobrenome)  
- `responsavel1_nome`, `responsavel2_nome` → Title Case
- `escola` → Title Case
- `endereco_rua`, `endereco_bairro` → Title Case
- `cpf` → formatado sem máscara (só dígitos, já está assim)
- `responsavel1_whatsapp`, `responsavel2_whatsapp` → só dígitos (já está assim)

Nota: O sistema atual usa MAIÚSCULAS para padronização (memória `tecnico/padronizacao-dados`). Preciso verificar se o pedido de "Nome e Sobrenome" do usuário significa mudar para Title Case ou manter o padrão existente. O pedido diz `<-ex`, indicando que é um exemplo do formato. Vou aplicar Title Case conforme pedido.

### 4. Idade irregular: ISABELLY VITORIA DOS SANTOS MELO

**Encontrado**: `data_nascimento: 2026-10-17` — data no futuro, claramente errada. Único participante com idade < 5 anos.

**Correção**: Via script, corrigir a data de nascimento. Provavelmente deveria ser `2016-10-17` (9 anos) em vez de `2026-10-17`.

### 5. Listas de presença exportadas sem informação de presença

**Investigação**: Os dados de presença **existem** no banco (104 presenças, 1753 ausências para março/2025). O código de exportação tanto em `ExportarRelatoriosPage.tsx` quanto em `DashboardRelatorioMensalTab.tsx` faz corretamente:
- Busca `presencas` filtradas por data
- Enriquece com fallback de `relatorio_presenca`
- Itera pelas datas e marca `■` quando encontra `presente: true`

**Possível causa**: O `turma_participantes` é buscado **sem filtrar** por `data_saida`. Os participantes transferidos (27 deles) têm `data_saida = 2025-03-01` nas turmas antigas. Porém, ao gerar a matriz, o export busca `tpIds = turmaParticipantes.filter(tp => tp.turma_id === t.id)` — isso inclui participantes que já saíram da turma, mas NÃO inclui participantes que entraram via transferência (porque a presença foi registrada na turma antiga). 

Na verdade, o problema mais provável é que ao gerar matrizes, `fetchAllRows("turma_participantes")` traz TODOS os vínculos (incluindo os com `data_saida`), mas a presença foi registrada na turma correta. Preciso verificar se os IDs de presença correspondem aos IDs de turma corretamente.

Vou verificar mais cuidadosamente: a presença inserida pelo script anterior usou a turma_id do participante no momento da inserção. Se o participante foi transferido, a presença deveria ter sido registrada na turma **nova** (pós-transferência). Mas olhando o script anterior, as presenças foram registradas na turma que o participante estava vinculado **antes** da transferência.

**Diagnóstico final**: As matrizes podem estar mostrando participantes nas turmas certas, mas as presenças estão associadas a turmas diferentes. Preciso cruzar os dados para confirmar.

### Arquivos a alterar

1. **`src/pages/participantes/ParticipantePerfilPage.tsx`**:
   - Mover `EditField` e `Info` para fora do componente
   - Adicionar `visualizado_em` à exclusão do payload
   - Aplicar Title Case nos campos textuais ao salvar

2. **Script de correção de dados**:
   - Corrigir data de nascimento da ISABELLY (2026→2016)
   - Verificar e corrigir mapeamento presença↔turma se necessário

3. **`src/pages/relatorios/ExportarRelatoriosPage.tsx`** e **`src/pages/dashboard/DashboardRelatorioMensalTab.tsx`**:
   - Filtrar `turma_participantes` para excluir vínculos com `data_saida` anterior ao mês (para não listar participantes transferidos nas turmas antigas)
   - OU incluir ambas as turmas (antiga e nova) para cada participante no período

