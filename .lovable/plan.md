## Objetivo

Gerar um único XLSX com ~39 abas de listas de presença de Maio/2026, 100% extraído do banco, com totais conciliados com a auditoria v5 (161 únicos).

## Estrutura das abas

**Bloco A — Bairro × Faixa × Período (8 abas)**

- JARDIM IRENE 6-8 MANHÃ / TARDE
- JARDIM IRENE 9-11 MANHÃ / TARDE
- ALVORADA 6-8 MANHÃ / TARDE
- ALVORADA 9-11 MANHÃ / TARDE

**Bloco B — Faixa 12-17 unificada (2 abas)**

- 12-17 MANHÃ (3 bairros, coluna Bairro em cada linha)
- 12-17 TARDE (3 bairros, coluna Bairro em cada linha)

**Bloco C — Oficinas por profissional registrador (8 abas cada)**
Filtro: `audit_log` do INSERT de `relatorio_presenca`/`presenca` com `user_id` = profissional.

- KARATE (Felipe Gomes) — 6-8/9-11 × Jardim Irene/Alvorada × M/T
- ESPORTE E RECREAÇÃO (Jenifer) — idem
- ARTÍSTICAS E CULTURAIS (Laila) — idem

**Bloco D — DANÇA E POESIA (2 abas)**

- DANÇA E POESIA MANHÃ = cópia/espelho da aba 12-17 MANHÃ
- DANÇA E POESIA TARDE = cópia/espelho da aba 12-17 TARDE

**Bloco E — IDOSOS (1 aba)**

- Participantes 71 e 73 anos (não entram em nenhuma outra aba)

**Total: ~37 abas de listas + 1 Validação Interna**

## Regras-chave

- **5 anos** → entra em 6-8
- **71 e 73 anos** → APENAS aba IDOSOS
- **Bloco A/B/D** = todos os profissionais
- **Bloco C** = filtra por registrador (Felipe/Jenifer/Laila)
- **Coluna Bairro** sempre presente
- Sobreposição entre Bloco A/B e Bloco C/D é esperada
- **Soma de únicos deduplicada (todas as abas) = 161**

## Colunas por aba

`Nome | Bairro | Idade | Data Nasc. | Datas de Presença (DD/MM,…) | Total Presenças` 

Cabeçalho de cada aba: Titulo Institucional: "Sociedade Civil Nossa Senhora Aparecida | SCFV-CAIA Medianeira | Lista de Presenca", TITULO DA LISTA conforme nome dos itens dos Blocos, Total Unicos, Mes de Referencia (Maio de 2026)

## Aba de Validação Interna

- Únicos deduplicados em todas as abas = **161**
- Total de registros Bloco A+B+E = **819** (sem dupla contagem)
- Bloco C/D conferem com filtros aplicados
- Quantidade "Sem comprovação documental" = **106**
- Participantes fora de qualquer aba = 0

## Técnico

- Fonte: `relatorio_presenca` (presente=true) + `relatorios_atividade.data` 2026-05-01..31
- Joins: `participantes`, `bairros`, `audit_log`, `profiles`
- Idade na data da presença
- Normalização accent via `unicodedata` (PARQUE INDEPENDÊNCIA)
- `PER_MAP` para período
- Estilo black and white, autofit 55, padrão SysCFV
- Arquivo: `/mnt/documents/SysCFV_ListasPresenca_Maio2026_<timestamp>.xlsx`