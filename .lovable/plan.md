

## Plano: Corrigir presenças não aparecendo + Relatório Completo

---

### Problema: Presenças não aparecem na matriz de frequência

**Causa raiz identificada** — Tanto na edge function (linha 329) quanto na geração local (linha 474), a lógica é:

```
datas = datasAtividade.length > 0 ? datasAtividade : [...allDatesSet].sort()
```

Quando a turma tem `dias_semana` configurado, `datasAtividade` contém apenas as datas "esperadas" (ex: segundas-feiras: 04-07, 04-14, 04-21, 04-28). Se a presença foi registrada em `2026-04-03` (data que não é segunda), essa data **nunca aparece como coluna**, e portanto a presença é ignorada.

**Correção**: Sempre mesclar datas reais de presença + datas de fallback nas colunas. Mudar para:

```
const datas = [...allDatesSet].sort()
```

Isso garante que qualquer data com presença registrada (seja via tabela `presenca` ou via `relatorio_presenca` fallback) apareça como coluna na matriz.

### Preenchimento visual das células de presença

O preenchimento preto (`rgb: "000000"`) já está implementado no código (linhas 367-368 da edge function, linhas 516-519 do local). Ele só não aparece porque as datas não batem. Com a correção acima, as células serão preenchidas com fundo preto sólido — ideal para digitalização e leitura por IA.

### Relatório Completo (período integral)

Adicionar botão "Relatório Completo" que detecta automaticamente o primeiro e último mês com dados e itera a lógica existente mês a mês, gerando todas as abas num único XLSX.

---

### Arquivos e mudanças

| Arquivo | Mudança |
|---|---|
| `supabase/functions/generate-relatorio-mensal/index.ts` | Linha 329: trocar para `[...allDatesSet].sort()` sempre. Aceitar `completo: true` para gerar todos os meses. |
| `src/pages/dashboard/DashboardRelatorioMensalTab.tsx` | Linha 474: mesma correção. Novo botão "Relatório Completo" + função `generateFullReport`. |

### Detalhe técnico — Relatório Completo

- Edge function aceita `{ completo: true }` → detecta `MIN(data)` e `MAX(data)` dos relatórios, presença e atendimentos
- Itera mês a mês, para cada mês gera as abas com sufixo (ex: "Resumo Abr26", "Metas Abr26", "JI 9-11M Abr26")
- Aba "Consolidado" no início com totais únicos de todo o período
- Nomes de aba limitados a 31 caracteres
- Botão na UI sem seletor de mês/ano

