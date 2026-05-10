## Plano — 4 frentes coordenadas

### Frente A · Aplicar ações do Relatório de Divergências (Larissa · Abril/2026)

Execução via migration/insert (com auditoria) sobre `turma_participantes`, `relatorio_presenca`, `participantes`.

**A1. Correção de `data_saida` inconsistente (anterior à `data_entrada`)**

- 6-8 Tarde: Kayo Gabriell Mendez, Millena Sophia Eckardt, Natanael Alcides Taborda Flores → `data_saida = NULL`.
- 6-8 Manhã: Ana Heloisa Pistilhi (saída 16/04 — confirmar se desligamento real ou erro; manter por ora e só registrar nota de auditoria).
- Filtro de query do `generate-relatorio-mensal` já protege esses casos; aqui corrigimos a origem.

**A2. Faltas Justificadas — Gabrielli (atestado a partir de 16/04)**

- Inserir registros `relatorio_presenca` (ou criar relatórios "FJ" mínimos) para 16/04, 23/04, 28/04, 30/04 com `presente=false`, `justificativa='Atestado médico'`.

**A3. Lançamento de presenças faltantes (subnotificação ~83%)**

- Relatórios físicos das três turmas para datas: 02, 07, 09, 23, 28, 30/04 (e 16/04 para Joaquim/Kayo da Tarde quando ausente).
- Estratégia: para cada (turma × data) sem relatório, criar um `relatorios_atividade` simples com título "Chamada física — abril (digitação retroativa)", `educador_id` = Larissa, e popular `relatorio_presenca` conforme o PDF. Marcar no campo `descricao` a origem ("Digitação retroativa a partir da lista física auditada em 10/05/2026").
- Entregar relatorio de digitacoes reroativas em pdf.

**A4. Migrações de turma**

- Yasmin Vitoria Taborda Flores: 9-11 Manhã → 12-17 (encerrar vínculo atual com `data_saida=02/04/2026` e abrir novo na 12-17 com `data_entrada=02/04/2026`).

**A5. Confirmação de desligamentos pendentes (9-11 Manhã)**

- Ana Julia Rodrigues Mackievicz, Arthur Aloisio Wolf, Gustavo Henrique Wolf: têm `data_saida=31/03` mas seguem na lista física como faltosos.
- Ação automática: marcar `status='desligado'` em `participantes` se ainda ativo e registrar nota em `audit_log` ("Desligamento confirmado por divergência de chamada física").

**A6. Busca ativa**

- Marcar Ygor Miguel Valansuelo Da Silva como `status='busca_ativa'`.

**A7. Cadastros pendentes (manuscritos no PDF)**

- Criar registros mínimos `participantes` (status `incompleto`) para: Joao Cardoso, Maria B. Cardozo, Lara Gabriely Flores, Nayeli Silguero Barua, Paloma Amaro Do Nascimento — só se ainda não houver match por nome (busca fuzzy via `pg_trgm > 0.5`). Deixar nomes na pagina de integridade para verificacao e criar recado sobre eles para Equipe Tecnica.

**A8. Revisar lançamento divergente**

- Antonio Marcos De Oliveira (9-11 Manhã, 22/04): apenas registrar alerta na `audit_log` para revisão humana — não excluir.

Resultado: PDF "Relatorio_Aplicacao_Divergencias_Abril_Larissa.pdf" salvo em `/mnt/documents/` listando o que foi alterado, antes/depois, e pendências humanas (A8 e A7 quando o match for ambíguo).

---

### Frente B · Adicionar /presenca e /presenca/exportar ao menu lateral

Em `src/components/AppSidebar.tsx`, grupo **Atividades**, inserir:

- `Presença` → `/presenca` (ícone `ClipboardCheck`, antes de "Planejamento").
- `Exportar Chamada` → `/presenca/exportar` (ícone `FileDown`, depois de "Exportar Relatórios").

Em `src/pages/Index.tsx` o atalho "Presença" já existe; adicionar também "Exportar Chamada" no grupo Atividades para paridade.

---

### Frente C · Auditoria de botões (sidebar + dashboard) — remover desatualizados/redundantes

Diagnóstico:


| Item                                            | Local                        | Recomendação                                                             | Motivo                                                       |
| ----------------------------------------------- | ---------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------ |
| `Biblioteca .docx`                              | sidebar (Atividades) e Index | **Remover**                                                              | Substituída pelo Drive (Frente D)                            |
| `Exportar Relatórios` (`/relatorios/exportar`)  | sidebar e Index              | **Manter** mas renomear para `Exportar Relatorios em Lote`               | Convive com novo "Exportar Chamada"                          |
| `Arquivos Financeiros` (`/financeiro/arquivos`) | sidebar e Index              | **Mover para sub-rota interna do Financeiro** (remover do sidebar)       | Já acessível dentro de `/financeiro`; ocupa espaço duplicado |
| `Desligamento` (`/desligamento-admin`)          | sidebar (Gestão)             | **Mover para Coordenação**                                               | Painel administrativo restrito                               |
| `Banco de Dados` (`/banco-de-dados`)            | sidebar (Gestão)             | **Manter**                                                               | Backup/exportação em massa, único acesso                     |
| `Site Público` (`/site-admin`)                  | sidebar (Gestão)             | **Manter**                                                               | Único acesso                                                 |
| `Mural` (`/mural`)                              | só rota, não no sidebar      | **Manter rota; já acessível pelo Feed**                                  | OK                                                           |
| `Cronograma`, `Transporte`, `Cozinha`           | sidebar (Gestão)             | **Manter**                                                               | Painéis operacionais distintos                               |
| Atalho `Feed/Mural` no Index                    | Index                        | **Manter** mas separar em "Feed" e "Mural" — hoje aponta só para `/feed` | Confunde usuários                                            |


Resultado: sidebar enxuto, sem itens redundantes. Adicionar `Presença` e `Exportar Chamada` (Frente B) e remover `Biblioteca .docx` e `Arquivos Financeiros` (este último vira aba interna).

---

### Frente D · Desativar a página/funcionalidade Biblioteca .docx

Justificativa: o fluxo institucional migrou para Google Drive (`generate-relatorio-gdoc`, `generate-lista-chamada-gsheet`), tornando a Biblioteca local obsoleta. Hoje ela mantém 212 documentos no bucket `biblioteca-docx` e cria fila a cada salvamento de relatório/planejamento (custo de Storage + chamadas de Edge).

Etapas:

1. **Remover UI**:
  - Apagar `src/pages/biblioteca/BibliotecaPage.tsx` e `BibliotecaAccordion.tsx`.
  - Mover `Accordion`/`AcordeonItem` (usados em `ArquivosFinanceirosPage.tsx`) para `src/components/ui/biblioteca-accordion.tsx` (ou inline) antes da exclusão para não quebrar.
  - Remover rota `/biblioteca` em `App.tsx`, item do `AppSidebar` e atalho do `Index.tsx`.
2. **Remover ganchos de enfileiramento**:
  - Em `RelatorioNovoPage.tsx` e `PlanejamentoNovoPage.tsx` apagar a chamada `enfileirarDocBiblioteca(...)`.
  - Apagar `src/lib/bibliotecaDocx.ts` (mantendo apenas `buildRelatorioDocxBlob`/`buildPlanejamentoDocxBlob` em `useDocumentExport.ts`, que continuam sendo usados pela exportação direta).
3. **Limpeza de backend** (migration):
  - Esvaziar bucket `biblioteca-docx` (loop em script via Edge ou comando), depois `DROP` do bucket.
  - `DROP TABLE biblioteca_documentos CASCADE` e `DROP FUNCTION enqueue_biblioteca_doc`.
4. **Confirmação**: como envolve perda de 212 arquivos, executo o backup ZIP do bucket antes de excluir e disponibilizo em `/mnt/documents/biblioteca_backup_2026-05-10.zip`.

---

### Ordem de execução

1. Frente D etapa 1+2 (remover UI/ganchos) — sem perda de dados.
2. Frente B + Frente C (sidebar/dashboard) — mesmo PR de UI.
3. Frente A (correções de dados via migrations + inserts auditados) com PDF de evidência.
4. Frente D etapas 3+4 (backup + drop bucket/tabela) — última para permitir rollback.

Ao final: relatório consolidado das alterações + `audit_log` populado.

### Confirmações necessárias antes de implementar

- **A7**: criar cadastros `incompleto` automaticamente para os 5 manuscritos, ou apenas listar para revisão humana? criar, inserir para revisao de integridade e gerar recado para equipe tecnica.
- **D**: confirma exclusão definitiva da Biblioteca após backup ZIP? sim.
- **C**: tudo bem mover "Arquivos Financeiros" para dentro de `/financeiro` como aba? sim.