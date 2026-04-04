

## Plano: Corrigir XLSX + Geração em segundo plano + Relatório de Execução do Objeto + Módulo Financeiro

---

### Diagnóstico: Por que o XLSX não tem bordas nem preenchimento preto

A biblioteca `xlsx` versão 0.18.5 (community/free) **NÃO suporta estilização de células** (propriedade `.s`). Todo o código de `applyBorders`, `applyHeaderStyle` e `fill: { fgColor: { rgb: "000000" } }` é **silenciosamente ignorado**. Os dados estão lá, mas sem formatação visual.

**Solução**: Substituir `xlsx` por `xlsx-js-style` (fork compatível que suporta `.s`). A API é idêntica, bastando trocar o import. Isso corrige imediatamente bordas, headers cinza, e preenchimento preto nas matrizes.

---

### 1. Trocar biblioteca XLSX (CRÍTICO)

- Remover `xlsx` do `package.json`
- Instalar `xlsx-js-style` (drop-in replacement)
- Em `DashboardRelatorioMensalTab.tsx` e `useDataExport.ts`: trocar `import * as XLSX from "xlsx"` para `import * as XLSX from "xlsx-js-style"`
- Sem mais alterações necessárias — todo o código de estilização já escrito passará a funcionar

---

### 2. Geração em segundo plano (mobile)

O celular trava porque o browser precisa: buscar 10+ tabelas inteiras via fetchAllRows, processar tudo em memória, e gerar o XLSX — tudo síncrono no main thread.

**Arquitetura**:

```text
[Usuário clica Gerar] 
  → POST edge function "generate-relatorio-mensal" (mes, ano)
  → Edge function busca dados com service_role, gera XLSX, salva no Storage
  → Retorna URL do arquivo
[Cliente baixa o arquivo pronto]
```

**Implementação**:
- Nova edge function `generate-relatorio-mensal/index.ts` que recebe `{ mes, ano }` e faz toda a lógica que hoje está em `DashboardRelatorioMensalTab.tsx`
- Usa `npm:xlsx-js-style` no Deno para gerar o XLSX com estilos
- Salva o resultado no bucket `documentos` (privado) com path `relatorios-mensais/{ano}-{mes}_{timestamp}.xlsx`
- Retorna `{ url: signedUrl }` com URL temporária de download
- No frontend, o botão "Gerar XLSX" chama `supabase.functions.invoke(...)`, mostra spinner, e faz download da URL retornada
- Funciona em qualquer dispositivo sem travar o browser

---

### 3. Relatório de Execução do Objeto (REO) — automação via template DOCX

O documento analisado tem esta estrutura, e cada seção mapeia para dados já existentes no app:

| Seção do REO | Fonte de dados no SysELO |
|---|---|
| 1.1 Atividades propostas × desenvolvidas | `planejamentos` + `relatorios_atividade` (filtrado pelo mês) |
| 1.2 Serviços da Equipe Técnica | `atendimentos` agrupados por tipo |
| 1.3 Comparativo de metas por bairro | `presenca` + `participantes` + `turmas` (lógica já existe em Metas) |
| 1.4 Recursos Humanos | `profiles` com cargos |
| 1.5 Monitoramento e Avaliação | Indicadores de presença (lógica já existe em Monitoramento) |
| 2.1-2.4 Execução Financeira | **Novo módulo financeiro** |
| Anexos I — Registros Fotográficos | `relatorio_fotos` do período |

**Implementação**:

- Salvar o DOCX modelo no bucket `templates` como `reo.docx`
- Inserir tags `{...}` no modelo para cada campo (ex: `{tabela_atividades}`, `{MES_ANO}`, `{COUNT_VISITAS_DOMICILIARES}`, etc.)
- Adicionar entrada `reo.docx` no `TemplateTagMapper` com os campos disponíveis
- Nova função `exportRelatorioPdf/Docx` em `useDocumentExport.ts` que:
  - Busca todos os dados do período
  - Monta os objetos de dados para cada tabela
  - Preenche o template via `docxtemplater`
  - Inclui fotos dos relatórios como anexos (via `ImageModule` do docxtemplater ou fallback com páginas de fotos)
- Nova seção na aba "Relatório Mensal" do Dashboard: "Gerar REO (DOCX)" com seletor de mês/ano
- O REO também pode ser gerado pela edge function em segundo plano

---

### 4. Módulo Financeiro

**Novas tabelas (migração SQL)**:

```sql
-- Parcelas recebidas
CREATE TABLE public.parcelas_financeiras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_parcela integer NOT NULL,
  valor numeric NOT NULL,
  data_recebimento date NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Categorias econômicas (plano de contas)
CREATE TABLE public.categorias_financeiras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL,
  descricao text NOT NULL,
  valor_previsto numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Despesas mensais
CREATE TABLE public.despesas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_lancamento text,
  descricao text NOT NULL,
  valor numeric NOT NULL,
  data_lancamento date NOT NULL,
  categoria_id uuid REFERENCES public.categorias_financeiras(id),
  mes_referencia text NOT NULL, -- 'YYYY-MM'
  created_at timestamptz DEFAULT now()
);

-- Estornos
CREATE TABLE public.estornos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria_id uuid REFERENCES public.categorias_financeiras(id),
  valor numeric NOT NULL,
  mes_referencia text NOT NULL,
  created_at timestamptz DEFAULT now()
);
```

- RLS: coordenação e técnico podem CRUD; demais autenticados podem SELECT
- **Página `/financeiro`**: CRUD de parcelas, despesas, categorias e estornos
- Os dados alimentam automaticamente as seções 2.1-2.4 do REO
- Item "Financeiro" no grupo GESTÃO do sidebar

---

### 5. Anexos fotográficos automáticos no REO

- Buscar `relatorio_fotos` via `relatorio_turmas` filtrado pelo período
- Para cada foto, baixar a imagem e inserir no DOCX como página de anexo
- Se usando docxtemplater: usar módulo de imagem ou gerar páginas extras programaticamente
- Se muitas fotos (>20), agrupar em grid (2-3 por página)

---

### Resumo de arquivos

| Arquivo | Mudança |
|---|---|
| `package.json` | Trocar `xlsx` por `xlsx-js-style` |
| `src/pages/dashboard/DashboardRelatorioMensalTab.tsx` | Import `xlsx-js-style` + botão REO + chamada edge function |
| `src/hooks/useDataExport.ts` | Import `xlsx-js-style` |
| `supabase/functions/generate-relatorio-mensal/index.ts` | Nova edge function para gerar XLSX em segundo plano |
| `src/hooks/useDocumentExport.ts` | Nova função `exportREODocx` |
| `src/components/TemplateTagMapper.tsx` | Campos para `reo.docx` |
| Migração SQL | Tabelas financeiras + RLS |
| `src/pages/financeiro/FinanceiroPage.tsx` | Nova página CRUD financeiro |
| `src/components/AppSidebar.tsx` | Item "Financeiro" |
| `src/App.tsx` | Rota `/financeiro` |

### Ordem de implementação sugerida

1. Trocar `xlsx` por `xlsx-js-style` (resolve formatação imediatamente)
2. Edge function de geração em segundo plano (resolve mobile)
3. Módulo financeiro (tabelas + página)
4. Automação do REO com template DOCX
5. Anexos fotográficos

