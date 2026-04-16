

## Plano: 3 Correções — Cards, Profissional Extra, Scroll Preservado

### 1. Cards de Planejamentos e Relatórios — limitar badges de turmas

**Problema**: Quando há muitas turmas vinculadas, as badges ocupam espaço excessivo e desconfiguam o card.

**Solução**: Mostrar no máximo 2 badges de turma e, se houver mais, exibir um "+N" resumido. Aplicar em ambos os arquivos.

**Arquivos**: `PlanejamentosPage.tsx` (linhas 155-163), `RelatoriosPage.tsx` (linhas 263-270)

---

### 2. Opção de +1 profissional no relatório de atividade

**Problema**: Atualmente o relatório só permite um educador. Precisa de campo para um segundo profissional de apoio.

**Solução**:
- **Migração SQL**: Adicionar coluna `educador_apoio_id uuid DEFAULT NULL` na tabela `relatorios_atividade` com FK para `profiles(id)`.
- **RelatorioNovoPage.tsx**: Adicionar segundo Combobox "Profissional de Apoio" abaixo do educador principal. Salvar no campo `educador_apoio_id`.
- **RelatorioDetalhePage.tsx**: Exibir o nome do profissional de apoio na visualização e permitir edição no modo edição.
- **RelatoriosPage.tsx**: Exibir o nome do apoio no card (se existir), ex: "+ Fulano".

---

### 3. Preservar posição do scroll ao mudar período/status

**Problema**: `fetchData()` recarrega toda a lista e o scroll volta ao topo.

**Solução**: Em `ParticipantesPage.tsx`, nas funções `handlePeriodoChange` e `handleStatusChange` (e `handleDesligamento`), salvar `window.scrollY` antes do `fetchData()` e restaurar com `requestAnimationFrame(() => window.scrollTo(0, savedY))` após o setState atualizar. Usar uma ref para não perder o valor.

Alternativamente, fazer update otimista: atualizar o array `participantes` localmente sem refetch completo, chamando `setParticipantes(prev => prev.map(...))` após o update no Supabase.

**Abordagem escolhida**: Update otimista — ao mudar período ou status com sucesso, atualizar o item no array local em vez de chamar `fetchData()`. Isso é mais rápido e preserva o scroll naturalmente. Manter `fetchData()` apenas para ações destrutivas (desligamento).

---

### Arquivos a editar

| Arquivo | Mudança |
|---|---|
| **Migração SQL** | `ALTER TABLE relatorios_atividade ADD COLUMN educador_apoio_id uuid DEFAULT NULL` |
| `src/pages/planejamentos/PlanejamentosPage.tsx` | Limitar badges a 2 + contador |
| `src/pages/relatorios/RelatoriosPage.tsx` | Limitar badges a 2 + contador; exibir apoio |
| `src/pages/relatorios/RelatorioNovoPage.tsx` | Campo Combobox "Profissional de Apoio" |
| `src/pages/relatorios/RelatorioDetalhePage.tsx` | Exibir/editar profissional de apoio |
| `src/pages/participantes/ParticipantesPage.tsx` | Update otimista em vez de refetch total |

