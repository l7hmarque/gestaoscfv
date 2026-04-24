# Finalizar módulo SIT no Financeiro

Continuar de onde parei: a base (migration, edge function multi-despesas, `sitExport.ts`, fix do DOCX) já está pronta. Faltam **3 itens de UI** para fechar o ciclo de prestação de contas no padrão TCE-PR/SIT.

## 1. Aba "SIT" em `/configuracoes`

Nova aba para a Coordenação preencher os dados que vão em **todas** as linhas do `Despesa.txt` (hoje vão vazios e quebram a importação no SIT).

Campos (gravados em `sit_configuracao`, 1 linha única):
- CNPJ do Concedente (Estado/Município)
- Nº do Termo / Ano do Termo
- CNPJ da OSC (auto-preenchido das configurações gerais, editável)
- Exercício padrão (ano corrente)
- Banco / Agência / Conta corrente da prestação
- Código do órgão concedente (campo livre — varia por município)

Botão **Salvar** → upsert na `sit_configuracao`. Badge no topo da aba mostrando "✅ Pronto para exportar SIT" ou "⚠️ Faltam X campos".

## 2. Botões "Gerar Despesa.txt" e "Baixar pacote ZIP" no Financeiro

Nova seção **"Exportação SIT"** no topo da página `/financeiro`, com seletor de **mês/ano de competência**.

Fluxo:
1. Buscar despesas do período onde `sit_completo = true`.
2. Validar pré-requisitos (config SIT preenchida + todas as despesas com comprovante anexado).
3. Mostrar contagem: "X despesas prontas · Y pendentes" + lista expansível das pendentes com link p/ corrigir.
4. **Botão "Gerar Despesa.txt"** → usa `buildDespesaTxt()` já criado, baixa o `.txt` puro.
5. **Botão "Baixar pacote ZIP"** → gera ZIP com:
   - `Despesa.txt`
   - Subpasta `comprovantes/` com cada anexo renomeado no padrão SIT: `{numero_documento}_{cnpj_favorecido}.pdf`
   - `README.txt` com instruções de upload no portal SIT.

Implementação ZIP: `jszip` (já no projeto via outras exportações).

## 3. Badges e modal de regularização na lista de despesas

Na tabela/cards de despesas existentes (`FinanceiroPage.tsx`):

- Badge **⚠️ "Pendente comprovante"** (amarelo) quando `pendente_comprovante = true` ou `arquivo_url` nulo.
- Badge **🔄 "Migrar p/ SIT"** (azul) quando despesa antiga sem campos `sit_*` preenchidos.
- Clique na badge → abre modal **"Regularizar para SIT"** com:
  - Upload de comprovante (PDF/JPG, vai p/ bucket `prestacao-contas`)
  - Campos `sit_*` faltantes (tipo doc favorecido, nº empenho, data débito, código natureza)
  - Pré-preenchimento via dropdown da tabela `sit_codigos`
  - Salvar → marca `sit_completo = true` e `pendente_comprovante = false`

Filtro rápido no topo da lista: **"Mostrar só pendentes SIT"** (toggle).

## Detalhes técnicos

**Arquivos a editar:**
- `src/pages/configuracoes/ConfiguracoesPage.tsx` → adicionar `<TabsTrigger value="sit">`
- novo: `src/pages/configuracoes/ConfiguracoesSitTab.tsx`
- `src/pages/financeiro/FinanceiroPage.tsx` → seção exportação + badges + filtro
- novo: `src/components/financeiro/RegularizarSitDialog.tsx`
- novo: `src/lib/sitZipPackage.ts` → monta ZIP usando `jszip` + `sitExport.ts`

**Validações no Despesa.txt** (antes de gerar):
- CNPJ do concedente preenchido (sit_configuracao)
- Toda despesa com `numero_documento`, `cnpj_favorecido`, `valor`, `data_pagamento`, `codigo_natureza`
- Bloqueia download se faltar qualquer um, mostrando lista do que falta.

**Auditoria:** cada geração de pacote SIT grava em `audit_log` (`acao: 'sit_export_gerado'`) com `mes/ano` e contagem de despesas exportadas.

## Fora do escopo (próxima iteração)

- Importação reversa de retorno do SIT (.txt de erros).
- Assinatura digital ICP-Brasil dos PDFs.
- Conciliação bancária automática com OFX.
