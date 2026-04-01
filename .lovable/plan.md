

## Plano: Gerar "Resultados Alcançados" com IA ao salvar relatório

### Resumo

Ao salvar um relatório de atividade, o sistema chamará uma edge function que gera um texto técnico de "Resultados Alcançados" vinculando a atividade aos objetivos do SCFV. O resultado é salvo no campo `analise_ia` (já existente na tabela `relatorios_atividade`) e exibido na página de detalhe do relatório. O relatório mensal XLSX usa esse campo diretamente, sem precisar chamar IA na hora da exportação.

---

### 1. Criar edge function `generate-resultados-alcancados`

**Arquivo:** `supabase/functions/generate-resultados-alcancados/index.ts`

- Recebe os dados do relatório (nome_atividade, tipo_atividade, observacoes, intervencoes, engajamento, situacoes_relevantes, objetivo_alcancado, score_elo) e os dados do planejamento vinculado (titulo, tema, objetivos)
- Prompt instrui a IA a:
  - Vincular a atividade aos objetivos do SCFV (convivência, fortalecimento de vínculos, protagonismo, prevenção)
  - Linguagem técnica e objetiva, sem afirmações falsas
  - Máximo 130 caracteres
  - Retornar apenas o texto, sem introduções
- Retorna `{ resultado: "texto" }`
- Modelo: `google/gemini-3-flash-preview`

### 2. Chamar a edge function ao salvar relatório

**Arquivo:** `src/pages/relatorios/RelatorioNovoPage.tsx`

Após inserir o relatório e obter o `relId`:
- Se há `planejamento_id`, buscar dados do planejamento
- Chamar `supabase.functions.invoke("generate-resultados-alcancados", { body: { relatorio, planejamento } })`
- Atualizar o campo `analise_ia` do relatório com o resultado
- Não bloquear o salvamento se a IA falhar (fire-and-forget com toast de aviso)

### 3. Exibir na página de detalhe

**Arquivo:** `src/pages/relatorios/RelatorioDetalhePage.tsx`

- Adicionar um Card "Resultados Alcançados" que mostra `item.analise_ia` quando disponível
- O campo já existe na tabela, só precisa renderizar

### 4. Usar no relatório mensal XLSX

**Arquivo:** `src/pages/dashboard/DashboardRelatorioMensalTab.tsx`

- Na sheet "Atividades", cruzar planejamentos x relatórios via `planejamento_id`
- Montar tabela de 4 colunas:
  - **Atividades Propostas**: título do planejamento
  - **Atividades Desenvolvidas**: nome_atividade do relatório vinculado
  - **Resultados Alcançados**: campo `analise_ia` do relatório (já gerado)
  - **Justificativas**: "Não realizada" se não há relatório vinculado
- Formatação com bordas e cabeçalhos em negrito para fácil cópia pro Word
- Relatórios sem planejamento aparecem como linhas extras

---

### Arquivos modificados

| Arquivo | Mudança |
|---|---|
| `supabase/functions/generate-resultados-alcancados/index.ts` | Nova edge function para gerar resultados com IA |
| `src/pages/relatorios/RelatorioNovoPage.tsx` | Chamar IA após salvar e gravar em `analise_ia` |
| `src/pages/relatorios/RelatorioDetalhePage.tsx` | Exibir card "Resultados Alcançados" |
| `src/pages/dashboard/DashboardRelatorioMensalTab.tsx` | Tabela de 4 colunas usando `analise_ia` já salvo |

