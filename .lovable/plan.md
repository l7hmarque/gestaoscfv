## Objetivo
Gerar um arquivo `.xlsx` único (one-off) com os participantes que tiveram **pelo menos 1 presença registrada em maio/2026**, segmentados por bairro × período × faixa etária.

## Fonte de dados
- Presenças vindas de `relatorio_presenca` (com `presente = true`) unidas ao `relatorios_atividade.data` entre `2026-05-01` e `2026-05-31`, conforme a lógica oficial de presença do sistema.
- União com `presenca.presente = true` no mesmo intervalo, para cobrir registros diretos.
- Dados do participante: `participantes.nome_completo`, `data_nascimento`, `periodo`, `bairro_id → bairros.nome`.
- Faixa etária calculada a partir da idade em `2026-05-31`.

## Estrutura do XLSX
- **9 abas** (uma por combinação Bairro × Período × Faixa):
  - JARDIM IRENE — MANHÃ — 6-8, 9-11, 12-17
  - JARDIM IRENE — TARDE — 6-8, 9-11, 12-17
  - PARQUE INDEPENDÊNCIA — MANHÃ — 6-8, 9-11, 12-17
  - PARQUE INDEPENDÊNCIA — TARDE — 6-8, 9-11, 12-17
  - ALVORADA — MANHÃ — 6-8, 9-11, 12-17
  - ALVORADA — TARDE — 6-8, 9-11, 12-17
  - (apenas as abas não vazias serão criadas; total até 18)
- Cada aba contém colunas: **#** (dígito contador sequencial), **Nome Completo**, **Idade**, **Data de Nascimento**.
- Cabeçalho institucional na primeira linha com Bairro / Período / Faixa / Mês de referência.
- Nomes em Title Case, ordenados alfabeticamente, sem duplicatas.
- Estilo grayscale conforme padrão SysCFV; auto-fit de coluna até 60 caracteres.

## Entrega
- Arquivo salvo em `/mnt/documents/SysCFV_PresentesMaio2026_{YYYY-MM-DD}_{HHmmss}.xlsx` e exposto via `<presentation-artifact>` para download imediato.
- Sem alterações no app, no banco ou em edge functions.

## Detalhes técnicos
- Script Python (pandas + openpyxl) executado via `code--exec`, consultando o banco com `psql -c "COPY (...) TO STDOUT WITH CSV HEADER"`.
- Idade: `floor((date('2026-05-31') - data_nascimento)/365.25)`; faixas: 6–8, 9–11, 12–17 (demais idades ignoradas).
- Bairro normalizado em maiúsculas e sem acentos para casar `PARQUE INDEPENDÊNCIA`/`PARQUE INDEPENDENCIA`.
- Inclui participantes desligados/inativos que registraram presença no período (snapshot histórico).
