

O usuário quer um **marco temporal** ("data de corte") para que dashboard, KPIs e relatórios oficiais ignorem dados anteriores — período em que o sistema não era usado e os dados são incompletos/sintéticos. Isso aumenta a integridade institucional.

Análise:
- Março/2026: 156 relatórios, 100% sintéticos (consolidados de chamada física) — NÃO refletem uso real do sistema.
- Abril/2026: 12 relatórios reais até agora — primeiro mês com adoção genuína.
- Logo, **01/04/2026** é o ponto de corte natural ("Data de Início Operacional").

Onde aplicar o filtro:
1. `get_dashboard_stats` — KPIs, médias ELO/adesão, top educadores, presença mensal, atividades recentes, delta de participantes.
2. `get_pendencias_integridade` — não filtra (continua mostrando estado atual).
3. Relatórios institucionais (REO, Mensal, Gestão, Prestação de Contas) — adicionar nota de rodapé e respeitar corte quando o período solicitado for retroativo.
4. UI: badge "Dados a partir de 01/04/2026" no dashboard + selo nos PDFs/XLSX.

Implementação proposta — armazenar a data em `configuracoes_gerais` (chave `data_inicio_operacional`) para que a coordenação possa ajustar pela tela `/configuracoes` sem deploy.

---

## Plano

### 1. Banco — guardar a data de corte
- Inserir em `configuracoes_gerais`: `chave='data_inicio_operacional'`, `valor='2026-04-01'`.
- Atualizar `get_dashboard_stats` para ler essa chave e:
  - Excluir relatórios/presenças anteriores ao corte de TODAS as métricas agregadas (ELO mensal, adesão mensal, presença mensal, top educadores, médias, taxa de frequência, atividades recentes, alertas).
  - Recalcular `deltaParticipantes` respeitando corte (não comparar com período pré-sistema).
  - Retornar `dataInicioOperacional` no JSON para a UI exibir.

### 2. UI — Dashboard
- `useDashboardData.ts`: incluir `dataInicioOperacional` no tipo.
- `DashboardPage.tsx`: badge discreto no header — "Indicadores a partir de 01/04/2026" (com tooltip explicativo).
- `PendenciasIntegridadeBanner` permanece inalterado.

### 3. UI — Configurações
- Em `/configuracoes`, novo card "Marco Operacional" permitindo coordenação editar a data (input + botão salvar). Auditado via `audit_log`.

### 4. Relatórios institucionais
- Hooks/edge functions de relatório (`useRelatorioGestao`, `generate-relatorio-mensal`, `generate-reo`) — filtrar dados por `>= data_inicio_operacional` quando o intervalo solicitado começar antes, e adicionar nota de rodapé:
  > "Os indicadores deste relatório consideram dados a partir de 01/04/2026 (início operacional do SysCFV). Registros anteriores referem-se a chamadas físicas consolidadas e não compõem as métricas analíticas."

### 5. Memória do projeto
- Salvar regra como `mem://constraints/data-inicio-operacional` e referenciar no `index.md`.

---

## Detalhes técnicos

**Migration** — atualizar `get_dashboard_stats`:
```sql
-- Ler config no início:
SELECT valor::date INTO v_data_corte
FROM configuracoes_gerais WHERE chave = 'data_inicio_operacional';
v_data_corte := COALESCE(v_data_corte, '2026-04-01'::date);

-- Aplicar em TODOS os WHERE de relatorios_atividade/relatorio_presenca/presenca:
AND data >= v_data_corte
```

**Insert** (data tool, não migration) — semear configuração:
```sql
INSERT INTO configuracoes_gerais (chave, valor)
VALUES ('data_inicio_operacional', '2026-04-01')
ON CONFLICT (chave) DO NOTHING;
```

**Frontend**: badge no header do `DashboardPage` ao lado de "Dashboard SysCFV".

---

## Decisão necessária

Antes de executar, preciso confirmar 1 ponto:

