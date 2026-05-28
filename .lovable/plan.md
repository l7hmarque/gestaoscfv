## Fase 3 — Consolidação pós-reorganização

Três frentes paralelas para finalizar o ciclo iniciado nas Fases 1 e 2.

### 1. Ampliar cobertura do i18n (PT-BR, EN-US, ES-AR, IT-IT)

Hoje apenas `common.*` e `nav.*` estão traduzidos. Vou expandir os locales para cobrir a UI das páginas principais — sem tocar em conteúdo de usuário (nomes, CPF, relatórios, endereços continuam intocados via `translate="no"`).

**Namespaces a adicionar** em cada um dos 4 arquivos JSON:
- `sidebar.*` — todos os rótulos e categorias do `AppSidebar`
- `dashboard.*` — títulos dos cards, KPIs, abas, legendas dos gráficos
- `participants.*` — filtros, status (Ativo/Busca Ativa/Desligado/etc.), ações em lote
- `classes.*` — categorias de turma, faixas etárias, períodos
- `attendance.*` — banner orientador, abas Lançamento/Exportar
- `documents.*` — abas do hub, descrições dos blocos de exportação
- `settings.*` — títulos das 7 abas + textos dos `InfoCallout`
- `auth.*` — tela de login, recuperação de senha

**Aplicação nos componentes**: substituir strings hard-coded por `t("namespace.key")` em:
- `AppSidebar.tsx`, `AppLayout.tsx`
- `DashboardPage.tsx` (chrome, não dados)
- `ParticipantesPage.tsx` (filtros e ações)
- `TurmasPage.tsx`, `PresencaPage.tsx`, `DocumentosPage.tsx`
- `ConfiguracoesPage.tsx` (títulos das abas + callouts)
- `LoginPage.tsx`

Conteúdo dinâmico vindo do banco (nomes de bairros, turmas, participantes) permanece em PT-BR — i18n cobre apenas UI estática.

### 2. QA visual das rotas afetadas

Verificação manual via preview (viewport 1260×785) para detectar regressões introduzidas nas Fases 1 e 2:

| Rota | Verificações |
|---|---|
| `/documentos` | 4 abas carregam; downloads disparam; aba Gestão só aparece para coordenação/super_admin |
| `/presenca` | Tabs controladas via query param `?tab=exportar`; banner visível; sem reset ao trocar aba |
| `/turmas` | Bordas vermelhas nos cards (1px); divisores azul SCNSA entre categorias |
| `/dashboard` | Gráficos Faixa Etária e Bairros com paleta institucional; sem abas Admin/Mensal |
| `/coordenacao` | Aba "Administração" presente; permissões intactas |
| `/configuracoes` | 7 callouts visíveis no topo de cada aba; cores corretas (primary vs warning) |
| Sidebar | Equipe Técnica em Operação; sem "Exportar Listas" nem "Hub de Exportações"; "Documentos & Relatórios" e "Dashboard Administrativo" em Coordenação |
| Redirects | `/mural` → `/feed`; `/relatorios/hub` → `/documentos`; `/presenca/exportar` → `/presenca?tab=exportar` |
| Header | Seletor de idioma (`Languages` icon) visível; troca de idioma persiste no localStorage `syscfv_lang` |

**Ferramentas**: `browser--navigate_to_sandbox` + `browser--screenshot` + `browser--read_console_logs` para cada rota. Qualquer console error ou layout quebrado vira correção pontual.

### 3. Atualizar memórias do projeto

Refletir a nova arquitetura para que futuras sessões já partam do estado atual:

**Novas memórias a criar**:
- `mem://funcionalidades/hub-documentos-relatorios` — Centralização de exports em `/documentos` (4 abas, restrição da Gestão)
- `mem://funcionalidades/i18n-nativo` — react-i18next, 4 locales, `syscfv_lang`, não traduz dados do usuário
- `mem://estilo/sidebar-categorias` — **atualizar** com nova organização (Equipe Técnica em Operação, hub em Coordenação)

**Memórias a atualizar/remover**:
- `mem://funcionalidades/exportacao-hub-unificado` — referenciar `/documentos` como ponto único
- `mem://funcionalidades/configuracoes-gerais-hub` — incluir callouts orientadores
- Remover referência ao `/mural` (página deletada)

**Index** (`mem://index.md`): adicionar as 2 entradas novas, manter ordem alfabética por seção.

### Critérios de aceite

- Build limpo, sem erros TS
- Trocar idioma no header muda imediatamente sidebar, abas e callouts (sem reload)
- Nenhum dado de participante/relatório/exportação é traduzido
- Todas as rotas listadas no QA carregam sem console error
- Memórias refletem o estado atual do código

### O que NÃO está no escopo

- Traduzir conteúdo gerado pelo banco (nomes, observações, endereços)
- Traduzir documentos exportados (PDF/DOCX/XLSX permanecem em PT-BR — padrão institucional)
- Mudanças em RLS, edge functions ou esquema do banco
