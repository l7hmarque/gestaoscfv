

## Plano: Otimizar UI/UX do Cronograma para caber na tela

### Problema
A grade atual com sidebar (220px) + grid (5 dias × 3 bairros × 2 períodos = 6 linhas) não cabe na viewport de 1260×785px. Células com informações ficam apertadas e difíceis de ler.

### Mudanças

**1. Layout compacto — tudo visível sem scroll vertical**
- Reduzir sidebar de 220px para 180px, com scroll interno (altura fixa `h-[calc(100vh-180px)]`)
- Header: condensar toolbar em uma única linha compacta
- Conflitos: mostrar como popover/tooltip no ícone de alerta, não como card separado
- Grid: reduzir `min-h` das células de 72px para 56px
- Remover padding excessivo (`p-4 md:p-6` → `p-2 md:p-3`)

**2. Grade mais densa — cabeçalhos de bairro+período unificados**
- Agrupar visualmente por bairro com uma faixa colorida fina no topo de cada par manhã/tarde
- Label do bairro+período na primeira coluna: reduzir para uma linha só (ex: "JD IRENE · Manhã") em vez de duas linhas empilhadas
- Coluna de labels: 100px em vez de 120px

**3. Células com melhor disposição de informações**
- Usar layout em "chips" lado a lado quando há espaço, empilhando apenas se necessário
- Ícone do tipo + nome abreviado (primeiro nome + inicial) para caber melhor
- Botão de remover (X) aparece apenas no hover da célula, não sempre visível
- Font size das badges internas: manter 10px mas com melhor truncamento

**4. Sidebar de recursos — mais compacta**
- Cards de recurso colapsáveis (accordion) para liberar espaço
- Scroll interno por seção
- Contagem de slots como badge inline sem ocupar espaço extra

### Arquivo afetado
- `src/pages/cronograma/CronogramaPage.tsx` — ajustes de classes Tailwind e reorganização do JSX de layout

Nenhuma alteração de lógica ou banco de dados.

