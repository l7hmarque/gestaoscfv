

## Plano: Corrigir auto-vinculação de participantes ao criar turma individual + sincronizar arrays no batch

### Problema
1. O formulário **Individual** (`handleSubmit`) cria a turma com `faixas_etarias` e `bairro_ids` corretos, mas **não executa auto-vinculação** de participantes — simplesmente salva e redireciona.
2. O formulário **Batch** (`handleBatchGenerate`) NÃO preenche `faixas_etarias` nem `bairro_ids`, apenas os campos singulares.
3. Resultado: as turmas de Karatê (criadas individualmente ou em batch) ficam sem participantes vinculados.

### Solução

**1. Adicionar auto-vinculação no formulário Individual (`TurmaNovaPage.tsx`)**
- Após o `insert` da turma, buscar participantes ativos que correspondam a qualquer combinação de `bairro_ids` × `faixas_etarias` × `periodo`
- Usar `calcFaixaFromDate` para calcular a faixa de cada participante
- Inserir os vínculos em `turma_participantes`
- Informar ao usuário quantos participantes foram vinculados

**2. Corrigir batch para preencher arrays (`TurmaNovaPage.tsx`)**
- Nas rows do batch, adicionar `faixas_etarias: [c.faixa]` e `bairro_ids: [c.bairro.id]` para manter sincronização

**3. Corrigir turmas existentes de Karatê (via migração)**
- Atualizar as 4 turmas de Karatê para preencher `faixas_etarias` e `bairro_ids` com base nos campos singulares
- Executar vinculação retroativa dos participantes compatíveis

### Detalhes técnicos

No `handleSubmit`, após o insert com `.select()` para obter o `id` da turma criada:
```typescript
// Buscar participantes ativos nos bairros selecionados
const { data: participantes } = await supabase
  .from("participantes")
  .select("id, bairro_id, periodo, data_nascimento")
  .eq("status", "ativo")
  .in("bairro_id", bairroIds);

// Filtrar por faixa e período, inserir turma_participantes
```

### Arquivo afetado
| Arquivo | Mudança |
|---|---|
| `src/pages/turmas/TurmaNovaPage.tsx` | Auto-vincular no individual + arrays no batch |
| Migração SQL | Sincronizar arrays e vincular participantes nas turmas de Karatê existentes |

