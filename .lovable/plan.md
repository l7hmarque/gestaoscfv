## Objetivo

Criar um participante "fantasma" **com cadastro completo** (bairro, ponto de transporte, responsáveis, escola, etc.) chamado **LEONARDO**, nascido em **11/02/2020**, para testar o **Painel da Família** sem que ele afete dashboards, KPIs, listas operacionais, exportações, busca ativa, transporte real ou prestação de contas.

## Abordagem (mais segura)

Adicionar uma **flag `is_teste boolean`** na tabela `participantes` e propagar o filtro em todos os pontos de agregação. Mais seguro que criar um novo valor de status (que quebraria triggers e switches espalhados pelo frontend).

### Por que essa é a opção mais segura
- **Não mexe no enum `status_participante`**: o fantasma fica com `status='ativo'` (necessário para o login no `/familia` funcionar) e o filtro `is_teste=false` esconde ele dos demais lugares.
- **Default `false`**: nenhum participante existente é afetado.
- **Reversível**: `DELETE FROM participantes WHERE is_teste=true;` remove tudo.

## Cadastro completo do fantasma

| Campo | Valor |
|---|---|
| `nome_completo` | **LEONARDO** |
| `data_nascimento` | **2020-02-11** (5 anos — válido pela regra de matrícula 5–99) |
| `genero` | masculino |
| `cor_raca` | parda |
| `status` | ativo |
| `is_teste` | **true** |
| `periodo` | tarde |
| `escola` | EMEF TESTE |
| `serie` | Educação Infantil |
| `endereco_rua` | Rua de Teste |
| `endereco_numero` | 123 |
| `endereco_bairro` | (nome do bairro escolhido) |
| `bairro_id` | 1º bairro existente (ex.: JARDIM IRENE) |
| `ponto_transporte_id` | 1º ponto vinculado ao bairro escolhido |
| `responsavel1_nome` | RESPONSÁVEL TESTE |
| `responsavel1_whatsapp` | 11999990000 |
| `vinculo_resp1` | mae |
| `responsavel2_nome` | RESPONSÁVEL TESTE 2 |
| `responsavel2_whatsapp` | 11988880000 |
| `vinculo_resp2` | pai |
| `restricao_alimentar` | Lactose (teste) |
| `outras_condicoes` | Cadastro de teste — ignorar |
| `iniciou_em` | data atual |
| `foto_url` | placeholder padrão |

A migration vai resolver `bairro_id` e `ponto_transporte_id` dinamicamente via subquery (`SELECT id FROM bairros LIMIT 1` etc.) para não quebrar caso configurações mudem.

## Mudanças no banco (1 migration)

1. `ALTER TABLE participantes ADD COLUMN is_teste boolean NOT NULL DEFAULT false;`
2. Índice parcial `WHERE is_teste = true`.
3. Atualizar RPCs para excluir `is_teste=true`:
   - `get_dashboard_stats` (KPIs públicos: ativos, faixa, gênero, bairro, período, alertas, delta).
   - `get_coordenacao_stats` (cobertura territorial).
   - `get_pendencias_integridade` + `get_pendencias_integridade_detalhes`.
   - `recalcular_busca_ativa` (não promove fantasma).
   - `recalcular_vinculos_turmas` (não vincula a turma real).
   - `find_similar_participants` e `find_fuzzy_participant` (não sugere como duplicata na matrícula pública).
   - `get_restricoes_alimentares` (cozinha não vê).
4. INSERT do LEONARDO com cadastro completo.

## Mudanças nas Edge Functions

- `public-indicadores` (contagem do site público) → filtra `is_teste=false`.
- `public-matricula` (deduplicação) → filtra `is_teste=false`.
- `public-pontos` → filtra ao listar participantes por ponto.
- `public-familia-auth` → **mantém aceitando** (é o que permite o login do fantasma).

## Mudanças no Frontend

Helper único `src/lib/participantesFilter.ts` para padronizar o filtro. Aplicar em:

- `ParticipantesPage` — listagem principal
- `PainelDesligamentoPage`
- `DashboardTransporteTab` — embarque
- `PresencaPage` — chamada do dia
- `TurmaDetalhePage` / `TurmaNovaPage` — vínculos de turma
- Hooks: `useBackupExport`, `useBulkRelatorioExport`, `useDashboardData`, `useCozinhaData`, `useCoordenacaoData`, `useRelatorioGestao`

## Acesso ao Portal da Família

Após a migration, acesse `/familia` com:
- **Nome:** `LEONARDO`
- **Data:** `11/02/2020`

Tudo aparecerá preenchido — bairro, ponto de transporte com horários, escola, responsáveis, restrição alimentar, status do ônibus, etc.

## Reversão

```sql
DELETE FROM participantes WHERE is_teste = true;
```

## Resumo

- 1 migration (coluna + índice + 8 funções + INSERT completo do LEONARDO 11/02/2020)
- 3 edge functions atualizadas
- 1 helper novo + ~10 telas com filtro
- 0 quebras esperadas (default `false`, status continua `ativo`)
