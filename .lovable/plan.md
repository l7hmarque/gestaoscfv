

## Plano Atualizado: Plano anterior + Padronização de nomenclatura de arquivos

Mantidas todas as partes anteriores (quadrado presença, relatórios mensais, PDF profissional, fix bug orçamentos, gastos previstos, documentos institucionais). Abaixo a nova parte adicionada.

---

### Nova Parte — Padronização de nomenclatura de todos os arquivos

**Padrão obrigatório:** `SysELO_{Categoria}_{YYYY-MM-DD}_{HHmmss}.{ext}`

#### Arquivos fora do padrão encontrados

| Arquivo atual | Onde é gerado | Problema |
|---|---|---|
| `rca_2026-03.csv` | `generate-rca/index.ts` | Falta prefixo `SysELO_`, falta timestamp completo |
| `relatorios-mensais/completo_1743...xlsx` | `generate-relatorio-mensal/index.ts` | Usa `Date.now()` em vez do formato padrão, sem prefixo |
| `relatorios-mensais/2026-03_1743...xlsx` | `generate-relatorio-mensal/index.ts` | Idem |
| `SysELO_REO_2026-03_20260304...docx` | `generate-reo/index.ts` | Formato quase correto, mas timestamp usa `YYYYMMDD` condensado sem separadores |
| `SysELO_Orcamento_2026-03-04 14:30.xlsx` | `useOrcamentoExport.ts` | Timestamp usa `YYYY-MM-DD HH:mm` em vez de `YYYY-MM-DD_HHmmss` |
| `SysELO_MapaComparativo_...xlsx` | `useOrcamentoExport.ts` | Idem |
| `SysELO_Lista_Presenca_Turma_Marco_2026.pdf` | `useDocumentExport.ts` | Usa nome da turma e mês por extenso, sem timestamp padrão |
| `SysELO_BuscaAtiva_...pdf` | `TurmaDetalhePage.tsx` | Já segue o padrão (OK) |
| Documentos importados (upload) | `ParticipantePerfilPage`, `ParticipanteNovoPage`, `public-matricula` | Já usam `SysELO_Doc_{categoria}_{ts}.pdf` (OK, mas garantir consistência) |

#### Solução: Helper centralizado `formatFileName`

Criar em `src/lib/fileNaming.ts` uma função utilitária reutilizável:

```typescript
export function sysEloFileName(categoria: string, ext: string, sufixo?: string): string {
  const d = new Date();
  const ts = `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
  return `SysELO_${categoria}${sufixo ? '_' + sufixo : ''}_${ts}.${ext}`;
}
```

E uma versão Deno equivalente inline para as Edge Functions (que não importam do `src/`).

#### Arquivos a corrigir

| Arquivo | Mudança |
|---|---|
| `src/lib/fileNaming.ts` (novo) | Helper centralizado `sysEloFileName()` |
| `src/hooks/useDataExport.ts` | Substituir `exportFileName` por `sysEloFileName` |
| `src/hooks/useOrcamentoExport.ts` | Usar `sysEloFileName("Orcamento", "xlsx")` e `sysEloFileName("MapaComparativo", "xlsx")` |
| `src/hooks/useDocumentExport.ts` | Padronizar `Lista_Presenca` para usar timestamp padrão em vez de `mês_ano` |
| `src/hooks/useBackupExport.ts` | Já usa padrão similar, ajustar para usar helper central |
| `src/pages/dashboard/DashboardRelatorioMensalTab.tsx` | Usar helper para nome do XLSX local |
| `supabase/functions/generate-rca/index.ts` | `rca_${mesRef}.csv` → `SysELO_RCA_${ano}-${mes}_${ts}.csv` |
| `supabase/functions/generate-relatorio-mensal/index.ts` | `completo_${Date.now()}.xlsx` → `SysELO_RelatorioMensal_Completo_${ts}.xlsx`; mensal → `SysELO_RelatorioMensal_${ano}-${mes}_${ts}.xlsx` |
| `supabase/functions/generate-reo/index.ts` | Ajustar timestamp para `YYYY-MM-DD_HHmmss` |
| `src/pages/participantes/ParticipanteNovoPage.tsx` | Já usa padrão, ajustar para helper |
| `src/pages/participantes/ParticipantePerfilPage.tsx` | Idem |

#### Storage paths

Os paths dentro dos buckets também serão padronizados:
- `rca/SysELO_RCA_...csv` (já usa pasta `rca/`)
- `relatorios-mensais/SysELO_RelatorioMensal_...xlsx`
- `reo/SysELO_REO_...docx`

---

### Resumo completo de mudanças (todas as partes)

| Arquivo | Mudança |
|---|---|
| `src/lib/fileNaming.ts` (novo) | Helper centralizado de nomenclatura |
| `src/pages/dashboard/DashboardRelatorioMensalTab.tsx` | Quadrado ■, reordenar botões, PDF profissional, nomenclatura |
| `supabase/functions/generate-relatorio-mensal/index.ts` | Quadrado ■, nomenclatura |
| `supabase/functions/generate-rca/index.ts` | Nomenclatura |
| `supabase/functions/generate-reo/index.ts` | Nomenclatura |
| `src/pages/financeiro/OrcamentosTab.tsx` | Fix inputs com estado local + onBlur |
| `src/pages/financeiro/FinanceiroPage.tsx` | KPI "Gastos Previstos", aba "Documentos", upload inline |
| `src/pages/financeiro/DocumentosPrestacaoTab.tsx` (novo) | Documentos institucionais com versionamento |
| Migração SQL | CREATE `documentos_prestacao_contas` com RLS |
| `src/hooks/useDataExport.ts` | Usar helper de nomenclatura |
| `src/hooks/useOrcamentoExport.ts` | Usar helper de nomenclatura |
| `src/hooks/useDocumentExport.ts` | Nomenclatura lista presença |
| `src/hooks/useBackupExport.ts` | Usar helper de nomenclatura |

