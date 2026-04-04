

## Plano: Fotos ajustadas + Ocultar Presença + Corrigir relatório mensal

---

### Diagnóstico do relatório mensal (causa raiz)

Analisando os dados reais e o código da edge function `generate-relatorio-mensal`:

**Problema 1 — Atividades Propostas x Desenvolvidas vazio:**
O relatório filtra `planejamentos` pela `data_aplicacao` no mês selecionado (linha 132). Os planejamentos existentes no banco têm datas de `2025-11` — nenhum de `2026-04`. O relatório "criando nosso site" tem `planejamento_id = ff393198...`, mas esse planejamento tem `data_aplicacao` de novembro/2025. Portanto, nem o planejamento aparece na lista, nem o relatório é listado como "sem planejamento" porque ele TEM planejamento_id.

**Correção:** A aba Atividades deve ser orientada pelos **relatórios do mês** (não planejamentos). Para cada relatório do mês, buscar o planejamento vinculado (independente da data dele). Relatórios sem planejamento aparecem como atividades "não planejadas".

**Problema 2 — Matriz de frequência sem presenças preenchidas (células pretas):**
A lógica na linha 293 filtra `tPresencas` por `turma_id` E período do mês. A presença registrada via relatório salva corretamente na tabela `presenca` (linha 250 do RelatorioNovoPage). Porém, a filtragem global na linha 130 usa comparação de strings `p.data >= startDate && p.data < endDate`. Se o mês selecionado for abril/2026 (`2026-04-01` a `2026-05-01`) e a presença é de `2026-04-03`, deveria funcionar. O problema pode ser que a edge function usa `getClaims` que pode estar falhando silenciosamente — mas o fetch via service role key deveria funcionar. O verdadeiro problema é que os dados retornam vazios no contexto da edge function.

Verificando o relatório: data = `2026-04-03`, turma vinculada via `relatorio_turmas`, e presença salva em `presenca` com `turma_id` e `data`. A query na presenca retorna `[]` no client (visto nos network requests). Isso pode indicar que as presenças NÃO estão sendo salvas corretamente, OU que a RLS está filtrando. Mas a edge function usa service role key, portanto RLS não se aplica. O problema real é que **não há dados na tabela presenca** (a resposta do network request mostra `[]`).

**Investigação adicional:** O `RelatorioNovoPage` (linhas 241-264) faz `delete().eq("turma_id", turmaId).eq("data", dataStr)` antes de inserir. Se houve erro no insert, as presenças teriam sido apagadas sem serem reinseridas. Além disso, o `registrado_por` usa `user?.id` (auth UUID) em vez de `profile.id` — mas isso é o campo correto.

**Conclusão:** O relatório registra presença na tabela `relatorio_presenca` (funciona — confirma pelos dados de `num_participantes: 19` no relatório). Porém a tabela `presenca` está vazia (confirmado pelo network request). Isso sugere que o fluxo de salvar na tabela `presenca` (linhas 241-264) pode estar falhando silenciosamente, OU que as presenças foram lançadas antes dessa funcionalidade ser adicionada.

**Correção adicional:** A matriz de frequência na edge function deve TAMBÉM considerar dados de `relatorio_presenca` + `relatorio_turmas` como fonte alternativa de presença quando a tabela `presenca` está vazia para uma turma/data.

---

### Mudanças

#### 1. Fotos de perfil — profissionais e participantes

**`src/components/ui/avatar.tsx`**: Adicionar `object-cover` ao `AvatarImage` para garantir recorte proporcional.

**`src/pages/dashboard/DashboardProfissionaisTab.tsx`**: O Avatar `h-12 w-12` já existe — apenas garantir `object-cover` via classe no AvatarImage.

**`src/pages/profissional/ProfissionalPerfilPage.tsx`**: Avatar `h-20 w-20` OK — adicionar `object-cover`.

**`src/pages/participantes/ParticipantePerfilPage.tsx`**: Adicionar exibição de foto no topo do perfil (atualmente não existe). Criar um bloco com Avatar ao lado do nome usando `participante.foto_url`.

**`src/pages/participantes/ParticipantesPage.tsx`**: Adicionar miniatura Avatar na coluna "Nome" da tabela.

**`src/pages/participantes/ParticipanteNovoPage.tsx`**: Preview de foto já existe com `w-24 h-24 object-cover` — OK. Apenas garantir consistência de recorte.

#### 2. Ocultar página de Presença do menu e atalhos

**`src/components/AppSidebar.tsx`**: Remover `{ title: "Presença", url: "/presenca", icon: ClipboardCheck }` do grupo "Atividades".

**`src/pages/Index.tsx`**: Remover atalho de "Presença" do array `shortcuts`.

**`src/pages/presenca/PresencaExportarPage.tsx`** e **`PresencaHistoricoPage.tsx`**: Mudar link de voltar de `/presenca` para `/dashboard`.

A rota `/presenca` em `App.tsx` permanece (mantém compatibilidade com links existentes), mas fica inacessível pela navegação principal.

#### 3. Corrigir aba Atividades do relatório mensal (edge function + local)

**`supabase/functions/generate-relatorio-mensal/index.ts`** e **`src/pages/dashboard/DashboardRelatorioMensalTab.tsx`** (lógica local):

Substituir lógica da Sheet 2 (Atividades):
- Em vez de iterar `filteredPlanejamentos` e buscar relatório, **iterar `filteredRelatorios`** e buscar planejamento vinculado
- Para cada relatório do mês:
  - Coluna "Atividades Propostas": título do planejamento vinculado (ou "Não planejada")
  - Coluna "Atividades Desenvolvidas": `nome_atividade` do relatório
  - Coluna "Resultados Alcançados": `analise_ia`
  - Coluna "Justificativas": vazio

#### 4. Corrigir matrizes de frequência usando `relatorio_presenca` como fallback

Na edge function e na geração local, ao montar as matrizes por turma:
- Continuar usando tabela `presenca` como fonte primária
- Se não houver registros na tabela `presenca` para uma turma/data, buscar em `relatorio_presenca` + `relatorio_turmas`:
  - `relatorio_turmas` vincula relatório → turma
  - `relatorio_presenca` tem `participante_id` + `presente`
  - `relatorios_atividade` tem `data`
- Mesclar essas fontes para preencher as células pretas

Também adicionar fetch de `relatorio_presenca` e `relatorio_turmas` no `Promise.all` da edge function (já são fetched na linha 124-125, mas não usados na seção das matrizes).

---

### Arquivos

| Arquivo | Mudança |
|---|---|
| `src/components/ui/avatar.tsx` | `object-cover` no AvatarImage |
| `src/pages/dashboard/DashboardProfissionaisTab.tsx` | Ajustar classe de foto |
| `src/pages/profissional/ProfissionalPerfilPage.tsx` | Ajustar classe de foto |
| `src/pages/participantes/ParticipantePerfilPage.tsx` | Adicionar Avatar com foto no header |
| `src/pages/participantes/ParticipantesPage.tsx` | Miniatura na tabela |
| `src/components/AppSidebar.tsx` | Remover item Presença |
| `src/pages/Index.tsx` | Remover atalho Presença |
| `src/pages/presenca/PresencaExportarPage.tsx` | Link voltar → `/dashboard` |
| `src/pages/presenca/PresencaHistoricoPage.tsx` | Link voltar → `/dashboard` |
| `supabase/functions/generate-relatorio-mensal/index.ts` | Corrigir atividades + fallback presença |
| `src/pages/dashboard/DashboardRelatorioMensalTab.tsx` | Mesma correção na geração local |

