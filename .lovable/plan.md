## Auditoria pós-consolidação de status

Banco está saudável: enum só tem `ativo | busca_ativa | desligado`, 272 participantes corretamente distribuídos, 0 status órfãos, 0 desligados com vínculo aberto, 18 turmas normais ativas + 38 oficinas ativas. Nenhuma RPC referencia status legado.

Mas sobraram **4 resíduos no código** (1 crítico, 3 obsoletos inofensivos):

### 🔴 CRÍTICO — quebra matrícula pública
**`supabase/functions/public-matricula/index.ts:133, 169`**
Ainda insere `status: "pendente"` ao criar/atualizar participante. Como o enum não aceita mais esse valor, **toda matrícula nova ou rematrícula via /matricula vai falhar com erro de enum** (`invalid input value for enum status_participante: "pendente"`).
→ Trocar `"pendente"` por `"ativo"`. Como agora a matrícula gera diretamente um participante ativo, também remover o `DELETE FROM turma_participantes` (linha 169-173) que limpava vínculos por causa do antigo fluxo de aprovação, e deixar o auto-vínculo por bairro+período+faixa acontecer naturalmente (consistente com a regra que já consolidamos).

### 🟡 OBSOLETO — código morto, sem efeito mas confuso
1. **`supabase/functions/generate-relatorio-mensal/index.ts:318-320`** — filtra `status === "ativo" || status === "cadastro_incompleto"`. `cadastro_incompleto` nunca existiu no enum, ramo morto.
2. **`src/hooks/useRelatorioGestao.ts:115-118`** — mesmo padrão de `cadastro_incompleto`.
3. **`src/pages/relatorios/RelatorioNovoPage.tsx:188-190`** — `ALLOWED_STATUS` inclui `cadastro_incompleto`.
4. **`supabase/functions/public-familia-auth/index.ts:95, 162`** — `.in("status", ["ativo", "pendente"])`. `pendente` nunca casa mais, mas o filtro continua funcionando porque inclui `ativo`. Remover `"pendente"`.

→ Em todos, deixar apenas `"ativo"` (e `"busca_ativa"` onde fizer sentido para garantir que quem está em busca ativa ainda apareça em relatórios — verificar caso a caso ao editar).

### ✅ NÃO mexer (são intencionais, não relacionados ao status)
- "transferido" em `TurmaDetalhePage`, `listaFrequencia`, `marcadoresFrequencia`, `generate-lista-*` → **marcador de vínculo** (`data_saida` sem desligar). Continua válido.
- "pendente" em `RecadosEquipeCards`, `useRoteirosVisita`, `RoteiroDetalhe/Novo`, `SiteAdminPage`, `NotificationBell`, `DriveSyncBadge`, `generate-noticia`, `drive-sync-worker`, `useTransporteOffline`, `offlineDB` → status de **recados/roteiros/notícias/sync/transporte**, domínios diferentes.
- "incompleto" em `IntegridadePage`, `PendenciasIntegridadeBanner` → refere a **desligamentos com motivo faltando**, não a status.
- `StatusBadge.pendente` → genérico para outros tipos (recados, sync). Mantém.
- `EquipeTecnicaPage` com `pendentes = []` (memo vazio) → já neutralizado. UI mostra "0 matrículas pendentes" inofensivamente; opcionalmente posso esconder esses blocos numa segunda passada se você quiser.

### Passo único proposto

Editar somente os 4 arquivos abaixo (sem migration, sem mudança de dados):

```text
supabase/functions/public-matricula/index.ts        → status "pendente" → "ativo"; remover DELETE turma_participantes da rematrícula
supabase/functions/public-familia-auth/index.ts     → remover "pendente" do .in()
supabase/functions/generate-relatorio-mensal/.../   → remover ramo "cadastro_incompleto"
src/hooks/useRelatorioGestao.ts                     → remover ramo "cadastro_incompleto"
src/pages/relatorios/RelatorioNovoPage.tsx          → remover "cadastro_incompleto" de ALLOWED_STATUS
```

Risco: nulo (3 dos 4 são código morto; o 4º — matrícula pública — está atualmente quebrado e a edição corrige).

Depois disso o sistema fica 100% alinhado com o modelo de 3 status + flag `is_incompleto`.
