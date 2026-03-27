

## Plano: Melhorias DevPage, Permissões, Fotos no Relatório, Gerador Instagram, Dashboard e Alertas de Busca Ativa

São 6 frentes de trabalho. Segue o detalhamento de cada uma.

---

### 1. DevPage: gestão visual de roles e permissões

**Arquivo:** `src/pages/dev/DevPage.tsx`

- Adicionar seção "Matriz de Permissões" mostrando uma tabela editável: linhas = roles (coordenacao, educador, tecnico, motorista, cozinheiro), colunas = permissões (ex: "Acesso Sigiloso", "Deletar Registros", "Gerenciar Turmas", etc.)
- Exibir como grid de checkboxes/switches para visualizar o que cada role pode fazer
- Isso é **informativo/documentação visual** — as regras reais ficam no RLS e no código. Serve como referência rápida para o dev.
- Otimizar layout para mobile: tabela scrollável horizontalmente, cards empilhados, fontes menores

**Regra de negócio a implementar no código (não no DevPage):**
- Educadores, oficineiros, motoristas e ADM **não** acessam seção sigilosa (já implementado: apenas `equipe_tecnica` e `coordenacao`)
- Educadores **podem deletar** seus próprios planejamentos e relatórios (já existe RLS para update por autor; precisa ajustar DELETE)

**Migration SQL:** Atualizar política de DELETE em `planejamentos` e `relatorios_atividade` para permitir que o autor delete seus próprios registros:
```sql
DROP POLICY "Coordenacao delete planejamentos" ON public.planejamentos;
CREATE POLICY "Author or coordenacao delete planejamentos" ON public.planejamentos
  FOR DELETE TO authenticated
  USING (educador_id = (SELECT id FROM profiles WHERE user_id = auth.uid() LIMIT 1)
    OR has_role(auth.uid(), 'coordenacao'));

DROP POLICY "Coordenacao delete relatorios" ON public.relatorios_atividade;
CREATE POLICY "Author or coordenacao delete relatorios" ON public.relatorios_atividade
  FOR DELETE TO authenticated
  USING (educador_id = (SELECT id FROM profiles WHERE user_id = auth.uid() LIMIT 1)
    OR has_role(auth.uid(), 'coordenacao'));
```

---

### 2. Otimização mobile geral

**Arquivos:** `DevPage.tsx`, `DashboardPage.tsx`, `TurmaDetalhePage.tsx`, `RelatorioDetalhePage.tsx`

- DevPage: tabela de permissões com scroll horizontal, cards responsivos
- Dashboard: KPIs em `grid-cols-2` no mobile, gráficos com altura responsiva
- TurmaDetalhePage: tabela de participantes responsiva com cards no mobile
- RelatorioDetalhePage: layout de fotos `grid-cols-1` no mobile

---

### 3. Fotos no relatório de atividades

**Arquivo:** `src/pages/relatorios/RelatorioDetalhePage.tsx`

As fotos **já são exibidas** (linhas 157-169). Melhorias:
- Adicionar lightbox/modal ao clicar na foto para ver em tela cheia
- Melhorar grid: `grid-cols-1 sm:grid-cols-2 md:grid-cols-3`
- Adicionar contagem de fotos no header da seção

---

### 4. Gerador de publicação Instagram via IA

**Novos arquivos:**
- `supabase/functions/generate-instagram-post/index.ts` — Edge Function usando Lovable AI
- Botão "Gerar Post Instagram" na `RelatorioDetalhePage.tsx`

**Fluxo:**
1. Botão "📸 Gerar Post" no relatório, ao lado de Exportar
2. Envia dados do relatório (atividade, turma, competências, observações) para edge function
3. Edge function usa Lovable AI (google/gemini-3-flash-preview) com prompt:
   - "Transforme este relatório de atividade em um texto para Instagram. Inicie SEMPRE com 'CAIA MEDIANEIRA 🌍'. Tom humanizado, atencioso e profissional. Destaque o que foi feito e o impacto nos participantes. Máximo 2200 caracteres. Inclua hashtags relevantes."
4. Resultado exibido em um Dialog/Sheet com:
   - Texto gerado (editável)
   - Botão "Copiar Texto" (clipboard)
   - Botão "Compartilhar via WhatsApp" → abre `https://wa.me/?text={texto_encodado}`
   - Galeria das fotos do relatório com botão "Baixar Fotos" para salvar individualmente
5. O usuário copia o texto, baixa as fotos e envia tudo pro marketing via WhatsApp

---

### 5. Dashboard: novos indicadores e visual

**Arquivos:** `useDashboardData.ts`, `DashboardPage.tsx`

Novos indicadores:
- **Participantes por período** (manhã/tarde/integral) — pie chart
- **Taxa de frequência geral** (total presenças / total registros)
- **Top 5 educadores por relatórios** — bar chart horizontal
- **Participantes em alerta** (3+ faltas seguidas ou adesão < 65%) — KPI card com badge vermelho

Melhorias visuais:
- Gradientes sutis nos KPI cards
- Ícones coloridos por categoria
- Melhor espaçamento e tipografia
- Cards com hover effect

**Dados adicionais no hook:** buscar `presenca` para calcular frequência geral e alertas.

---

### 6. Alertas de busca ativa nas turmas

**Arquivo:** `src/pages/turmas/TurmaDetalhePage.tsx`

**Lógica de alerta:**
- Consultar tabela `presenca` para cada participante da turma
- Calcular: 3+ faltas consecutivas **OU** % adesão < 65%
- Exibir ícone de alerta (⚠️ triangulo amarelo/vermelho) ao lado do nome na tabela de participantes
- Tooltip com motivo: "3 faltas seguidas" ou "Adesão: 42%"

**Exportar relatório de busca ativa:**
- Botão "Exportar Busca Ativa" no header da turma (aparece só se houver alertas)
- Gera DOCX com:
  - Cabeçalho: "RELATÓRIO DE BUSCA ATIVA — [Nome da Turma] — [Data]"
  - Info da turma (bairro, período, educador)
  - Tabela com colunas: Nome | Idade | Responsável | Telefone | Endereço | Última Presença | Motivo Alerta
- Busca dados completos do participante (responsável, telefone, endereço) para preencher

**Dados necessários:** Para cada participante da turma, buscar registros de `presenca` ordenados por data e calcular sequência de faltas e % adesão.

---

### Resumo de arquivos

| Arquivo | Ação |
|---|---|
| Migration SQL | Ajustar DELETE policies (planejamentos e relatórios) |
| `src/pages/dev/DevPage.tsx` | Matriz de permissões visual + mobile |
| `src/pages/relatorios/RelatorioDetalhePage.tsx` | Lightbox fotos + botão gerar post Instagram |
| `supabase/functions/generate-instagram-post/index.ts` | Edge function IA para texto Instagram |
| `src/hooks/useDashboardData.ts` | Novos indicadores (frequência, período, alertas) |
| `src/pages/dashboard/DashboardPage.tsx` | Novos gráficos + visual aprimorado |
| `src/pages/turmas/TurmaDetalhePage.tsx` | Alertas de busca ativa + exportação DOCX |

