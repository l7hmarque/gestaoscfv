

## Plano: Corrigir contagem de atendidos no REO + Unificar página de exportação de relatórios

### Problema 1: REO não contabiliza crianças atendidas no Comparativo

A Edge Function `generate-reo` conta presenças apenas da tabela `presenca`, mas a frequência no sistema é registrada prioritariamente via `relatorio_presenca`. A função **não busca** `relatorio_presenca` nem faz o merge (fallback) que a geração local do Relatório Mensal já faz corretamente. Resultado: contagem zerada no Comparativo (seção 1.3 Metas).

**Correção na Edge Function `generate-reo/index.ts`:**
- Adicionar `fetchAll(supabase, "relatorio_presenca")` ao Promise.all
- Após carregar `presenca`, enriquecer com dados de `relatorio_presenca` + `relatorio_turmas` (mesma lógica de merge já usada em `DashboardRelatorioMensalTab.tsx` linhas 168-182)
- Isso garante que `countUniqueParts` encontre os participantes presentes

### Problema 2: Exportação de relatórios dispersa

Atualmente, os botões de geração de relatórios estão espalhados entre:
- `DashboardRelatorioMensalTab` (aba "Relatórios" do Dashboard) — XLSX local, XLSX servidor, PDF, REO DOCX, REO XLSX, Relatório Completo
- `FinanceiroPage` — Prestação de Contas PDF+XLSX, REO DOCX+XLSX, RCA
- `PresencaExportarPage` — Matrizes de frequência e listas de presença

**Solução: Criar página unificada `ExportarRelatoriosPage`** em `/relatorios/exportar`

A página terá um seletor de mês/ano e 3 seções:

**1. Relatório de Execução do Objeto (REO)**
- Botão único "Exportar REO" que gera DOCX + XLSX + PDF simultaneamente
- O DOCX e XLSX já existem via edge function; PDF será gerado localmente
- Incluir matrizes de frequência preenchidas (mesma lógica do Relatório Mensal) embutidas no relatório
- Unificar local/servidor: tentar local primeiro, fallback para servidor automaticamente

**2. Relatório de Prestação de Contas**
- Botão único "Exportar Prestação de Contas" que gera XLSX + PDF simultaneamente
- Migrar lógica de `FinanceiroPage.generatePrestacaoContas`

**3. Relatório Completo Anual**
- Seletor de ano (em vez de mês)
- Gera um REO consolidado com todos os meses do ano selecionado
- Usa a edge function `generate-relatorio-mensal` com `{ completo: true }` adaptada para escopo anual

**Unificação local/servidor:**
Cada botão de exportação tenta gerar localmente primeiro (`try/catch`); se falhar (ex: mobile, memória), chama automaticamente a edge function equivalente, sem dois botões separados.

### Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `supabase/functions/generate-reo/index.ts` | Buscar `relatorio_presenca`, fazer merge com `presenca` para corrigir contagem |
| `src/pages/relatorios/ExportarRelatoriosPage.tsx` | **Novo** — página unificada de exportação |
| `src/App.tsx` | Adicionar rota `/relatorios/exportar` |
| `src/components/AppSidebar.tsx` | Adicionar link para a nova página (se necessário) |
| `src/pages/dashboard/DashboardRelatorioMensalTab.tsx` | Simplificar — redirecionar para a nova página ou manter resumido |

### Detalhes técnicos

**Merge de presença no REO (edge function):**
```typescript
// Após fetchAll
const relatorioPresencas = await fetchAll(supabase, "relatorio_presenca");

// Enrich presenca with relatorio_presenca fallback
const presencaKeys = new Set(presenca.map(p => `${p.participante_id}_${p.data}_${p.turma_id}`));
for (const r of relsMes) {
  const rTurmas = relatorioTurmas.filter(rt => rt.relatorio_id === r.id);
  const rPres = relatorioPresencas.filter(rp => rp.relatorio_id === r.id);
  for (const rt of rTurmas) {
    for (const rp of rPres) {
      if (!rp.presente || !rp.participante_id) continue;
      const key = `${rp.participante_id}_${r.data}_${rt.turma_id}`;
      if (!presencaKeys.has(key)) {
        presenca.push({ participante_id: rp.participante_id, data: r.data, turma_id: rt.turma_id, presente: true });
        presencaKeys.add(key);
      }
    }
  }
}
```

**Lógica unificada local/servidor:**
```typescript
const exportarREO = async () => {
  setLoading(true);
  try {
    // Tenta local primeiro
    await generateLocalREO(mes, ano);
  } catch {
    // Fallback para servidor
    const { data } = await supabase.functions.invoke("generate-reo", { body: { mes, ano, formato: "docx" } });
    if (data?.url) window.open(data.url, "_blank");
  }
  setLoading(false);
};
```

