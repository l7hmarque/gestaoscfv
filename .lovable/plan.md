## Plano: Novo status "Busca Ativa" + Painel de Desligamento Administrativo

### Contexto

Atualmente o enum `status_participante` tem: `ativo`, `desligado`, `incompleto`, `pendente`. Precisa de um novo valor `busca_ativa` para participantes que ainda não foram desligados formalmente mas precisam de busca ativa. Além disso, é necessário um painel especial para coordenação realizar desligamentos retroativos em lote, limpando vínculos com indicadores.

### 1. Migração: adicionar valor "busca_ativa" ao enum

```sql
ALTER TYPE public.status_participante ADD VALUE IF NOT EXISTS 'busca_ativa';
```

### 2. Atualizar labels e cores em `constants.ts`

Adicionar `busca_ativa: "Busca Ativa"` em `STATUS_LABELS` e cor laranja em `STATUS_COLORS`.

### 3. Adicionar "Busca Ativa" nos selects de status

**Arquivos afetados:**

- `ParticipantesPage.tsx` — filtro de status e select inline na tabela
- `ParticipantePerfilPage.tsx` — dropdown de status no perfil

### 4. Criar página "Painel de Desligamento Administrativo"

**Novo arquivo:** `src/pages/participantes/PainelDesligamentoPage.tsx`

**Acesso:** Apenas `coordenacao` (super admin). Rota `/desligamento-admin` protegida.

**Funcionalidades:**

- Lista todos participantes com status `ativo` ou `busca_ativa`
- Checkbox individual + "Selecionar todos"
- Campos globais: motivo do desligamento, data de desligamento (retroativa), justificativa - todos opcionais.
- Botão "Executar Desligamento em Lote" que para cada participante selecionado:
  1. Atualiza status para `desligado`, preenche `motivo_desligamento`, `justificativa_desligamento`, `data_desligamento`
  2. Remove vínculos de `turma_participantes` (deleta registros)
  3. Remove registros de `relatorio_presenca` onde `participante_id` corresponde
  4. Remove registros de `presenca` onde `participante_id` corresponde
  5. Registra no `audit_log`
- Os participantes **não são deletados** — continuam no banco como `desligado`
- Filtros por bairro, período, faixa etária para facilitar a triagem

### 5. Adicionar rota e link no sidebar

- Nova rota protegida em `App.tsx`: `/desligamento-admin`
- Link no sidebar na seção "Gestão", visível apenas para coordenação (verificação de role client-side)

### Resumo de alterações


| Recurso                                | Mudança                                                            |
| -------------------------------------- | ------------------------------------------------------------------ |
| **Migração SQL**                       | `ALTER TYPE status_participante ADD VALUE 'busca_ativa'`           |
| `constants.ts`                         | Novo label + cor para `busca_ativa`                                |
| `ParticipantesPage.tsx`                | Adicionar opção "Busca Ativa" nos selects                          |
| `ParticipantePerfilPage.tsx`           | Idem                                                               |
| **Novo: `PainelDesligamentoPage.tsx**` | Painel completo de desligamento em lote com limpeza de indicadores |
| `App.tsx`                              | Nova rota `/desligamento-admin`                                    |
| `AppSidebar.tsx`                       | Link condicional para coordenação                                  |
