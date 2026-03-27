

## Plano: Melhorias em Bairros SCFV, Transporte, Perfil do Participante e Página do Desenvolvedor

### 1. Filtrar bairros SCFV em todos os selects (exceto Banco de Dados)

Aplicar `isBairroSCFV` nos selects de bairro das seguintes páginas que ainda mostram todos os bairros:

| Arquivo | Mudança |
|---|---|
| `src/pages/participantes/ParticipantesPage.tsx` | Filtro de bairro na listagem → somente SCFV |
| `src/pages/participantes/ParticipantePerfilPage.tsx` | Select de bairro no edit mode → somente SCFV (endereço permanece livre) |
| `src/pages/dashboard/DashboardTransporteTab.tsx` | Select de bairro no "Novo Ponto" → somente SCFV |
| `src/pages/presenca/PresencaExportarPage.tsx` | Já filtra SCFV ✓ |
| `src/pages/presenca/PresencaPage.tsx` | Já filtra SCFV ✓ |
| `src/pages/turmas/*` | Já filtra SCFV ✓ |
| `src/pages/banco-dados/BancoDadosPage.tsx` | Mantém todos (conforme solicitado) |

---

### 2. Transporte: edição manual e em massa de pontos

**Arquivo:** `src/pages/dashboard/DashboardTransporteTab.tsx`

- Adicionar botão "Editar" por ponto (ícone lápis) que abre inline editing do **nome**, **bairro** e **horários** (além dos horários que já existem)
- Adicionar modo de **seleção em massa** (checkboxes por ponto) com barra de ações:
  - Alterar horário manhã/tarde em todos os selecionados
  - Ativar/desligar todos os selecionados
  - Alterar bairro de todos os selecionados
- Adicionar botão "Excluir" ponto (com confirmação)

---

### 3. Perfil do participante: destaque SCFV + seção sigilosa

**Arquivo:** `src/pages/participantes/ParticipantePerfilPage.tsx`

**Destaque no topo:**
- Abaixo do nome, adicionar uma faixa destacada com 3 badges coloridos:
  - **Bairro SCFV** (baseado no `bairro_id` do participante, mostrando o nome do bairro)
  - **Faixa Etária** (calculada a partir da `data_nascimento`: 6-8, 9-11, 12-17, idosos)
  - **Período** (Manhã/Tarde/Integral)

**Seção sigilosa para equipe técnica:**
- Nova seção `Card` no final da página, visível apenas para usuários com role `equipe_tecnica` ou `coordenacao`
- Conteúdo: campo de texto livre "Observações Sigilosas" salvo em uma nova coluna `observacoes_sigilosas` na tabela `participantes`
- Visual diferenciado (borda vermelha/amarela, ícone de cadeado)

**Migration SQL:** Adicionar coluna `observacoes_sigilosas text` à tabela `participantes`

---

### 4. Página do Desenvolvedor (protegida com senha)

**Novos arquivos:**
- `src/pages/dev/DevPage.tsx` — página protegida por senha local ("leoleo")

**Funcionalidades da página:**
- Prompt de senha ao acessar (armazenada em sessionStorage após validação)
- **Gestão de permissões:** Lista todos os profissionais com suas roles, permitindo adicionar/remover roles rapidamente
- **Configurações rápidas:** Toggle para habilitar/desabilitar funcionalidades do sistema
- **Info do sistema:** Contagem de registros por tabela, versão, etc.

**Arquivo modificado:**
- `src/App.tsx` — adicionar rota `/dev` (pública, sem ProtectedRoute, a senha é validada internamente na página)

---

### Resumo de arquivos

| Arquivo | Ação |
|---|---|
| `src/pages/participantes/ParticipantesPage.tsx` | Filtrar bairros SCFV |
| `src/pages/participantes/ParticipantePerfilPage.tsx` | Destaque SCFV + seção sigilosa |
| `src/pages/dashboard/DashboardTransporteTab.tsx` | Edição manual + em massa |
| `src/pages/dev/DevPage.tsx` | Criar — página do desenvolvedor |
| `src/App.tsx` | Adicionar rota `/dev` |
| Migration SQL | Adicionar `observacoes_sigilosas` em `participantes` |

