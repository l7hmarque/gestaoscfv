

## Plano: Corrigir dropdown de educador no formulário de relatório

### Problema
O dropdown de educador usa o componente `Select` do Radix UI que, dependendo da posição na tela, pode cortar itens na parte inferior sem permitir scroll. Felipe Gomes da Silva está na lista (confirmado no banco), mas provavelmente fica escondido pelo overflow do viewport.

### Solução

**1. Trocar Select por Combobox com busca (`RelatorioNovoPage.tsx`)**
- Substituir o `<Select>` de educador por um componente Combobox (Popover + Command) com campo de busca
- Permite digitar para filtrar educadores pelo nome
- Resolve tanto o problema de scroll quanto facilita encontrar nomes em listas maiores
- O popover abre com altura controlada e scroll interno garantido

**2. Filtrar apenas educadores (não todos os profiles)**
- Atualmente busca todos os 12 profiles — incluir apenas quem tem role `educador` ou `coordenacao`
- Fazer join com `user_roles` para filtrar, ou buscar roles separadamente e filtrar no frontend

### Arquivos afetados
| Arquivo | Mudança |
|---|---|
| `src/pages/relatorios/RelatorioNovoPage.tsx` | Combobox com busca para educador, filtro por role |

