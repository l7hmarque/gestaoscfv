

## Plano: Site Público da OSC "Sociedade Civil Nossa Senhora Aparecida"

---

### Visão Geral

Criar um mini-site público (rotas `/site/*`) separado do sistema interno, com layout próprio, paleta institucional (laranja #E5541B da logo SCNSA + azul #3B8FC2 do CAIA), fundo branco/offwhite. As logos enviadas serão copiadas para `src/assets/`.

---

### Estrutura de Páginas

| Rota | Página | Conteúdo |
|---|---|---|
| `/site` | Home | Hero com logos, slogan, histórico, diretoria/comissão, projeto CAIA |
| `/site/indicadores` | Painel de Indicadores | Dados públicos agregados do SCFV, exportação PDF, captura de lead (email) |
| `/site/noticias` | Feed de Notícias | Manchetes/notícias publicadas (aprovadas pelo admin) |
| `/site/conteudos` | Conteúdos | E-books, vídeos, podcasts, guias sobre OSC/SCFV/Prestação de Contas |
| `/site/contato` | Contato | Formulário institucional + agendamento de reunião Google Meet |

---

### Parte 1 — Infraestrutura (Banco + Roles)

**Migração SQL:**
- `ALTER TYPE app_role ADD VALUE 'marketing'` — nova role de Assistente de Marketing
- Tabela `site_noticias` — id, titulo, subtitulo, conteudo, imagem_url, status (rascunho/pendente/publicado), autor_id, relatorio_id (nullable), created_at, published_at
- Tabela `site_conteudos` — id, tipo (ebook/video/podcast/guia), titulo, descricao, arquivo_url, thumbnail_url, created_at
- Tabela `site_reunioes` — id, nome, email, telefone, assunto, data_hora, status (pendente/confirmado/cancelado), google_meet_link, created_at
- Tabela `site_leads` — id, nome, email, interesse, created_at
- Tabela `site_horarios_disponiveis` — id, dia_semana (0-6), hora_inicio, hora_fim, ativo
- RLS: noticias/conteudos publicados = SELECT anon; CRUD = marketing/coordenacao
- RLS: reunioes/leads = INSERT anon; SELECT/UPDATE = coordenacao/marketing

---

### Parte 2 — Layout Público

**Novo arquivo:** `src/components/SiteLayout.tsx`
- Header com logos (SCNSA + CAIA), navegação horizontal (Início, Indicadores, Notícias, Conteúdos, Contato)
- Footer institucional (endereço, CNPJ, redes sociais)
- Paleta: laranja (#E5541B), azul (#3B8FC2), branco, cinza escuro para texto
- Fonte Inter, design limpo e institucional

---

### Parte 3 — Páginas Públicas

**`src/pages/site/SiteHomePage.tsx`**
- Hero com slogan "Olhando o passado, vivendo o presente e projetando o futuro."
- Seção Histórico (texto estático editável via admin futuramente)
- Seção Diretoria e Comissão (dados estáticos inicialmente: nomes, cargos, fotos)
- Seção Projetos: card do CAIA Medianeira com logo e descrição

**`src/pages/site/SiteIndicadoresPage.tsx`**
- Consulta dados agregados do Supabase (total participantes ativos, turmas, frequência geral, etc.) via Edge Function pública (sem expor dados individuais)
- Cards visuais com gráficos simples (barras/donuts)
- Botão "Exportar Relatório Sintético" → gera PDF com jsPDF
- Modal de captura de lead: nome + email antes de baixar

**`src/pages/site/SiteNoticiasPage.tsx`**
- Lista de notícias publicadas (status='publicado'), com imagem, título, data
- Página de detalhe ao clicar

**`src/pages/site/SiteConteudosPage.tsx`**
- Grid filtrado por tipo (ebook/video/podcast/guia)
- Cards com thumbnail, título, descrição, botão de download/assistir

**`src/pages/site/SiteContatoPage.tsx`**
- Formulário de contato (nome, email, telefone, assunto, mensagem) → insere em `site_leads`
- Seção de agendamento: calendário mostrando horários disponíveis → insere em `site_reunioes`

---

### Parte 4 — Geração de Notícias por IA

**Edge Function:** `supabase/functions/generate-noticia/index.ts`
- Recebe dados do relatório de atividade
- Usa Lovable AI para gerar título + corpo de notícia com tom jornalístico/institucional
- Salva em `site_noticias` com status='pendente'

**Integração no RelatorioDetalhePage:** Botão "Gerar Notícia para o Site" (ao lado do botão Instagram existente)

---

### Parte 5 — Painel Admin de Notícias e Conteúdos

**Novo na área protegida:** Adicionar aba ou página de gestão:
- `/site-admin` (rota protegida) com tabs: Notícias, Conteúdos, Reuniões, Horários
- Notícias: listar, aprovar (pendente→publicado), editar, criar manualmente
- Conteúdos: upload de e-books/vídeos/guias com metadados
- Reuniões: ver agendamentos, confirmar, adicionar link Google Meet
- Horários: configurar dias/horários disponíveis para reunião
- Acessível por: coordenacao, marketing

---

### Parte 6 — Role Marketing

- Adicionar role `marketing` ao enum
- Sidebar: mostrar item "Site Admin" para marketing/coordenacao
- Permissões: mesmas de coordenação para gerenciamento do site público

---

### Resumo de Arquivos

| Arquivo | Ação |
|---|---|
| `src/assets/scnsa-logo.png` | Copiar logo SCNSA |
| `src/assets/caia-logo.png` | Copiar logo CAIA |
| Migração SQL | Tabelas site_*, role marketing |
| `src/components/SiteLayout.tsx` | Layout público com header/footer |
| `src/pages/site/SiteHomePage.tsx` | Home institucional |
| `src/pages/site/SiteIndicadoresPage.tsx` | Painel de indicadores público |
| `src/pages/site/SiteNoticiasPage.tsx` | Feed de notícias |
| `src/pages/site/SiteConteudosPage.tsx` | Biblioteca de conteúdos |
| `src/pages/site/SiteContatoPage.tsx` | Contato + agendamento |
| `supabase/functions/generate-noticia/index.ts` | IA para gerar notícias |
| `supabase/functions/public-indicadores/index.ts` | Dados agregados públicos |
| `src/pages/site-admin/SiteAdminPage.tsx` | Gestão de notícias/conteúdos/reuniões |
| `src/App.tsx` | Novas rotas `/site/*` e `/site-admin` |
| `src/components/AppSidebar.tsx` | Item "Site Admin" para marketing/coord |

