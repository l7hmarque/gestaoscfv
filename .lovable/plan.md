

## Plano: Correção de Status na Chamada + Sistema de Período Automático

### Problema 1: Participantes com status errado na chamada do relatório

**Causa raiz**: A query em `RelatorioNovoPage.tsx` (linha 172-176) busca `turma_participantes WHERE data_saida IS NULL` e faz join com `participantes(id, nome_completo)` — mas **não filtra pelo status** do participante. Resultado:
- Desligados sem `data_saida` preenchida → aparecem
- Busca Ativa → na verdade aparecem normalmente (114 registros com `data_saida IS NULL`). Se estão faltando, pode ser que não estejam vinculados às turmas selecionadas.

**Correção**: Alterar a query para incluir o `status` do participante e filtrar:
- Incluir: `ativo`, `busca_ativa`
- Excluir: `desligado`, `pendente`, `incompleto`

Aplicar no `RelatorioNovoPage.tsx` e no `RelatorioDetalhePage.tsx` (modo edição).

---

### Problema 2 + 3: Seleção multi-período + auto-atualização de período

**Nova coluna**: Adicionar `periodo_atividade` (text, nullable, default NULL) na tabela `relatorios_atividade` — valores: `manha`, `tarde`, `integral`.

**Mudanças no formulário de relatório**:
1. Permitir selecionar turmas de qualquer período (já funciona, só organizar visualmente por período)
2. Adicionar campo "Período da Atividade" (Manhã/Tarde) — obrigatório quando turmas de períodos diferentes são selecionadas
3. Na lista de chamada, indicar ao lado do nome se o participante é de turma com período diferente do selecionado (ex: badge "Tarde → Manhã")

**Lógica de auto-atualização ao salvar** (somente participantes marcados como PRESENTES):

```text
Para cada participante presente no relatório:
  SE participante.periodo ≠ periodo_atividade:
    1. Atualizar participantes.periodo = periodo_atividade
    2. Em turma_participantes: setar data_saida na turma antiga
    3. Encontrar turma destino (mesmo bairro + faixa_etária + novo período)
    4. Criar link em turma_participantes para turma destino
    5. Registrar em participante_transferencias
    6. Registrar em audit_log
```

**Segurança e integridade**:
- Só transfere participantes que estavam **presentes** — ausentes mantêm o período atual
- Só transfere se existir turma destino compatível (mesmo bairro + faixa etária)
- Se não encontrar turma destino, pula o participante e exibe aviso
- Registra tudo no `audit_log` e `participante_transferencias`
- Não afeta dados históricos de presença (registros antigos permanecem com a turma original)

**Impacto downstream** (sem alterações necessárias):
- Listas de presença física (XLSX): já consultam `turma_participantes` com `data_saida IS NULL` — transferidos automaticamente saem da lista antiga e entram na nova
- REO e Relatório Mensal: mesma lógica, sem alteração
- Dashboard e KPIs: sem impacto, pois usam dados agregados

---

### Arquivos a editar

| Arquivo | Mudança |
|---|---|
| **Migração SQL** | Adicionar coluna `periodo_atividade` em `relatorios_atividade` |
| `src/pages/relatorios/RelatorioNovoPage.tsx` | Filtrar status na query; agrupar turmas por período; campo `periodo_atividade`; lógica de auto-transferência ao salvar |
| `src/pages/relatorios/RelatorioDetalhePage.tsx` | Exibir `periodo_atividade`; filtrar status no modo edição |

### Não precisa alterar
- Exportações (REO, Relatório Mensal, Listas de Presença) — já usam `turma_participantes.data_saida IS NULL`, então participantes transferidos refletem automaticamente
- Dashboard — já usa dados agregados
- Perfil do participante — já mostra período atualizado

