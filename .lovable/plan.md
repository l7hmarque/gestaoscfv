

## Plano: Mapeamento de Tags DOCX na Aba Admin

### Resumo

Criar um recurso na aba Admin que:
1. Baixa cada template DOCX do storage
2. Extrai todas as tags `{TAG}` encontradas no XML interno
3. Mostra uma interface para o usuario mapear cada tag a um campo de dados do sistema
4. Salva os mapeamentos no banco de dados
5. O motor de exportacao usa esses mapeamentos em vez dos hardcoded

---

### 1. Nova tabela: `template_tag_mappings`

```sql
CREATE TABLE public.template_tag_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key text NOT NULL,        -- ex: "relatorio.docx"
  tag_name text NOT NULL,            -- ex: "DATA_ATIVIDADE"  
  data_field text NOT NULL,          -- ex: "data" (campo do sistema)
  created_at timestamptz DEFAULT now(),
  UNIQUE(template_key, tag_name)
);

ALTER TABLE public.template_tag_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read mappings" ON public.template_tag_mappings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Coordenacao manage mappings" ON public.template_tag_mappings
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'coordenacao'::app_role));
```

### 2. Extração de tags no client-side

Usar `PizZip` (já instalado) para abrir o DOCX no navegador, ler os arquivos XML internos e extrair todas as ocorrencias de `{PALAVRA}` via regex. Nao precisa de edge function — tudo roda no browser.

```typescript
async function extractTagsFromTemplate(templateKey: string): Promise<string[]> {
  const buffer = await loadTemplate(templateKey);
  if (!buffer) return [];
  const zip = new PizZip(buffer);
  const tags = new Set<string>();
  for (const fileName of Object.keys(zip.files)) {
    if (!fileName.endsWith(".xml")) continue;
    const content = zip.file(fileName)?.asText() || "";
    // Buscar {TAG} inclusive em runs fragmentados
    const cleaned = content.replace(/<[^>]+>/g, ""); // strip XML tags
    const matches = cleaned.matchAll(/\{([A-Z0-9_]+)\}/g);
    for (const m of matches) tags.add(m[1]);
  }
  return Array.from(tags).sort();
}
```

### 3. Interface na aba Admin

Novo componente `TemplateTagMapper` dentro de `DashboardAdminTab.tsx`:

- Botao "Mapear Tags" ao lado de cada template enviado
- Ao clicar, o sistema baixa o DOCX, extrai as tags, e abre um Dialog/Sheet
- Para cada tag encontrada, mostra um `<Select>` com os campos disponíveis do sistema:
  - **Relatório:** `data`, `dia_semana`, `profiles.nome` (educador), `turmas`, `tipo_atividade`, `nome_atividade`, `score_elo`, `iniciativa`, `autonomia`, `colaboracao`, `comunicacao`, `respeito_mutuo`, `pct_adesao`, `num_participantes`, `num_ausentes`, `objetivo_alcancado`, `intervencoes`, `observacoes`, engajamento/situacoes checkboxes, presenca loop
  - **Planejamento:** `titulo`, `data_aplicacao`, `educador`, `turmas`, `tema`, `questao_geradora`, `objetivos`, `roteiro`, `materiais`, `apoio_tecnico`, `forma_avaliacao`
  - **Ficha Inscrição:** todos os campos de `participantes`
  - **Matriz Frequência:** `turma`, `periodo`, `faixa_etaria`, datas, participantes loop
- Botao "Salvar Mapeamento" grava tudo na tabela `template_tag_mappings`
- Tags ja mapeadas aparecem pre-selecionadas ao reabrir

### 4. Motor de exportação usa mapeamentos

Em `useDocumentExport.ts`, ao preencher o template:
1. Carregar mapeamentos da tabela `template_tag_mappings` para o template
2. Construir o objeto de dados usando os mapeamentos em vez dos nomes hardcoded
3. Se nao houver mapeamento salvo, usar os nomes das tags diretamente (comportamento atual como fallback)

### 5. Auto-match inteligente

Ao abrir o mapeador, o sistema tenta sugerir automaticamente o campo correto baseado no nome da tag (ex: `{DATA}` → `data`, `{EDUCADOR}` → `profiles.nome`). O usuario so precisa confirmar ou ajustar.

---

### Arquivos modificados

| Arquivo | Mudanca |
|---|---|
| Migracao SQL | Criar tabela `template_tag_mappings` |
| `src/pages/dashboard/DashboardAdminTab.tsx` | Adicionar botao "Mapear Tags" e componente de mapeamento |
| `src/hooks/useDocumentExport.ts` | Carregar mapeamentos e usar no `fillTemplate` |

