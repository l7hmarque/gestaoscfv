## Higienização das funções de frequência — plano de ação

### O que entendi das suas alterações

1. **Inclusão de participantes** em tudo que envolve frequência (digital, listas, indicadores): **só pelo `status**` — nunca mais por `data_saida`/`data_entrada`/janela de vínculo. Quem aparece:
  - Chamada digital e listas de **chamada em branco**: status `ativo` + `cadastro_incompleto` + `busca_ativa`.
  - Desligados aparecem apenas se o **desligamento foi informado no sistema há ≤ 30 dias** (campo novo `desligado_registrado_em`).
  - Transferidos aparecem com o marcador completo `(Transferido DD/MM para "NOME DA TURMA DESTINO")` 
2. **NÃO** integrar `participante_checkins` à PresencaPage (C2 fica fora).
3. **Marcadores padronizados** em DOCX, PDF e XLSX  e Google Sheets (Google Drive)(preenchida e em branco):
  - `P` presente · `A` ausente · `J` ausência justificada · `—` sem aula/desligado · `(Desligado)` desligado · `(Transferido DD/MM para "Turma X")` transferido · `(BA)` busca ativa.
4. **Listas mensais só via Google Sheets.** Remover da página `/relatorios/exportar` (e equivalentes) toda geração local DOCX/PDF/XLSX e a geração por turma individual dessas duas listas.
5. **Indicadores em todos os relatórios:**
  - **Atendidos** = participantes únicos com **≥ 1 presença** no mês/período.
  - **Ativos** = `status IN ('ativo','cadastro_incompleto')`.
  - **Em Busca Ativa** = participantes com `status='busca_ativa'` cuja entrada nesse status (data registrada como BA) é `≤ fim do mês`. Aparece como **indicador** + **aba/seção dedicada** com nome e dados de cada um — em Relatório Mensal Consolidado, Relatório Mensal Completo e Relatório de Gestão (não em relatórios de atividade).

Se algo divergir do que você quis, me corrija antes de eu codar.

---

### Plano de execução (4 fases)

#### Fase 1 — Migração de banco

```sql
ALTER TABLE participantes ADD COLUMN desligado_registrado_em timestamptz;

-- Trigger: preencher quando status muda para 'desligado'
CREATE FUNCTION marcar_desligado_registrado() ...
  IF NEW.status = 'desligado' AND OLD.status IS DISTINCT FROM 'desligado'
  THEN NEW.desligado_registrado_em := now();

-- Backfill conservador: usa updated_at atual para desligados existentes
UPDATE participantes SET desligado_registrado_em = updated_at
WHERE status='desligado' AND desligado_registrado_em IS NULL;

-- Capturar entrada em busca_ativa (para corte por fim de mês)
ALTER TABLE participantes ADD COLUMN busca_ativa_desde timestamptz;
-- Trigger análogo + backfill via audit_log/updated_at.
```

#### Fase 2 — Função única `getParticipantesDaTurma`

- Criar `src/lib/participantesTurma.ts` (+ RPC `get_participantes_turma(turma_id, ref_date)`).
- Regra única:
  - Vínculo: `turma_participantes.turma_id = X` (sem filtrar por `data_saida` ou `data_entrada`).
  - Status visível: `ativo`, `cadastro_incompleto`, `busca_ativa`. Inclui `desligado` se `desligado_registrado_em >= ref_date - 30 dias`. Transferido entra com marcador se a transferência ocorreu nos últimos 30d.
  - Para cada participante, devolver: `nome`, `status`, `marcador` (`""`, `(BA)`, `(Desligado)`, `(Transferido DD/MM para "TURMA Y")`), `bloqueado_chamada` (true para desligado/transferido — mostra `—` em todas as datas).
- Substituir os filtros atuais em:
  - `src/pages/presenca/PresencaPage.tsx`
  - `src/pages/relatorios/RelatorioNovoPage.tsx`
  - `src/lib/listaFrequencia.ts` (`carregarDadosTurma`)
  - Edges `generate-listas-frequencia-mes-gsheet`, `generate-listas-chamada-mes-gsheet`, `generate-lista-frequencia-gsheet`, `generate-lista-chamada-gsheet`, `generate-relatorio-mensal`, `useRelatorioGestao`.

#### Fase 3 — Marcadores unificados e remoção das listas locais

**3.1 Padronizar marcadores** em um único helper `src/lib/marcadoresFrequencia.ts` consumido por:

- `useDocumentExport.ts` (DOCX/PDF preenchida)
- `exportListaPresenca.ts` (XLSX preenchida e em branco)
- Edges Sheets equivalentes

Tabela de células: `P` / `A` / `J` / `—` (vazio = não lançado). Linha de desligado/transferido respeita a data efetiva: células **anteriores** mantêm `P/A/J` do histórico; **posteriores** ficam `—`. Acaba o "tudo `—`" do XLSX em branco atual.

**3.2 Remover gerações antigas:**

- Em `/relatorios/exportar`: remover os cards "Lista de Frequência (preenchida)" e "Lista de Chamada (em branco)" e a `PresencaExportarPage`.
- Em `src/lib/listaFrequencia.ts`: remover suporte a formatos locais (DOCX/PDF/XLSX) e ao modo "lote" local. Manter só interface para o Sheets se reaproveitável; senão, apagar o arquivo.
- Remover `exportSingleListaPresenca`, `exportAllListasPresenca` e variantes em `useDocumentExport` que servem apenas listas.
- Auditar usos para não quebrar relatórios de atividade.

**3.3 Novo módulo `/listas-frequencia**` (rota nova, sidebar):

- Card 1: **Lista de Frequência Mensal (preenchida) — Google Sheets** → invoca `generate-listas-frequencia-mes-gsheet` para mês/ano/filtros de turmas.
- Card 2: **Lista de Chamada Mensal (em branco) — Google Sheets** → invoca `generate-listas-chamada-mes-gsheet`.
- Ambas as edges atualizadas para usar marcadores novos, `getParticipantesDaTurma`, e janela 30d de desligados.

#### Fase 4 — Indicadores dos relatórios

Tocar `supabase/functions/generate-relatorio-mensal/index.ts`, `src/hooks/useRelatorioGestao.ts`, `useBulkRelatorioExport.ts` e a edge `generate-relatorio-gdoc`:


| Métrica            | Fórmula nova                                                                                        |
| ------------------ | --------------------------------------------------------------------------------------------------- |
| **Atendidos**      | `COUNT(DISTINCT participante_id)` em `presenca ∪ relatorio_presenca` com `presente=true` no período |
| **Ativos**         | `COUNT participantes WHERE status IN ('ativo','cadastro_incompleto')` no fim do período             |
| **Em Busca Ativa** | `COUNT participantes WHERE status='busca_ativa' AND busca_ativa_desde <= fim_periodo`               |


**Nova aba/seção "Em Busca Ativa"** (Mensal Consolidado XLSX, Mensal Completo XLSX, Gestão XLSX+PDF):

- Colunas: Nome · CPF · Idade · Bairro · Turma atual · Em BA desde · Último registro de contato (de `busca_ativa_registros`) · Resultado · Responsável pelo contato.
- Linha de resumo no topo: total acumulados, total que entraram em BA no mês.

**Relatórios de atividade** ficam de fora (KPI e aba BA não são incluídos lá), conforme você pediu.

---

### Detalhes técnicos para a equipe

- **Marcadores em rótulo de linha** (não em célula de data): nome do participante recebe `(BA)`, `(Desligado)` ou `(Transferido DD/MM para "TURMA DESTINO")`. Células de data mantêm `P/A/J/—`.
- **"Transferido para"**: resolver via `participante_transferencias` mais recente do participante naquela turma, juntando `turmas(nome)` do destino.
- **Janela 30d de desligados**: avaliada por `desligado_registrado_em >= (ref_date - interval '30 days')`. `ref_date` = primeiro dia do mês para listas mensais; `now()` para chamada digital.
- **Memórias a atualizar:** `presenca-logica`, `desligamento-participantes`, `transferencia-participantes`, `busca-ativa` (re-incluir `(BA)`), `gestao-participantes-status-unificada`, `documentos-institucionais-padrao` (mudar `■` → `P`).
- **Compatibilidade:** edges Sheets já existem (`generate-listas-frequencia-mes-gsheet`, `generate-listas-chamada-mes-gsheet`); só vão receber `getParticipantesDaTurma` + marcadores novos + indicador BA quando aplicável.

---

### O que **não** muda

- `presenca` e `relatorio_presenca` continuam como estão (sem unificar agora — fora do seu pedido).
- Filtro retroativo `01/04/2026` continua valendo.
- `PresencaPage` mantém pré-marcação atual (sem mexer em UX além da regra de inclusão).
- Relatórios de atividade individuais não recebem indicador/aba de BA.

---

### Riscos / pontos de atenção

1. **Backfill de `desligado_registrado_em**` usa `updated_at` — pode ficar impreciso para desligamentos antigos editados depois. Aceitável? Posso usar `audit_log` como fallback se preferir. -> Use algo que deixe preciso.
2. Remover a `PresencaExportarPage` quebra links salvos por usuários — colocarei redirect 301 para `/listas-frequencia`. -> NAO ENTENDI O QUE ISSO AQUI SIGNIFICA, ME EXPLIQUE ATRAVES DE UMA QUESTION BOX PERGUNTANDO SE EU APROVO.
3. Marcadores mudam de `■` para `P` em **todos** os exports históricos novos — listas antigas já geradas dever ser geradas novamente de forma identica apenas trocando o marcador.

Confirma para eu seguir, ou ajusta algum item?  
Fazer analise e avaliacao do codigo apos execucao, visando higienizar e garantir boa performance geral.