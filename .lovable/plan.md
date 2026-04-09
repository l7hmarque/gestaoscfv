
## Plano: Recados na Equipe Técnica + Atalho "Meu Perfil"

### Resumo
Adicionar uma seção de cards de recados no dashboard da Equipe Técnica (recados enviados para técnicos/coordenação), com status atualizável. Adicionar um campo `status` na tabela `recados` para rastrear o andamento. Implementar atalho "Meu Perfil" no header e sidebar.

---

### 1. Migração: Adicionar campo `status` na tabela `recados`

Adicionar coluna `status` (text, default `'pendente'`) para controlar o fluxo de trabalho dos recados na equipe técnica. Valores: `pendente`, `em_andamento`, `concluido`.

```sql
ALTER TABLE public.recados ADD COLUMN status text NOT NULL DEFAULT 'pendente';
```

### 2. Cards de Recados no Dashboard da Equipe Técnica

No `EquipeTecnicaPage.tsx`, dentro da tab "Dashboard" (após os KPI cards e antes dos gráficos):

- Carregar recados destinados a perfis com role `tecnico` ou `coordenacao` (qualquer destinatário técnico, não só o logado)
- Exibir como cards com: remetente, participante vinculado (se houver), conteúdo, data, status atual (badge colorido)
- Select para atualizar status (`pendente` → `em_andamento` → `concluido`)
- Ao atualizar status, gravar no banco + criar notificação (o remetente já vê via NotificationBell pois o canal realtime de recados dispara refresh)

### 3. Notificação para o remetente

O `NotificationBell` já escuta `postgres_changes` na tabela `recados`. Quando o status é atualizado, o remetente verá o recado atualizado automaticamente na lista de notificações. Ajustar o `NotificationBell` para mostrar o badge de status quando existir, e exibir texto como "Status atualizado: Em andamento" no detail dialog.

### 4. Acompanhamento na página do profissional

No `ProfissionalPerfilPage.tsx`, adicionar uma seção/tab "Recados Enviados" que lista os recados enviados por aquele profissional com o status atual de cada um (badge colorido).

### 5. Atalho "Meu Perfil"

- No `AppLayout.tsx` header: adicionar um botão/avatar "Meu Perfil" que busca o `profile.id` do usuário logado e navega para `/profissional/:id`
- No `AppSidebar.tsx` footer: adicionar link "Meu Perfil" antes do botão "Sair", com ícone `User`

---

### Arquivos alterados

| Arquivo | Mudança |
|---|---|
| Migração SQL | `ALTER TABLE recados ADD COLUMN status text DEFAULT 'pendente'` |
| `src/pages/equipe-tecnica/EquipeTecnicaPage.tsx` | Carregar recados para técnicos, exibir cards com status, permitir update |
| `src/components/NotificationBell.tsx` | Mostrar status do recado no detail dialog |
| `src/pages/profissional/ProfissionalPerfilPage.tsx` | Adicionar tab/seção "Recados Enviados" com status |
| `src/components/AppLayout.tsx` | Adicionar botão "Meu Perfil" no header |
| `src/components/AppSidebar.tsx` | Adicionar link "Meu Perfil" no footer |
