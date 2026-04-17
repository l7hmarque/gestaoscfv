

## Diagnóstico

**Por que não aparecem no dashboard:**
- 2.006 presenças foram inseridas em `presenca` (tabela de chamada manual).
- **Zero** registros foram criados em `relatorio_presenca` (tabela vinculada a `relatorios_atividade`).
- A função `get_dashboard_stats` calcula KPIs (`taxaFrequenciaGeral`, `presencaMensal`, `mediaELO`) **somente** a partir de `relatorio_presenca`.
- O REO, Relatório Mensal e Relatório de Gestão também leem de `relatorio_presenca` (memória `presenca-logica` confirma: "frequência institucional registrada prioritariamente via Relatórios de Atividade").
- Resultado: dados inseridos ficam invisíveis nas exportações institucionais.

**Outros pontos críticos a auditar:**
- 0 relatórios de atividade existem em março/2026 → score ELO, competências, objetivos zerados no dashboard.
- 18 mudanças de período (`MOVER_PERIODO`) ajustaram `participantes.periodo`, mas não há garantia de que `turma_participantes` foi reposicionado.
- 111 marcações `busca_ativa` foram aplicadas, mas a RPC `recalcular_busca_ativa` pode reverter se houver presenças recentes.

## O que precisa ser feito

### 1. Gerar `relatorios_atividade` sintéticos para março/2026
Para cada combinação **turma + dia letivo** com presenças importadas:
- Criar 1 `relatorios_atividade` com `tipo_atividade='regular'`, `nome_atividade='Atividade SCFV (consolidado lista física março/2026)'`, `educador_id` = educador titular da turma (fallback: coordenação), `data` do dia.
- Criar 1 `relatorio_turmas` vinculando à turma.
- Migrar/espelhar cada linha de `presenca` para `relatorio_presenca` (mesmos `participante_id`, `presente`, `justificativa`).
- Calcular `num_participantes` e `pct_adesao` automaticamente.
- **Não preencher** `score_elo` nem competências (ficarão null — não distorce médias).

### 2. Validar consistência de período e turma
- Verificar se os 18 participantes com `MOVER_PERIODO` têm `turma_participantes` ativo na turma do novo período.
- Listar divergências em XLSX para revisão.

### 3. Validar `busca_ativa`
- Rodar `recalcular_busca_ativa()` para reconciliar status com base nas novas presenças importadas (quem foi marcado BA mas tem presença em março volta para ativo).

### 4. Entregar relatório de auditoria pós-execução
XLSX **SysCFV_AuditoriaPosExecucao_Marco2026.xlsx** com abas:
- **Resumo** — contagens antes/depois (relatórios criados, presenças espelhadas, BA recalculados).
- **Relatorios_Criados** — lista dos relatórios sintéticos com turma, data, educador, nº participantes.
- **Periodo_Divergencias** — participantes com período no cadastro ≠ período da turma vinculada.
- **BA_Reconciliados** — quem voltou de busca_ativa para ativo.

## Indicadores que vão melhorar após execução

| Indicador | Estado atual | Após execução |
|---|---|---|
| `taxaFrequenciaGeral` (mar/2026) | 0% | calculado real |
| `presencaMensal` no gráfico | sem ponto mar/2026 | ponto visível |
| `totalRelatorios` (mar/2026) | 0 | ~50-80 relatórios |
| REO março — frequência por turma | vazio | preenchido |
| Relatório Mensal — matriz de frequência | vazio | preenchido |
| Top educadores | sem mar/2026 | computado |

## Amarras técnicas

- `relatorios_atividade.educador_id` é nullable, mas o dashboard agrupa por educador — usar fallback configurável.
- `score_elo`, `iniciativa`, `autonomia`, etc. ficam `null` — a função `get_dashboard_stats` filtra `WHERE score_elo IS NOT NULL`, então **não vai distorcer médias**.
- Operação é idempotente: antes de criar, verificar se já existe `relatorios_atividade` na data+turma com `nome_atividade` começando com "Atividade SCFV (consolidado lista física".
- Auditoria: cada relatório criado registra em `audit_log` com `acao='import_chamada_marco_2026'`.

## Decisões necessárias antes de executar

Vou perguntar 3 pontos críticos via `ask_questions` antes de iniciar a execução, principalmente sobre: (a) preencher ou não competências/ELO com média histórica do educador, (b) tratar dias sem turma resolvível, (c) sobrescrever ou complementar caso já exista relatório no mesmo dia/turma.

