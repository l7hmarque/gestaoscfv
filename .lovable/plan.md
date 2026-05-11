## Diagnóstico — por que "Abrir no Drive" funciona e "Abrir no Google Docs" não

| Botão | Função | Como gera |
|---|---|---|
| **Abrir no Google Docs** (cabeçalho do relatório) | `generate-relatorio-gdoc` | Copia um template ID hardcoded e injeta texto cru via `insertText` + `updateTextStyle`. **Não usa os modelos institucionais cadastrados em `drive_modelos`.** É por isso que o "Minha Família" saiu fora do padrão. |
| **Abrir no Drive** (DriveSyncBadge) | `drive-sync-worker` (assíncrono, em fila) | Clona o template registrado em `drive_modelos.template_doc_id` e faz **substituição de placeholders** (`{DATA}`, `{EDUCADOR}`, `{ENG_1}`, fotos, tabela ANEXO II...). É o pipeline que produz o resultado que você gostou. |

**Por que só "Maio Laranja 11/05" mostra o botão Drive em planejamentos:** apenas 8 de 34 planejamentos têm `drive_url` preenchido (os demais nunca foram enfileirados; o badge volta `null` quando não há linha em `drive_sync_queue`). Mesma lógica para relatórios antigos.

**Lista de frequência preenchida — 3 bugs confirmados:**
1. **Só apareceu 13/04**: a função usa apenas as datas que já têm `relatorios_atividade` cadastrado. Quero usar os `dias_semana` da turma (`{seg,qua}` etc.) para gerar TODAS as datas planejadas do mês — relatório existente preenche P/A/J, datas sem relatório ficam em branco.
2. **Linha congelada**: `frozenRowCount: headerStartRow + 1` na linha 345 — remover.
3. **Sufixo (N) "novo no mês"**: linhas 263 e 298 — remover (lógica + legenda).

**Relatório Mensal Consolidado no Drive:** hoje só existe via Dashboard → aba "Relatório Mensal" → botão "Exportar XLSX" (faz upload como Google Sheets e mostra "Abrir no Drive" depois). Não há botão dedicado no Hub.

---

## Plano de Execução

### Etapa 1 — Unificar relatórios e planejamentos no pipeline Drive (o que você gostou)

**Página do Relatório de Atividade (`RelatorioDetalhePage.tsx`)**
- Remover botão **"Abrir no Google Docs"**.
- Substituir por um único botão **"Abrir no Drive"** que:
  - se `drive_sync_queue` está sincronizado → abre o link;
  - se ainda não foi gerado → chama `enqueue_drive_sync` + `drive-sync-worker` e mostra "Sincronizando…".
- Manter o `DriveSyncBadge` no rodapé como indicador de status para casos avançados (ou consolidar tudo nesse componente).

**Página do Planejamento (`PlanejamentoDetalhePage.tsx`)**
- Estender `DriveSyncBadge` para que, quando não houver linha em `drive_sync_queue`, mostre o botão **"Gerar no Drive"** que enfileira via `enqueue_drive_sync('planejamento', id)` + dispara `drive-sync-worker` (igual ao `retry`).
- Resultado: todos os 34 planejamentos passam a ter o botão.

**Decomissionar (mantendo arquivos como fallback técnico, sem botão)**
- Edge function `generate-relatorio-gdoc` deixa de ser chamada pela UI (mantida para um eventual fallback futuro).
- Hook `abrirRelatorioNoGoogleDocs` em `useDocumentExport.ts`: marcar como deprecated, sem chamadas.

### Etapa 2 — Corrigir Lista de Frequência (`generate-lista-frequencia-gsheet`)

1. Ler `turmas.dias_semana` (ex.: `{seg,qua}`) e calcular **todos os dias do mês** que casam com esses dias da semana → essa é a lista canônica de colunas.
2. Para cada data: se há relatório → P / A / J; se não há → célula em branco.
3. Remover `frozenRowCount` (sem linha congelada).
4. Remover lógica `(N)` e o item "(N) = Novo no mês" da legenda.

### Etapa 3 — Botão de Relatório Mensal Consolidado (Google Sheets) no Hub

- Adicionar botão **"Gerar no Drive (Sheets)"** ao lado do atual "Exportar XLSX" no Dashboard → Relatório Mensal.
- O Hub `/relatorios/exportar` ganha o card descrito na Etapa 4.

### Etapa 4 — Reestruturar Hub Exportar Relatórios

Layout do mês selecionado (Mês/Ano no topo) com cards alinhados ao Drive:

```
[Mês: Maio ▾] [Ano: 2026]

┌─────────────────────────────────────────┐
│ 1. Relatório Mensal Consolidado         │
│    → Gerar no Drive (1 Google Sheet)    │
├─────────────────────────────────────────┤
│ 2. Relatórios de Atividade do Mês       │
│    → Gerar todos no Drive (lote)        │
│    Cria/atualiza 1 Google Doc por       │
│    relatório em 02_Relatorios_Atividade │
├─────────────────────────────────────────┤
│ 3. Planejamentos do Mês                 │
│    → Gerar todos no Drive (lote)        │
│    1 Google Doc por planejamento em     │
│    03_Planejamentos                     │
├─────────────────────────────────────────┤
│ 4. Listas de Chamada em Branco          │
│    → 1 Google Sheet, 1 aba por turma    │
├─────────────────────────────────────────┤
│ 5. Listas de Frequência Preenchidas     │
│    → 1 Google Sheet, 1 aba por turma    │
├─────────────────────────────────────────┤
│ 6. Relatório de Execução do Objeto (REO)│  ← placeholder
│    🚧 em breve                           │
├─────────────────────────────────────────┤
│ 7. Prestação de Contas                  │  ← placeholder
│    🚧 em breve                           │
└─────────────────────────────────────────┘
```

**Implementação técnica dos botões em lote:**
- Cards 2 e 3: para cada item do mês, faz `enqueue_drive_sync(tipo, id)` e dispara `drive-sync-worker`. Mostra progresso (X/Y concluídos) e ao final lista links.
- Cards 4 e 5: novas edge functions `generate-listas-chamada-mes-gsheet` e `generate-listas-frequencia-mes-gsheet` — variações das atuais, criando UMA spreadsheet com **uma aba por turma** ao invés de uma planilha por turma. Reutilizam a lógica de cabeçalho institucional + a lógica corrigida da Etapa 2.
- Tudo salvo em `SYSCFV/{MÊS} - {ANO}/0X_…/` (estrutura já existente).

**Preservar o legado** descrito na conversa anterior: REO, Prestação de Contas, Atendimentos Técnicos, Coordenação, Cronograma, Atividades em lote DOCX/PDF — esses cards/seções existentes ficam abaixo, agrupados como **"Outros (legado)"**, até termos modelos institucionais para eles.

---

## Arquivos a alterar

- `supabase/functions/generate-lista-frequencia-gsheet/index.ts` — datas via `dias_semana`, sem freeze, sem (N).
- `supabase/functions/drive-sync-worker/index.ts` — confirmar que job `relatorio` e `planejamento` escrevem `drive_url` na tabela origem (ajuste se faltar).
- `src/components/DriveSyncBadge.tsx` — quando não há linha em fila, mostrar botão "Gerar no Drive" que chama `enqueue_drive_sync`.
- `src/pages/relatorios/RelatorioDetalhePage.tsx` — remover botão "Abrir no Google Docs", deixar só o fluxo Drive.
- `src/pages/planejamentos/PlanejamentoDetalhePage.tsx` — sem mudança extra além do badge atualizado.
- `src/pages/relatorios/ExportarRelatoriosPage.tsx` — reestruturação dos cards na ordem acima, com seção "Outros (legado)" para o que sobra.
- `src/pages/dashboard/DashboardRelatorioMensalTab.tsx` — renomear botão para "Gerar no Drive (Sheets)".
- Novas edge functions: `generate-listas-chamada-mes-gsheet`, `generate-listas-frequencia-mes-gsheet` (1 spreadsheet, 1 aba por turma).

## Validação

1. Lista de Frequência da turma testada (mês 04/2026) → deve listar 01, 06, 08, 13, 15, 20, 22, 27, 29; sem freeze; sem (N).
2. Planejamento "Minha Família" → botão "Gerar no Drive" disponível, gera doc no padrão dos 8 que já estão OK.
3. Relatório "Minha Família" → "Abrir no Drive" idem.
4. Hub Exportar → 5 cards funcionando + 2 placeholders.

Aprovando este plano, executo na ordem das etapas.