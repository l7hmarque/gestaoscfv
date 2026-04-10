

## Plano: Transferência automática de turma ao mudar período (com histórico)

### Problema
Ao mudar o período de um participante pela listagem (`ParticipantesPage`), ele permanece nas turmas do período antigo. Precisa: (1) mover para turmas do novo período, (2) manter frequências da turma antiga, (3) indicar "transferido" nas listas de presença e na página da turma.

### 1. Migração: adicionar campo `data_saida` em `turma_participantes`

```sql
ALTER TABLE public.turma_participantes
  ADD COLUMN data_saida date DEFAULT NULL,
  ADD COLUMN motivo_saida text DEFAULT NULL;
```

Quando `data_saida` é preenchido, o participante é considerado "transferido" daquela turma. Ele permanece na tabela (não é deletado), preservando o vínculo histórico e as frequências.

### 2. Alterar `handlePeriodoChange` em `ParticipantesPage.tsx`

Após atualizar o período do participante:
1. Buscar turmas atuais do participante (via `turma_participantes` onde `data_saida IS NULL`)
2. Para cada turma do período antigo: preencher `data_saida = hoje` e `motivo_saida = "Transferência de período"`
3. Buscar turmas compatíveis no novo período (mesma lógica de bairro/faixa etária)
4. Inserir novos vínculos `turma_participantes`
5. Registrar em `participante_transferencias`
6. Notificar educadores das turmas antigas e novas via `recados`

### 3. Ajustar queries que listam membros ativos de turmas

**Arquivos afetados:**
- `TurmaDetalhePage.tsx` — separar membros ativos (`data_saida IS NULL`) de transferidos (`data_saida IS NOT NULL`); exibir transferidos em seção separada com a data de saída
- `PresencaPage.tsx` — filtrar apenas `data_saida IS NULL` ao carregar participantes para registro de presença
- `RelatorioNovoPage.tsx` — idem ao carregar participantes das turmas selecionadas

### 4. Listas de presença (XLSX) — indicar transferidos

**Arquivo:** `exportListaPresenca.ts`

- Ao gerar a lista, incluir participantes transferidos que saíram no mês corrente ou no mês anterior
- Marcar com "(T)" ao lado do nome e riscado a partir da data de saída (mesma lógica existente para "desligado")
- `MemberInfo` ganha campos `transferido?: boolean` e `data_transferencia?: string | null`

### 5. Ajustar Automação 3 no `ParticipantePerfilPage.tsx`

A lógica existente de transferência (linhas 173-191) já solicita aprovação. Ao confirmar, usar a mesma lógica: preencher `data_saida` nas turmas antigas ao invés de deletar os vínculos.

### Resumo de alterações

| Recurso | Mudança |
|---|---|
| **Migração SQL** | `data_saida` e `motivo_saida` em `turma_participantes` |
| `ParticipantesPage.tsx` | `handlePeriodoChange` faz transferência automática de turma |
| `TurmaDetalhePage.tsx` | Separar membros ativos de transferidos na UI |
| `PresencaPage.tsx` | Filtrar `data_saida IS NULL` |
| `RelatorioNovoPage.tsx` | Idem |
| `exportListaPresenca.ts` | Indicar transferidos com "(T)" |
| `ParticipantePerfilPage.tsx` | Usar `data_saida` ao invés de deletar vínculos |

