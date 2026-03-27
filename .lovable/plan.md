

## Plano: Exportação baseada em modelo DOCX institucional

### Ideia central
Em vez de construir o documento do zero com `docx-js`, o sistema vai **carregar o modelo DOCX institucional original** que você enviou, localizar as tags (ex: `{DATA}`, `{EDUCADOR}`, `{TURMA}`) e **preencher automaticamente** com os dados do banco. Assim o layout, fontes, margens e formatação ficam **exatamente** como no seu modelo. O mesmo documento preenchido é exportado em DOCX e convertido para PDF.

### Como funciona

1. **Templates armazenados no Storage** — Os modelos DOCX institucionais (Relatório, Planejamento, Ficha de Inscrição, Matriz de Frequência) ficam salvos em um bucket `templates` no backend. A coordenação pode subir novos modelos quando quiser.

2. **Biblioteca `docxtemplater`** — Substitui a `docx-js` para exportação. Ela abre o `.docx` original como ZIP, encontra as tags `{TAG}` dentro do XML e preenche com os valores correspondentes. Suporta:
   - Tags simples: `{DATA}`, `{EDUCADOR}`, `{NOME_ATIVIDADE}`
   - Loops (tabelas de presença): `{#PRESENCA}{NOME} {STATUS}{/PRESENCA}`
   - Checkboxes condicionais: `{CHECK_ENGAJAMENTO_1}`
   - Cores Likert nos campos de competência

3. **Mapeamento de tags** — Cada tipo de documento tem um mapeamento fixo:
   - Relatório: `{DATA}` → `item.data`, `{EDUCADOR}` → `item.profiles.nome`, `{SCORE_ELO}` → `item.score_elo`, etc.
   - Planejamento: `{TITULO}` → `item.titulo`, `{TEMA}` → `item.tema`, etc.
   - Ficha: `{NOME_COMPLETO}` → `p.nome_completo`, `{CPF}` → `p.cpf`, etc.

4. **Exportação PDF** — Após preencher o DOCX via `docxtemplater`, o mesmo conteúdo é replicado com `jsPDF` seguindo a mesma estrutura visual (cabeçalho institucional completo, tabelas formatadas, cores Likert, checkboxes).

5. **Página de gestão de templates** — Tela simples (acessível à coordenação) para upload/substituição dos modelos DOCX.

### Arquivos

| Arquivo | Ação |
|---|---|
| `src/hooks/useDocumentExport.ts` | Reescrever — usar `docxtemplater` para carregar template do Storage e preencher tags; reescrever funções PDF para espelhar o layout do template |
| `src/pages/dashboard/DashboardAdminTab.tsx` | Editar — adicionar seção de upload/gestão dos templates DOCX |
| Migration SQL | Criar bucket `templates` no Storage com policies para coordenação |
| `package.json` | Adicionar `docxtemplater`, `pizzip` |

### Fluxo do usuário
1. Coordenação faz upload do modelo DOCX com as tags nos campos
2. Educador abre um relatório → clica "Exportar DOCX" → sistema baixa o template, preenche as tags, gera o arquivo
3. Educador clica "Exportar PDF" → mesmo conteúdo, formatado identicamente em PDF

### Detalhes técnicos
- `docxtemplater` + `pizzip` para manipulação do DOCX template
- Templates baixados do bucket `templates` via `supabase.storage.from('templates').download('relatorio.docx')`
- Cache local do template para evitar downloads repetidos
- Fallback: se não houver template no Storage, usa a geração atual como backup

