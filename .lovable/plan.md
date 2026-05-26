## Objetivo

Nas listas de chamada/presença geradas no Google Sheets, agrupar os nomes em três blocos visuais — **Ativos**, **Busca Ativa**, **Inativos (transferidos/desligados)** — mantendo intacto o design atual (cabeçalho institucional preto, bordas, merges, larguras, legenda, congelamento de linhas).

Hoje, "busca ativa" é misturado junto com "ativos". O usuário quer separá-los visualmente, sem mexer no resto do layout.

## Escopo (4 edge functions)

1. `supabase/functions/generate-lista-chamada-gsheet/index.ts` — lista de chamada em branco (turma única).
2. `supabase/functions/generate-lista-frequencia-gsheet/index.ts` — lista de presença preenchida (turma única).
3. `supabase/functions/generate-listas-chamada-mes-gsheet/index.ts` — lote mensal em branco (todas as turmas).
4. `supabase/functions/generate-listas-frequencia-mes-gsheet/index.ts` — lote mensal preenchido (todas as turmas).

## Mudanças

### Funções individuais (1 e 2)
- A flag `busca_ativa` já é carregada do banco, mas não é usada hoje. Passo a usar:
  - Ordenação: `ativos` → `buscaAtiva` → `transferidos` → `desligados` (todos alfabéticos dentro do bloco).
  - Marcador no nome para quem está em Busca Ativa: sufixo `(BA)` em negrito (mesmo padrão dos marcadores `(D)`, `(T)`, `(N)`), sem riscado e sem cinza — cor preta normal.
  - Atualizar a legenda existente para incluir `(BA) = Busca Ativa` ao lado dos demais marcadores.
- Nenhuma linha em branco extra entre blocos (evita quebrar merges, congelamento de linhas e cálculos `signRowIdx`/`legendRowIdx`). A separação é puramente pela ordem + o marcador `(BA)`.

### Funções em lote (3 e 4)
- A RPC `get_participantes_turma` já entrega `status` e `marcador` (que inclui `(BA)` quando aplicável). Hoje a ordenação só separa `bloqueado_chamada` (transferidos/desligados ≤30d) dos demais. Vou intercalar o grupo Busca Ativa:
  - Ordenação: `não-bloqueados ativos` → `não-bloqueados busca_ativa` → `bloqueados (transferidos/desligados)`, alfabético dentro de cada bloco.
- A legenda da lote já contém `(BA) = Busca Ativa` — nada a mudar nela.
- Nenhuma alteração em fontes, cores, bordas, merges, largura de colunas ou `headerStartRow`.

## Garantias de não-regressão (design preservado)

- Não adiciono linhas separadoras → `dataRowsCount`, `signRowIdx`, `legendRowIdx`, `frozenRowCount` continuam idênticos.
- Não toco em `baseFmt`, `headerInstFmt`, `titleFmt`, `tableHeaderFmt`, `signFmt`, `legendFmt`, merges, `autoResizeDimensions` nem `updateDimensionProperties`.
- O frontend (`PresencaExportarPage`, `HubExportacoesPage`, `TurmaDetalhePage`) não muda — mesmas URLs, mesmo payload, mesma resposta.
- Nome do arquivo, pasta de destino no Drive e permissões continuam iguais.

## Validação

- Após edição, deploy das 4 funções e teste rápido com `curl_edge_functions` em uma turma que tenha pelo menos um participante em `busca_ativa` para conferir agrupamento + marcador.