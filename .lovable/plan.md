

## Diagnóstico

**Os dados ESTÃO espelhados, mas só 12,6% são presentes.** A confusão vem de dois pontos:

### 1. Realidade dos dados originais (tabela `presenca`)
- **2.006 registros** em março/2026
- **Apenas 253 presentes** (12,6%)
- **1.753 ausentes** (87,4%)

Isso reflete fielmente as listas físicas digitalizadas — a maioria dos participantes faltou nos dias importados (provável: lista incluía toda a turma, marcando ausentes os que não estavam, ou houve baixa frequência real em março).

### 2. Espelhamento em `relatorio_presenca` está correto
- 2.006 registros → 253 presentes / 1.753 ausentes (idêntico à origem). Espelho 1:1 funcionou.

### 3. PROBLEMA REAL identificado: relatórios "fantasma"
A query mostrou **dois bugs** nos relatórios sintéticos:

**Bug A — `num_participantes` e `pct_adesao` zerados** em TODOS os 232 relatórios:
- Ficaram com `num_participantes=0` e `pct_adesao=0.00`
- O dashboard usa `pct_adesao` para `mediaAdesao` → vai puxar a média para baixo artificialmente.

**Bug B — Relatórios sem `relatorio_turmas` nem presenças** (ex: `f8210495...`, `4a657004...`):
- Existem múltiplos relatórios criados no mesmo dia/turma (duplicatas) onde só 1 ficou com as presenças e os outros ficaram vazios.
- No dia 03/03 há 16 relatórios mas o histograma mostra vários com `qtd_turmas=0` e `total_rp=0`.
- Isso polui `totalRelatorios` no dashboard (vai contar 232 em vez dos ~80 reais).

## Plano de correção

### Etapa 1 — Limpar relatórios fantasma
Deletar relatórios sintéticos de março/2026 que estão **sem `relatorio_turmas` E sem `relatorio_presenca`** (são lixo de tentativa duplicada). Estimativa: ~30-50 registros.

### Etapa 2 — Recalcular `num_participantes` e `pct_adesao`
Para cada relatório sintético restante:
```
num_participantes = COUNT(relatorio_presenca WHERE presente=true)
total_esperado    = COUNT(relatorio_presenca)
pct_adesao        = (num_participantes / total_esperado) * 100
```

### Etapa 3 — Verificar duplicatas turma+data
Se ainda houver mais de 1 relatório sintético na mesma turma+data após Etapa 1, consolidar em 1 só (mover presenças para o relatório "principal" e deletar os outros).

### Etapa 4 — Auditoria final XLSX
Gerar **SysCFV_AuditoriaCorrecao_Marco2026.xlsx** com:
- **Resumo**: antes/depois (relatórios deletados, recalculados, consolidados)
- **Relatorios_Final**: lista limpa com data, turma, presentes, ausentes, % adesão
- **Frequencia_Por_Turma**: matriz turma × indicador (taxa real de frequência)

## Resposta direta à sua pergunta

> "Por que os relatórios não têm nenhum presente?"

Eles **têm presentes sim** — mas só 253 de 2.006 registros são presentes (12,6%), espelhando as listas físicas reais. O que parece "vazio" no XLSX de auditoria é porque a coluna `num_participantes` ficou zerada (bug do script de criação) e há ~30-50 relatórios duplicados completamente vazios poluindo a contagem.

Após a correção:
- Dashboard mostrará taxa de frequência real de março (~12,6%) — que pode indicar problema operacional a investigar.
- `totalRelatorios` cairá de 232 para ~80 (valor real).
- `mediaAdesao` deixará de ser puxada para 0 pelos fantasmas.

