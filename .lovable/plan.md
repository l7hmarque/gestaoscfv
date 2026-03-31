

## Plano: DOCX template, Relatório Mensal, Dashboard por Turma, e Ranking de Atividades

---

### 1. Corrigir DOCX template — delimitadores `{ }`

**Problema:** O usuario trocou as tags nos templates para `{TAG}` mas o codigo ainda usa `delimiters: { start: "<<", end: ">>" }` e o `cleanXmlRuns` procura por `&lt;&lt;`/`&gt;&gt;`.

**Arquivo:** `src/hooks/useDocumentExport.ts`

- Remover a config `delimiters` do Docxtemplater (voltar ao padrao `{ }`)
- Reescrever `cleanXmlRuns` para unificar runs fragmentados entre `{` e `}` (que no XML aparecem como texto normal, nao entidades)
- O regex precisa buscar runs quebrados entre `{` e `}` dentro de `<w:t>` tags
- Manter try/catch com fallback em todas as funcoes de export

```typescript
// cleanXmlRuns: merge runs splitting { and }
// No XML, { e } sao caracteres normais (nao entidades), entao basta unificar runs entre { e }
function cleanXmlRuns(zip: PizZip): void {
  const xmlFiles = Object.keys(zip.files).filter(f => f.endsWith(".xml"));
  for (const fileName of xmlFiles) {
    let content = zip.file(fileName)?.asText();
    if (!content || !content.includes("{")) continue;
    for (let pass = 0; pass < 10; pass++) {
      let changed = false;
      content = content.replace(
        /(\{[^}]*?)(<\/w:t>\s*<\/w:r>\s*<w:r(?:\s[^>]*)?>(?:\s*<w:rPr>[\s\S]*?<\/w:rPr>)?\s*<w:t(?:\s[^>]*)?>)([^{]*?\})/g,
        (_m, before, _boundary, after) => { changed = true; return before + after; }
      );
      if (!changed) break;
    }
    zip.file(fileName, content);
  }
}

// fillTemplate: remover delimiters customizado
const doc = new Docxtemplater(zip, {
  paragraphLoop: true,
  linebreaks: true,
  // delimiters padrao { } — nao precisa especificar
});
```

---

### 2. Corrigir Relatório Mensal XLSX

**Problema:** O relatorio provavelmente falha silenciosamente quando nao ha dados de presenca ou turmas. O `generate()` nao tem try/catch e o `setGenerating(false)` nao executa em caso de erro.

**Arquivo:** `src/pages/dashboard/DashboardRelatorioMensalTab.tsx`

- Envolver todo o `generate()` em try/catch/finally com `setGenerating(false)` no finally
- Gerar o relatorio mesmo sem presenca (mostrar "0 atendidos", sheets vazias)
- Adicionar toast.error em caso de excecao
- Garantir que nomes de sheets nao tenham caracteres invalidos e nao repitam

---

### 3. Dashboard simples na pagina da Turma

**Arquivo:** `src/pages/turmas/TurmaDetalhePage.tsx`

Adicionar secao de dashboard apos os badges, com cards mostrando:

- **Taxa de adesao** (% de presencas sobre total de registros)
- **Participantes presentes** (ultimo registro vs total de membros)
- **Score ELO** (mediana dos relatorios vinculados a turma, com desvio padrao)
- **Alertas** (participantes com 3+ faltas seguidas = busca ativa, ou adesao < 65%)

Buscar dados:
- `presenca` filtrado por `turma_id`
- `relatorio_turmas` + `relatorios_atividade` filtrado por `turma_id`

Exibir lista de **planejamentos** e **relatorios** associados a turma:
- Query `planejamento_turmas` WHERE `turma_id = id` → join `planejamentos`
- Query `relatorio_turmas` WHERE `turma_id = id` → join `relatorios_atividade`
- Listar como cards clicaveis com link para `/planejamentos/:id` e `/relatorios/:id`

---

### 4. Pagina de Relatorios — ver planejamento associado e ranking de atividades

**Arquivo:** `src/pages/relatorios/RelatoriosPage.tsx`

- Na listagem, mostrar badge com nome do planejamento vinculado (se existir)
- Buscar `planejamento_id` que ja vem no select, e fazer join com `planejamentos(titulo)`

**Arquivo:** `src/pages/relatorios/RelatorioDetalhePage.tsx`

- Ja mostra link para planejamento (implementado antes) — verificar se funciona

**Novo componente ou secao na pagina de Relatorios:**

Adicionar secao/aba "Ranking de Atividades" que mostra:
- Atividades planejadas ordenadas por melhor Score ELO medio
- Regras de classificacao:
  - Minimo 5 participantes para contar
  - Peso maior para relatorios com mais participantes (media ponderada)
  - Mostrar: nome da atividade, score ELO, nro de participantes, objetivo alcancado
- Query: todos os `relatorios_atividade` com `score_elo IS NOT NULL` e `planejamento_id IS NOT NULL`

---

### 5. Instagram post — remover preambulo

**Arquivo:** `supabase/functions/generate-instagram-post/index.ts`

Adicionar instrucoes explicitas no system message e no prompt:
```
system: "Retorne SOMENTE o texto da publicação. Nunca adicione frases introdutórias como 'Aqui está', 'Segue o texto', 'Com base no relatório'. Comece diretamente com o conteúdo."
```
E no prompt adicionar:
```
- NÃO inicie com frases introdutórias. Comece DIRETAMENTE com "CAIA MEDIANEIRA 🌍"
- Retorne APENAS o texto da publicação
```

---

### Arquivos modificados

| Arquivo | Mudanca |
|---|---|
| `src/hooks/useDocumentExport.ts` | Delimitadores `{ }`, reescrever cleanXmlRuns |
| `src/pages/dashboard/DashboardRelatorioMensalTab.tsx` | try/catch, gerar com dados parciais |
| `src/pages/turmas/TurmaDetalhePage.tsx` | Dashboard com ELO/adesao/alertas + lista de planejamentos e relatorios |
| `src/pages/relatorios/RelatoriosPage.tsx` | Badge de planejamento + secao ranking de atividades |
| `supabase/functions/generate-instagram-post/index.ts` | Remover preambulo IA |

