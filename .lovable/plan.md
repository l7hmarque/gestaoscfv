
## Parte 1 — O que são as "Decisões" hoje

A aba **Decisões** do painel `/coordenacao` **não é um cadastro manual**. Ela é uma leitura automática da tabela de auditoria (`audit_log`), filtrada pelo período selecionado:

| Card | Como é calculado |
|---|---|
| Decisões registradas (você) | Total de ações suas no `audit_log` no período |
| Decisões da equipe | Total de ações de qualquer perfil de Coordenação no período |
| Aprovações concedidas | Ações suas contendo `aprov` ou `transfer` (ex.: aprovar transferência) |
| Exclusões justificadas | Ações suas contendo `delete` ou `exclu` (com justificativa registrada) |
| Desligamentos validados | Ações suas contendo `deslig` |

Resumo: hoje "Decisões" é apenas um **espelho de auditoria**, não um registro próprio. Útil como rastro, mas não substitui um caderno de registros da coordenação — que é justamente o que você quer.

---

## Parte 2 — Funcionalidade pedida: Registros da Coordenação

Já existe uma aba **Atividades** (`coordenacao_atividades`) que é o embrião disso, mas é limitada: poucas categorias, sem status, sem prioridade, sem responsáveis, sem prazo. Em vez de criar uma tabela paralela, vamos **expandir essa aba** para virar o "diário operacional" da coordenação que você descreveu.

### Renomear a aba e ampliar o escopo
- A aba `Atividades` passa a se chamar **Registros**.
- Suporta: comunicados, reuniões, tarefas, ações, articulações, decisões manuais, etc.

### Tipos (categorias estruturadas)
Lista controlada via `src/lib/constants.ts` para ficar consistente em filtros e relatórios:
- Reunião
- Comunicado
- Tarefa
- Ação / Decisão
- Visita técnica
- Articulação de rede
- Formação de equipe
- Documento / Ofício
- Evento
- Outro

### Campos do registro
Obrigatórios: **data**, **tipo**, **título**.
Opcionais: descrição, duração (min), **prioridade** (baixa / média / alta), **status** (aberto / em andamento / concluído / cancelado), **prazo** (data), **responsáveis** (multi-seleção de profissionais), **tags** livres.

### Tela
Card de criação enxuto no topo (título + tipo + data, resto colapsável em "Mais detalhes") + listagem agrupada por mês com:
- Filtros por tipo, status, prioridade e mês.
- Badges coloridos por status e prioridade.
- Edição inline rápida do status (ex.: marcar tarefa como concluída em 1 clique).
- Contadores no topo: total, abertos, concluídos, atrasados (prazo vencido sem conclusão).

### Auditoria
Toda criação, edição de status e exclusão grava em `audit_log` (mantém o ciclo já existente — isso vai naturalmente alimentar os contadores da aba "Decisões").

---

## Detalhes técnicos

**Migração `coordenacao_atividades`** (ALTER TABLE, dados existentes preservados):
- Renomear colunas conceitualmente via novos campos:
  - `status text not null default 'aberto'` (aberto | em_andamento | concluido | cancelado)
  - `prioridade text not null default 'media'` (baixa | media | alta)
  - `prazo date null`
  - `responsaveis uuid[] null` (FK lógica para `profiles.id`)
  - `tags text[] null`
- Ampliar `categoria` aceitando os novos valores via trigger de validação (CHECK não, conforme regra do projeto).
- Índices: `(data desc)`, `(status)`, `(prazo)`.

**RLS** (manter o padrão atual): leitura/escrita restrita a `coordenacao`. `coordenador_id` continua sendo `auth.uid()` via `profiles`.

**Frontend**:
- Renomear `src/pages/coordenacao/AtividadesTab.tsx` → `RegistrosTab.tsx` e atualizar `CoordenacaoPage.tsx` (aba `atividades` → `registros`, label "Registros").
- Adicionar `TIPOS_REGISTRO_COORD`, `STATUS_REGISTRO`, `PRIORIDADE_REGISTRO` em `src/lib/constants.ts` para reuso.
- Componente de filtro reaproveitando `Select` + `Input type="month"` já em uso.
- Toggle rápido de status via `DropdownMenu` no card.
- Métrica "atrasados" calculada client-side (`prazo < hoje && status != 'concluido'`).

**Compatibilidade com o painel**: o card "Atividades registradas (período)" da aba **Qualidade** continua funcionando (mesma tabela). Opcionalmente renomeio o label para "Registros da coordenação".

**Sem mudanças** em: `get_coordenacao_stats`, RPCs, edge functions, ou demais módulos.

---

## Entregáveis
1. Migração SQL adicionando colunas + índices em `coordenacao_atividades`.
2. Constantes centralizadas em `src/lib/constants.ts`.
3. Refatoração da aba `Atividades` → `Registros` com novos campos, filtros e ações rápidas.
4. Atualização do label da aba em `CoordenacaoPage.tsx`.
5. Memória atualizada documentando o módulo e a clarificação sobre "Decisões".
