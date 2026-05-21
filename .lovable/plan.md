# Plano — Coerência das listas de chamada/presença

## Diagnóstico

A fonte única de verdade hoje é a RPC `get_participantes_turma(_turma_id, _ref_date)`. Ela retorna:

- Todos os ativos / cadastro incompleto / busca ativa **independentemente da data em que entraram na turma**.
- Desligados cujo `desligado_registrado_em` cai nos últimos 30 dias da `_ref_date` (com `bloqueado_chamada = true`, exibidos tachados).
- Transferidos (≤30 dias) também com `bloqueado_chamada = true`.

Isso gera os 3 sintomas que você relatou:

1. **Lista de Maio em branco vem cheia de desligados** — porque a edge function `generate-listas-chamada-mes-gsheet` usa `_ref_date = 1º dia do mês` e mantém todos os bloqueados visíveis (tachados). Para uma lista que vai ser **impressa em branco** isso é só ruído.
2. **Lista de mês passado contém participantes inseridos depois** — a RPC não filtra por `turma_participantes.data_entrada` nem por `participantes.created_at`. Quem entrou em 18/05 aparece na chamada de Abril.
3. **Página de Presença e Novo Relatório também mostram desligados** (tachados, mas ainda visíveis) — atrapalha o educador no momento de marcar.

E a 4ª dor: **/presenca/exportar** existe no roteamento mas não tem entrada na sidebar — só dá pra chegar pelo Hub de Exportações ou pelo card da Home antiga.

---

## Plano de correção

### 1. Reescrever a RPC `get_participantes_turma` com 2 modos

Migration nova adicionando parâmetros:

```
get_participantes_turma(_turma_id uuid, _ref_date date, _modo text DEFAULT 'frequencia')
```

- `_modo = 'frequencia'` (padrão, atual) — comportamento de hoje: inclui desligados ≤30d tachados, para a lista **preenchida** (precisa mostrar quem teve presença lançada).
- `_modo = 'chamada_branco'` — **só ativos para imprimir**:
  - `status IN ('ativo','cadastro_incompleto','busca_ativa')`
  - **sem** desligados / transferidos
  - `bloqueado_chamada` sempre false

Em **ambos** os modos, adicionar filtro temporal pelo mês de referência:

- `tp.data_entrada <= último dia de _ref_date`
- `(tp.data_saida IS NULL OR tp.data_saida >= primeiro dia de _ref_date)`
- `p.created_at::date <= último dia de _ref_date`

Isso resolve “participante novo aparecendo em lista de mês passado”.

### 2. Edge functions de lista em branco passam `_modo='chamada_branco'`

- `supabase/functions/generate-listas-chamada-mes-gsheet/index.ts` — atualizar a chamada da RPC.
- `supabase/functions/generate-lista-chamada-gsheet/index.ts` (chamada por turma) — idem.

A lista de **frequência preenchida** (`generate-listas-frequencia-mes-gsheet`, `generate-lista-frequencia-gsheet`) continua em `'frequencia'` (precisa mostrar quem foi desligado no meio do mês com presenças já lançadas).

`src/lib/exportListaPresenca.ts` (exportação XLSX local da chamada em branco, se ainda em uso) — alinhar com o mesmo modo.

### 3. Página de Presença e Novo Relatório

- `src/pages/presenca/PresencaPage.tsx`: ao carregar participantes, **filtrar fora `bloqueado_chamada**` antes de pintar a lista. Hoje eles entram desmarcados mas continuam visíveis.
- `src/pages/relatorios/RelatorioNovoPage.tsx`: idem na seleção de participantes.
- Manter a edição de relatórios antigos com lista completa (histórico continua íntegro), mas no formulário de **novo** registro só ativos.

### 4. Acesso à `/presenca/exportar` na navegação

A página já existe e funciona; só falta entrada de menu. Duas opções:

- **(A)** Adicionar item “Exportar chamada/frequência” na sidebar dentro do grupo **Operação**, logo abaixo de Presença, com mesmo gating de permissão (`presenca`). - ESSA OPCAO.
- **(B)** Tornar a página um redirect para `/relatorios/hub` (Hub unificado já tem o card “Exportar Chamada”) e parar de manter duas portas de entrada.

Recomendado: **(A)**, porque o fluxo natural do educador é “marcar presença → exportar a lista do mês”, sem precisar passar pelo Hub de Coordenação.

---

## Detalhes técnicos resumidos

```text
migration: alter get_participantes_turma → adiciona _modo + filtro temporal
edge fns chamada-branco: rpc(..., { _modo: 'chamada_branco' })
edge fns frequencia: rpc(..., { _modo: 'frequencia' })   // explícito p/ clareza
PresencaPage / RelatorioNovoPage: filter(p => !p.bloqueado_chamada)
AppSidebar: novo NavLink "Exportar listas" → /presenca/exportar (grupo Operação)
```

Sem impacto em RLS (a RPC continua `SECURITY DEFINER`). Sem impacto em relatórios já salvos (apenas no que é exibido para novos cadastros e nas listas geradas a partir daqui).

## Perguntas antes de implementar

1. Para a **lista de frequência preenchida** (a que já tem as presenças lançadas), você quer manter os desligados ≤30d tachados (situação atual) ou também escondê-los? MANTER SOMENTE ATE A CHAMADA DO PRIMEIRO MES POSTERIOR AO DESLIGAMENTO, GARANTIR QUE SE O PARTICIPANTE FOI DESLIGADO NO MEIO DO MES, AS PRESENCAS ATE DATA DE DESLIGAMENTO FICAM REGISTRADAS.
2. Você prefere a opção **(A)** sidebar ou **(B)** redirect para o Hub na questão do `/presenca/exportar`? A