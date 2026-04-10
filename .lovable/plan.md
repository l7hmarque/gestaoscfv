

## Plano: 4 melhorias no sistema de relatórios

### 1. Auto-preencher campos ao vincular planejamento

**Arquivo:** `src/pages/relatorios/RelatorioNovoPage.tsx`

- Alterar o fetch de planejamentos para incluir `tipo_atividade, tipo_atividade_detalhe, educador_id` além de `id, titulo`
- Em `handlePlanejamentoChange`, ao selecionar um planejamento, preencher automaticamente: `nome_atividade` (titulo), `educador_id`, `tipo_atividade`, `tipo_atividade_detalhe`
- Só preencher se o campo estiver vazio ou se vier do planejamento (não sobrescrever dados já editados manualmente — usar o valor do plano como default)

### 2. Renomear "Intervenções Realizadas" para "Atividades Realizadas"

**Arquivo:** `src/pages/relatorios/RelatorioNovoPage.tsx` (linha 592)

- Trocar o label de "Intervenções Realizadas" para "Atividades Realizadas"
- O campo `form.intervencoes` e a coluna no banco continuam iguais (apenas label visual)

### 3. Relato para Equipe Técnica (novo recurso)

**Banco de dados:** Criar tabela `relato_equipe_tecnica`:
- `id` uuid PK
- `relatorio_id` uuid NOT NULL (referência ao relatório)
- `motivo` text NOT NULL (ex: conflito, vulnerabilidade, encaminhamento)
- `descricao` text NOT NULL
- `created_at` timestamptz DEFAULT now()
- `criado_por` uuid (profile id do educador)

Criar tabela `relato_equipe_participantes`:
- `id` uuid PK
- `relato_id` uuid NOT NULL
- `participante_id` uuid NOT NULL

RLS: insert/select para non-visitante; select para tecnico/coordenacao.

**Arquivo:** `src/pages/relatorios/RelatorioNovoPage.tsx`
- Adicionar seção "Relato para Equipe Técnica" no formulário (após Observações):
  - Select de motivo: "Conflito entre participantes", "Vulnerabilidade identificada", "Comportamento preocupante", "Encaminhamento necessário", "Outro"
  - Multi-select de participantes (da lista de `participantesTurma`)
  - Textarea de descrição breve
  - Botão "Adicionar relato" (pode ter múltiplos relatos por relatório)
- No `handleSave`, após criar o relatório:
  - Inserir na `relato_equipe_tecnica` e `relato_equipe_participantes`
  - Criar `recado` tipo `tecnico` para cada profissional com role `tecnico`/`coordenacao`, com link ao relatório
  - Registrar observação no prontuário (`participantes.observacoes_sigilosas`) — append ao texto existente com data e motivo

**Arquivo:** `src/pages/relatorios/RelatorioDetalhePage.tsx`
- Exibir seção "Relatos Equipe Técnica" na visualização do relatório (visível para tecnico/coordenacao)

### 4. REO: Atividades planejadas x realizadas com IA

**Arquivo:** `supabase/functions/generate-reo/index.ts`

Na tabela de atividades (linhas 203-226):
- Coluna "Atividades desenvolvidas": se há relatório vinculado, exibir o `nome_atividade` do relatório ao invés de "Sim (Nx)"
- Coluna "Resultados alcançados": usar o campo `analise_ia` do relatório vinculado (que já é gerado com até 130 caracteres pelo `generate-resultados-alcancados`). Se não houver `analise_ia`, gerar um resumo via chamada à API Lovable AI durante a geração do REO.
- Para relatórios sem planejamento vinculado, aplicar a mesma lógica de `analise_ia`

Mesma correção no trecho XLSX (linhas 571-577).

---

### Resumo de alterações

| Arquivo/Recurso | Mudança |
|---|---|
| `RelatorioNovoPage.tsx` | Auto-preencher ao vincular planejamento; renomear label; seção de relato equipe técnica |
| `RelatorioDetalhePage.tsx` | Exibir relatos da equipe técnica |
| `generate-reo/index.ts` | Nome da atividade na coluna "desenvolvidas"; `analise_ia` na coluna "resultados" |
| **Nova migração** | Tabelas `relato_equipe_tecnica` + `relato_equipe_participantes` com RLS |

