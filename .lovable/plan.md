## Diagnóstico

A função que está bagunçando turmas é a **"Automação 3"** em `src/pages/participantes/ParticipantePerfilPage.tsx` (linhas 211–229): ao salvar o perfil com mudança de **bairro**, **período** ou **data de nascimento** (faixa etária), o sistema abre um dialog "Transferência de Turma" que, ao ser aprovado, insere o participante em todas as turmas compatíveis sem remover os vínculos antigos de forma efetiva.

**Bug confirmado:** nas 5 transferências geradas por essa função (motivo `"Alteração de dados cadastrais"`), o participante ficou em **AMBAS** as turmas (origem e destino) — `data_saida` foi preenchida mas a turma origem continua aparecendo nas listas porque queries normais não filtram por `data_saida`.

A automação mais antiga ("período do relatório") já tinha sido removida em 17/04/2026 (memória `auto-transferencia-periodo-relatorio`). As 72 transferências em massa de abril (motivos `importacao frequencia marco/2025` e `lista chamada mar/2026`) vieram de scripts pontuais de importação, não da automação atual — devem ficar.

## Auditoria das 5 transferências por "Alteração de dados cadastrais"

| Data | Participante | Origem → Destino | Avaliação |
|------|--------------|------------------|-----------|
| 29/04 | Angela Noemi Insfran Adorno (7a) | JI 6-8 Manhã → PI 6-8 Tarde | **Legítima** (mudou bairro+período cadastral) — manter destino, remover origem |
| 29/04 | Liz Mariela Insfran Adorno (9a) | JI 9-11 Manhã → PI 9-11 Tarde | **Legítima** (irmã, mesma mudança) — manter destino, remover origem |
| 05/05 | Isabelly Vitoria dos Santos Melo (6a) | JI 9-11 Manhã → JI 6-8 Manhã | **Legítima** (correção de faixa etária) — manter destino, remover origem |
| 13/05 | Josias David Rojas Olmedo (8a) | PI 9-11 Tarde → PI 6-8 Tarde | **Legítima** (correção de faixa etária) — manter destino, remover origem |
| 13/05 | Josias David Rojas Olmedo | PI 9-11 Tarde → **KARATÊ 6-8 Tarde PI** | **Duvidosa** — turma de oficina puxada como "compatível"; provavelmente não deveria ter sido vinculado automaticamente. Recomenda-se remover o vínculo do KARATÊ |

Em todos os 5 casos o participante está hoje vinculado **simultaneamente à turma de origem e à de destino** — é o que está bagunçando as chamadas.

## Plano de execução

### 1. Desativar a automação (frontend)
Arquivo: `src/pages/participantes/ParticipantePerfilPage.tsx`
- Remover o bloco "Automação 3: Realocar turmas se bairro/período/idade mudaram" (linhas 211–229).
- Remover o `Dialog` "Transferência de Turma" (linhas 766–820), o estado `transferInfo`/`setTransferInfo` e `showTransferDialog`/`setShowTransferDialog`.
- Comportamento novo: ao mudar bairro/período/data de nascimento, o sistema apenas atualiza o cadastro. A coordenação fará a transferência manualmente via fluxo explícito de troca de turma (já existente em `participante_transferencias` aprovado pela coordenação).

### 2. Limpeza dos vínculos duplicados (banco)
Para cada uma das 5 linhas em `participante_transferencias` com motivo `"Alteração de dados cadastrais"`:
- **Remover** o vínculo em `turma_participantes` da turma **origem** (`turma_origem_id`) — garante que o aluno saia da chamada antiga.
- **Manter** o vínculo da turma **destino** (já está correto).
- **Exceção (Josias → KARATÊ):** remover também o vínculo do destino KARATÊ, pois foi vinculação indevida (turma de oficina não deveria ter entrado na lista).

Resultado final esperado por participante:
- Angela → somente PI 6-8 Tarde
- Liz → somente PI 9-11 Tarde
- Isabelly → somente JI 6-8 Manhã
- Josias → somente PI 6-8 Tarde

### 3. Auditoria registrada
Inserir uma entrada em `audit_log` (acao `limpeza_transferencias_automaticas`, tabela `turma_participantes`) listando os 5 IDs revertidos com a justificativa.

### 4. Atualizar memória do projeto
Atualizar `mem://funcionalidades/auto-transferencia-periodo-relatorio` (ou criar nova) registrando que **toda transferência automática a partir do perfil também foi removida** — a partir de agora, mudanças de turma exigem ação manual da coordenação.

## Detalhes técnicos
- O dialog atual também envia recados aos educadores e marca `data_saida` na turma antiga, mas como nenhuma query de chamada filtra por `data_saida`, o participante continua aparecendo em duas listas — daí a "bagunça" relatada.
- Não há triggers no banco fazendo essas mudanças (verificado em `information_schema.triggers`).
- As 72 transferências de 14–17/04 vieram de scripts de importação de planilhas Drive (motivo explicita "importacao frequencia marco/2025" e "lista chamada mar/2026") e **não serão tocadas**.

## Arquivos afetados
- `src/pages/participantes/ParticipantePerfilPage.tsx` — remoção da automação 3 e do dialog
- Migração de dados (via insert tool): 5 deletes em `turma_participantes` + 1 insert em `audit_log`
- `mem://funcionalidades/auto-transferencia-periodo-relatorio` — atualização da regra
