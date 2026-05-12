## Diagnóstico

Analisei o fluxo `detect-despesa-from-doc` → `validateDespesa` → `insert despesas` → exportações (RCA/SIT/Prestação XLSX).

**Causas dos problemas relatados:**

1. **Aba Despesas (planilha) com Código/Boleto/Comprovante vazios:**
   - Na importação, `validateDespesa` só preenche `nota_url = storageUrl`. Nunca grava `boleto_url` nem `comprovante_url`, e **não gera `codigo_lancamento`** (campo fica null).
   - O gerador da Prestação (`generatePrestacaoContas` em `FinanceiroPage.tsx`, linhas 740–744) lê esses três campos → todos vazios.

2. **"folha_pagamento" cru no RCA/SIT:**
   - `TIPOS_DOCUMENTO` (FinanceiroPage.tsx l.71) não contém `folha_pagamento`.
   - Quando a IA classifica como `folha_pagamento`, o lookup por `label` retorna o valor cru (ou vazio) → aparece "folha_pagamento" no SIT/RCA.

3. **Valores arredondados:** prompt da IA pede "número decimal com ponto" mas não proíbe arredondamento. Modelo às vezes trunca `1.419,35` → `1419`.

4. **Boleto + comprovante na mesma página:** IA hoje retorna 1 despesa, mas frontend só salva 1 URL (`nota_url`). Falta marcar que aquele PDF cumpre os 3 papéis (NF separada, boleto+comprovante juntos).

5. **Holerites sem código/data padronizados:** prompt não define a regra `mm/aaaa` (mês anterior ao pagamento) nem último dia do mês anterior.

6. **Ordem da Prestação de Contas / Controle Bancário:** hoje despesas são ordenadas por `data_lancamento`. Não existe upload nem extração do Controle Bancário, nem campo de ordenação a partir dele.

---

## Plano de implementação

### 1. Novo tipo de documento "Folha Pagamento/Holerite"

- Em `src/pages/financeiro/FinanceiroPage.tsx` adicionar `{ value: "folha_pagamento", label: "Folha Pagamento/Holerite" }` em `TIPOS_DOCUMENTO`.
- Validar/garantir que `src/lib/sitCodeMappings.ts` mapeia `folha_pagamento → 6` (já existe; revisar `describeSitTipoDocDespesa` para retornar "Folha Pagamento/Holerite").
- RCA (`generate-rca/index.ts`) e SIT (`generateDespesaTxt`) passam a usar `TIPOS_DOCUMENTO.label` corrigido.

### 2. IA: regras adicionais em `detect-despesa-from-doc`

Acrescentar ao SYSTEM_PROMPT:

- **Valores BRL sem arredondamento:** "Extraia o valor EXATAMENTE como aparece no documento, preservando todos os centavos. Nunca arredonde. Converta `1.419,35` → `1419.35` (decimal com ponto, 2 casas)."
- **Regra de holerite/folha:**
  - `tipo_documento = "folha_pagamento"`, `sit_tipo_doc_despesa = 6`.
  - `numero_documento` / `sit_numero_doc_despesa` = `MM/AAAA` onde `MM` = mês ANTERIOR à data do comprovante de pagamento, `AAAA` = ano do pagamento (no exemplo, pagamento 01/04/2026 → código `03/2026`).
  - `data_lancamento` / `sit_data_doc_despesa` = ÚLTIMO DIA do mês anterior (ex.: `2026-02-28`).
  - `sit_data_emissao_pagamento` continua sendo a data da transferência.
- **Pareamento boleto+comprovante mesma página:** quando boleto e comprovante de pagamento aparecem JUNTOS na mesma página, retornar novo flag `anexos: { tem_nf, tem_boleto, tem_comprovante }` para o item, indicando os 3 papéis presentes no PDF importado.

### 3. Persistência de anexos na importação

Em `src/lib/despesaImportValidation.ts` (`row` final):

- Continuar salvando `nota_url = storageUrl` quando `anexos.tem_nf` (default true).
- Quando `anexos.tem_boleto` → também gravar `boleto_url = storageUrl`.
- Quando `anexos.tem_comprovante` → também gravar `comprovante_url = storageUrl` e marcar `status_sit = "pago"`.
- Gerar `codigo_lancamento` automaticamente:
  - Holerite: usa o `MM/AAAA` derivado pela IA.
  - Demais: usa `numero_documento` (ou sequencial `mesRef-NNN` se vazio).

### 4. Aba "Despesas" da Prestação (XLSX/PDF)

`generatePrestacaoContas`:

- Após persistência correta dos campos, as colunas Código/Comprovante/NF/Boleto passam a ser preenchidas automaticamente.
- Reordenar despesas na ordem do Controle Bancário (ver passo 6) quando disponível; fallback para `data_lancamento`.

### 5. Armazenamento ordenado para PDF consolidado

- Já existem `comprovante_url`, `nota_url`, `boleto_url` na tabela `despesas` (bucket `prestacao-contas`).
- Adicionar coluna `ordem_prestacao integer` (default null) em `despesas`.
- Novo botão "Gerar PDF Consolidado da Prestação" no FinanceiroPage:
  - Para cada despesa em `ordem_prestacao` ASC (fallback data), baixar `nota_url`, `boleto_url`, `comprovante_url` (deduplicando quando apontam para o mesmo arquivo) e mesclar tudo num PDF único usando `pdf-lib` (já no projeto via export REO? Caso não, adicionar `pdf-lib`).
  - Capa = sumário das despesas, ordem = Controle Bancário.

### 6. Controle Bancário (novo upload + IA)

- Adicionar nova categoria de upload na importação financeira: "Controle Bancário".
- Nova edge function `detect-controle-bancario` (ou novo modo dentro de `detect-despesa-from-doc`) que extrai linhas: `data, descricao, valor, identificador` (NR.DOCUMENTO ou hash).
- Salvar em nova tabela `controle_bancario_lancamentos` (mes_referencia, data, descricao, valor, nr_documento, ordem).
- Após importar Controle Bancário, rodar matcher (valor + data + nr_documento) que atribui `ordem_prestacao` em `despesas`.
- Exibir status "Conciliado com Controle Bancário ✓" na lista.

### 7. Migração / banco

- `ALTER TABLE despesas ADD COLUMN ordem_prestacao integer;`
- `CREATE TABLE controle_bancario_lancamentos (...)` + RLS coordenação (igual a `despesas`).

---

## Detalhes técnicos

**Arquivos a editar:**
- `supabase/functions/detect-despesa-from-doc/index.ts` — prompt + schema (`anexos`, regras BRL/holerite).
- `src/lib/despesaImportValidation.ts` — gravar `boleto_url`, `comprovante_url`, `codigo_lancamento`, `status_sit` a partir dos `anexos`.
- `src/pages/financeiro/FinanceiroPage.tsx` — adicionar `folha_pagamento` em `TIPOS_DOCUMENTO`; novo card "Controle Bancário"; novo botão "PDF Consolidado".
- `src/lib/sitCodeMappings.ts` — descrição "Folha Pagamento/Holerite".
- `supabase/functions/generate-rca/index.ts` — usar label correto.
- Nova edge function `detect-controle-bancario` (espelho do `detect-despesa-from-doc`).
- Nova migração (`ordem_prestacao` + tabela `controle_bancario_lancamentos`).
- `pdf-lib` para mesclar PDFs (verificar se já está nas deps; se não, `bun add pdf-lib`).

**Compatibilidade:** despesas antigas continuam funcionando (campos novos opcionais; ordenação cai para `data_lancamento`).
