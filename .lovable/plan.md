## Validação concluída — Plano revisado

Diferenças vs. plano anterior (achados na validação):
- `generate-rca` é puramente financeira → entra na lista de exclusão
- `drive-sync-worker` tem branch `processOrcamento` + dispatch `tipo === "orcamento"` → precisa ser podado (não excluído, pois sincroniza outros tipos)
- `sync-drive-modelos` tem template de orçamento → remover só o template
- Bucket de Storage `prestacao-contas` + policies → entram na migration de drop
- Memórias financeiras existentes em arquivo: apenas `financeiro-rubricas-oficiais.md` e `financeiro-audit-sync` (referenciadas no índice). Demais entradas do índice serão removidas como links órfãos

---

## Parte 1 — Remoção total do módulo Financeiro

### 1.1 Pastas e arquivos a EXCLUIR
- `src/pages/financeiro/` (4 arquivos)
- `src/components/financeiro/` (6 arquivos)
- `src/lib/sitExport.ts`, `sitZipPackage.ts`, `sitCodeMappings.ts`, `despesaImportValidation.ts`, `orcamentoMatcher.ts`, `rubricasOficiais.ts`
- `src/hooks/useOrcamentoExport.ts`
- `src/pages/configuracoes/ConfiguracoesSitTab.tsx`
- `.lovable/memory/funcionalidades/financeiro-rubricas-oficiais.md`

### 1.2 Edge Functions a deletar (supabase--delete_edge_functions)
`audit-financeiro`, `classify-financeiro-doc`, `detect-controle-bancario`, `detect-despesa-from-doc`, `detect-orcamento-from-doc`, `generate-reo`, **`generate-rca`** (adicionada na validação)

### 1.3 Edge Functions a EDITAR (manter, podar trecho financeiro)
- `supabase/functions/drive-sync-worker/index.ts` — remover `processOrcamento` (linhas ~850–900), o `else if (job.tipo === "orcamento")` e qualquer enfileiramento de jobs de orçamento
- `supabase/functions/sync-drive-modelos/index.ts` — remover template financeiro/orçamento

### 1.4 Pontos de integração no front a LIMPAR
- `src/App.tsx` — remover lazy imports e rotas `/financeiro` e `/financeiro/arquivos`
- `src/components/AppSidebar.tsx` — remover item "Financeiro"
- `src/components/FloatingActionButton.tsx` — remover atalho "Financeiro"
- `src/pages/Index.tsx` — remover tile "Financeiro"
- `src/pages/preview/DesignPreviewPage.tsx` — remover entrada "Financeiro"
- `src/pages/coordenacao/PermissoesTab.tsx` — limpar texto "financeiro" do papel Técnico
- `src/pages/configuracoes/ConfiguracoesPage.tsx` — remover aba SIT (TabsTrigger e TabsContent `value="sit"`) e o import de `ConfiguracoesSitTab`
- `src/pages/banco-dados/BancoDadosPage.tsx` — remover abas/colunas/queries/states de despesas, despesa_historico, estornos, orcamentos, orcamento_itens, orcamento_cotacoes, categorias_financeiras, parcelas_financeiras
- `src/pages/dashboard/DashboardRelatorioMensalTab.tsx` — remover botão/lógica "generate-reo" e textos "financeiro"
- `src/pages/relatorios/ExportarRelatoriosPage.tsx` — remover bloco "6. REO" + função `exportarPrestacaoContas` (linhas ~581–800) e cards UI correspondentes
- `src/hooks/useRelatorioGestao.ts` — remover seção "6. Financeiro" (campos `despesas/estornos/parcelas/categorias_financeiras` no fetch + aba "Financeiro" do XLSX + `despesasByCat`); manter as outras 9 seções
- `src/test/security.test.ts` e `src/test/security-auth.test.ts` — remover asserts de tabelas financeiras e do bucket `prestacao-contas`

### 1.5 Banco de dados (migration única, ordem segura)
Drop em cascata (com `IF EXISTS`):
- Tabelas: `despesa_historico`, `despesas`, `estornos`, `orcamento_precos`, `orcamento_cotacoes`, `orcamento_itens`, `orcamentos`, `categorias_financeiras`, `parcelas_financeiras`
- Policies de Storage referenciando `bucket_id = 'prestacao-contas'`
- `DELETE FROM storage.objects WHERE bucket_id = 'prestacao-contas'` e `DELETE FROM storage.buckets WHERE id = 'prestacao-contas'`
- Drop de funções/triggers SQL exclusivamente financeiras (verificar via `supabase--linter` antes de aplicar)

### 1.6 Memórias do projeto
- Apagar arquivo `mem://funcionalidades/financeiro-rubricas-oficiais`
- Atualizar `mem://index.md` removendo bullets: `financeiro-audit-sync`, `modulo-orcamentos-mapas-comparativos`, `financeiro-prestacao-contas`, `financeiro-gestao-pipeline`, `gestao-dados-financeiros-banco`, `formato-exportacao-sit`, `relatorio-execucao-objeto-reo`, `financeiro-rubricas-oficiais`

---

## Parte 2 — Auditoria de performance e higienização

### 2.1 Achados relevantes

```text
[A] Lazy de rotas: OK
[B] QueryClient: staleTime 5min, refetchOnWindowFocus:false — OK
[C] Toaster + Sonner duplicados em App.tsx
[D] Bibliotecas pesadas (xlsx, jspdf, jspdf-autotable, docx,
    docxtemplater, pdf-lib, pdfjs-dist, html2canvas, recharts,
    canvas-confetti, pizzip) importadas top-level em várias páginas
    inflam o chunk inicial mesmo com lazy de rota
[E] BancoDadosPage carrega TUDO no mount
[F] Dashboard monta todas as abas de uma vez
[G] AuthContext.getSession failsafe 8s atrasa primeiro paint quando
    Cloud está instável
[H] Console.log de produção espalhados
[I] Sem manualChunks no Vite — bundle inicial monolítico
[J] Várias páginas usam .select("*") sem necessidade
[K] Algumas Edge Functions têm awaits sequenciais que podem
    virar Promise.all
```

### 2.2 Otimizações SEGURAS (zero impacto funcional)
1. **Code-splitting de libs pesadas** via `await import(...)` dentro das funções de export (xlsx, jspdf, docx, html2canvas, pdf-lib, pdfjs-dist).
2. **`vite.config.ts`** — `build.rollupOptions.output.manualChunks`: separar `react-vendor`, `radix`, `charts`, `pdf`, `xlsx`, `editor`.
3. **Dashboard**: lazy-load por aba (Admin, Profissionais, RelatorioMensal, Transporte) com `React.lazy` + `Suspense`.
4. **AuthContext**: failsafe de 8s → 4s; renderizar shell público enquanto valida (gate só em `ProtectedRoute`).
5. **Toaster duplicado**: manter apenas `Sonner` em App.tsx.
6. **Memoização**: `useMemo` em derivações pesadas dos dashboards e `React.memo` em linhas grandes do DataTable.
7. **`select` enxuto**: trocar `select("*")` por colunas necessárias em listagens grandes (Participantes, Relatórios, BancoDados restante).
8. **Edge Functions**: `Promise.all` em `generate-relatorio-mensal`, `drive-sync-worker` e demais com awaits independentes.
9. **Imagens**: `loading="lazy"` + `decoding="async"` em `<img>` não-LCP; preload do logo.
10. **Console**: remover `console.log` (manter `console.error`).
11. **Dependências órfãs após Parte 1**: revisar e remover do `package.json` apenas o que ficou sem uso (provavelmente `pizzip` permanece em outro export).

### 2.3 NÃO será alterado
RLS, roles, permissões, lógica de busca ativa/ELO/presença/matrícula, schema de tabelas remanescentes, payload das Edge Functions, comportamento visível ao usuário.

---

## Parte 3 — Ordem de execução

1. **Migration de drop** (tabelas + storage `prestacao-contas`) → aprovação obrigatória
2. **Delete edge functions** (7 funções)
3. **Editar** `drive-sync-worker` e `sync-drive-modelos` (poda)
4. **Excluir arquivos** front (pastas financeiro, libs SIT, hook, ConfiguracoesSitTab)
5. **Limpar referências** cruzadas (App, sidebar, FAB, Index, Configuracoes, BancoDados, Dashboard, ExportarRelatorios, useRelatorioGestao, PermissoesTab, DesignPreview, tests)
6. **Atualizar `mem://index.md`** + apagar memória financeira
7. **Aplicar otimizações** 2.2 (code-splitting, manualChunks, Suspense por aba, AuthContext, Toaster, console.log)
8. **`supabase--linter`** + build para confirmar zero referências quebradas

### Critério de aceite
- Build verde, sem imports órfãos
- `rg "financeiro|despesas|orcamentos|estornos|categorias_financeiras|parcelas_financeiras|sit_|REO|prestacao-contas"` retorna apenas migrations antigas (read-only)
- Dashboard, Relatórios, Banco de Dados, Cronograma, Cozinha, Transporte, Coordenação, Equipe Técnica, Matrícula, Família, Feed, Mural, Site Público — 100% funcionais
- Bundle inicial reduzido (verificável no output do build)
