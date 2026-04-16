
## Plano de Correções — 7 problemas

### 1. Participantes em `busca_ativa` sumindo das listas

**Causa**: Várias telas filtram com `.eq("status", "ativo")`, excluindo os 107 participantes em busca ativa. Eles devem aparecer normalmente para presença/seleção/listas — apenas marcados visualmente.

**Arquivos a corrigir** (substituir filtro `status = "ativo"` por `status IN ("ativo", "busca_ativa")`):
- `src/pages/turmas/TurmaDetalhePage.tsx` (linha 73 — adicionar participantes na turma)
- `src/pages/turmas/TurmaNovaPage.tsx` (linhas 112, 190 — auto-vinculação)
- `src/pages/dashboard/DashboardTransporteTab.tsx` (linha 51)
- `src/components/SendRecadoDialog.tsx` (linha 38)
- `src/pages/Index.tsx` e demais que listam para seleção

Na lista de chamada exportada e nas telas, manter um badge "(BA)" ao lado do nome para identificá-los visualmente.

### 2. Marcar presença → tirar de busca ativa automaticamente

Em `RelatorioNovoPage.tsx` (`handleSave`) e `PresencaPage.tsx` (`handleSave`):
- Após salvar a presença, identificar IDs marcados como `presente=true` que estavam com `status='busca_ativa'`.
- Atualizar `participantes.status = 'ativo'` em lote para esses IDs.
- Registrar em `audit_log`: "Retorno automático de busca ativa via presença em [data]".
- Inserir um `atendimento` tipo `busca_ativa` com encaminhamento "Vai Retornar / Já Retornou" para deixar registro técnico.

### 3. Bagunça nas turmas após mudança de período

**Causa identificada**: `handlePeriodoChange` em `ParticipantesPage.tsx` desvincula de TODAS as turmas atuais e só revincula se encontrar turma EXATA com mesmo `bairro_id + faixa_etaria + periodo`. Como turmas Karate e algumas SCFV não batem nesse critério, o participante fica órfão ou só em uma das turmas.

**Correção**: 
- Antes de aplicar `data_saida`, validar que existe pelo menos uma turma destino compatível. Se não houver, abortar com toast de erro e NÃO desvincular nada.
- Não desvincular de turmas de outras categorias (Karate etc.) — só desvincular das turmas SCFV cujo período mudou.
- Adicionar diálogo de confirmação mostrando: "Será removido de X turmas e adicionado a Y turmas. Confirma?"

Mesma lógica para a auto-transferência em `RelatorioNovoPage.tsx`.

### 4. Relatório de Busca Ativa não mostra última busca/retorno

**Causa**: O componente já lê `getBARegistros` corretamente, mas só busca a tabela `busca_ativa_registros`. Quando o técnico registra busca via "Novo Atendimento" (tipo=busca_ativa), só vai para `atendimentos`, não para `busca_ativa_registros`.

**Correção**:
- Ao criar atendimento de tipo `busca_ativa` ou `visita_domiciliar`, inserir também em `busca_ativa_registros` (espelhar).
- Em `getBARegistros`, mesclar registros das duas fontes ordenados por data.
- Quando `resultado='vai_retornar'`, atualizar `participantes.status='ativo'` automaticamente (já existe a opção no formulário, falta a ação).

### 5. Recados/Chamados para equipe técnica devem virar relatório

Em `EquipeTecnicaPage.tsx` aba "Relatórios", adicionar nova seção "Relatório de Recados Técnicos":
- Listar todos os `recados` com `tipo_recado='tecnico'` no período selecionado.
- Incluir: data, remetente, participante, conteúdo, status (pendente/em_andamento/resolvido), última atualização.
- Exportar em PDF e XLSX no mesmo padrão dos outros relatórios.

### 6. Histórico de presença nas páginas de Participante e Turma

**ParticipantePerfilPage.tsx** — nova aba/card "Frequência (últimos 30 dias)":
- Buscar `presenca` do participante onde `data >= today-30`.
- Mostrar tabela: data, turma, presente/ausente, justificativa.
- KPI no topo: X presenças / Y registros (Z% adesão).

**TurmaDetalhePage.tsx** — nova aba "Frequência 60 dias":
- Para cada membro ativo, listar últimas 60 dias: total presenças, total ausências, % adesão.
- Tabela ordenada por menor adesão (alertas no topo).

### 7. Padrão XLSX — texto não cortar nas células

**Causa**: `autoFitColumns` em `src/lib/xlsxAutoFit.ts` tem `max=60` (cap). Textos longos são truncados visualmente. Além disso, células não têm `wrapText` habilitado.

**Correção em `src/lib/xlsxAutoFit.ts`**:
- Aumentar `max` padrão para 120.
- Habilitar `wrapText: true` em todas as células de dados.
- Ajustar `!rows` (altura da linha) automaticamente proporcional ao maior conteúdo da linha.
- Garantir que TODOS os exports XLSX do sistema chamem `autoFitColumns(ws)` no final (auditar e adicionar onde faltar).

Arquivos que geram XLSX a auditar: `useBulkRelatorioExport.ts`, `useRelatorioGestao.ts`, `useDataExport.ts`, `EquipeTecnicaPage.tsx`, `ExportarRelatoriosPage.tsx`, `DashboardRelatorioMensalTab.tsx`, `exportListaPresenca.ts`.

---

### Detalhes técnicos

- **Migrations**: nenhuma. Apenas mudanças de código + writes de dados pontuais.
- **Operações de dados (sem migration)**:
  - Não vou alterar dados em massa neste plano. Apenas ajustes de código fazem o sistema voltar a funcionar corretamente daqui para frente.
- **Edge functions**: nenhuma alteração.
- **Sem mudança de schema**.

### Ordem de execução

1. Filtros de status (item 1) — desbloqueio imediato dos 107 participantes
2. Auto-volta-de-busca-ativa (item 2)
3. Proteção contra bagunça em transferência de período (item 3)
4. Espelhamento atendimento↔busca_ativa_registros + auto-status (item 4)
5. Relatório de recados técnicos (item 5)
6. Histórico de presença nas páginas de detalhe (item 6)
7. Padrão XLSX wrapText/largura (item 7)

Memórias a atualizar: `mem://funcionalidades/busca-ativa`, `mem://funcionalidades/transferencia-participantes`, `mem://tecnico/utilitario-xlsx-autofit`.
