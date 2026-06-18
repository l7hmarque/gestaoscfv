## v4 — Auditoria de Presenças Maio/2026 (Profissional = quem registrou)

Gerar novo arquivo XLSX versionado (não sobrescreve v1/v2/v3):
`SysCFV_PresentesMaio2026_Auditoria_v4_{YYYY-MM-DD}_{HHmmss}.xlsx`

### Mudança principal vs v3

"Profissional" agora é **quem efetivamente registrou a presença no sistema** (autor do INSERT no audit_log ou `presenca.registrado_por`), não o educador vinculado à turma.

### Estrutura de abas

**1. Aba "Resumo Único" (primeira aba — exclusiva de contagem)**

Contagem de participantes **distintos** (sem repetição) que tiveram ≥1 presença em Maio/2026, cruzando:

- Linhas: Bairro × Período (JARDIM IRENE Manhã, JARDIM IRENE Tarde, PARQUE INDEPENDÊNCIA Manhã, …, ALVORADA Tarde)
- Colunas: Faixa 6–8 | Faixa 9–11 | Faixa 12–17 | **Total Linha**
- Última linha: **Total Geral** por faixa e total absoluto

Cada célula = COUNT(DISTINCT participante_id) — o mesmo participante pode aparecer em múltiplas células se teve presença em combinações diferentes (ex: JARDIM IRENE Manhã e depois ALVORADA Tarde).
**Porém, os totais (Total Linha, Total Coluna, Total Geral) usam DISTINCT global** — Maria, mesmo aparecendo em duas células, contribui com apenas 1 para qualquer total.

Regra confirmada: participante aparece em todas as células onde teve presença, mas nunca é contado mais de uma vez em totais.

Abaixo da matriz, três mini-tabelas separadas:
- Total único por Bairro (DISTINCT; quem aparece em 2 períodos conta 1 vez)
- Total único por Período (DISTINCT; quem aparece em 2 bairros conta 1 vez)
- Total único por Faixa (DISTINCT; quem aparece em 2 faixas conta 1 vez)
- **Total geral de participantes únicos no mês**

**2. Abas por agrupamento (Bairro × Período × Faixa × Profissional)**

Uma aba por combinação `{Bairro} - {Período} - {Faixa} - {Profissional}`, onde Profissional = **quem registrou a presença no sistema** (não educador da turma). Nome da aba truncado em 31 caracteres (limite Excel) com hash se necessário.

Colunas:
| # | Nome | Idade | Data Nasc. | Datas Presença (DD/MM, …) | Qtd. | Fonte | ID Registro | Registrado em | Log Auditoria |

Uma linha por (participante × data × fonte).

**3. Aba "Auditoria Detalhada Completa"**

Todas as linhas (participante × data × fonte) com: Nome, Bairro, Período, Faixa, Data, Fonte, ID Registro, **Profissional (Registrador)**, UUID Autor, Registrado em, Relatório Vinculado, Log Auditoria. Mantém coluna auxiliar "Educador da Turma" para referência.

### Regra de atribuição por registro

1. **Fonte `presenca`** → `registrado_por` (fallback: `audit_log` INSERT mais antigo do registro)
2. **Fonte `relatorio_presenca`** → autor do INSERT no `audit_log` do relatório (fallback: `relatorios_atividade.created_by`; senão `educador_id`)
3. Resolver nome via `profiles.full_name`. Sem autor identificado → "Sistema / Desconhecido".

### Detalhes técnicos

- Reusar queries `psql COPY` do v3 (presenca + relatorio_presenca + audit_log + profiles).
- Nova consulta auxiliar: primeiro INSERT por `(tabela, registro_id)` no `audit_log` → mapa `registro → user_id`.
- JOIN com `profiles` para nome do registrador.
- DISTINCT por `participante_id` para totais do Resumo Único (usar set Python).
- Agrupamento por profissional: `GROUP BY (bairro, periodo, faixa, autor_nome)` no Python.
- Estilo grayscale, auto-fit 55 chars (padrão SysCFV).
- Saída em `/mnt/documents/`, apresentada via `<presentation-artifact>`.