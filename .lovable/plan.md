
# Padronização DD/MM/AAAA + Auditoria de Datas

Escopo confirmado: **apenas exibição/exportação** (banco continua ISO `YYYY-MM-DD`, que é tecnicamente correto e preserva ordenação, filtros, RPCs e indicadores). Separador único: **barra (DD/MM/AAAA)**. Inclui a varredura do bug de inversão DD↔MM (caso Sofia).

---

## Fase 1 — Auditoria de exibição (read-only, 0 risco)

**1.1 Varredura técnica do código** — script que lista toda ocorrência de formatação de data e classifica em:
- Conforme (`dd/MM/yyyy` via date-fns ou helper `formatDataBR`)
- Divergente (`yyyy-MM-dd`, `MM/dd/yyyy`, `dd-MM-yyyy`, `toLocaleDateString` sem locale, `toISOString().slice(0,10)` exibido cru)
- Datas em nomes de arquivo (`SysCFV_*_YYYY-MM-DD_HHmmss` — mantido por ser ordenável e já é padrão institucional)

Áreas auditadas: `src/pages/**`, `src/components/**`, `src/lib/**` (exportListaPresenca, exportRelacaoTurmasPdf, listaFrequencia, transporteRelatorio, fileNaming), `supabase/functions/**` (todas as 28 edge functions de export), templates DOCX/PDF.

Entrega: **relatório CSV em `/mnt/documents/`** com arquivo, linha, snippet e padrão atual → padrão proposto.

**1.2 Auditoria de dados históricos (inversões DD↔MM)** — RPC `auditar_datas_invertidas()` que varre todas as colunas date/timestamp do schema public e sinaliza candidatos a inversão:

| Critério | O que captura |
|---|---|
| Data futura impossível | `data_desligamento > current_date` em participantes ativos no passado (caso Sofia) |
| Salto temporal absurdo | `data_entrada > data_saida`, `data_nascimento > data_matricula` |
| Cluster de `updated_at` idêntico | Sinaliza import em lote (já achamos `2026-05-19 16:39:21.436692+00` com 26 registros) |
| Ambiguidade DD↔MM | dia≤12 E mês≤12 com `updated_at` no cluster suspeito |
| Sem entrada em `audit_log` | Confirma origem de migração e não de ação de usuário |

Tabelas varridas: `participantes` (data_nascimento, data_matricula, data_desligamento), `turma_participantes` (data_entrada, data_saida), `participante_transferencias`, `relatorios_atividade` (data), `presenca`, `atendimentos`, `encaminhamentos_externos`, `busca_ativa_registros`, `roteiros_visita`, `coordenacao_atividades`, `cronograma_*`.

Entrega: **painel `/coordenacao/auditoria-datas`** (somente coordenação) com 3 abas:
- **Inversões prováveis** (alto confiança — data futura ou cluster de import)
- **Ambíguas** (dia≤12 e mês≤12, requer decisão humana)
- **Conformes** (contagem por tabela)

Mais relatório breve em Markdown: `/mnt/documents/Auditoria_Datas_SysCFV.md` com totais por tabela, lista de registros afetados, e estimativa de impacto em indicadores.

---

## Fase 2 — Padronização da exibição (DD/MM/AAAA)

**2.1 Helper único** `src/lib/formatDate.ts`:
```ts
formatDataBR(d) → "19/05/2026"
formatDataHoraBR(d) → "19/05/2026 14:30"
formatDataExtensoBR(d) → "19 de maio de 2026"
parseDataBR("19/05/2026") → Date  // para inputs futuros
```

**2.2 Substituição assistida** das ocorrências divergentes detectadas em 1.1. Critérios:
- Telas de listagem, cards, tooltips, drawers → `formatDataBR`
- Exports DOCX/PDF/XLSX (edge functions e cliente) → `dd/MM/yyyy`
- Inputs `<Input type="date">` continuam ISO (HTML padrão) mas o label/preview ao lado mostra DD/MM/AAAA
- **Mantido** o padrão `YYYY-MM-DD_HHmmss` em nomes de arquivo (ordenação cronológica em pastas, já é norma)

**2.3 Lint guard** — regra ESLint custom que bloqueia novas ocorrências de `toLocaleDateString()` sem locale e `format(d, "yyyy-MM-dd")` em código de UI.

---

## Fase 3 — Correção do histórico invertido (com aprovação)

Para cada registro classificado como **inversão provável** em 1.2:
- Painel `/coordenacao/auditoria-datas` mostra `valor atual → valor proposto` lado a lado
- 3 botões por linha: **Corrigir** (swap DD↔MM), **Manter** (registra decisão), **Editar manualmente**
- Toda correção registrada em `audit_log` com `valor_antes`, `valor_depois`, `decidido_por`, `motivo`
- Modo **lote** disponível só para o cluster `2026-05-19 16:39:21` (origem comprovada de import inconsistente)

Nada é alterado sem aprovação registro a registro ou aprovação explícita do lote.

---

## Fase 4 — Reprocessamento de indicadores

Após Fase 3, datas corrigidas afetam:
- `get_dashboard_stats` (já recalcula on-the-fly)
- `get_coordenacao_stats` (idem)
- `get_pendencias_integridade` (idem)
- Indicadores históricos públicos `/site/indicadores` — invalidar cache TanStack Query
- Relatórios mensais já exportados em PDF/DOCX continuam intocados (snapshot histórico); novo export reflete dados corrigidos

Não há tabelas materializadas de indicadores — todos são calculados em tempo real, então a correção se reflete automaticamente no retroativo. ✅

---

## Fase 5 — Relatório final de impacto

`/mnt/documents/Relatorio_Impacto_Padronizacao_Datas.md`:
- Total de telas/componentes/exports padronizados (esperado: ~120–180 ocorrências)
- Total de registros com inversão detectada e corrigida por tabela
- Indicadores que mudaram (antes/depois): cobertura por bairro, % adesão mensal, mapa de calor de presença, taxa de desligamento Maio
- Lista de participantes cujo status histórico foi reconciliado (provavelmente os 26+ desligamentos suspeitos)
- Recomendações de processo (importadores futuros usando ISO obrigatório, validação de cluster `updated_at`)

---

## Ordem de execução e aprovação

1. Fase 1 inteira (read-only) → você revê relatório e painel
2. Fase 2 com flag de preview em uma página piloto (ex: `/participantes`) → aprovação → roll-out
3. Fase 3 caso a caso (ou lote do cluster) com seu aval
4. Fase 4 automática
5. Fase 5 entregue como artefato

## Garantias

- Banco intocado estruturalmente (sem migração de tipo de coluna)
- Nenhum dado sobrescrito sem `audit_log` + valor anterior preservado
- Snapshots exportados (PDF/DOCX já gerados) permanecem como estavam
- Lint guard impede regressão futura
