## Plano: Tipo de Atividade estruturado + Oficina na Turma + Pré-população

### Resumo

Transformar "Tipo de Atividade" de campo texto livre para seleção múltipla com opções fixas (com subcampo para nomear quando necessário). Aplicar em relatórios e planejamentos. Vincular turmas a oficinas. Adicionar botão "Novo Relatório" na página da turma. Corrigir checkboxes no DOCX exportado.

---

### 1. Migração SQL

- Adicionar coluna `tipo_atividade text[]` na tabela `planejamentos` (array, nullable)
- Adicionar coluna `oficina text` na tabela `turmas` (nullable, para vincular a uma oficina)
- Alterar `relatorios_atividade.tipo_atividade` de `text` para `text[]` (migração: converter valores existentes para array de 1 elemento)
- Adicionar coluna `tipo_atividade_detalhe text` em `relatorios_atividade` (para "Evento: nome" e "Outra Oficina: nome")
- Adicionar coluna `tipo_atividade_detalhe text` em `planejamentos`

### 2. Constante compartilhada

Criar em `src/lib/constants.ts`:

```
TIPOS_ATIVIDADE = [
  { value: "momento_educando", label: "Momento Educando" },
  { value: "evento", label: "Evento ou Data Comemorativa", hasDetail: true },
  { value: "socioeducativa_idosos", label: "Atividade Socioeducativa (Idosos)" },
  { value: "colonia_ferias", label: "Atividade de Colônia de Férias" },
  { value: "arte_cultura", label: "Oficina de Arte e Cultura" },
  { value: "futebol_esportes", label: "Oficina de Futebol e Outros Esportes / Recreativo" },
  { value: "karate", label: "Oficina de Karatê" },
  { value: "outra_oficina", label: "Outra Oficina", hasDetail: true },
]
```

### 3. `RelatorioNovoPage.tsx`

- Trocar `tipo_atividade: ""` (string) por `tipo_atividade: [] as string[]` (array)
- Adicionar `tipo_atividade_detalhe: ""`
- Renderizar checkboxes com as opções de `TIPOS_ATIVIDADE`
- Para itens com `hasDetail: true`, exibir campo Input ao lado quando selecionado
- Filtrar planejamentos por `educador_id` selecionado (quando educador muda, recarregar lista)
- Ao vincular planejamento, popular `nome_atividade` com o título do planejamento
- Salvar `tipo_atividade` como array e `tipo_atividade_detalhe` como texto

### 4. `PlanejamentoNovoPage.tsx`

- Adicionar campo `tipo_atividade: [] as string[]` e `tipo_atividade_detalhe: ""`
- Renderizar mesmas checkboxes de tipo de atividade
- Salvar no insert

### 5. `PlanejamentoDetalhePage.tsx`

- Exibir tipos de atividade como badges (como já faz com `forma_avaliacao`)
- Incluir no form de edição

### 6. `TurmaNovaPage.tsx` e `TurmaDetalhePage.tsx`

- Adicionar campo Select "Oficina" com opções filtradas dos tipos que são oficinas:
  - Arte e Cultura, Futebol/Esportes/Recreativo, Karatê, Outra Oficina (com campo para nome)
- Salvar na coluna `turmas.oficina`

### 7. `TurmaDetalhePage.tsx` — Botão "Novo Relatório"

- Adicionar botão que navega para `/relatorios/novo?turma={id}` 
- Em `RelatorioNovoPage`, ler query param `turma`, pré-selecionar a turma, e carregar educador/oficina da turma

### 8. DOCX — Checkboxes marcadas

O problema: no DOCX, tags `{ENG_1}` são substituídas por `☑` ou `☐` (caracteres Unicode), mas dentro de checkboxes nativas do Word (content controls) isso não funciona.

**Solução**: No fallback DOCX gerado pelo código, já usa `checkbox()` com `☑`/`☐` em fonte "Segoe UI Symbol" — isso funciona. Para templates DOCX customizados: as tags `{ENG_1}` etc. já geram `☑`/`☐`. Se o template usa **content controls** (checkboxes do Word), não é possível marcá-las via docxtemplater. A solução é:

- Instruir que o template use `{TAG}` como texto simples (não dentro de content control)
- Atualizar a documentação/tooltip no mapeamento de tags para explicar isso
- No `buildRelatorioTemplateData`, trocar `☑`/`☐` por texto descritivo alternativo (`[X]`/`[ ]`) que é mais robusto em diferentes fontes, sendo que [X] com preenchimento/cor de destaque preto, fonte tam. 9
- Adicionar nota na UI de admin sobre como configurar checkboxes no template

### 9. Páginas de detalhe e exportação

- `RelatorioDetalhePage.tsx`: exibir `tipo_atividade` como array de badges
- `useDocumentExport.ts`: atualizar `TIPO_ATIVIDADE` para juntar labels do array com vírgula, incluindo detalhe quando houver
- `TemplateTagMapper.tsx`: manter campo `tipo_atividade` com label atualizada

---

### Arquivos modificados


| Arquivo                                               | Mudança                                                                                                                                                            |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Migração SQL                                          | `tipo_atividade text[]` em planejamentos, `oficina text` em turmas, converter `relatorios_atividade.tipo_atividade` para array, adicionar `tipo_atividade_detalhe` |
| `src/lib/constants.ts`                                | Exportar `TIPOS_ATIVIDADE`                                                                                                                                         |
| `src/pages/relatorios/RelatorioNovoPage.tsx`          | Checkboxes tipo atividade, filtrar planejamentos por educador, popular nome ao vincular                                                                            |
| `src/pages/planejamentos/PlanejamentoNovoPage.tsx`    | Adicionar tipo de atividade                                                                                                                                        |
| `src/pages/planejamentos/PlanejamentoDetalhePage.tsx` | Exibir/editar tipo de atividade                                                                                                                                    |
| `src/pages/turmas/TurmaNovaPage.tsx`                  | Campo oficina                                                                                                                                                      |
| `src/pages/turmas/TurmaDetalhePage.tsx`               | Campo oficina + botão novo relatório                                                                                                                               |
| `src/pages/relatorios/RelatorioDetalhePage.tsx`       | Exibir array de tipos                                                                                                                                              |
| `src/hooks/useDocumentExport.ts`                      | Ajustar para array + detalhe                                                                                                                                       |
| `src/components/TemplateTagMapper.tsx`                | Manter compatibilidade                                                                                                                                             |
