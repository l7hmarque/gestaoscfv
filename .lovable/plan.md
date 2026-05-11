## Objetivo

Tornar a classificação de **Busca Ativa (BA)** exclusivamente **manual**, removendo toda lógica automática que hoje promove ou rebaixa participantes para esse status.

## O que muda

Hoje, a função `recalcular_busca_ativa()` (criada na migration `20260430183028`) roda automaticamente e:

- Marca como `busca_ativa` quem tem 3 faltas consecutivas OU mais de 14 dias sem presença.
- Reverte para `ativo` quem volta a ter presença recente.

Além disso, o `PresencaPage.tsx` também faz auto-reversão de `busca_ativa → ativo` ao salvar presença, e cria registros automáticos em `busca_ativa_registros`.

Tudo isso será desativado. A classificação BA passará a depender 100% de ação manual da equipe técnica/coordenação (via tela do participante, painel de busca ativa, etc.).

## Implementação

### 1. Migration (banco)

- Remover/desabilitar qualquer **trigger** ou **cron job** (`pg_cron`) que chame `recalcular_busca_ativa()`.
- Substituir o corpo da função `recalcular_busca_ativa()` por um `no-op` (retorna 0) — mantém compatibilidade caso algum código ainda invoque, mas não altera mais status.
- Manter as tabelas `busca_ativa_registros` e os campos `status` em `participantes` intactos (sem perda de dados).

### 2. Frontend — `src/pages/presenca/PresencaPage.tsx`

- Remover o bloco "Auto-revert busca_ativa → ativo" (linhas ~115-130) que altera status e insere registros automáticos ao salvar presença.

### 3. Verificação

- Buscar no código outras chamadas a `recalcular_busca_ativa` ou auto-mudanças de `status = 'busca_ativa'` (edge functions, hooks) e remover/neutralizar.

## Não muda

- Botões manuais para marcar/desmarcar BA na ficha do participante e no painel de Busca Ativa continuam funcionando normalmente.
- Histórico já existente em `busca_ativa_registros` é preservado.
- Marcador `(BA)` em listagens e relatórios continua refletindo o status atual (apenas a fonte do status muda para 100% manual).

## Confirmação necessária

Posso prosseguir com:

1. Desligar cron/trigger automáticos
2. Neutralizar a função `recalcular_busca_ativa()`
3. Remover auto-reversão no `PresencaPage`

`Remover (BA) atuais das listas de chamada e listas de presenca.`

Quer manter algum dos dois critérios automáticos ativos como sugestão (sem alterar status, só sinalizando na UI)? Ou remoção total?