## O que a planilha tem

103 linhas com 3 colunas: **Nome Completo**, **Atenção Prioritária ou Situação de Vulnerabilidade**, **Origem Encaminhamento**.

Valores distintos encontrados na coluna de vulnerabilidade:

- "Não está em situação prioritária" (≈30 linhas)
- "Vivência de violência e, ou negligência" (≈12)
- "violação de direitos" / "Direitos violados" (2)
- "Com medidas de proteção do Estatuto da Criança e do Adolescente - ECA" (1)
- "Situação de abuso e/ou exploração sexual" (2)
- vazio (≈55)

Origens: CRAS, CREAS, Conselho Tutelar, Educação, Busca Ativa, Demanda espontânea.

## Como vou aplicar

1. **Casamento de nomes** — normalizo (upper + sem acentos + trim) e bato contra `participantes.nome_completo`. Já validei que o casamento funciona (Title Case no banco vs UPPER na planilha).
2. **Atualizo `categoria_vulnerabilidade**` mapeando para as categorias padrão já existentes em `categorias_vulnerabilidade_padrao`:
  - "violação de direitos" / "Direitos violados" / "Vivência de violência e, ou negligência" → **Violação de Direitos Identificada**
  - "Com medidas de proteção... ECA" → **Medida Protetiva (ECA)**
  - "Situação de abuso e/ou exploração sexual" → **Violação de Direitos Identificada** (não há categoria específica)
  - "Não está em situação prioritária" → **deixa em branco** (é justamente a ausência de vulnerabilidade prioritária)
  - vazio → não altera
3. **Atualizo `origem_encaminhamento**` com o valor literal da planilha (CRAS, CREAS, Conselho Tutelar, Educação, Busca Ativa, Demanda espontânea) — **só preenche se estiver vazio no banco**, para não sobrescrever dados já corretos.
4. **Relatório** — listo no chat: quantos participantes foram encontrados, quantos atualizados, quantos não encontraram correspondência (para você revisar manualmente).

## Detalhes técnicos

- Migration única com `UPDATE` por nome (case/accent-insensitive via `lower(translate(nome_completo, 'áàâãäéèêëíïóòôõöúùûüç', 'aaaaaeeeeiioooouuuuc'))`).
- Não toco em `laudo` (campo clínico, diferente).
- Após salvar, o dashboard "Distribuição por Vulnerabilidade" passa a mostrar as categorias reais (PBF, Medida Protetiva, Violação de Direitos) em vez de só "Outros".

## Pergunta única antes de executar

Você confirma o mapeamento de **"Situação de abuso e/ou exploração sexual"** → **Violação de Direitos Identificada**? Ou prefere que eu crie uma categoria padrão nova chamada **"Abuso/Exploração Sexual"**? confirmo. 