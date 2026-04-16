## Plano: Integração Recados Técnicos ↔ Atendimentos + Relatório Equipe Técnica

### Contexto

Hoje os recados técnicos (`recados.tipo_recado='tecnico'`) e os atendimentos (`atendimentos`) vivem em silos separados. Quando um educador envia um chamado para a equipe técnica e a psicóloga/AS realiza o atendimento, não há vínculo entre eles. Isso impede rastreabilidade no relatório.

### Parte 1 — Vínculo Recado ↔ Atendimento

**Schema (migration)**: adicionar coluna `recado_origem_id uuid` em `atendimentos` (nullable, sem FK rígida para preservar histórico se o recado for excluído).

**Fluxo na UI**:

- Em `EquipeTecnicaPage`, na aba de Recados, cada recado técnico ganha botão **"Registrar atendimento"** que abre o diálogo de novo atendimento já pré-preenchido com `participante_id` e `recado_origem_id`.
- Ao salvar o atendimento, o recado é atualizado para `status='resolvido'` automaticamente.
- No card do recado, se já houver atendimento vinculado, mostra link "Ver atendimento #X" e data.

### Parte 2 — Relatório de Atividades da Equipe Técnica (P&B)

Atualizar o relatório existente em `EquipeTecnicaPage` (PDF + XLSX) com paleta grayscale (preto/cinza/branco, sem cores), seguindo `mem://estilo/documentos-institucionais-padrao`. Adicionar **nova seção "Chamados Técnicos"** com:

1. **Resumo**: total de recados técnicos no período, % resolvidos, tempo médio até resolução, pendentes.
2. **Detalhamento**: tabela com data envio, remetente (educador), participante, conteúdo do chamado, status, data resolução, atendimento vinculado (se houver), descrição resumida do atendimento.
3. **Indicador de eficácia**: chamados que geraram atendimento formal vs apenas resolução administrativa.

Disponível em PDF e XLSX (com `wrapText` e `autoFitColumns` já corrigidos).

### Parte 3 — Outras vinculações sugeridas (para você escolher)

Listo abaixo as ideias que considero mais úteis para controle/monitoramento/avaliação. Marque quais quer incluir neste mesmo ciclo ou em ciclos seguintes:


| #      | Vinculação                                                                                                                              | Benefício                                                 | Complexidade | &nbsp; |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | ------------ | ------ |
| A      | **Atendimento ↔ Busca Ativa** (`busca_ativa_registros.atendimento_id`)                                                                  | Rastreia se a busca virou atendimento formal e o desfecho | Baixa        | &nbsp; |
| B      | **Atendimento ↔ Relato Equipe Técnica** (relatos pedagógicos que viram atendimento)                                                     | Fecha o ciclo educador → técnica → registro               | Baixa        | &nbsp; |
| C      | **Participante ↔ Linha do tempo unificada** (timeline com presenças, BA, atendimentos, recados, transferências, desligamento) no perfil | Visão 360° por participante para coordenação              | Média        | &nbsp; |
| &nbsp; | &nbsp;                                                                                                                                  | &nbsp;                                                    | &nbsp;       | &nbsp; |
| &nbsp; | &nbsp;                                                                                                                                  | &nbsp;                                                    | &nbsp;       | &nbsp; |
| F      | **Relatório de Atividade ↔ Frequência consolidada por participante** (link direto do relatório para o histórico do participante)        | Auditoria rápida de presença declarada                    | Baixa        | &nbsp; |
| G      | **Conquistas ↔ Métricas reais** (gamificação alimentada por: nº de atendimentos, recados resolvidos, presenças marcadas no prazo)       | Engajamento da equipe                                     | Baixa        | &nbsp; |
| H      | **Encaminhamentos externos** (CRAS, CAPS, UBS) como entidade própria vinculada a atendimento + acompanhamento de retorno                | Controle de rede de proteção                              | Alta         | &nbsp; |
| I      | **Indicadores de risco automáticos** (participante com BA + laudo + faltas + sem atendimento recente = alerta vermelho na lista)        | Priorização da equipe técnica                             | Média        | &nbsp; |
| J      | **Planejamento ↔ Resultado real** (planejamento previsto vs relatório executado, taxa de cumprimento por educador)                      | Avaliação pedagógica                                      | Média        | &nbsp; |


### Detalhes técnicos

- **Migration**: `ALTER TABLE atendimentos ADD COLUMN recado_origem_id uuid`. Sem FK (preserva histórico).
- **Sem mudança de RLS** — políticas atuais cobrem.
- **Edge functions**: nenhuma.
- **Hook novo** em `RecadosEquipeCards` ou diálogo dedicado para criar atendimento a partir de recado.
- Atualização do gerador XLSX/PDF existente em `EquipeTecnicaPage` (paleta grayscale + nova seção).

### Ordem de execução

1. Migration: coluna `recado_origem_id` em `atendimentos`.
2. UI: botão "Registrar atendimento" no card de recado técnico + auto-resolução do recado.
3. Atualizar relatório PDF/XLSX da Equipe Técnica: paleta grayscale + seção Chamados Técnicos.
4. Aguardar sua escolha das vinculações A–J para próximo ciclo.

### Pergunta para você

Quais das vinculações A–J você quer incluir já neste ciclo (junto com a parte 1 e 2)? Recomendo **A, B, C, F** como pacote inicial — todas baixas/médias e de alto impacto para coordenação. RESPOSTA: A, B, C, F, H, I, J.