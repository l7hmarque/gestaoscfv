## Drawer de tendência detalhada por indicador

Ao clicar em um KPI do dashboard, abre um painel lateral esquerdo com **gráfico de evolução** e um **histórico técnico rico** — cada evento traz contexto operacional completo, não só o delta.

### Layout

```text
┌──── Drawer (esq, 520px) ───────────────────────┐
│ ✕  Participantes Ativos                        │
│    248 hoje  ▲ +12 (30 dias)  · pico: 251     │
├────────────────────────────────────────────────┤
│ ┌─ Evolução (últimos 60 dias) ──────────────┐  │
│ │      ╱╲     ╱──                           │  │
│ │  ╱──╯  ╲___╯       área sombreada         │  │
│ │ marcos: ▼ desligamento em lote 23/04     │  │
│ └───────────────────────────────────────────┘  │
│                                                │
│ Min 232  ·  Máx 251  ·  Média 243              │
├────────────────────────────────────────────────┤
│ HISTÓRICO TÉCNICO                              │
│                                                │
│ ┌─ 04/05/2026 — 14:32 ──────── +3 ▲ 248 ─┐    │
│ │ MATRÍCULA | Ana Silva (8a) → JARDIM    │    │
│ │ IRENE manhã · Maria Santos (10a) →     │    │
│ │ ALVORADA tarde · João P. (7a) →        │    │
│ │ JARDIM IRENE manhã                     │    │
│ │ Origem: matrícula online · por Coord.  │    │
│ └────────────────────────────────────────┘    │
│                                                │
│ ┌─ 02/05/2026 — 09:15 ──────── −1 ▼ 245 ─┐    │
│ │ DESLIGAMENTO | Pedro Costa (12a)       │    │
│ │ Turma: ADOLESCENTES — PARQUE INDEP.    │    │
│ │ Motivo: mudança de cidade              │    │
│ │ Tempo no SCFV: 8 meses · por Téc. RH   │    │
│ └────────────────────────────────────────┘    │
│ ...                                            │
└────────────────────────────────────────────────┘
```

### O que torna o histórico "técnico"

Cada linha do histórico inclui o máximo de contexto disponível para aquele evento:

**Participantes Ativos** — para cada matrícula/desligamento/transferência:
- Nome + idade + bairro/turma de destino + período
- Origem (matrícula online, importação, manual)
- Em desligamentos: motivo + justificativa + tempo de permanência
- Quem executou (profissional)
- Link para o perfil do participante

**Frequência Geral** — por mês/semana:
- % presença + nº presentes / nº esperados
- Top 3 turmas com maior queda vs mês anterior
- Top 3 turmas com maior alta
- Eventos pontuais com baixa anormal (ex: "13/04: 32% — feriado prolongado")

**Turmas Ativas** — abertura/encerramento:
- Nome completo da turma + faixa etária + bairro + período
- Educador vinculado
- Nº inicial de participantes
- Em encerramentos: motivo, último relatório, destino dos participantes

**Relatórios** — agregação mensal + destaques:
- Total do mês + média ELO + média adesão
- Top 3 educadores mais produtivos do mês
- Turma mais ativa (mais relatórios)
- Atividades destaque (ELO 5)

**Planejamentos** — por evento:
- Título + categoria + autor + nº de objetivos
- Status (rascunho, finalizado)

**Média ELO** — por mês:
- Score do mês + nº de relatórios computados
- Top 3 atividades de maior score (com nome + educador)
- Bottom 3 atividades de menor score (oportunidade de melhoria)

**Média Adesão** — por mês:
- % adesão + nº esperado vs nº presente
- Atividades com adesão > 90% e < 50%

**Educadores Ativos** — variação mensal:
- Quem entrou no quadro ativo (primeiro relatório do mês)
- Quem saiu (sem relatório no mês após estar ativo)
- Top 3 mais produtivos do mês

### Comportamento

- **Card → Sheet**: KPI vira `<button>` com hover ring; abre `Sheet side="left"` (520px desktop, fullscreen mobile).
- **Janela temporal**: respeita filtro mês/ano da página. Se "todos os períodos" → últimos 60 dias (Participantes) ou 12 meses (demais). Se mês específico → detalhe diário daquele mês.
- **Gráfico**: LineChart Recharts (200px) com área sombreada, marcos de eventos relevantes anotados (`<ReferenceDot>`).
- **Resumo estatístico**: linha com Min/Máx/Média/Mediana abaixo do gráfico.
- **Histórico**: lista cronológica reversa, paginada (mostra 20, botão "Ver mais"). Cada item é um card com título destacado, badge de delta (+/− e cor), e bloco de contexto técnico em texto estruturado.
- **Links acionáveis**: nomes de participantes/turmas/relatórios viram links para suas páginas internas.
- **Filtro dentro do drawer**: dropdown para filtrar por tipo de evento (matrícula | desligamento | transferência | todos).
- **Exportação**: botão "Exportar histórico (CSV)" no rodapé do drawer.
- **Loading**: skeleton no gráfico + lista enquanto busca; cache 5 min via TanStack.

### Fonte de dados (sem migrações)

Tudo derivado das tabelas existentes — sem snapshot diário no banco, calculado sob demanda:

| Indicador | Tabelas usadas | Como construir contexto técnico |
|---|---|---|
| Participantes | `participantes`, `bairros`, `turma_participantes`, `turmas`, `audit_log`, `profiles` | join para nome de turma/bairro/profissional; `audit_log` traz justificativa de desligamento |
| Frequência | `presencas`, `relatorios_atividade`, `turmas` | agrupa por mês; calcula deltas por turma |
| Turmas | `turmas`, `profiles` (educador), `turma_participantes` | join para educador e contagem inicial |
| Relatórios | `relatorios_atividade`, `profiles` (autor), `turmas` | agrega por mês; ranqueia top educadores/turmas |
| Planejamentos | `planejamentos_atividade`, `profiles` (autor) | metadata do registro |
| Média ELO | `relatorios_atividade.score_elo`, `profiles` | top/bottom 3 do mês |
| Média Adesão | `relatorios_atividade.adesao_pct` | extremos do mês |
| Educadores Ativos | distinct `educador_id` em `relatorios_atividade` por mês | comparar conjunto entre meses |

Performance: queries client-side em janela limitada (60 dias / 12 meses) — volume aceitável. Se ficar lento, próxima iteração cria RPC `get_indicador_timeline(_id, _mes, _ano)`.

### Detalhes técnicos

- `src/components/dashboard/IndicadorTimelineDrawer.tsx` (novo) — Sheet shadcn esquerdo, recebe `{ indicadorId, mes, ano, onClose }`; renderiza header (label + valor atual + delta), gráfico, stats, filtro de tipo, lista de eventos com `EventoTecnicoCard`.
- `src/components/dashboard/EventoTecnicoCard.tsx` (novo) — card individual estruturado: título destacado, delta colorido, bloco de contexto, links.
- `src/hooks/useIndicadorTimeline.ts` (novo) — `switch (indicadorId)` despacha para fetcher dedicado de cada indicador. Cada fetcher retorna:
  ```ts
  {
    pontos: { label: string; value: number; date: string }[];
    eventos: {
      data: string; // ISO
      tipo: string; // matricula | desligamento | ...
      delta: number;
      valorApos: number;
      titulo: string; // "MATRÍCULA"
      contexto: { campo: string; valor: string; link?: string }[];
      autor?: string;
    }[];
    stats: { min: number; max: number; media: number; mediana: number };
  }
  ```
- `KPICard` ganha props `interactive?: boolean` e `onClick?: () => void`; quando interativo, vira `<button>` com `cursor-pointer`, ring focus visível e `aria-label`.
- `IndicadoresTab` adiciona `selectedIndicator` state e renderiza `<IndicadorTimelineDrawer>` quando há seleção. Cada KPI passa seu id (`'participantes'`, `'frequencia'`, etc.).
- Helper `src/lib/indicadorTimelineFetchers.ts` (novo) — funções puras por indicador, isoladas para teste.

### Arquivos afetados

- `src/pages/dashboard/DashboardPage.tsx` — KPI clicáveis + estado + drawer.
- `src/components/dashboard/IndicadorTimelineDrawer.tsx` (novo).
- `src/components/dashboard/EventoTecnicoCard.tsx` (novo).
- `src/hooks/useIndicadorTimeline.ts` (novo).
- `src/lib/indicadorTimelineFetchers.ts` (novo).

Sem alterações em banco, RLS ou edge functions.