# Otimização da Caixa de Entrada: leitura híbrida texto + visão e conciliação com extrato

## Contexto dos arquivos enviados

Analisei os 3 PDFs de exemplo:


| Arquivo                            | Tipo                  | OCR?                      | Páginas | O que contém                                                                                 |
| ---------------------------------- | --------------------- | ------------------------- | ------- | -------------------------------------------------------------------------------------------- |
| `Despesas_OCR.pdf`                 | compilado de despesas | **SIM** (texto extraível) | 50+     | Comprovantes BB + holerites + boletos + NFs intercalados                                     |
| `Extrato_conta_corrente_04_26.pdf` | extrato bancário      | NÃO (sem camada de texto) | 3       | Tabela cronológica de **todas** as movimentações de 04/2026                                  |
| `SCNA_NOTA_1.pdf`                  | NF avulsa             | SIM                       | 2       | NF FOZ CONSTRUTORA R$ 38.572,00 (aparece no extrato em 14/04 PIX, mas NÃO está no compilado) |


Observação importante: o parser do Lovable indicou que o `Despesas_OCR` *tem* OCR — mas o nome do arquivo sugere que o PDF original veio escaneado e foi rodado OCR depois. Significa que a **camada de texto existe**, mas pode ter erros de OCR (dígitos trocados, "0/O", "1/I"). A leitura híbrida precisa lidar com isso.

## Objetivo

1. **Otimização** — reduzir tempo e custo de processamento de PDFs com camada de texto (rota texto-only quando possível), mantendo qualidade
2. **Conciliação (oportunidade nova, opt-in)** — quando o usuário também subir o extrato bancário do mesmo mês, cruzar com as despesas extraídas e apontar **lançamentos do extrato sem despesa correspondente** (caso da NF avulsa de R$ 38.572,00)

## Parte 1 — Leitura híbrida texto + visão

### Detecção no cliente (`CaixaEntradaTab.tsx`)

- Usar `pdfjs-dist` para abrir o PDF e iterar páginas
- Para cada página: `page.getTextContent()` → contar caracteres não-whitespace
- Heurística por página:
  - `≥ 50 chars` → **nativa** (rota texto)
  - `< 50 chars` → **escaneada** (rota visão)
- Se o PDF tem ≥ 80% das páginas nativas → modo texto puro; caso contrário, modo visão (fluxo atual). Híbrido fica para fase 2 — não vale a complexidade inicial.

### Nova entrada no `detect-despesa-from-doc`

- Aceitar input alternativo: `pages_text: string[]` (texto bruto por página, com marcador `=== PÁGINA N ===`)
- Quando vier `pages_text`, monta `userContent` como **texto puro**, sem `type: "file"` base64
- **Mesmo `SYSTEM_PROMPT**`, **mesma tool `extract_despesas**`, **mesmo schema** — saída idêntica
- Adendo no prompt: *"Você está recebendo texto extraído por OCR. Pode haver erros de dígitos (0/O, 1/I, 5/S). Quando um valor numérico parecer inconsistente, prefira a leitura mais provável dado o contexto (total = vencimentos − descontos). Marca-texto amarelo NÃO é detectável neste modo: assuma `marcado_orcamento=false`."*

### Modelo

- Texto-only: `google/gemini-2.5-flash-lite` (5–10x mais barato e rápido)
- Visão: continua `google/gemini-2.5-flash` (atual)
- Fallback 429: subir um nível

### Marca-texto amarelo

- Adicionar toggle simples na Caixa de Entrada: **"Detectar marca-texto amarelo (modalidade Pesquisa de Preço)"**
- Quando ligado → força rota visão para o PDF inteiro
- Quando desligado (default) → escolhe automaticamente a rota mais barata

### Ganho esperado

- Compilado tipo `Despesas_OCR.pdf` (50 páginas com texto): processamento 3–8× mais rápido, custo cai significativamente
- PDF escaneado tipo `Extrato_conta_corrente`: igual ao atual (vai pra visão)

## Parte 2 — Conciliação extrato ↔ despesas (opt-in, opcional)

> Se você não quiser essa parte agora, eu construo só a Parte 1. Mas como você mandou o extrato e a NF "perdida" justamente para mostrar o problema, faz sentido tratar.

### Como funciona

1. Quando um documento for classificado como `controle_bancario` (extrato), além de salvar como hoje, a IA já extrai as **movimentações** (data, valor, histórico, favorecido, nº documento) — uma chamada nova `detect-extrato-movimentacoes` com schema próprio
2. Salvar movimentações em nova tabela `extrato_movimentacoes` ligada ao `caixa_entrada_documentos.id`
3. Card novo na Caixa de Entrada: **"Conciliação do mês"** que, dado um mês de referência, compara:
  - Lançamentos do extrato (valor + data + favorecido)
  - Despesas extraídas no mesmo período
4. Mostra duas listas:
  - **No extrato sem despesa correspondente** → "Faltam comprovantes/NFs para estes lançamentos" (ex: PIX 14/04 FOZ CONSTRUTORA R$ 38.572,00)
  - **Em despesa sem lançamento no extrato** → possível duplicidade ou erro de digitação
5. Pareamento: igualdade de valor + ±2 dias de diferença + similaridade de nome (Levenshtein ≥ 0.7)

### Schema novo (mínimo)

```sql
CREATE TABLE extrato_movimentacoes (
  id uuid pk,
  caixa_entrada_doc_id uuid fk,
  data date, valor numeric(14,2), tipo text, -- 'D' | 'C'
  historico text, favorecido text, numero_doc text,
  conciliada_despesa_id uuid null,
  created_at timestamptz default now()
);
```

Com RLS espelhando `caixa_entrada_documentos`.

## O que NÃO muda

- Schema de `despesas` e `caixa_entrada_documentos`
- Tool `extract_despesas` e seu schema
- Auto-lançamento na aba Despesas
- Validação `validateDespesa`, matching com orçamentos, regras SIT/tributos federais

## Arquivos afetados

**Parte 1:**

- `src/components/financeiro/CaixaEntradaTab.tsx` — detecção via `pdfjs-dist`, toggle marca amarela, envio condicional de `pages_text`
- `supabase/functions/detect-despesa-from-doc/index.ts` — aceitar `pages_text`, montar prompt texto, escolher modelo

**Parte 2 (se aprovada):**

- nova migration: `extrato_movimentacoes`
- nova edge function: `detect-extrato-movimentacoes`
- `CaixaEntradaTab.tsx` — invocação ao classificar `controle_bancario`
- novo componente: `ConciliacaoExtratoCard.tsx`

## Decisão pendente

1. **Faço só a Parte 1** (otimização) ou **Parte 1 + Parte 2** (otimização + conciliação)? faz parte 1 + parte 2.
2. Marca-texto amarelo: confirma que o toggle manual atende? nao confirma, pensar em outra forma de classificar depois, nem que seja manualmente a principio.