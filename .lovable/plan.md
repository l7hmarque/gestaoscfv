

## Plano: Exclusão de Relatórios de Atividade (individual e em lote)

### Resumo
Adicionar funcionalidade para coordenadores excluírem relatórios de atividade — individualmente na página de detalhe e em lote por intervalo de datas na listagem. As RLS policies já permitem delete para coordenação e autor.

---

### 1. Botão "Excluir" na página de detalhe (`RelatorioDetalhePage.tsx`)

- Adicionar botão vermelho "Excluir" no header (ao lado de Imprimir/Exportar), visível para coordenação
- Ao clicar, AlertDialog de confirmação
- Na exclusão: deletar registros vinculados (`relatorio_presenca`, `relatorio_fotos`, `relatorio_turmas`) e depois `relatorios_atividade`
- Redirecionar para `/relatorios` após sucesso

### 2. Exclusão em lote na listagem (`RelatoriosPage.tsx`)

- Botão "Excluir em Lote" no header, visível para coordenação (verificar role via `user_roles`)
- Abre Dialog com dois campos de data (De / Até) e botão "Buscar"
- Lista os relatórios encontrados com checkboxes (selecionar todos / individual)
- Botão "Excluir Selecionados" com AlertDialog de confirmação
- Cascata: deletar `relatorio_presenca`, `relatorio_fotos`, `relatorio_turmas` dos IDs selecionados, depois `relatorios_atividade`
- Recarregar a lista após exclusão

### 3. Verificação de role

- Buscar `user_roles` do usuário logado para checar se tem role `coordenacao`
- Usar o `useAuth()` + query rápida em `user_roles` ou reutilizar padrão existente no projeto

---

### Arquivos modificados

| Arquivo | Mudança |
|---|---|
| `src/pages/relatorios/RelatorioDetalhePage.tsx` | Botão excluir individual com confirmação |
| `src/pages/relatorios/RelatoriosPage.tsx` | Botão excluir em lote com filtro por datas |

