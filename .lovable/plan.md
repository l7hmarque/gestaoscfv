## Plano: REO em XLSX + Prestação de Contas PDF/XLSX + Lista de Presença XLSX por Turma

São 3 funcionalidades distintas. Vou detalhar cada uma.

---

### 1. REO em XLSX (além do DOCX existente)

**O que**: Novo botão "Gerar REO (XLSX)" na aba Relatórios Mensais, ao lado do botão DOCX existente. Gera planilha com as mesmas seções do REO DOCX.

**Abordagem**: Nova Edge Function `generate-reo-xlsx` (ou estender a existente com parâmetro `formato`).

**Estrutura do XLSX**:

- Aba "Atividades": oficinas propostas × desenvolvidas
- Aba "Equipe Técnica": atendimentos da equipe técnica
- Aba "Metas": comparativo metas × alcançadas
- Aba "RH": recursos humanos (nome, cargo, carga horária)
- Aba "Monitoramento": objetivos, indicadores, metas, verificação
- Aba "Financeiro": parcelas, despesas do mês, resumo financeiro, saldo por categoria

**Arquivos alterados**:

- `supabase/functions/generate-reo/index.ts` — adicionar parâmetro `formato: "docx" | "xlsx"`, reutilizar dados já carregados, gerar XLSX com `xlsx-js-style` quando `formato === "xlsx"`
- `src/pages/dashboard/DashboardRelatorioMensalTab.tsx` — novo botão + função `generateReoXlsx`

---

### 2. Relatório de Prestação de Contas (PDF e XLSX)

**O que**: Novo botão "Prestação de Contas" no painel financeiro. Gera documento completo com:

- Resumo financeiro (parcelas recebidas, despesas, estornos, saldo)
- Despesas detalhadas com status de comprovação
- Saldo por categoria
- Lista de documentos fiscais anexados (NF, boleto, comprovante) em ordem cronologica de gastos

**Regra de negócio**: Despesa só fica "aprovada/paga" se tiver `comprovante_url` preenchido. Caso contrário, status = "aguardando_pagamento".

**Estrutura PDF**: Cabeçalho institucional, tabelas estilizadas (padrão REO), assinatura.

**Estrutura XLSX**: Abas "Resumo", "Despesas", "Categorias", "Documentos".

**Arquivos alterados**:

- `src/pages/financeiro/FinanceiroPage.tsx`:
  - Nova função `generatePrestacaoContas(formato: "pdf" | "xlsx")`
  - Lógica de status: ao salvar despesa, se `comprovante_url` está vazio → `status_sit = "aguardando_pagamento"`; se preenchido → `status_sit = "pago"`
  - Dois novos botões na barra de ações: "Prestação de Contas (PDF)" e "Prestação de Contas (XLSX)"
  - Badge visual na tabela de despesas indicando status (pago ✓ / aguardando pagamento ⏳)

---

### 3. Lista de Presença XLSX na Página da Turma

**O que**: Botão "Lista de Presença (XLSX)" na `TurmaDetalhePage`. Ao clicar, gera planilha A4 paisagem com:

- Cabeçalho: nome da turma, bairro, período, mês/ano
- Coluna "Nº", coluna "Nome", colunas com datas de atividade do mês (baseado em `dias_semana` da turma)
- Bordas 0.5pt pretas em todas as células
- Células de presença vazias para preenchimento manual

**Seleção de mês**: Dialog com seletores de mês/ano antes de gerar.

**Arquivos alterados**:

- `src/pages/turmas/TurmaDetalhePage.tsx`:
  - Importar `xlsx-js-style`
  - Nova função `exportListaPresencaXlsx()`
  - Dialog para selecionar mês/ano
  - Botão "Lista de Presença" na barra de ações
  - Reutilizar lógica de `calcularDatasDoMes` (já existente em `useDocumentExport.ts`)

**Estilo XLSX**:

```
Bordas: { style: "thin", color: { rgb: "000000" } } em top/bottom/left/right
Cabeçalho: fundo azul #1A5276, texto branco, bold
Coluna nome: largura ~35, colunas data: largura ~5
```

---

### Resumo de alterações


| Arquivo                                               | Alteração                                                |
| ----------------------------------------------------- | -------------------------------------------------------- |
| `supabase/functions/generate-reo/index.ts`            | Suporte a formato XLSX                                   |
| `src/pages/dashboard/DashboardRelatorioMensalTab.tsx` | Botão "REO XLSX"                                         |
| `src/pages/financeiro/FinanceiroPage.tsx`             | Prestação de contas PDF/XLSX + lógica comprovante→status |
| `src/pages/turmas/TurmaDetalhePage.tsx`               | Botão + dialog lista presença XLSX                       |
