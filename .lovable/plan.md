## Objetivo

Reforçar a aba Coordenação com filtro territorial restrito, novos indicadores de qualidade do serviço, painel de produtividade dos educadores (lançamentos vs prazo), telemetria invisível de tempo na plataforma e auditoria expandida de criações/edições/exclusões. Tudo visível **somente para perfis `coordenacao**` (RLS estrita).

---

## 1. Cobertura Territorial — restringir a 3 bairros

Atualizar a função `get_coordenacao_stats` para que o agregador `cobertura_metas` filtre apenas:

- `ALVORADA`
- `PARQUE INDEPENDENCIA`
- `JARDIM IRENE`

A tabela na aba Qualidade já consome esse array, não exige mudança no front.

---

## 2. Novos indicadores de Qualidade do Serviço

Adicionar à seção Qualidade (todos derivados do que já existe — relatórios, presenças, planejamentos, ELO, audit):

**Engajamento dos participantes**

- Taxa de presença média por bairro (últimos 30/90 dias)
- Top 5 turmas com maior frequência e Top 5 com menor (alerta)
- % participantes em risco (3+ faltas consecutivas) — já existe, expor por bairro
- Tempo médio de permanência ativo (dias entre matrícula e desligamento)
- Taxa de retenção mensal (matriculados que continuaram no mês seguinte)

**Qualidade pedagógica**

- ELO médio por educador (ranking) e por bairro
- % relatórios com `objetivo_alcancado = 'sim'` vs `parcialmente` vs `nao`
- % relatórios com fotos anexadas
- % relatórios com `analise_ia` preenchida (sinal de uso da IA)
- Distribuição de competências avaliadas (radar: iniciativa, autonomia, colaboração, comunicação, respeito)

**Operação**

- Nº de transferências aprovadas vs negadas no período
- Nº de busca-ativa abertas e resolvidas
- Tempo médio para resolver pendência de integridade
- % turmas que cumpriram dias planejados (relatórios lançados ÷ dias úteis previstos)

**Família / Comunicação**

- Logins do portal família no período
- Recados técnicos respondidos vs pendentes
- Encaminhamentos externos abertos > 30 dias (já existe — manter)

Todos derivados via extensão de `get_coordenacao_stats` (já é o hub) — sem novas tabelas.

---

## 3. Painel de Lançamentos — Educadores e Oficineiros --- ESSE PAINEL E SOMENTE PARA VISUALIZACAO DO COORDENADOR E DEVE FICAR ESCONDIDO DE EDUCADORES E OFICINEIROS E DEMAIS. 

Nova aba **"Produtividade"** com:

- Tabela: profissional · relatórios lançados no mês · presenças lançadas no mês · planejamentos lançados · % esperado · **dias até o prazo + TEMPO MEDIO UTILIZADO PARA PLANEJAMENTOS, RELATORIOS, PRESENCAS E SOMA TOTAL DESTES POR DIA / SEMANA / MES**
- Esperado = nº dias úteis com turma atribuída × turmas que coordena.
- Prazo = dia 1º do mês seguinte (configurável por tipo via `configuracoes_gerais`):
  - `prazo_relatorios_dias_apos_mes`
  - `prazo_presencas_dias_apos_mes`
  - `prazo_planejamentos_dias_apos_mes`
- Alertas visuais: verde (em dia), amarelo (≤5 dias), vermelho (atrasado).

Indicadores agregados:

- Total esperado vs realizado no mês
- Profissionais com 0 lançamentos nos últimos 7 dias (alerta)
- Top/bottom por volume e por aderência ao prazo

Dados derivados de `relatorios_atividade`, `presenca`, `planejamentos` agrupados por `educador_id`/`registrado_por`.

---

## 4. Telemetria de tempo na plataforma (invisível para usuários)

**Nova tabela `user_activity_pings**` (RLS: insert para qualquer autenticado, select só `coordenacao`):

- `user_id`, `created_at`, `route` (rota atual), `session_id` (uuid por aba)

Hook global `useActivityPing()` montado em `AppLayout`:

- Envia ping a cada **30 s** enquanto `document.visibilityState === 'visible'` (não pinga em aba background → não infla minutos)
- Insere via `supabase.from('user_activity_pings').insert(...)` em batch (acumula 4 pings e envia 1× por 2 min para reduzir requisições)

**Cálculo de minutos** (server-side, função `get_user_activity_summary(_user_id, _from, _to)`):

- Agrupa pings consecutivos com gap < 2 min → soma duração da sessão
- Retorna minutos por dia / semana / mês / rota mais usada

**Nova tabela `user_action_durations**` (cronômetro invisível):

- `user_id`, `tipo` ('relatorio' | 'planejamento' | 'presenca'), `registro_id`, `iniciado_em`, `salvo_em`, `duracao_segundos`
- Front: hook `useFormTimer(tipo)` instrumenta os 3 formulários (`RelatorioNovoPage`, `PlanejamentoNovoPage`, `PresencaPage`):
  - `useEffect` ao montar → salva `performance.now()` em ref
  - No `onSubmit` bem-sucedido → insere linha com `duracao_segundos`
  - Nenhuma UI exposta ao usuário
- Edição também rastreada (mesmo hook em páginas de detalhe)

**Agregado semanal "tempo burocrático"**:

- Soma `duracao_segundos` dos 3 tipos por educador na semana → exibido só na Coordenação

---

## 5. Auditoria expandida — listar tabelas críticas

Vou propor a lista; você confirma antes da implementação:

**Sugestão (tabelas com dados operacionais sensíveis):**

- `participantes` (INSERT/UPDATE/DELETE)
- `turmas` (UPDATE/DELETE)
- `turma_participantes` (INSERT/DELETE)
- `relatorios_atividade` (UPDATE/DELETE)
- `relatorio_presenca` (UPDATE/DELETE)
- `presenca` (UPDATE/DELETE)
- `planejamentos` (UPDATE/DELETE)
- `profiles` (UPDATE de campos sensíveis — salário, status ativo)
- `user_roles` (INSERT/DELETE — escalonamento de privilégios)
- `participante_transferencias` (INSERT/UPDATE)
- `bairros` (UPDATE metas)
- `configuracoes_gerais` (UPDATE)

Implementação:

- Trigger genérico `fn_audit_changes()` que insere em `audit_log` com:
  - `acao` = 'INSERT' | 'UPDATE' | 'DELETE'
  - `tabela`, `registro_id`
  - `detalhes` = JSONB diff (apenas campos alterados em UPDATE; row completa em INSERT/DELETE)
- Ativado por tabela via `CREATE TRIGGER ... AFTER INSERT/UPDATE/DELETE`.
- `audit_log` precisa nova coluna `diff jsonb` (ou armazenar JSON em `detalhes` existente).

Nova aba **"Auditoria"** dentro de Coordenação:

- Filtros: tabela, usuário, ação, período
- Tabela paginada com expansor mostrando diff
- Export XLSX

---

## 6. RLS e segurança

Todas as novas tabelas e visualizações:

- `user_activity_pings`: SELECT só `has_role(auth.uid(),'coordenacao')`; INSERT autenticado próprio user_id
- `user_action_durations`: idem
- `audit_log` ampliado: SELECT só coordenação (já é)
- Novos RPCs com `SECURITY DEFINER` + guard `IF NOT has_role(...,'coordenacao') THEN RETURN forbidden`

---

## 7. Etapas de entrega (sem quebrar nada)

1. **Migração 1**: filtro 3 bairros em `get_coordenacao_stats` + novos campos qualidade (puro SQL, não afeta UI)
2. **Migração 2**: tabelas `user_activity_pings`, `user_action_durations`, configs de prazo + RLS
3. **Migração 3**: trigger de auditoria + lista de tabelas confirmada
4. **Front**:
  - Filtro cobertura (automático via SQL)
  - Nova aba Produtividade
  - Nova aba Auditoria
  - Hook `useActivityPing` em `AppLayout`
  - Hook `useFormTimer` em 3 formulários (Relatório, Planejamento, Presença) — invisível
5. **Validação**: criar smoke test manual; verificar performance (pings em batch).

---

## Confirmações antes de codar

a) **Lista de tabelas auditadas** acima — aprovar/ajustar? aprovar  
b) **Prazos padrão por tipo** — default proposto: relatórios=1º dia mês seguinte, presenças=mesmo, planejamentos=sem data definida. OK?  
c) **Frequência do ping**: 30s ativo + batch 2min — OK ou prefere mais leve (60s)?
d) **Retenção dos pings**: manter 90 dias rolling (auto-delete) para não inflar banco? Ou guardar tudo? manter 90 dias rolling com opcao de salvar infos manualmente se eu quiser.