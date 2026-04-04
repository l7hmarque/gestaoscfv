

## Plano: Coordenação com acesso total + Matrizes XLSX com presença preenchida + Atendimentos no relatório + Conquistas inline + Menções @

---

### 1. Coordenação vê todos os recados e notificações

**Migração SQL**: Alterar RLS de `recados` para incluir coordenação no SELECT e UPDATE.

**`NotificationBell.tsx` (linha 46)**: Verificar role `coordenacao` via `user_roles`. Se coord, não filtrar por `destinatario_id` — mostrar todos os recados. Exibir "Para: [nome]" quando o recado não é para o coord.

**`MuralPage.tsx`**: Coord já vê tudo (sem filtro por destinatário). Sem alteração.

---

### 2. Matrizes de frequência no XLSX — formato conforme print

A print mostra o formato desejado que **já existe no código** (linhas 348-388 do `DashboardRelatorioMensalTab.tsx`). O problema é que os dados de presença não estão aparecendo nas células.

**Diagnóstico**: O código usa `✓` e `F` para marcar presença, mas a print mostra **células preenchidas com fundo preto** para presença. Além disso, as datas são geradas a partir dos `dias_semana` da turma (correto).

**Correções em `DashboardRelatorioMensalTab.tsx`**:

- **Estilização das células de presença**: Em vez de apenas `✓`/`F`, aplicar **fundo preto (`fill: { fgColor: { rgb: "000000" } }`)** nas células onde `presente === true`, mantendo a célula vazia visualmente (o preenchimento preto indica presença, como na print).
- Células com falta (`presente === false`): manter fundo branco, sem texto.
- Células sem registro: manter vazio.
- Aplicar **bordas finas** em todas as células da matriz (já existe `applyBorders` mas não é chamado nas sheets de turma — adicionar chamada).
- **Header style**: Aplicar negrito + fundo cinza na linha de cabeçalho (Nº, Nome, datas).
- **Coluna widths**: Nº=5, Nome=30, datas=6 (já correto).
- **Linha de assinatura**: Já existe (linha 384). Manter.

**Verificar `fetchAllRows`**: A função já pagina corretamente (busca em blocos de 1000). O problema pode ser que a filtragem `p.data >= startDate && p.data < endDate` usa comparação de strings — verificar se as datas estão no formato correto `YYYY-MM-DD`. Adicionar log/debug se necessário.

---

### 3. Atendimentos e demais dados no relatório mensal XLSX

**Nova aba "Atendimentos"** no `DashboardRelatorioMensalTab.tsx`:
- Buscar da tabela `atendimentos` filtrado pelo período (mês/ano)
- Colunas: Data, Tipo, Participante, Profissional, Descrição (truncada), Encaminhamento
- Aplicar bordas e header style

**Aba "Resumo"**: Adicionar contagem de atendimentos técnicos no mês.

---

### 4. Conquistas inline no post do relatório (evitar flood)

**`useConquistas.ts`**: Remover `postConquistaToFeed` (posts separados). Retornar apenas `earned[]`.

**`RelatorioNovoPage.tsx`**: Após criar o auto-post do relatório no feed, se houver conquistas earned, fazer UPDATE no `conteudo` do post adicionando as conquistas como texto no final: `"\n\n🏆 Conquistas: ..."`.

---

### 5. Menções @ com notificação

**Migração SQL**: Adicionar coluna `mencoes text[] DEFAULT '{}'` em `feed_posts` e `feed_comentarios`.

**`FeedPage.tsx`** e **`FeedPost.tsx`**: Ao digitar `@` no campo de texto, mostrar dropdown com profissionais para selecionar. Ao salvar, gravar IDs no campo `mencoes` e criar um `recado` automático para cada mencionado.

Renderizar `@Nome` com destaque visual no texto do post/comentário.

---

### Arquivos

| Arquivo | Mudança |
|---|---|
| Migração SQL | RLS recados coord + colunas `mencoes` |
| `src/components/NotificationBell.tsx` | Coord vê todos os recados |
| `src/pages/dashboard/DashboardRelatorioMensalTab.tsx` | Células pretas para presença + bordas + aba Atendimentos |
| `src/hooks/useConquistas.ts` | Remover post separado, retornar earned |
| `src/pages/relatorios/RelatorioNovoPage.tsx` | Conquistas inline no auto-post |
| `src/components/FeedPost.tsx` | Renderizar menções @ |
| `src/pages/feed/FeedPage.tsx` | UI de @ mention no campo de texto |

