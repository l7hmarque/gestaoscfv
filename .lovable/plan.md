

## Plano: Corrigir Matrizes de Frequência e Novas Inserções no Relatório Mensal

---

### Problema 1 — Matrizes mostram apenas datas com registros

Atualmente as colunas da matriz vêm de `presenca.data` (só datas onde alguém teve registro). Se nenhuma presença foi lançada num dia de atividade, esse dia não aparece. O correto é gerar TODAS as datas de atividade do mês baseado nos `dias_semana` da turma, e marcar `✓`, `F` ou vazio conforme o registro.

**Correção em `DashboardRelatorioMensalTab.tsx`:**
- Calcular todas as datas do mês que caem nos `dias_semana` da turma (ex: `["seg", "qua"]` → todas as segundas e quartas do mês)
- Usar essas datas como colunas, não apenas as datas com registro de presença
- Para cada participante x data: `✓` se presente, `F` se ausente com registro, vazio se sem registro

### Problema 2 — "Novas Inserções" conta registros importados em massa

O campo `created_at` reflete quando o registro foi criado no banco, não quando o participante efetivamente entrou no SCFV. Os 200 participantes importados em massa aparecem todos como "novos" em março.

**Correção:**
- Usar `iniciou_em` (data de início real no SCFV) em vez de `created_at` para contar novas inserções
- Fallback: se `iniciou_em` for nulo, não contar como nova inserção (dados antigos/importados)
- Renomear a seção para "NOVAS INSERÇÕES NO MÊS (por data de início)"

---

### Arquivo modificado

| Arquivo | Mudança |
|---|---|
| `src/pages/dashboard/DashboardRelatorioMensalTab.tsx` | Gerar datas de atividade a partir de `dias_semana` da turma; usar `iniciou_em` para novas inserções |

### Detalhe técnico — geração de datas

```typescript
const DIAS_MAP: Record<string, number> = {
  dom: 0, seg: 1, ter: 2, qua: 3, qui: 4, sex: 5, sab: 6
};

function getDatasAtividade(ano: number, mes: number, diasSemana: string[]): string[] {
  const datas: string[] = [];
  const diasNum = diasSemana.map(d => DIAS_MAP[d]).filter(n => n !== undefined);
  const d = new Date(ano, mes - 1, 1);
  while (d.getMonth() === mes - 1) {
    if (diasNum.includes(d.getDay())) {
      datas.push(d.toISOString().slice(0, 10));
    }
    d.setDate(d.getDate() + 1);
  }
  return datas;
}
```

