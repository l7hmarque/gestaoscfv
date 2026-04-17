

## Diagnóstico do "-46 vs mês anterior"

O delta no card **Participantes Ativos** **NÃO compara cadastros**. A função `get_dashboard_stats` calcula assim (linhas 269-291 do RPC):

```
v_last_month = '2026-04' (último mês com presença)
v_prev_month = '2026-03' (penúltimo)
v_last_count = COUNT DISTINCT participantes presentes em ABR = 59
v_prev_count = COUNT DISTINCT participantes presentes em MAR = 105
deltaParticipantes = 59 - 105 = -46
```

Ou seja: o "-46" compara **quantos participantes distintos tiveram pelo menos 1 presença** entre março e abril/2026. Como abril ainda está em curso (só 431 registros vs 2.006 de março), o delta fica artificialmente negativo. **O card mostra "60 ativos" (cadastro) mas o delta vem de outro universo (presença mensal)** — isso é confuso e tecnicamente errado.

## Outros indicadores precisam de refinamento

Auditando o RPC + o que está exibido:

| Indicador | Problema atual | Correção |
|---|---|---|
| **Delta Participantes Ativos** | Compara presentes distintos entre 2 últimos meses (mistura conceitos) | Comparar **cadastros ativos** atual vs 30 dias atrás (`iniciou_em`/`data_desligamento`) |
| **Média ELO** | 156 relatórios sintéticos mar/2026 com `score_elo NULL` derruba contagem mas a `AVG` ignora NULL — OK mas card não diz "n=X" | Adicionar contador "baseado em N relatórios" |
| **Média Adesão** | Sintéticos têm `pct_adesao=23%` (12,6% real + ausentes) puxando média geral para baixo | Filtrar sintéticos OU calcular adesão = presentes/cadastrados-da-turma-no-dia |
| **Frequência Geral** | Inclui ABRIL incompleto sem aviso visual | Marcar mês corrente como "parcial" no gráfico |
| **Total Relatórios** | Conta 156 sintéticos como se fossem reais → infla métrica de produção pedagógica | Separar "Relatórios reais" vs "Consolidados de chamada física" |
| **Top Educadores** | Sintéticos usam fallback coordenação → infla 1 perfil | Excluir sintéticos do ranking |
| **Frequência Mensal (gráfico)** | Mostra abril com poucos dias úteis sem indicação | Adicionar label "(parcial)" + linha pontilhada |
| **Atividades Recentes** | Mostra "Atividade SCFV (consolidado lista física março/2026)" 5x | Filtrar sintéticos OU agrupar por mês |

## Plano de refinamento

### 1. Refatorar `get_dashboard_stats` (migração SQL)

**a) Delta de Participantes Ativos** — recalcular com base em cadastro real:
```sql
v_delta_participantes = 
  (COUNT participantes WHERE status='ativo' AND iniciou_em <= today)
  - (COUNT participantes WHERE iniciou_em <= today - 30 days 
       AND (data_desligamento IS NULL OR data_desligamento > today - 30 days))
```

**b) Marcar relatórios sintéticos** — adicionar coluna ou usar filtro:
- Identificador: `nome_atividade LIKE 'Atividade SCFV (consolidado%'`
- Criar 2 KPIs separados:
  - `totalRelatorios` = só reais
  - `totalConsolidadosChamada` = sintéticos
- Excluir sintéticos do `topEducadores` e da `mediaELO` (já são NULL, mas explicitar)

**c) Adesão refinada**: dividir em `mediaAdesao` (real) e `mediaAdesaoConsolidada` (sintéticos).

**d) `presencaMensal`**: incluir flag `parcial: boolean` (true se mês = mês corrente).

### 2. Atualizar `useDashboardData.ts` + tipos
Adicionar campos novos: `totalConsolidadosChamada`, `mediaAdesaoConsolidada`, `presencaMensal[].parcial`.

### 3. Atualizar `DashboardPage.tsx` (IndicadoresTab)
- Card Participantes Ativos: tooltip explicando delta = "vs 30 dias atrás (cadastro)"
- Novo card "Consolidados de Chamada (mar/2026): 156" — visualmente diferente (cinza/secundário)
- Card Média Adesão: mostrar "real: X% / consolidados: 23%"
- Gráfico Frequência Mensal: barra de abril com hachura + label "(parcial)"
- Atividades Recentes: filtrar `nome_atividade NOT LIKE 'Atividade SCFV (consolidado%'`

### 4. Auditoria visual
Após deploy, verificar:
- Card Participantes Ativos mostra delta coerente (provável 0 ou pequeno positivo)
- Total Relatórios separado dos consolidados
- Abril marcado como parcial no gráfico

## Decisão necessária antes de executar

Vou confirmar 2 pontos via `ask_questions` antes de implementar:
1. **Como tratar relatórios sintéticos** nas métricas: (a) excluir totalmente do dashboard, (b) mantê-los em KPI separado, ou (c) incluir tudo junto com aviso visual?
2. **Cálculo do delta** de participantes ativos: comparar com (a) 30 dias atrás, (b) mês anterior fechado, ou (c) início do mês corrente?

