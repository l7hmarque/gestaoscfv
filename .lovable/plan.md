

# Módulo Cozinha — Painel do Cozinheiro (com Mapa de Restrições Alimentares)

Hub dedicado em `/cozinha` para o cargo de Cozinheiro, com gestão de insumos, cardápios semanais, relatórios de consumo e **mapa visual de restrições alimentares** dos participantes ativos cruzado com os dias em que frequentam.

## O que será entregue

### 1. Rota `/cozinha` (acesso `cozinheiro` + `coordenacao`)
Item na sidebar, grupo **Gestão**, ícone ChefHat. Bloqueado para outros perfis com redirect.

### 2. Layout em 5 abas

**Aba 1 — Painel (default)**
KPIs operacionais:
- Refeições previstas hoje (participantes ativos por período × cardápio do dia)
- Itens em estoque baixo (qtd ≤ estoque_minimo) com alerta vermelho
- Itens vencendo em 7 dias / vencidos
- **Total de participantes ativos com restrição alimentar** + atalho para a aba Restrições
- Lista rápida das próximas 3 refeições da semana
- Atalho "Compartilhar cardápio no Feed"

**Aba 2 — Estoque (Insumos)**
CRUD completo: nome, categoria (Hortifruti, Carnes, Grãos, Laticínios, Mercearia, Limpeza, Outros), unidade (kg, L, un, pct), qtd atual, estoque mínimo, validade, valor unitário, observação. Filtros por categoria/status, busca, badges coloridas (OK/baixo/vencendo/vencido). Ações **Entrada (+)** e **Saída (−)** com modal de qtd + motivo. Exportação XLSX/PDF `SysCFV_EstoqueCozinha_{data}_{hora}`.

**Aba 3 — Cardápio Semanal**
Grade segunda→sexta × Café da Manhã / Almoço / Lanche da Tarde. Editor inline com seleção de insumos do estoque + qtd prevista. Badge de viabilidade (verde/vermelho). Botões "Replicar semana anterior" e "Compartilhar no Feed/Mural". Visível só a cozinheiro/coord (demais veem só o que for publicado).

**Aba 4 — Restrições Alimentares (NOVO)**
Mapa operacional para o cozinheiro planejar refeições seguras:

- **Visão "Por Dia da Semana" (default)**: 5 colunas (seg–sex), cada uma listando os participantes ativos com `restricao_alimentar` preenchida que frequentam aquele dia, agrupados por período (Manhã/Tarde). Cada card mostra: nome, idade, período, **badge da restrição** (cor por categoria detectada: lactose, glúten, alergia, vegetariano, diabetes, outros) e **texto livre completo** da restrição em tooltip/expandível. Também exibe "remédio contínuo" e "outras condições" quando relevantes.
- **Visão "Por Restrição"**: agrupa por tipo de restrição detectada e mostra todos os participantes afetados + dias que frequentam.
- **Visão "Tabela completa"**: DataTable filtrável (nome, restrição, período, dias, turma, bairro) exportável em XLSX/PDF — `SysCFV_RestricoesAlimentares_{data}_{hora}` — para imprimir e fixar na cozinha.
- Filtros: período, bairro, busca por nome, busca por palavra na restrição.
- Banner de alerta quando houver restrição grave (alergia/anafilaxia detectada por palavras-chave) com destaque vermelho.

**Como os dias são determinados**: cruza `participantes` (status=ativo, com `restricao_alimentar` ou `remedio_continuo` não-nulos) com `turma_participantes` → `turmas.dias_semana` (array). Se o participante não tiver turma vinculada, assume todos os dias úteis do período dele e marca como "sem turma vinculada" (ícone âmbar).

**Aba 5 — Movimentações & Relatórios**
Histórico cronológico de entradas/saídas/ajustes, filtros por período/item/tipo, gráfico recharts de consumo dos 30 dias (top 10 itens), exportação XLSX do consumo do mês.

## Detalhes técnicos

**Backend (1 migration)** — 3 tabelas + RLS + 2 RPCs:

1. `cozinha_insumos` — `id`, `nome`, `categoria`, `unidade`, `quantidade_atual` (numeric default 0), `estoque_minimo` (numeric default 0), `validade` (date null), `valor_unitario` (numeric null), `observacao`, `created_at`, `updated_at`.
2. `cozinha_movimentacoes` — `id`, `insumo_id` (FK), `tipo` ('entrada'|'saida'|'ajuste'), `quantidade`, `motivo`, `responsavel_id` (FK profiles), `created_at`. **Trigger** atualiza `cozinha_insumos.quantidade_atual` automaticamente.
3. `cozinha_cardapio` — `id`, `semana_inicio` (date — segunda), `dia_semana` (1–5), `refeicao` ('cafe'|'almoco'|'lanche'), `prato`, `insumos_previstos` (jsonb `[{insumo_id, quantidade}]`), `criado_por`, timestamps. Unique (semana_inicio, dia_semana, refeicao).

**RLS** (alinhado ao endurecimento recente):
- SELECT/INSERT/UPDATE/DELETE: somente `cozinheiro` OU `coordenacao`.
- `responsavel_id` em movimentações deve casar com profile do `auth.uid()`.

**RPCs `SECURITY DEFINER` + `SET search_path = public` + gate `has_role(auth.uid(),'cozinheiro') OR has_role(auth.uid(),'coordenacao')`**:

- `get_cozinha_stats()` → KPIs do painel (estoque baixo, vencendo, refeições hoje, top consumo 30d, total restrições).
- `get_restricoes_alimentares()` → retorna jsonb com array de participantes ativos que tenham `restricao_alimentar` OU `remedio_continuo` OU `outras_condicoes` preenchidos, incluindo: id, nome, idade, periodo, bairro, foto_url, restricao_alimentar (texto), remedio_continuo, outras_condicoes, turmas (array de `{id, nome, dias_semana[]}`) e `dias_frequenta` (união dos dias_semana das turmas, ou `['seg','ter','qua','qui','sex']` quando sem turma vinculada).

**Frontend (6 arquivos novos + 2 edições)**:
- `src/pages/cozinha/CozinhaPage.tsx` — shell com Tabs controladas (5 abas).
- `src/pages/cozinha/PainelTab.tsx` — KPIs + alertas + atalho para Restrições.
- `src/pages/cozinha/EstoqueTab.tsx` — DataTable + diálogos CRUD/entrada/saída.
- `src/pages/cozinha/CardapioTab.tsx` — grade 5×3 + editor + viabilidade.
- `src/pages/cozinha/RestricoesTab.tsx` — 3 visões (Por Dia / Por Restrição / Tabela), filtros, exportação, detector de palavras-chave para badge de gravidade.
- `src/pages/cozinha/MovimentacoesTab.tsx` — histórico + gráfico + export.
- `src/hooks/useCozinhaData.ts` — TanStack Query para `get_cozinha_stats` e `get_restricoes_alimentares`.
- Edição `src/components/AppSidebar.tsx` — item "Cozinha" visível se role = `cozinheiro` OR `coordenacao`.
- Edição `src/App.tsx` — rota lazy `/cozinha` em `<ProtectedRoute>`.

**Detecção de categoria/gravidade da restrição** (no frontend, sem mudar dados):
- Categoria por palavras-chave em `restricao_alimentar`: lactose/leite → laticínio; glúten/trigo → glúten; alergia/anafilaxia/amendoim/castanha → alergia (vermelho); vegetariano/vegano → vegetariano; diabetes/diabético → diabetes; senão "outros".
- Gravidade alta = qualquer ocorrência de "anafil", "alergia grave", "epipen" → banner vermelho fixo no topo da aba.

**Estilo**: cards com borda lateral 4px (verde/âmbar/vermelho conforme status/gravidade), grayscale para exportações, nomenclatura `SysCFV_{Categoria}_{data}_{hora}`.

## Diagrama

```text
/cozinha (cozinheiro + coordenacao)
  ├── Painel        → get_cozinha_stats() — alertas + refeições hoje + total restrições
  ├── Estoque       → cozinha_insumos + entrada/saída
  ├── Cardápio      → cozinha_cardapio (5×3) + viabilidade
  ├── Restrições    → get_restricoes_alimentares() — visões Por Dia / Por Restrição / Tabela
  └── Movimentações → cozinha_movimentacoes + gráfico 30d

cruzamento de dados (Restrições)
  participantes (restricao_alimentar IS NOT NULL)
       └─► turma_participantes ─► turmas.dias_semana[]
                                   └─► dias_frequenta (união)
```

## Fora do escopo
- Compras/cotação de fornecedores → já existe em `/financeiro`
- Edição da restrição alimentar → continua no perfil do participante (`/participantes/:id`)
- Geração de cardápio por IA (iteração futura)

