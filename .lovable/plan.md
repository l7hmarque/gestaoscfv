# Marca-texto amarelo → Modalidade 7 (Pesquisa de Preço)

## Objetivo

Permitir que o usuário, antes de subir o PDF de despesas, marque com **marca-texto amarelo** os valores/linhas que pertencem à modalidade de **orçamento (Pesquisa de Preço — modalidade SIT 7)**. A IA reconhece o destaque visual e classifica automaticamente apenas essas despesas, sem alterar as demais.

## Como vai funcionar para o usuário

1. No PDF (ex: Adobe Reader, Foxit, Preview), o usuário usa a ferramenta de **destaque amarelo** sobre o valor ou a linha da despesa que veio de orçamento aprovado.
2. Sobe o PDF normalmente pela **Caixa de Entrada** ou pela aba **Despesas → Importar**.
3. A IA, ao analisar a imagem da página, identifica regiões com fundo amarelo e marca aquelas despesas com `sit_modalidade_compra = 7`.
4. O matcher de orçamentos já existente (`orcamentoMatcher.ts`) tenta vincular essas despesas ao orçamento aprovado correspondente (por CNPJ + mês). Se encontrar, preenche `orcamento_id`.
5. Se não houver marca amarela, a modalidade segue a regra atual (8 para tributos, 1 padrão, etc.).

Indicação visual no resultado da importação: badge **"Marcado (Pesquisa de Preço)"** nas linhas detectadas.

## Mudanças técnicas

### 1) `supabase/functions/detect-despesa-from-doc/index.ts`
Adicionar regra **11) MARCA-TEXTO AMARELO** ao `SYSTEM_PROMPT`:

- Examine cada página em busca de regiões com **destaque/realce amarelo** (highlight) sobre valores monetários, nomes de fornecedor ou linhas de itens.
- Para cada despesa cuja **linha, valor ou bloco esteja sob marca amarela**, force:
  - `sit_modalidade_compra = 7` (Pesquisa de Preço)
  - novo campo `marcado_orcamento: true` no JSON de retorno
- Se a marca amarela aparece sobre **uma linha específica de uma folha/lista**, aplique somente àquela despesa, não às demais do mesmo PDF.
- Tributos (FGTS/INSS/PIS) **ignoram a marca amarela** — modalidade continua 8.

Adicionar `marcado_orcamento: boolean` ao schema de resposta documentado no prompt.

### 2) `src/lib/despesaImportValidation.ts`
- Após validar, se `marcado_orcamento === true` e não for tributo, garantir `sit_modalidade_compra = 7`.
- Propagar `marcado_orcamento` para a linha exibida na revisão.

### 3) `src/lib/orcamentoMatcher.ts`
- Quando `marcado_orcamento === true` e o match por CNPJ/nome **falhar**, ainda assim manter `sit_modalidade_compra = 7` (apenas `orcamento_id` fica nulo). Hoje a função só seta modalidade 7 quando há match — vamos preservar a marca do usuário mesmo sem orçamento aprovado encontrado.

### 4) UI — revisão da importação (`FinanceiroPage.tsx` + `CaixaEntradaTab.tsx`)
- Mostrar **badge amarelo "Pesquisa de Preço (marcado)"** nas linhas com `marcado_orcamento`.
- Adicionar bloco curto de **instrução** acima da dropzone:
  > Dica: marque com **marca-texto amarelo** no PDF os valores que vieram de orçamento aprovado. A IA classifica essas despesas como Pesquisa de Preço (modalidade 7) automaticamente.

### 5) Sem mudanças de banco
O campo `marcado_orcamento` é apenas auxiliar durante a importação; o que persiste é `sit_modalidade_compra` e `orcamento_id` (já existentes).

## Fora do escopo
- Detecção de outras cores (rosa, verde) — pode ser adicionado depois se houver demanda para outras modalidades.
- Edição de PDF dentro do app — o usuário continua marcando no leitor de PDF de sua preferência.

## Deploy
Após aprovação: redeploy de `detect-despesa-from-doc`. Sem migração de banco.
