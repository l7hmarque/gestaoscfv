# Reforma de Navegação + Permissões Granulares

Plano em duas frentes que se completam: **(A)** reorganizar a navegação separando o que é de **Coordenação** do operacional, e **(B)** trocar o controle por "role" puro por um sistema de **capabilities por módulo**, configurável pessoa-a-pessoa nas Configurações.

---

## Diagnóstico atual

**Navegação (`AppSidebar`)**

- 4 grupos: Principal, Atividades, Comunicação, Gestão — mas tudo aparece para qualquer login. Só `Cozinha` e `Coordenação` são filtrados por role no client.
- "Gestão" mistura coisas universais (Cronograma, Transporte) com coisas só de coord (Banco de Dados, Site Público, Configurações).
- **22 rotas autenticadas**, todas sem guard de rota — qualquer usuário logado abre tudo digitando URL (só `/coordenacao` e `/dev` checam role na própria página).

**Hubs com abas internas** que repetem coisas:

- `CoordenacaoPage` → 11 abas (Painel, Ações, Decisões, Qualidade, Produtividade, **Auditoria**, Registros, Família, **Permissões**, Desligamento, Relatório).
- `ConfiguracoesPage` → 6 abas (Instituição, Bairros, Transporte, **Equipe**, **Auditoria**, Sistema).
- Sobreposição: **Auditoria** e **gestão de Equipe/Permissões** existem nos dois lugares.

**Roles atuais no banco** (`app_role` enum, via `user_roles`): `coordenacao, tecnico, educador, motorista, cozinheiro, visitante, marketing`.

---

## A. Nova arquitetura de navegação

Sidebar reagrupada em **5 seções**, com cabeçalho da seção "Coordenação" visualmente distinto (badge "Restrito" + cor):

```text
PRINCIPAL              (todos com acesso)
  Dashboard
  Participantes
  Turmas
  Presença
  Registros Fotográficos

ATIVIDADES             (educadores + técnicos)
  Planejamento
  Relatórios
  Hub de Exportações       ← unifica /relatorios/hub + /relatorios/exportar + /presenca/exportar
  Cronograma

OPERAÇÃO               (perfis operacionais)
  Transporte
  Cozinha

EQUIPE & COMUNICAÇÃO
  Feed / Mural
  Equipe Técnica

COORDENAÇÃO 🔒          (badge "Restrito", borda vermelha)
  Painel da Coordenação    ← consolida CoordenacaoPage (Painel/Ações/Decisões/Qualidade/Produtividade)
  Auditoria & Registros    ← funde aba Auditoria + Registros (move da Configurações)
  Permissões & Equipe      ← funde Permissões + tab "Equipe" da Configurações
  Banco de Dados
  Integridade
  Site Público
  Configurações do Sistema ← Instituição/Bairros/Transporte/Sistema apenas
```

**Mudanças concretas:**

1. `Hub de Exportações`, `Exportar Relatórios em Lote` e `Exportar Chamada` viram **abas dentro do Hub** (`/relatorios/hub` com tabs `Oficiais | Atividades em Lote | Chamadas`) — 3 itens viram 1 na sidebar.
2. `Coordenação` deixa de ser link único e vira **seção colapsável** com itens diretos para cada sub-hub — fim das 11 abas empilhadas.
3. Auditoria sai de Configurações; Configurações fica só com parâmetros do sistema.
4. Sidebar passa a esconder seções inteiras quando o usuário não tem nenhuma capability dela.

---

## B. Sistema de capabilities granulares

**Modelo**: cada usuário tem **capabilities por módulo** (`turmas`, `participantes`, `transporte`, `cozinha`, `auditoria`, `permissoes`, ...). Roles continuam existindo como **presets** que aplicam pacotes pré-definidos — mas a coord pode sobrescrever individualmente.

### Banco

Nova tabela:

```text
user_module_access
  - user_id (uuid)
  - module (text)          ← chave do módulo: 'turmas', 'participantes', etc.
  - level (text)           ← 'none' | 'read' | 'write' | 'admin'
  - granted_by (uuid)
  - created_at
  UNIQUE (user_id, module)
```

Função security-definer:

```text
public.has_module_access(_user uuid, _module text, _min_level text) RETURNS boolean
  - lê user_module_access; se não houver linha, deriva do role via has_role()
  - 'admin' > 'write' > 'read' > 'none'
```

RLS nas tabelas críticas (participantes, turmas, etc.) passa a chamar `has_module_access(auth.uid(), 'participantes', 'read')` em vez de listar roles. **Coordenação continua ganhando tudo automaticamente** (preset fixo no fallback).

### Frontend

- **Hook** `useCapabilities()` → carrega capabilities + roles uma vez, cacheia (TanStack Query, staleTime infinito).
- **Helper** `can(module, level='read')` usado para gating de menu e rotas.
- `**<ModuleRoute module="turmas" level="read">**` — wrapper de `<Route>` que redireciona para `/` com toast "Acesso não autorizado" se faltar capability.
- `AppSidebar` filtra cada item com base em `can(item.module)`; seções vazias somem inteiras.

### UI de configuração (nova aba em Configurações → "Permissões & Equipe")

Tabela: linhas = profissionais, colunas = módulos, células = `<Select>` com `Nenhum / Leitura / Edição / Admin`. Linha colapsável mostra o preset do role + overrides em destaque. Botão "**Aplicar preset do papel**" reseta as células ao default do role.

Catálogo de módulos (15):

```text
dashboard, participantes, turmas, presenca, planejamentos, relatorios,
registros_fotograficos, cronograma, transporte, cozinha, feed,
equipe_tecnica, integridade, banco_dados, configuracoes,
auditoria, permissoes, site_publico, coordenacao
```

### Anti-lock-out

- Sempre existe ≥1 `admin` em `coordenacao` e `permissoes` — UI bloqueia salvar se quebrar.
- Migração inicial popula `user_module_access` derivando dos roles atuais para evitar regressão.

---

## C. Entregas (ordem sugerida)

1. **Migration** — tabela `user_module_access`, função `has_module_access`, seed inicial a partir de `user_roles`, **backup explícito do banco** antes.
2. **Hook + helper + `ModuleRoute**` — frontend lê capabilities, gating funciona em rotas e sidebar.
3. **Sidebar reorganizada** nas 5 seções, com seção "Coordenação" destacada.
4. **Hub de Exportações unificado** absorvendo as 3 rotas de export.
5. **Coordenação como seção colapsável** (split das 11 abas em sub-páginas).
6. **Aba "Permissões & Equipe"** com a matriz de capabilities (única fonte de verdade — remove duplicação Configurações/Coordenação).
7. **RLS endurecida** — políticas das tabelas sensíveis passam a usar `has_module_access`. Coordenação mantém bypass.

Entrego em ondas; cada onda é deployável sozinha sem quebrar o que existe. Roles antigos continuam funcionando durante a transição porque `has_module_access` cai no fallback de role quando não há override.

---

## Pontos para você decidir antes de eu codar

1. **Granularidade do nível**: 4 níveis (`none/read/write/admin`) ou só 2 (`none/full`)? Mais níveis = mais poder, mais UI. -- 4 niveis
2. **Coordenação é intocável?** Posso garantir que ninguém consiga revogar capabilities de quem tem role `coordenacao` (recomendado), ou você quer poder limitar até coord? -- Sim, contudo meu usuario ([l7hmarque@gmail.com](mailto:l7hmarque@gmail.com)) pode tudo (super admin)
3. **Visitante** continua read-only global ou entra no mesmo sistema com capabilities `read` em tudo? -- read only
4. **Sidebar quando usuário não tem nada de uma seção**: esconder a seção inteira (recomendado) ou mostrar acinzentada com cadeado? -- apenas acinzentada

Responda esses 4 e eu sigo direto para a migration + onda 1.