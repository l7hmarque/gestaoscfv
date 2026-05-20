## Entrega 1 — Hub de Exportações com aba "Oficiais"

Foco: adicionar peças novas para a rede de proteção **sem refatorar** o que já funciona. Tudo vira atalho/agregador.

---

### 1. Padronização de Vulnerabilidade (migration)

Criar tabela `categorias_vulnerabilidade_padrao` (lookup editável pela coordenação) e popular com:

- Bolsa Família (PBF)
- BPC
- Medida Protetiva (ECA)
- Trabalho Infantil
- Violação de Direitos Identificada
- Referenciado CRAS
- Referenciado CREAS
- Acompanhamento Conselho Tutelar
- Outro

Manter `participantes.categoria_vulnerabilidade` como **texto livre** (não migrar dado antigo). No formulário do perfil, trocar input por **Combobox com sugestões da tabela + opção de digitar livre**. Valores antigos continuam aparecendo normalmente.

---

### 2. Nova rota `/relatorios/hub`

Página única com `Tabs` (estado controlado, conforme memória) e 5 abas:

```text
┌─ Presença ─┬─ Atividades ─┬─ Gestão ─┬─ Oficiais ─┬─ Família ─┐
```

Cada aba lista cards com:
- Título do relatório
- 1 linha de descrição
- Destinatário sugerido (MP, SAS, CRAS, interno…)
- Botão **Abrir** (vai pra página existente) **ou** **Gerar agora** (export direto)

**Abas 1–3 e 5**: agregam atalhos para páginas que **já existem** (Exportar Chamada, Exportar Relatórios em Lote, Relatório de Gestão, Portal da Família, etc). Zero refactor — só links.

**Aba "Oficiais"**: 3 peças novas (item 3).

---

### 3. Três relatórios oficiais novos

Todos seguem o padrão **Google Docs/Sheets first + fallback local** (XLSX/PDF via libs já no projeto), nomenclatura `SysCFV_{Categoria}_{YYYY-MM-DD}_{HHmmss}.{ext}`.

#### 3.1 Ficha de Referenciamento por Participante
- **Para quem**: CRAS, CREAS, Conselho Tutelar, MP
- **Entrada**: combobox de participante
- **Conteúdo**: dados de identificação, responsável, endereço, território, vulnerabilidades, turma atual, data de ingresso, frequência dos últimos 90 dias, registros de busca ativa, encaminhamentos da equipe técnica, observações pedagógicas recentes
- **Saída**: Google Doc (template) + fallback PDF
- **Edge function nova**: `generate-ficha-referenciamento`

#### 3.2 Relatório de Faltas Consecutivas com Alerta
- **Para quem**: Conselho Tutelar, coordenação interna
- **Filtros**: território, período, limiar de faltas (default 3 consecutivas)
- **Conteúdo**: nome, idade, responsável, telefone, turma, nº de faltas consecutivas, data da última presença, status de busca ativa, encaminhamento sugerido
- **Saída**: Google Sheet + fallback XLSX (xlsx-js-style, grayscale, autoFit)
- **Edge function nova**: `generate-faltas-consecutivas`

#### 3.3 Cobertura de Público Prioritário
- **Para quem**: SAS, Controladoria, MP
- **Filtros**: mês de referência, território
- **Conteúdo**: tabela cruzando meta territorial × atendidos no mês × atendidos por categoria de vulnerabilidade (PBF, BPC, Medida Protetiva, etc) × % de cobertura
- **Saída**: Google Sheet + fallback XLSX
- **Edge function nova**: `generate-cobertura-prioritaria`

Marco operacional **01/04/2026** respeitado (memória).

---

### 4. Sidebar

Adicionar item **"Hub de Exportações"** (ícone `FolderDown`) no grupo **Atividades**, logo abaixo de "Exportar Chamada". Os itens antigos permanecem — quem já tem fluxo memorizado segue usando.

---

### Detalhes técnicos

- **Tabela nova**: `categorias_vulnerabilidade_padrao(id, nome, descricao, ativo, ordem)` + RLS (leitura para autenticados, escrita só coordenação)
- **3 edge functions novas**, cada uma com fallback: tenta `connector-gateway.lovable.dev/google_*` primeiro; se falhar ou Drive não configurado, devolve binário XLSX/PDF
- **Paginação Supabase** via `fetchAllRows` para todas as consultas (memória)
- **Sanitização** de nulos nos exports (memória)
- **Sem mudanças** em: páginas existentes de relatórios, presença, exportação em lote, dashboard, portal da família, etc.

### Arquivos a criar
```text
src/pages/relatorios/HubExportacoesPage.tsx
src/pages/relatorios/hub/PresencaTab.tsx
src/pages/relatorios/hub/AtividadesTab.tsx
src/pages/relatorios/hub/GestaoTab.tsx
src/pages/relatorios/hub/OficiaisTab.tsx
src/pages/relatorios/hub/FamiliaTab.tsx
src/pages/relatorios/oficiais/FichaReferenciamentoDialog.tsx
src/pages/relatorios/oficiais/FaltasConsecutivasDialog.tsx
src/pages/relatorios/oficiais/CoberturaPrioritariaDialog.tsx
src/components/CategoriaVulnerabilidadeCombobox.tsx
supabase/functions/generate-ficha-referenciamento/index.ts
supabase/functions/generate-faltas-consecutivas/index.ts
supabase/functions/generate-cobertura-prioritaria/index.ts
```

### Arquivos a alterar (mínimo)
- `src/App.tsx` — registrar `/relatorios/hub`
- `src/components/AppSidebar.tsx` — novo item
- `src/pages/participantes/ParticipantePerfilPage.tsx` — usar `CategoriaVulnerabilidadeCombobox`

### Não muda nesta entrega
Páginas legadas de exportação, lógica de presença, relatórios mensais, portal da família, fluxo de matrícula.

---

Posso seguir?