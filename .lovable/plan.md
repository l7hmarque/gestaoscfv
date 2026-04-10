

## Plano: Separar Recados Técnicos dos Demais

### Problema
Atualmente, o `RecadosEquipeCards` carrega **todos** os recados sem filtro. Não há distinção no banco entre recados enviados via "Recado para Equipe Técnica" e recados normais (menções, notificações do sistema, etc.).

### Solução

#### 1. Migração: Adicionar campo `tipo_recado` na tabela `recados`
```sql
ALTER TABLE public.recados ADD COLUMN tipo_recado text NOT NULL DEFAULT 'geral';
```
Valores: `"geral"` (padrão) e `"tecnico"` (enviados via botão "Recado para Equipe Técnica").

#### 2. Marcar recados técnicos no envio (`SendRecadoDialog.tsx`)
Quando `toTecnicos === true`, incluir `tipo_recado: "tecnico"` no insert do recado.

#### 3. Filtrar `RecadosEquipeCards` por `tipo_recado = "tecnico"`
Na query de `loadRecados`, adicionar `.eq("tipo_recado", "tecnico")` para mostrar apenas os recados destinados à equipe técnica.

#### 4. Mover RecadosEquipeCards para aba própria no `EquipeTecnicaPage`
- Adicionar tab **"Recados"** ao `TabsList` com badge de contagem de pendentes
- Remover o `<RecadosEquipeCards />` do dashboard tab
- O componente já tem realtime via `postgres_changes`, então a notificação (badge na tab) atualiza automaticamente
- Expor a contagem de pendentes via callback ou state lifting para o badge na tab

#### 5. Status apenas nos recados técnicos
Recados com `tipo_recado = "geral"` não terão controle de status (mantêm o default `pendente` mas ninguém os atualiza). A página do profissional continua mostrando recados enviados/recebidos normalmente sem seletor de status.

### Arquivos alterados

| Arquivo | Mudança |
|---|---|
| Migração SQL | `ALTER TABLE recados ADD COLUMN tipo_recado text DEFAULT 'geral'` |
| `src/components/SendRecadoDialog.tsx` | Inserir `tipo_recado: "tecnico"` quando `toTecnicos` |
| `src/components/RecadosEquipeCards.tsx` | Filtrar por `tipo_recado = "tecnico"`, expor contagem de pendentes |
| `src/pages/equipe-tecnica/EquipeTecnicaPage.tsx` | Adicionar tab "Recados" com badge, mover RecadosEquipeCards pra lá |

