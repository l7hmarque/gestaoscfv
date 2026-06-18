## Nova lista v3 — Auditoria de Presenças Maio/2026

Gerar novo arquivo XLSX versionado (não sobrescreve v1/v2):
`SysCFV_PresentesMaio2026_Auditoria_v3_{YYYY-MM-DD}_{HHmmss}.xlsx`

### Estrutura de abas

**1. Aba "Resumo Único" (primeira aba — exclusiva de contagem)**

Contagem de participantes **distintos** (sem repetição) que tiveram ≥1 presença em Maio/2026, cruzando:

- Linhas: Bairro × Período (JARDIM IRENE Manhã, JARDIM IRENE Tarde, PARQUE INDEPENDÊNCIA Manhã, …, ALVORADA Tarde)
- Colunas: Faixa 6–8 | Faixa 9–11 | Faixa 12–17 | **Total Linha**
- Última linha: **Total Geral** por faixa e total absoluto

Cada célula = COUNT(DISTINCT participante_id) — o mesmo participante nunca conta duas vezes na mesma célula.
Totais usam DISTINCT global (participante que aparece em duas faixas/bairros é contado uma única vez no Total Geral).

Regra absoluta de contagem (Resumo Único): cada participante é contado no máximo UMA vez no planilha inteira. Se um participante teve presença em múltiplas combinações (ex: JARDIM IRENE Manhã e depois mudou para ALVORADA Tarde), ele entra em apenas uma célula — a primeira combinação onde aparece na ordenação — e em nenhuma outra. Nunca soma >1 para o mesmo participante_id em totais de linha, coluna ou geral.

Abaixo da matriz, três mini-tabelas separadas:
- Total único por Bairro (DISTINCT sobre todos os participantes daquele bairro, sem duplicar quem mudou)
- Total único por Período
- Total único por Faixa
- **Total geral de participantes únicos no mês** — soma das células da matriz, garantido sem duplicatas

**2. Abas por agrupamento (Bairro × Período × Faixa × Profissional)**

Uma aba por combinação `{Bairro} - {Período} - {Faixa} - {Profissional}`, agrupando participantes pelo profissional que registrou a presença. Nome da aba truncado em 31 caracteres (limite Excel) com hash se necessário.

Colunas:
| # | Nome | Idade | Data Nasc. | Datas Presença (DD/MM, …) | Qtd. | Fonte | ID Registro | Registrado em | Log Auditoria |

Uma linha por (participante × data × fonte). Permite ver claramente quais datas cada profissional registrou para cada participante.

**3. Aba "Auditoria Detalhada Completa"** (mantida do v2, achatada)

Todas as linhas (participante × data × fonte) com: Nome, Bairro, Período, Faixa, Data, Fonte (presenca/relatorio_presenca), ID Registro, Profissional, UUID Autor, Registrado em, Relatório Vinculado, Log Auditoria.

### Detalhes técnicos

- Reusar queries `psql COPY` do v2 (presenca + relatorio_presenca + audit_log + profiles).
- DISTINCT por `participante_id` para a aba Resumo (usar set Python).
- Agrupamento por profissional: `GROUP BY (bairro, periodo, faixa, autor_nome)` no Python.
- Truncamento de nome de aba: se >31 chars, usar `{prefix}_{hash6}`.
- Estilo grayscale, auto-fit 60 chars (padrão SysCFV).
- Saída em `/mnt/documents/`, apresentada via `<presentation-artifact>`.

### Confirmar antes de gerar

Algum ajuste no escopo, ou pode prosseguir?