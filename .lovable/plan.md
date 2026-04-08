

## Plano: Unificar Mural+Feed, Conquistas Inline, Composer Aberto e Exportação Unificada

---

### 1. Unificar Mural e Feed em uma única página

**O que muda**: Remover a rota `/mural` e a página `MuralPage.tsx`. Mover os posts do mural para o topo do Feed unificado. Atualizar sidebar para ter apenas "Feed" no grupo Comunicação.

**Na página Feed unificada**:
- Seção superior fixa: posts do `mural_posts` com visual de post-it (cores, rotação, tape) como já existe no MuralPage, com fixados primeiro. Coordenação pode fixar/desafixar e criar avisos.
- Abaixo: feed normal com posts manuais e automáticos.
- Botão "Novo Aviso" (apenas coordenação) cria em `mural_posts`; o composer aberto (ver item 3) cria em `feed_posts`.

**Arquivos afetados**:
- `src/pages/feed/FeedPage.tsx` — absorve lógica do mural no topo
- `src/components/AppSidebar.tsx` — remover "Mural", renomear "Feed" para "Feed / Mural"
- `src/App.tsx` — remover rota `/mural`, redirecionar se necessário
- `src/pages/mural/MuralPage.tsx` — pode ser deletado ou mantido como redirect

---

### 2. Conquistas inline nos posts de atividade

**Situação atual**: Conquistas já são appended ao conteúdo do post automático no `RelatorioNovoPage` (linhas 342-363). Posts antigos tipo `conquista` existem separados.

**Mudança**: No `FeedPost.tsx`, ao renderizar um post tipo `relatorio_auto`, buscar conquistas do mesmo `educador_id` que tenham `created_at` próximo ao post e exibir como badges/destaque visual dentro do card. Posts tipo `conquista` avulsos podem ser ocultados (filtrar no fetch).

**Alternativa mais simples**: Apenas filtrar `tipo !== "conquista"` no fetch do feed, já que as conquistas novas já vêm inline. Para conquistas antigas, rodar uma migração/script que as consolide nos posts de relatório correspondentes.

---

### 3. Composer aberto (sem dialog)

**Mudança**: Substituir o Dialog por um card fixo no topo do feed (abaixo do mural), estilo "O que está acontecendo?", com:
- `MentionInput` aberto direto na página
- Barra inferior com: ícone de foto do dispositivo, ícone de galeria (buscar fotos dos relatórios), botão Publicar
- Ao clicar "Galeria de Relatórios", abrir dialog com grid de fotos de `relatorio_fotos` para selecionar

**Galeria de fotos de relatórios**: Dialog que carrega `relatorio_fotos` paginadas (mais recentes primeiro), exibe grid de thumbnails selecionáveis. Fotos selecionadas vão para o post.

**Arquivos afetados**:
- `src/pages/feed/FeedPage.tsx` — remover Dialog, criar composer inline + dialog de galeria

---

### 4. Exportação unificada (um botão, baixa DOCX + PDF juntos)

**Problema**: Botões separados para DOCX e PDF, lento, às vezes precisa clicar duas vezes.

**Solução**: Substituir o DropdownMenu de exportação por um único botão "Exportar" que executa ambas as funções em paralelo (`Promise.all`), disparando os dois downloads simultaneamente. Remover menu dropdown.

**Arquivos afetados**:
- `src/pages/relatorios/RelatorioDetalhePage.tsx` — botão único que chama `exportRelatorioDocx` + `exportRelatorioPdf` em paralelo
- `src/pages/planejamentos/PlanejamentoDetalhePage.tsx` — mesmo padrão: `exportPlanejamentoDocx` + `exportPlanejamentoPdf` em paralelo

---

### Prioridade de Implementação

1. Exportação unificada (rápido, impacto imediato)
2. Composer aberto no feed (UX)
3. Unificação Mural + Feed (reestruturação)
4. Conquistas inline / ocultar posts avulsos

### Arquivos Modificados

| Arquivo | Mudança |
|---|---|
| `src/pages/feed/FeedPage.tsx` | Absorver mural no topo, composer aberto, galeria de fotos |
| `src/components/FeedPost.tsx` | Filtrar/ocultar posts tipo "conquista" |
| `src/components/AppSidebar.tsx` | Unificar menu Mural+Feed |
| `src/App.tsx` | Remover rota `/mural` |
| `src/pages/relatorios/RelatorioDetalhePage.tsx` | Botão único exporta DOCX+PDF |
| `src/pages/planejamentos/PlanejamentoDetalhePage.tsx` | Botão único exporta DOCX+PDF |

