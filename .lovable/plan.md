## Plano de ajustes

### 1. Filtro de intervalo de datas no Dashboard (corrigir)
**Problema:** o filtro só atua em séries mensais e atividades recentes, e não recarrega os KPIs nem desabilita o filtro de mês/ano — o usuário sente que "não funciona".

**Correção em `src/pages/dashboard/DashboardPage.tsx`:**
- Quando `range.from` está definido, **desabilitar visualmente** os selects de Mês/Ano e exibir badge "Intervalo ativo".
- Passar o `range` para `useDashboardData` como parâmetros novos `dataInicio` / `dataFim` (ISO `yyyy-mm-dd`), e replicar para a RPC `get_dashboard_stats` via dois novos parâmetros opcionais.
- **Migration**: estender a função `get_dashboard_stats(_mes, _ano, _data_inicio date default null, _data_fim date default null)` para que, quando o intervalo vier preenchido, ele substitua o filtro por mês/ano em todos os blocos (presença, ELO, adesão, atividades recentes, KPIs derivados de relatórios).
- Atualizar `useDashboardData(mes, ano, dataInicio?, dataFim?)` e a chave do React Query.
- Remover a filtragem client-side redundante (já feita no servidor).

### 2. Página dedicada de Transporte com 2 abas + edição rápida de ponto/período
A rota `/transporte` já existe (`src/pages/transporte/TransportePage.tsx`) renderizando o tab antigo do dashboard. Vou:

- Reestruturar `TransportePage.tsx` com `Tabs` controlado:
  - **Aba "Embarques"** — bloco "Embarques de hoje" + seletor de outras datas (date-picker) e período (manhã/tarde) para revisar embarques históricos.
  - **Aba "Pontos & Configurações"** — listagem de pontos por bairro, edição inline, seleção em massa, novo ponto, ordenação (todo o conteúdo administrativo atual).
- Quebrar `DashboardTransporteTab.tsx` em dois componentes: `EmbarquesTab` e `PontosConfigTab`, mantendo um único `useTransporteOffline`.
- **Edição rápida participante → ponto/período:** em cada participante listado nos embarques, adicionar dois pequenos selects inline (Ponto e Período) com `supabase.from("participantes").update({ ponto_transporte_id, periodo })` e toast. Disponível para `coordenacao` e `motorista` (mesma checagem já existente).

### 3. Idade em anos, meses e dias no perfil do participante
Em `src/lib/constants.ts`: nova função `displayAgeDetalhada(dob)` que retorna ex.: `"9 anos, 4 meses e 12 dias"` usando `differenceInYears/Months/Days` do `date-fns`.

Em `src/pages/participantes/ParticipantePerfilPage.tsx` — seção de visualização (perto de "Data de Nascimento"): adicionar `<InfoField label="Idade" value={displayAgeDetalhada(participante.data_nascimento)} />`.

### 4. Página da turma: transferir alunos + abrir card no clique do nome
Em `src/pages/turmas/TurmaDetalhePage.tsx`:

- **Botão "Transferir" por linha** da tabela de membros, que abre um Dialog para escolher turma de destino (combobox de turmas ativas com mesmo bairro/faixa OU livre escolha). Ao confirmar:
  - `delete from turma_participantes` da turma origem
  - `insert into turma_participantes` na destino
  - `insert into participante_transferencias (participante_id, turma_origem_id, turma_destino_id, motivo)`
  - Audit log + toast.
- **Botão "Transferir em lote"** no header da tabela, com seleção via checkbox e mesmo Dialog (loop nas seleções).
- **Clique no nome do participante:** trocar o `<Link to="/participantes/:id">` por um trigger de `Sheet` lateral (novo `ParticipanteQuickCard`) com foto, idade detalhada, status, contatos, último relatório e botão "Abrir perfil completo" no rodapé. Reaproveita queries já feitas em `participantesData`.

### 5. Padronizar nomes maiúsculos já existentes no banco
Verifiquei: 264 dos 275 participantes têm `nome_completo` em CAIXA ALTA (legado da migração). O `toTitleCase` só roda ao **editar e salvar**.

**Migration de dados (única vez):** SQL `update participantes set nome_completo = initcap(lower(nome_completo))` aplicando exceções para conectores (de, da, do, etc.) via expressão regex. Vou rodar via tool de insert/SQL com justificativa de auditoria. Também aplico em `responsavel1_nome`, `responsavel2_nome`, `escola`.

Adicionalmente: criar trigger `before insert or update on participantes` que normaliza esses campos no servidor — assim qualquer caminho (matrícula pública, importação) fica consistente sem depender do front.

### 6. Inserir "segunda-feira" (`seg`) nas turmas do Jardim Irene
Confirmei via SQL — 7 turmas no bairro JARDIM IRENE. 4 já têm `seg`, mas as turmas de Karatê e as turmas 9-11 e 6-8 (manhã/tarde) precisam de ajuste:

| Turma | dias_semana atual | ação |
|---|---|---|
| KARATE - TERÇA — 9-11 — JD. IRENE | {ter} | adicionar `seg` |
| JARDIM IRENE — 9-11 — Tarde | {ter,qua,qui} | adicionar `seg` |
| JARDIM IRENE — 9-11 — Manhã | {ter,qua,qui} | adicionar `seg` |
| JARDIM IRENE — 6-8 — Tarde | {ter,qua,qui} | adicionar `seg` |
| (demais já têm `seg`) | — | nenhuma |

`update turmas set dias_semana = array(select distinct unnest(dias_semana || array['seg'])) where bairro_id = (select id from bairros where nome ilike 'JARDIM IRENE')`.

---

### Arquivos afetados
- `src/pages/dashboard/DashboardPage.tsx`
- `src/hooks/useDashboardData.ts`
- migration SQL: `get_dashboard_stats` (novos parâmetros) + trigger nome Title Case + UPDATE retroativo de nomes + UPDATE dias_semana Jardim Irene
- `src/pages/transporte/TransportePage.tsx` (refatorar com 2 abas)
- `src/pages/dashboard/DashboardTransporteTab.tsx` (quebrar em `EmbarquesTab` + `PontosConfigTab`) — manter export para retrocompatibilidade
- `src/lib/constants.ts` (`displayAgeDetalhada`)
- `src/pages/participantes/ParticipantePerfilPage.tsx` (mostrar idade detalhada)
- `src/pages/turmas/TurmaDetalhePage.tsx` (botões Transferir + Sheet de card rápido)
- novo: `src/pages/turmas/components/ParticipanteQuickCard.tsx`
- novo: `src/pages/turmas/components/TransferirAlunoDialog.tsx`
