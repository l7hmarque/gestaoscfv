# Estratégia — Performance sem quebrar nada

## Item 1 — Cronograma: memoizar (NÃO remover)

### Por que não remover
A feature está mais entrelaçada do que parece. Remover quebraria:
- `AgendaProfissional` dentro de `ProfissionalPerfilPage` (cada perfil mostra a agenda do educador).
- `CienteRequiredModal` no `AppLayout` (depende de `cronograma_intervencoes` para o bloqueio de ciência — usado por toda a coordenação para forçar leitura de avisos críticos).
- Card "Cronograma" no DashboardPage e link na sidebar.
- 6 tabelas com FKs (`cronograma_cenarios`, `_slots`, `_slot_profissionais`, `_atividades_manuais`, `_intervencoes`, `_intervencao_cientes`, `_disponibilidade`) + edge function `generate-cronograma-report` + realtime publications.
- O fluxo de "Intervenções com ciência obrigatória" é institucional, não bônus.

Conclusão: o custo/risco de remover é alto e a página **já é lazy-loaded** (não pesa no boot). O ganho real está em **memoizar o grid** para acelerar quando o usuário entra em `/cronograma`.

### O que fazer (memoização cirúrgica)

Em `CronogramaPage.tsx` (842 linhas):
1. Extrair a célula do grid (`<div>` que renderiza slots + atividades por dia/período/bairro) em um componente `CronogramaCell` envolvido por `React.memo` com comparador raso nas props (`slots`, `atividades`, `bairro`, handlers estáveis).
2. Estabilizar handlers (`onSlotClick`, `onAddAtividade`, etc.) com `useCallback`.
3. Pré-indexar dados em `useMemo`: `Map<bairroId, slots[]>`, `Map<slotId, profissionais[]>`, em vez de filtrar arrays inteiros por célula a cada render (hoje é O(células × slots)).
4. Mesmo tratamento em `AgendaProfissional.tsx` (grid 5×2 também faz `.filter` por célula).

Sem mudança de comportamento, sem mudança de dados. Risco: baixo.

### Plano B (opcional, reversível): "desligar" sem remover
Se mesmo memoizado o usuário quiser sumir com o cronograma da navegação:
- Remover o link da sidebar e o card do dashboard.
- Manter a rota `/cronograma`, as tabelas, edge function e `CienteRequiredModal` intactos.
- Acessível ainda por URL direta para coordenação.
- Reversível em 2 linhas. Zero risco para `AgendaProfissional` e ciência.

Recomendação: aplicar memoização agora; decidir o Plano B depois se ainda quiser limpar a navegação.

---

## Item 3 — CienteRequiredModal: fix de performance

### Problema atual
O modal está no `AppLayout` (renderiza em toda navegação autenticada). Hoje:
- A cada login/montagem dispara 4 queries em paralelo (`profiles`, `cronograma_intervencoes` LIMIT 50, `cronograma_intervencao_cientes`, `recados`).
- Abre 1 canal realtime por usuário escutando **todas** as mudanças de `cronograma_intervencoes` e `recados` no banco inteiro.
- Cada evento realtime dispara `load()` novamente (4 queries) — barulhento em horários de pico.

### Correções (baixo risco)
1. **Mover `profileId` lookup para o `AuthContext`** (já existe `user`; expor `profileId` cacheado). Elimina 1 query por montagem em todo lugar que hoje faz `select id from profiles where user_id=...` (>10 componentes fazem isso).
2. **Filtrar o canal realtime** por `filter: "destinatario_id=eq.{profileId}"` em `recados` (Postgres Changes suporta filter). Para `cronograma_intervencoes` não tem como filtrar por array no servidor — então debounçar o `load()` em 1500ms para coalescer rajadas.
3. **Substituir realtime de `cronograma_intervencoes` por polling leve** (a cada 60s + on focus) já que intervenções são raras. Remove uma subscription global por usuário.
4. **Memoizar `CienteRequiredModal`** e mover para dentro de um wrapper que só monta se `user` existir (já é o caso, mas remover o `useEffect` que dispara em cada navegação — usar `useQuery` com `staleTime: 60_000`).
5. **Throttle do `useActivityPing`** se ainda não tiver (verificar).

Ganho esperado: redução real de ~30–40% de latência percebida em navegações entre páginas (especialmente em `/coordenacao`, `/participantes`).
Risco: baixo. O fluxo de ciência continua igual — só muda *como* o cliente descobre que há pendência.

---

## Item 4 — useDocumentExport: análise de risco (NÃO aplicar agora)

### Fatores de risco

1. **Tamanho e acoplamento**: 1381 linhas, 9+ funções exportadas (`exportRelatorioPdf`, `exportRelatorioDocx`, `buildRelatorioDocxBlob`, `exportPlanejamentoPdf/Docx`, `exportFichaInscricaoPdf/Docx`, `exportProntuarioPdf`, `ensurePresencaForExport`, `abrirRelatorioNoGoogleDocs`). Consumido por 8+ páginas e também re-exportado por `lib/listaFrequencia.ts` e `useBulkRelatorioExport.ts`. Tornar tudo async (`await import("docx")`) força mudar a assinatura de todos os call-sites.

2. **Template-fill DOCX (docxtemplater)**: lê PNG de fotos, faz substituição de tags com `TemplateTagMapper`. Se quebrar, perde a integração com modelos institucionais do Drive (`09_Cronogramas`, etc.) — exatamente o fluxo que você acabou de migrar para Drive/Docs.

3. **Bulk export** (`useBulkRelatorioExport`) gera lotes de DOCX/PDF/XLSX em paralelo via `Promise.allSettled`. Falha silenciosa em um dynamic import quebraria o relatório do mês inteiro sem erro claro.

4. **`abrirRelatorioNoGoogleDocs`**: hoje converte DOCX local → upload via edge function → abre no Docs. Se o blob de DOCX vier "vazio" porque o import dinâmico ainda não resolveu, o Docs abre em branco e o usuário pode editar e salvar por cima — perda de conteúdo silenciosa.

5. **PWA/cache**: dynamic imports criam chunks novos. Em sessões com Service Worker antigo + chunk faltante = tela branca no export.

### Como executar com segurança (se for fazer no futuro)

- **Manter API síncrona externamente**. Cada função vira um wrapper que faz `await import()` por dentro e retorna `Promise`. Como já são todas `async`, a assinatura não muda — só o conteúdo. Único ponto sensível: garantir que `buildRelatorioDocxBlob` continue retornando `Blob`, não `Promise<Blob>` se algum consumer não awaita (verificar todos os call-sites com `rg`).
- **Splitting por engine**: 3 chunks dinâmicos separados — `chunk-docx` (docx + docxtemplater + pizzip), `chunk-pdf` (jspdf + jspdf-autotable), `chunk-xlsx` (xlsx-js-style). Hoje o `vite.config` já tem `manualChunks`; basta trocar import estático por `await import()`. Os chunks já existem, só passam de "carregados no boot" para "carregados sob demanda".
- **Pré-fetch on intent**: ao montar `RelatorioDetalhePage` / `PlanejamentoDetalhePage`, disparar `import("docx")` em background dentro de `requestIdleCallback`. Quando o usuário clicar em "Exportar", já está em cache. Elimina a latência de primeira exportação.
- **Smoke test obrigatório**: criar `src/test/export-smoke.test.ts` que chama cada função exportada com um mock mínimo e valida que retorna um `Blob` não-vazio. Roda em CI antes de mergear.
- **Migração Drive/Docs reduz a urgência**: como agora você usa Google Docs para edição colaborativa, o caminho DOCX local é cada vez menos crítico. Faz sentido **adiar** essa otimização até decidir se vai aposentar parte do fluxo DOCX local em favor do Docs (aí o ganho vem de **remover** docxtemplater, não de torná-lo lazy).

### Pode executar sem falhas?
Sim, mas só se: (a) for feito em PR isolado, (b) tiver smoke test cobrindo as 9 funções exportadas, (c) você testar manualmente as 3 rotas críticas (relatório individual, ficha de inscrição, bulk mensal) antes de publicar. **Não recomendo aplicar junto com as outras mudanças.**

---

## Ordem de execução proposta nesta rodada

1. Memoização do grid do Cronograma (`CronogramaPage` + `AgendaProfissional`).
2. Fix do `CienteRequiredModal`: `profileId` no AuthContext, debounce do `load()`, filter no canal de `recados`, polling para intervenções.
3. Apenas relatório dos riscos do Item 4 — sem código.

## Detalhes técnicos
- Nenhuma migration necessária.
- Nenhum endpoint novo.
- Nenhuma alteração em RPCs de indicadores (`get_dashboard_stats`, `get_coordenacao_stats`, `get_produtividade_educadores`).
- Realtime: remover 1 subscription global por usuário (`cronograma_intervencoes`), substituída por polling 60s.

## Fora de escopo
- Refatorar `useDocumentExport` (Item 4).
- Remover tabelas do cronograma.
- Mexer em qualquer hook de produtividade/dashboard.
