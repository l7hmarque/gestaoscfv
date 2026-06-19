## Objetivo

Validar in loco, com sua conta real (`l7hmarque@gmail.com`), que as três frentes recentes funcionam ponta a ponta — sem deixar resíduo no banco — e, em paralelo, produzir um documento `.md` descrevendo a UI/UX atual do SysCFV para você compartilhar com a IA do Manus.

---

## Parte 1 — Testes práticos in loco

### Como vou acessar
- Usar Playwright (Chromium headless) apontando para `http://localhost:8080`.
- Login pelo formulário de `/login` com as credenciais informadas (sem persistir em arquivo, sem ecoar em logs).
- Screenshots em `/tmp/browser/qa-frentes/screenshots/` (descartáveis).

### Roteiro de validação (Frentes 1, 2 e 4)

**T1 — Frente 1: enums e backfill**
- Navegar até `/coordenacao/qualidade-dados` e conferir os 4 KPIs carregando.
- Via `psql` (somente SELECT): confirmar `0 sem_audit`, contagem de `tipo_oficina` e `papel_profissional` por valor.
- Esperado: KPIs renderizam, distribuição bate com a migration (228 tipo_oficina, 12 papel_profissional).

**T2 — Frente 2: trigger de período + flag de divergência**
- Criar 1 relatório de atividade de teste (data futura, turma existente) **sem** preencher `periodo_atividade`, com 2-3 participantes marcados presentes no período da manhã.
- Salvar e reabrir o relatório.
- Esperado: `periodo_atividade` preenchido automaticamente como "Manhã"; `flag_divergencia=false` se território coerente.

**T3 — Frente 2: detecção de divergência territorial**
- Editar o relatório de T2 adicionando 1 participante de um bairro fora das turmas vinculadas.
- Esperado: após salvar, `flag_divergencia=true` e motivo `participantes_fora_territorio` aparece; o relatório passa a aparecer na tabela de `/coordenacao/qualidade-dados`.

**T4 — Frente 4: painel de qualidade**
- Recarregar `/coordenacao/qualidade-dados`, abrir o link do relatório divergente em `/relatorios/:id` para confirmar navegação e dados coerentes.
- Esperado: relatório de teste listado, link funciona, motivo legível via `MOTIVO_LABEL`.

### Tratamento de erros durante os testes
- **Falha de login** (ex.: `bad_jwt` que aparece nos auth-logs): tentar uma 2ª vez; se persistir, parar e reportar — não tentar workaround inseguro.
- **Trigger não dispara** (período continua nulo): consultar `pg_trigger` via `psql` para confirmar instalação; reportar com evidência.
- **Flag não recalcula**: testar via UPDATE direto na `relatorio_presenca` para isolar se o problema é UI ou trigger.
- **UI quebra** (erro de render no painel): capturar screenshot + console + network e reportar; não tentar “corrigir” em modo de teste.
- Se 3 tentativas falharem no mesmo passo, paro o roteiro e devolvo diagnóstico — sem inventar correções.

### Limpeza obrigatória ao final
Toda criação feita durante os testes será revertida via migration `down`-like (DELETE escopado por marcador). Plano de limpeza:

1. Todo relatório criado terá `observacoes` contendo a tag `__QA_FRENTE_TEST__` (marcador único).
2. Ao final (sucesso ou falha), rodar migration de limpeza:
   - `DELETE FROM relatorio_presenca WHERE relatorio_id IN (SELECT id FROM relatorios_atividade WHERE observacoes LIKE '%__QA_FRENTE_TEST__%')`
   - `DELETE FROM relatorio_turmas WHERE relatorio_id IN (...)`
   - `DELETE FROM relatorios_atividade WHERE observacoes LIKE '%__QA_FRENTE_TEST__%'`
   - `DELETE FROM audit_log WHERE detalhes LIKE '%__QA_FRENTE_TEST__%'`
3. Verificação pós-limpeza: SELECT count(*) = 0 nas mesmas condições.
4. **Nenhum arquivo do projeto será editado** durante os testes — só dados transitórios marcados.

---

## Parte 2 — Documento UI/UX para Manus

Gerar `/mnt/documents/SysCFV_UIUX_Manus.md` cobrindo:

1. **Visão geral do produto** — propósito (SCFV, 3 territórios, base 2026) e personas (coordenação, técnico, educador, oficineiro, motorista, cozinheiro, família, visitante).
2. **Stack visual** — paleta cinza/vermelho, radius 0.25rem, tipografia, tom “dashboard técnico”, dark mode.
3. **Arquitetura de navegação** — sidebar agrupada por categorias (extraída de `AppSidebar.tsx`), rotas-chave de `App.tsx`, padrões de Tabs controladas.
4. **Fluxos principais** (passo a passo, com rota e ação):
   - Matrícula pública → confirmação;
   - Cadastro/edição de participante → desligamento/transferência;
   - Criação de relatório de atividade → presença → ELO → exportação;
   - Cronograma semanal e intervenções;
   - Coordenação: auditoria, qualidade de dados, permissões;
   - Hub de documentos/relatórios (4 abas);
   - Portal da família e formulários dinâmicos;
   - Equipe técnica (roteiros de visita, vulnerabilidade).
5. **Padrões de interação** — máscaras (CPF/telefone), Title Case, busca fuzzy, edição inline auditada, modais com justificativa obrigatória.
6. **Exportações e impressão** — nomenclatura `SysCFV_{Categoria}_{data}_{hora}`, CSS de impressão A4, grayscale.
7. **Segurança/visibilidade** — RLS por papel, auto-logout 30 min, modo visitante, banners de aviso.
8. **Componentes recorrentes** — `PageHeader`, `DataTable`, `StatusBadge`, `NotificationBell`, `LanguageSwitcher`, `FloatingActionButton`.
9. **Pontos de fricção observados durante o QA** (preenchido após os testes).

Fontes para o doc: leitura de `AppSidebar.tsx`, `App.tsx`, páginas-chave (`CoordenacaoPage`, `RelatorioNovoPage`, `ParticipantesPage`, `CronogramaPage`, `DocumentosPage`, `MatriculaPublicaPage`), `index.css`, memórias do projeto.

---

## Ordem de execução

1. Ler arquivos-fonte para o doc UI/UX (paralelo).
2. Subir Playwright, logar, executar T1→T4 capturando screenshots.
3. Rodar limpeza e verificar zero resíduo.
4. Escrever `/mnt/documents/SysCFV_UIUX_Manus.md` consolidando observações.
5. Reportar: o que passou, o que falhou (se algo), evidências, e o artefato `.md`.

## Critérios de sucesso

- 4/4 testes (T1-T4) com resultado esperado **ou** diagnóstico claro de falha.
- Banco volta ao estado pré-teste (contagens iguais antes/depois nos marcadores).
- Documento `.md` entregue como `<presentation-artifact>`.
- Nenhum arquivo do repositório alterado ao final.
