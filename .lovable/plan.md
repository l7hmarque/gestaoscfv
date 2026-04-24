
# Correção do export DOCX + Módulo Financeiro no padrão SIT

Duas frentes independentes:
1. **Bug**: exportar DOCX em relatório/planejamento individual está falhando.
2. **Financeiro SIT**: detecção precisa identificar **múltiplas despesas em um único PDF** (folha de pagamento, lote de comprovantes etc.), gravar todos os campos exigidos pelo SIT e gerar o `Despesa.txt` em lote no layout oficial.

---

## 1. Bug — Exportar DOCX (relatório e planejamento individual)

A causa provável é o `loadTemplate("relatorio.docx" / "planejamento.docx")` falhar silenciosamente (bucket `templates` ausente ou template inexistente) e o **fallback** quebrar em alguma propriedade ausente do `item` (ex.: `item.profiles?.nome`, `engajamento` quando vem `null`, fotos sem `foto_url`).

**O que será feito**
- Envolver `exportRelatorioDocx` e `exportPlanejamentoDocx` num try/catch externo que loga `e.message`, `e.stack` e (quando docxtemplater) `e.properties.errors[]` no console **e** mostra um toast com a causa real (em vez de “Erro ao gerar DOCX”).
- Tornar todos os acessos defensivos: arrays `engajamento / situacoes_relevantes / fotos / presenca` sempre tratados como `[] ` quando `null/undefined`; `tipo_atividade` aceita string, array ou null.
- Garantir que o **fallback** (gera DOCX do zero, sem template) execute sempre que `loadTemplate` retornar `null` **ou** lançar erro — hoje há caminhos em que o catch só dispara o toast e não chama o fallback.
- Sanitizar caracteres inválidos antes de passar ao docx-js (substituir `\u0000-\u0008\u000B\u000C\u000E-\u001F` por “”).
- Após o fix, deploy + teste manual abrindo um relatório/planejamento existente.

---

## 2. Financeiro — Padrão SIT (Sistema Integrado de Transferências)

### 2.1 Por que só 1 despesa foi detectada

`detect-despesa-from-doc` envia o PDF para o Gemini com a função `extract_despesa` que retorna **um único objeto** (1 despesa). Folhas de pagamento, lotes de comprovantes e PDFs com várias páginas geram N despesas — o modelo precisa devolver um **array**.

### 2.2 Refatoração da edge function

Renomear o tool para `extract_despesas` e mudar o schema:

```text
extract_despesas → { despesas: [ { ...campos SIT... } ] }
```

Cada item conterá os 24 campos do layout SIT (ver tabela na seção 2.4). Prompt orientará a IA a:
- iterar por todas as páginas do PDF,
- agrupar por “transferência/comprovante” (ex.: cada bloco “COMPROVANTE DE TRANSFERENCIA … TRANSFERIDO PARA …” = 1 despesa),
- inferir `tpDocumentoDespesa` (folha de pagamento → 6, NF → 1, recibo → 4 etc.) e `tpDocumentoPagamento` (transferência bancária → 3),
- normalizar valores (`1.019,23` → `1019.23`) e datas (`02/03/2026` → `2026-03-02`).

Modelo trocado para **`google/gemini-2.5-pro`** (multi-página + raciocínio mais robusto). `gemini-2.5-flash` fica como fallback se 429.

### 2.3 Novas tabelas / colunas

**Migração** adicionando à tabela `despesas` os campos exigidos pelo SIT que ainda não existem:

```text
sit_tipo_transferencia       smallint   -- código SIT (Apêndice A)
sit_numero_instrumento       text(20)
sit_ano_transferencia        smallint
sit_codigo_tipo_despesa      integer    -- ex 33903001
sit_tipo_doc_favorecido      text(4)    -- CPF | CNPJ | EXT
sit_nome_favorecido          text(250)
sit_tipo_doc_despesa         smallint   -- código SIT
sit_numero_doc_despesa       text(10)
sit_data_doc_despesa         date
sit_placa_veiculo            text(7)
sit_quilometragem            integer
sit_numero_empenho           text(15)
sit_data_empenho             date
sit_modalidade_compra        smallint
sit_numero_processo          text(10)
sit_data_processo            date
sit_tipo_doc_pagamento       smallint   -- ex 3 = transferência
sit_numero_doc_pagamento     text(15)
sit_data_emissao_pagamento   date
sit_data_debito              date
sit_descricao_item           text(2000)
sit_completo                 boolean default false  -- todos os obrigatórios preenchidos
```

Nova tabela `sit_configuracao` (1 linha por OSC) com `cnpj_concedente`, `tipo_transferencia_padrao`, `numero_instrumento_padrao`, `ano_transferencia_padrao`, `tipo_doc_pagamento_padrao` — aplicados como defaults em todo lançamento.

Nova tabela `sit_codigos` (apêndice A): `categoria` (`tipo_despesa | tipo_doc_despesa | tipo_doc_pagamento | modalidade_compra | tipo_transferencia`), `codigo`, `descricao`. Carregada pela coordenação na primeira vez via tela de Configurações → SIT.

RLS: leitura para qualquer autenticado, escrita só para `coordenacao`.

### 2.4 UI Financeiro

**Aba “Lançamento Inteligente” (refatorada)**
- Drop de **N PDFs/imagens** → cada arquivo retorna **lista** de despesas detectadas; cada uma vira um card revisável.
- Para cada card: campos SIT pré-preenchidos + “Status SIT”: ✅ completo / ⚠ faltando X campos.
- Botão “Salvar todas” persiste em `despesas` + sobe o PDF original (uma vez) e amarra a `comprovante_url` em todas as despesas extraídas dele (mais o `comprovante_pagina` quando aplicável).

**Aba “Lançamento Manual”**
- Mantida, mas com checkbox **“Pendente de comprovante”** (default ligado se nenhum arquivo anexado). Despesas pendentes ficam visíveis na lista com badge ⚠ “Anexar documento”.
- Quando o usuário voltar e anexar PDF/foto, o sistema baixa, sobe ao bucket `prestacao-contas/{ano}/{mes}/{id}.pdf` e marca `sit_completo = true` (se demais campos OK).

**Aba “Exportar SIT”**
- Filtro mês/ano + termo de fomento.
- Botão **“Gerar Despesa.txt”** que monta o arquivo conforme regras (pipe `|`, decimal com ponto, datas `DD-MM-AAAA`, sem cabeçalho, ordem fixa dos 24 campos, vazios `||`, valores obrigatórios sem dado → `0.00`).
- Validação prévia: se houver `sit_completo = false`, abrir diálogo listando despesas incompletas e impedir export até resolver (ou marcar para excluir do lote).
- Botão paralelo **“Baixar pacote ZIP”** com `Despesa.txt` + todos os comprovantes nomeados como `{nrDocumentoDespesa}_{nmFavorecido}.pdf` para anexar à prestação de contas.

### 2.5 Diagrama

```text
PDF lote ──▶ detect-despesa-from-doc (Gemini Pro, retorna ARRAY)
                  │
                  ▼
       Cards revisáveis (UI Financeiro)
                  │  (coordenação valida/edita)
                  ▼
            despesas (+ campos SIT)
            comprovante_url ────────────► storage: prestacao-contas/...
                  │
                  ├─▶ Exportar SIT ─▶ Despesa.txt (pipe-delimited, layout oficial)
                  └─▶ Pacote ZIP   ─▶ Despesa.txt + comprovantes/
```

---

## Detalhes técnicos

- **Edge function** `detect-despesa-from-doc`: novo schema `{ despesas: array }`, prompt em PT-BR com few-shot do PDF de exemplo (folha de pagamento + comprovante BB), modelo `google/gemini-2.5-pro`. Mantém compatibilidade retornando também `extracted` (= `despesas[0]`) para callers antigos.
- **Storage bucket** `prestacao-contas` (privado, só `coordenacao` escreve, leitura via signed URL).
- **Gerador `.txt`**: novo módulo `src/lib/sitExport.ts` com função `buildDespesaTxtLine(d)` que aplica regras: trim/uppercase quando exigido, `0.00` em obrigatórios vazios, datas `DD-MM-AAAA`, sem cabeçalho, `\r\n` como quebra de linha (compat Windows/SIT), encoding `windows-1252` (ou UTF-8 se SIT aceitar — confirmar no PDF: o documento não exige; assumir UTF-8 sem BOM).
- **Códigos SIT (Apêndice A)**: como o apêndice não veio anexado, criar tela `/configuracoes` → aba “SIT” com importação CSV/JSON do apêndice + edição manual; pré-popular com valores comuns (`1=NF`, `4=Recibo`, `6=Folha de Pagamento`, `3=Transferência Bancária`, `33903001=Combustíveis`, `33903004=Gás`, `33903030=Material de Consumo`, `33903036=Serviços Técnicos PF`, `33903039=Outros Serviços PJ`, `33903046=Auxílio Alimentação`).
- **Compatibilidade**: despesas antigas (sem campos SIT) entram no `.txt` somente se a coordenação completar os campos obrigatórios; aparecem com badge “Migrar p/ SIT” na listagem.

## Fora do escopo
- Importação automática do Apêndice A completo (será carregado pela coordenação via CSV — fornecemos template).
- Lançamento direto no portal SIT (apenas geração do arquivo `.txt` para upload manual).
- OCR de PDFs escaneados de baixa qualidade (Gemini já faz OCR básico; PDFs ilegíveis cairão para lançamento manual com badge “pendente”).
