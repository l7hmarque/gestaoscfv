## Objetivo

1. Em **/presenca** e **/relatorios/novo**, exibir apenas participantes cujo `periodo` coincide com o `periodo` da turma selecionada.
2. Melhorar a apresentação da lista de turmas, categorizando por período (Manhã / Tarde) com cabeçalhos visuais claros.

## Alterações

### 1. Filtro por período da turma

`**src/pages/presenca/PresencaPage.tsx**`

- Ao carregar participantes em `fetchParts`, depois de hidratar `periodo` de cada participante, filtrar a lista mantendo apenas quem tem `p.periodo === turma.periodo` (turma já está em `turmas`, basta achar por `selectedTurma`).
- Participantes "integral" entram em qualquer turma. ->NAO EXISTE PARTICIPANTE INTEGRAL, NAO EXISTE PERIODO INTEGRAL NO NOSSO SERVICO
- Remover o filtro manual "Período" do card de filtros (vira redundante), mantendo só Bairro, Faixa Etária.

`**src/pages/relatorios/RelatorioNovoPage.tsx**`

- No `useEffect` que carrega participantes via `getParticipantesDaTurma` (linha ~169-240): após buscar, cruzar com `participantes.periodo` e manter apenas os que batem com o período de cada turma selecionada (participante "integral" entra em qualquer turma; senão `participante.periodo === turma.periodo`).
- Mantém a lógica atual de auto-transferência ao salvar (já existe aviso na UI).

### 2. UI/UX do seletor de turmas

`**/presenca` — `PresencaPage.tsx**`

Hoje é um `<Select>` plano com todos os nomes. Trocar por `<Select>` com `SelectGroup` + `SelectLabel` por período:

```text
Manhã
  ├─ Karatê — 6-8 — Jardim Irene
  └─ Arte — 9-11 — Alvorada
Tarde
  ├─ Futebol — 12-17 — Parque Independência
  └─ ...
Integral
  └─ ...
```

Cada item mostra também um badge sutil com o bairro (já está no nome canônico, então fica só o agrupamento por período como melhoria principal).

`**/relatorios/novo` — `RelatorioNovoPage.tsx**`

Já agrupa por período em cards. Refinar:

- Cabeçalho de cada coluna ganha cor/ícone (Sol = Manhã, Pôr-do-sol = Tarde) usando tokens semânticos.
- Contador `(n turmas)` no header de cada período.
- Card da turma com hover state e destaque mais forte para turmas do educador selecionado (★ já existe — adicionar `ring-1 ring-primary/40`).
- Quando uma turma é selecionada e a contagem de participantes é zero por incompatibilidade de período, mostrar dica: "Nenhum participante deste período vinculado a esta turma".

## Detalhes técnicos

- `getParticipantesDaTurma` continua sendo a fonte de verdade dos vínculos; o filtro por período acontece no cliente após hidratar `periodo` do participante (já buscamos em `PresencaPage`; em `RelatorioNovoPage` precisaremos buscar `periodo` junto na query `participantes.select(...)` se ainda não estiver — verificar e adicionar).
- Sem mudanças de schema, RLS ou edge functions.
- Tokens: usar `text-amber-600` → semântico via classes existentes; cabeçalhos com `bg-muted/40` + ícone Lucide.