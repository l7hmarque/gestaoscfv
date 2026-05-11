## Objetivo

Adotar as **28 rubricas oficiais** da planilha como única lista do `categorias_financeiras` e usá-las em todas as funcionalidades do módulo financeiro — incluindo a sugestão automática pela IA na digitalização de lançamentos.

## 1. Banco de Dados (migration)

- Apagar as 10 categorias atuais (não há despesas/orçamentos vinculados — verificado: 0 registros com `categoria_id`).
- Inserir as 28 rubricas exatamente como na planilha:

```text
3.1.90.11.01  VENCIMENTOS E SALÁRIOS
3.1.90.11.43  13º SALÁRIO
3.1.90.11.45  FÉRIAS - ABONO CONSTITUCIONAL
3.1.90.13.01  FGTS
3.1.90.13.02  CONTRIBUIÇÕES PREVIDENCIÁRIAS - INSS
3.1.90.16.00  OUTRAS DESPESAS VARIÁVEIS - PESSOAL CIVIL
3.1.90.47.99  OUTRAS OBRIGAÇÕES TRIBUTÁRIAS E CONTRIBUTIVAS
3.1.90.49.00  AUXÍLIO-TRANSPORTE
3.1.90.94.00  INDENIZAÇÕES E RESTITUIÇÕES TRABALHISTAS
3.3.90.30.01  COMBUSTÍVEIS E LUBRIFICANTES AUTOMOTIVOS
3.3.90.30.07  GÊNEROS DE ALIMENTAÇÃO
3.3.90.30.14  MATERIAL EDUCATIVO E ESPORTIVO
3.3.90.30.16  MATERIAL DE EXPEDIENTE
3.3.90.30.22  MATERIAL DE LIMPEZA E PRODUTOS DE HIGIENIZAÇÃO
3.3.90.30.23  UNIFORMES, TECIDOS E AVIAMENTOS
3.3.90.36.15  LOCAÇÃO DE IMÓVEIS
3.3.90.36.26  SERVIÇOS DOMÉSTICOS
3.3.90.39.05  SERVIÇOS TÉCNICOS PROFISSIONAIS
3.3.90.39.19  MANUTENÇÃO E CONSERVAÇÃO DE VEÍCULOS
3.3.90.39.43  SERVIÇOS DE ENERGIA ELÉTRICA
3.3.90.39.44  SERVIÇOS DE ÁGUA E ESGOTO
3.3.90.39.69  SEGUROS EM GERAL
3.3.90.39.81  SERVIÇOS BANCÁRIOS
3.3.90.39.99  OUTROS SERVIÇOS DE TERCEIROS, PESSOA JURÍDICA
3.3.90.40.97  DESPESAS DE TELEPROCESSAMENTO
3.3.90.47.99  OUTRAS OBRIGAÇÕES TRIBUTÁRIAS E CONTRIBUTIVAS
4.4.90.52.52  VEÍCULOS DE TRAÇÃO MECÂNICA
4.4.90.52.99  OUTROS MATERIAIS PERMANENTES
```

- Garantir índice único em `codigo` (já existe; continuar).

## 2. Constante centralizada

- Criar `src/lib/rubricasOficiais.ts` exportando o array `[{codigo, descricao}]` com as 28 entradas — usado como fonte da verdade para seed, validação e prompt da IA.

## 3. Detecção por IA (`detect-despesa-from-doc`)

- No `SYSTEM_PROMPT`, adicionar a lista completa das 28 rubricas (código + descrição) e instrução para escolher **a mais específica** com base na natureza do lançamento (ex.: holerite → `3.1.90.11.01`; conta de luz → `3.3.90.39.43`; combustível → `3.3.90.30.01`; INSS → `3.1.90.13.02`; FGTS → `3.1.90.13.01`).
- Adicionar ao `PARAMS_SCHEMA` o campo:
  - `rubrica_codigo` (string, enum com os 28 códigos) — código sugerido.
- Após receber a resposta da IA, no front (`ImportReviewDialog`), resolver o `rubrica_codigo` → `categoria_id` por lookup local e pré-selecionar no formulário; usuário pode trocar.

## 4. Front-end — onde aparecem os selects e exibições

Pontos já mapeados que continuarão funcionando após a substituição (somente o conteúdo da lista muda):

- `FinanceiroPage.tsx`: cadastro/edição de Despesa, Estorno, aba Categorias e dashboards por rubrica.
- `OrcamentosTab.tsx`: criação e edição de Orçamento, exportação XLSX e Mapa Comparativo.
- `BancoDadosPage.tsx`: tabelas de despesas/estornos/orçamentos com nome da categoria.
- `ImportReviewDialog.tsx`: aceitar `rubrica_codigo` vindo da IA e pré-selecionar a categoria correspondente.

Aba **Categorias** ganha uma nota informativa: "Lista oficial conforme rubricas SIT/TCE-PR — manter padronizado."

## 5. Relatórios e exportações

- `useOrcamentoExport`, `useRelatorioGestao`, `ExportarRelatoriosPage`, `generate-rca`, `generate-reo` e `audit-financeiro`: nenhuma mudança estrutural — eles já leem `categorias_financeiras` dinamicamente. Apenas validar que as colunas/labels acomodam código de 5 segmentos (ex.: `3.3.90.30.22`).

## 6. Memória

Atualizar `mem://constraints/formato-exportacao-sit` (ou criar `mem://funcionalidades/financeiro-rubricas-oficiais`) registrando que a lista de 28 rubricas é a oficial e que IA deve sugeri-las automaticamente.

## Detalhes técnicos

- Migration: `DELETE FROM categorias_financeiras;` seguido de `INSERT` em lote com os 28 pares `(codigo, descricao)`. `valor_previsto` permanece `0` (preenchido depois conforme orçamento anual).
- Edge function `detect-despesa-from-doc` recebe a lista hardcoded — mais barato que consultar o banco a cada chamada e mantém prompt determinístico.
- Lookup no `ImportReviewDialog` usa `categorias.find(c => c.codigo.trim() === rubrica_codigo.trim())`.

## Não incluído

- Não cria hierarquia pai/filho.
- Não altera o catálogo de fornecedores nem os campos SIT já existentes (`sit_codigo_tipo_despesa` etc.).
- Não mexe em despesas já cadastradas (todas estão sem categoria).