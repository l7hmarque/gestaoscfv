## Objetivo

Corrigir 2 problemas no Relatório Mensal Consolidado XLSX e 1 no Relatório de Atividade Google Docs sincronizados ao Drive.

> Observação sobre o ponto do "ver no Google Drive": tanto o botão da página do relatório quanto a sincronização chamam a **mesma** edge function `generate-relatorio-gdoc`. Os docs que estão "corretos" pela página são versões **cacheadas** (já existiam com `gdoc_url`/`gdoc_id` salvos antes — ou foram editados manualmente no Drive). A sincronização gera docs novos para relatórios sem `gdoc_url`, expondo a saída real do gerador atual — que precisa ser ajustada para refletir o modelo institucional.

---

## Mudanças

### 1. `generate-relatorio-mensal` — Matriz de Frequência por turma

Arquivo: `supabase/functions/generate-relatorio-mensal/index.ts` (bloco da matriz, linhas ~503–622).

**a) Janela efetiva por participante** — combinar 3 fontes:

- Entrada efetiva = `max(turma_participantes.data_entrada, participantes.iniciou_em)`.
- Saída efetiva = `min(turma_participantes.data_saida, participantes.data_desligamento + 1 dia)` quando `status='desligado'`.
- Se sem entrada: assumir `1900-01-01`. Se sem saída: assumir aberta.

**b) Greying unificado** — qualquer data fora da janela efetiva (antes da entrada OU a partir da saída) recebe célula cinza com borda. Isso resolve ambos os pontos:

- Participante novo (iniciou_em > 01/abril) → dias 01..(iniciou_em-1) viram cinza.
- Desligado pré-mês (data_desligamento < 01/abril) → mês inteiro cinza, linha continua na lista com sufixo `(D dd/mm)`.
- Desligado mid-month → dias após data_desligamento ficam cinza (hoje vinham marcados com "D" preto destacado — passa a ser cinza simples; o sufixo `(D dd/mm)` no nome já comunica o desligamento).

**c) Atualizar legenda** (linha 547):  
`Legenda: ■ presente · vazio = ausente · cinza = fora do vínculo (não matriculado, já saiu ou desligado) · "(D dd/mm)" no nome = desligado · "(BA)" = busca ativa`.

Sem mudança em outras planilhas (Resumo/Atividades/Metas já filtravam corretamente via `atendidosFiltered`).

### 2. `generate-relatorio-gdoc` — produzir o corpo institucional correto

Arquivo: `supabase/functions/generate-relatorio-gdoc/index.ts`.

A função hoje copia o template (que tem timbre/cabeçalho/rodapé), apaga TODO o body e injeta um corpo simplificado com 7 seções planas. Falta paridade com o modelo institucional já implementado no DOCX (`src/hooks/useDocumentExport.ts:buildRelatorioDocxBlob` linhas 466+), que é o que a coordenação aprovou.

Reescrever a montagem do body para espelhar fielmente esse builder DOCX:

**Seções na ordem:**

1. Banner preto com texto em branco negrito centralizado: **RELATÓRIO DE ATIVIDADE**
2. Bloco "DADOS DA ATIVIDADE" — Data, Dia da Semana, Educador(a), Turma(s), Tipo, Nome da Atividade
3. **ENGAJAMENTO** — uma linha por opção com ■/☐
4. **COMPETÊNCIAS TRABALHADAS** — bullet por competência com nível textual + linha "Score ELO: X"
5. **RESUMO DE FREQUÊNCIA** — Presentes/Ausentes/Adesão
6. **OBJETIVO** — alcançado/parcial/não
7. **ATIVIDADES REALIZADAS** — texto livre
8. **OBSERVAÇÕES** — texto livre
9. **INTERVENÇÕES** (se houver) — texto livre
10. **SITUAÇÕES RELEVANTES** (se houver, da equipe técnica) — bullets
11. Banner branco centralizado: **ANEXO I — LISTA DE FREQUÊNCIA**
12. Cabeçalho do anexo (Atividade/Data/Turmas/Educador)
13. Lista numerada `NN. ■|☐ Nome (justificativa se ausente; "(BA)" se busca ativa)`
14. Linha de assinatura

**Estilos a aplicar via batchUpdate:**

- Banner preto com texto branco negrito.
- Banner branco.
- Títulos de seção (DADOS DA ATIVIDADE, ENGAJAMENTO, etc.): bold 12pt + paragraphStyle HEADING_3.
- Score ELO: bold.
- Demais linhas: normal 12pt.
- Espaços em branco entre seções: 1 parágrafo vazio.

**Buscar dados adicionais** que o builder DOCX usa e que o gdoc atual ignora:

- `intervencoes`, `situacoes_relevantes` (já no `rel.*`).
- Status `busca_ativa` em `participantes` (join leve no select de `relatorio_presenca` para o sufixo "(BA)").

**Forçar regeneração das versões antigas:** adicionar opção `force: true` no caminho da sync (`sync-drive-modelos` → `invokeFn(..., { relatorioId: rel.id, force: true })`) **somente** quando o Drive ainda não tem o arquivo na pasta correta. Como a sync já recopia/move por nome, e a maioria dos docs cacheados estão fora da estrutura de pastas, simplesmente passar `force: true` na chamada do worker garante que o conteúdo atualizado seja gerado nesta sincronização.

Manter idempotência (`gdoc_id`/`gdoc_url`), permissões públicas, naming.

---

## Detalhes técnicos

- `generate-relatorio-mensal`: a janela efetiva é calculada uma vez por participante antes do loop de datas (`effEntrada`, `effSaida`); o teste `foraDaJanela` vira `(effEntrada && d < effEntrada) || (effSaida && d >= effSaida)`. Removida a marcação especial "D" em célula (vai virar cinza como o resto).
- `generate-relatorio-gdoc`: manter a estratégia atual de construir `lines[]` + `insertText` reverso + `styleOps`; só expandir o array de linhas e estilos para o conjunto institucional acima.
- `sync-drive-modelos`: única linha alterada (passar `force: true` no payload do `relatorios`).
- Sem migração de banco. Sem mudança no frontend.

---

## Arquivos afetados

- `supabase/functions/generate-relatorio-mensal/index.ts` — bloco da matriz de frequência (janela efetiva + greying unificado + legenda).
- `supabase/functions/generate-relatorio-gdoc/index.ts` — reescrita do `lines[]` para refletir o modelo institucional completo.
- `supabase/functions/sync-drive-modelos/index.ts` — `force: true` na invocação por relatório.