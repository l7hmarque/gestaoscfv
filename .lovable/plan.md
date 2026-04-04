

## Plano: Módulo Financeiro Avançado — MROSC/SIT + Detecção de documentos + Auditoria + RPA

---

### Resumo

Expandir o módulo financeiro com: rubricas pré-cadastradas do SCFV, lançamento em lote, upload de boletos/notas/comprovantes com detecção automática via IA, conformidade MROSC/SIT, geração de arquivo RCA, automação RPA para lançamento no SIT, e auditoria inteligente.

---

### 1. Rubricas pré-cadastradas do Plano de Trabalho

**Migração SQL** — inserir as rubricas padrão do SCFV na tabela `categorias_financeiras`:

| Código | Descrição |
|---|---|
| 3.1.90.04 | Contratação por tempo determinado |
| 3.1.90.11 | Vencimentos e vantagens fixas |
| 3.1.90.13 | Obrigações patronais |
| 3.3.90.14 | Diárias |
| 3.3.90.30 | Material de Consumo |
| 3.3.90.33 | Passagens e despesas com locomoção |
| 3.3.90.36 | Serviços de Terceiros — Pessoa Física |
| 3.3.90.39 | Serviços de Terceiros — Pessoa Jurídica |
| 3.3.90.47 | Obrigações tributárias e contributivas |
| 4.4.90.52 | Equipamentos e material permanente |

Usar INSERT via supabase insert tool (não migração, pois são dados). A tabela já existe com estrutura correta.

---

### 2. Campos adicionais na tabela `despesas` (MROSC/SIT)

**Migração SQL** para adequar ao formato exigido:

```sql
ALTER TABLE despesas ADD COLUMN IF NOT EXISTS
  fornecedor text,
  cnpj_cpf text,
  numero_documento text,
  tipo_documento text DEFAULT 'nota_fiscal',
  comprovante_url text,
  nota_url text,
  boleto_url text,
  status_sit text DEFAULT 'pendente',
  lote_id uuid;
```

Campos `tipo_documento`: `nota_fiscal`, `recibo`, `cupom_fiscal`, `boleto`, `darf`, `gps`, `outro`.
Campo `status_sit`: `pendente`, `lancado`, `erro`.

---

### 3. Lançamento em lote de despesas

**`FinanceiroPage.tsx`** — Novo dialog "Lançar em Lote":
- Formulário com N linhas editáveis (adicionar/remover)
- Cada linha: Descrição, Valor, Data, Categoria (select), Fornecedor, CNPJ/CPF, Nº Documento
- Botão "Salvar Todas" insere todas de uma vez com `supabase.from("despesas").insert([...array])`
- Gerar um `lote_id` compartilhado para rastreabilidade

---

### 4. Upload de documentos com detecção automática via IA

**Nova edge function `detect-despesa-from-doc`**:
- Recebe imagem/PDF (base64 ou URL do Storage)
- Usa Lovable AI (gemini-2.5-flash) com prompt para extrair: valor, data, fornecedor, CNPJ/CPF, nº documento, descrição, tipo
- Retorna JSON estruturado via tool calling

**UI em `FinanceiroPage.tsx`**:
- Botão "Importar Documentos" abre dialog
- Upload de múltiplos arquivos (boleto, nota fiscal, comprovante)
- Para cada arquivo: upload ao bucket `documentos`, chamar edge function, mostrar preview dos dados extraídos
- Usuário revisa/edita cada campo antes de confirmar
- Botão "Lançar Todas" salva as despesas com links para os documentos

---

### 5. Geração de arquivo RCA

**Nova edge function `generate-rca`**:
- Recebe `{ mes, ano }`
- Busca despesas do mês com todos os campos (fornecedor, CNPJ, nº documento, etc.)
- Gera arquivo CSV/XLSX no formato exigido pelo SIT (colunas: Nº Ordem, Data, Nº Documento, Fornecedor, CNPJ/CPF, Descrição, Valor, Categoria)
- Salva no Storage e retorna URL

**UI**: Botão "Gerar RCA" na página Financeiro.

---

### 6. Automação RPA para lançamento no SIT

**Abordagem**: O SIT é um sistema web governamental sem API. A automação via robô (browser automation) requer:

- **Nova edge function `sit-automation`** que recebe as credenciais (armazenadas como secret) e os dados das despesas
- Usa Puppeteer/Playwright em ambiente externo (não roda dentro de edge functions Deno)
- **Alternativa viável**: Gerar um script `.py` de automação com Selenium/Playwright que o usuário executa localmente, ou integrar com um serviço de RPA externo (n8n, Make, etc.)

**Implementação realista**:
1. Armazenar credenciais SIT como secrets (`SIT_USERNAME`, `SIT_PASSWORD`)
2. Gerar script Python de automação que:
   - Loga no SIT com as credenciais
   - Navega até a tela de lançamento
   - Preenche cada despesa do mês
   - Marca como `status_sit = 'lancado'`
3. Botão "Gerar Script RPA" na página Financeiro que baixa o `.py` pronto para executar
4. Alternativamente, sugerir integração com n8n (MCP connector disponível) para automação cloud

> **Nota**: Automação direta via edge function não é possível pois o SIT não tem API e edge functions não rodam browsers. A solução mais robusta é gerar o script + integrar com n8n para execução cloud.

---

### 7. Auditoria financeira inteligente

**Nova edge function `audit-financeiro`**:
- Recebe `{ mes, ano }` ou `{ periodo_inicio, periodo_fim }`
- Busca todas as despesas, parcelas, categorias, estornos
- Usa Lovable AI para analisar e detectar:
  - Despesas sem comprovante anexo
  - Despesas sem fornecedor ou CNPJ
  - Valores acima do previsto por categoria
  - Duplicidades (mesmo valor + data + fornecedor)
  - Gaps de numeração de documentos
  - Categorias com saldo negativo
  - Despesas fora do período de vigência
  - Inconsistências entre nota fiscal e valor lançado
- Retorna relatório estruturado com severidade (erro/alerta/sugestão)

**UI em `FinanceiroPage.tsx`**:
- Nova aba "Auditoria" ou botão no header
- Card com resultado da auditoria: lista de achados com ícones (erro vermelho, alerta amarelo, ok verde)
- Para cada achado: descrição do problema + ação sugerida + botão de correção automática quando aplicável
- Botão "Corrigir Automaticamente" para itens que podem ser resolvidos (ex: preencher categoria faltante baseado no código)

---

### Arquivos

| Arquivo | Mudança |
|---|---|
| Supabase insert tool | Rubricas pré-cadastradas |
| Migração SQL | Campos MROSC na tabela `despesas` |
| `src/pages/financeiro/FinanceiroPage.tsx` | Lote, import docs, RCA, auditoria, script RPA |
| `supabase/functions/detect-despesa-from-doc/index.ts` | IA para extrair dados de documentos |
| `supabase/functions/generate-rca/index.ts` | Geração de arquivo RCA |
| `supabase/functions/audit-financeiro/index.ts` | Auditoria inteligente com IA |

### Ordem de implementação

1. Migração SQL (campos + rubricas)
2. Lançamento em lote
3. Edge function de detecção de documentos + UI de upload
4. Geração de RCA
5. Auditoria financeira
6. Script RPA / integração n8n

