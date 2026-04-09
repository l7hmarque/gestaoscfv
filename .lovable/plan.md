

## Plano: Atalhos de exportação + gestão de equipe + correção REO

### 3 frentes de trabalho

---

### 1. Corrigir erro do REO (`generate-reo/index.ts`)

**Problema**: A variável `tableWidth` é usada nas linhas 830, 945, 956 mas nunca é definida. Isso causa `500: tableWidth is not defined`.

**Correção**: Adicionar `const tableWidth = 9360;` (largura padrão de página A4 com margens de 1440 DXA = 12240 - 2×1440) logo antes do bloco que a utiliza.

---

### 2. Adicionar atalhos de exportação (`ExportarRelatoriosPage.tsx`)

Adicionar 2 novas abas/cards na página:

- **Relatórios de Atividades + Listas de Presença**: Reutilizar a função `exportBulkRelatorios` do `useBulkRelatorioExport.ts` já existente, com seletor de intervalo de datas e filtro de educador. Um botão gera DOCX + PDF + XLSX.

- **Relatório de Atendimentos Técnicos**: Reutilizar a lógica já existente em `EquipeTecnicaPage.tsx` (função `generateRelatorioEquipe`), extraindo para um hook ou simplesmente replicando a query de atendimentos + exportação PDF/XLSX com filtro de datas.

A `TabsList` passará de 4 para 6 abas (ou cards adicionais dentro de uma aba existente).

---

### 3. Gestão de equipe nas Configurações (`ConfiguracoesPage.tsx`)

Na aba "Equipe", expandir a tabela para incluir:

- **Toggle ativo/inativo**: Switch para ativar/desativar conta (já existe `profiles.ativo`)
- **Carga horária**: Input editável (já existe `profiles.carga_horaria`)
- **Data de início**: Input date (já existe `profiles.data_inicio`)
- **Salário**: Novo campo (precisa migration)
- **Data de desligamento**: Novo campo (precisa migration)

**Migration necessária**: Adicionar 2 colunas na tabela `profiles`:
```sql
ALTER TABLE public.profiles ADD COLUMN salario numeric DEFAULT NULL;
ALTER TABLE public.profiles ADD COLUMN data_desligamento date DEFAULT NULL;
```

Esses campos serão usados na seção "1.4. Recursos Humanos" do REO (já existente no edge function, mas com dados estáticos).

---

### Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `supabase/functions/generate-reo/index.ts` | Definir `const tableWidth = 9360` |
| `src/pages/relatorios/ExportarRelatoriosPage.tsx` | Adicionar 2 cards: exportação de atividades em lote + atendimentos técnicos |
| `src/pages/configuracoes/ConfiguracoesPage.tsx` | Expandir aba Equipe com toggle ativo, carga horária, datas, salário |
| Migration | `profiles`: adicionar `salario` (numeric) e `data_desligamento` (date) |

