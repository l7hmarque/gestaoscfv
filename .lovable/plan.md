

## Plano: Corrigir mapeamento de tags + Módulo de Orçamentos/Mapa Comparativo + Upload de novos templates

---

### Parte 1 — Corrigir mapeamento automático de tags (AUTO_MATCH)

Os templates enviados usam tags com casing/nomes diferentes do que o `AUTO_MATCH` espera. Problemas encontrados:

| Tag no template | AUTO_MATCH atual | Problema |
|---|---|---|
| `{nomegrupo}` | `NOME_GRUPO` | Lowercase, não bate |
| `{JUST_DESLIG}` | `JUST_DESLG` | Nome diferente |
| `{responsavel2}` | `RESPONSAVEL2_NOME` | Lowercase |
| `{VINCULO_RESP1}` | — | Não existe |
| `{VINCULO_RESP2}` | — | Não existe |
| `{REMEDIO}` | — | Não existe |
| `{outras_cond}` | — | Não existe |
| `{EDUCADOR}` | `profiles.nome` | Já funciona via AUTO_MATCH |

**Correções em `TemplateTagMapper.tsx`:**
- Adicionar variantes lowercase ao `AUTO_MATCH`: `nomegrupo`, `responsavel2`, `outras_cond`
- Adicionar novas tags: `JUST_DESLIG`, `VINCULO_RESP1`, `VINCULO_RESP2`, `REMEDIO`, `outras_cond`
- Adicionar novos campos em `SYSTEM_FIELDS["ficha_inscricao.docx"]`

**Correções em `useDocumentExport.ts` (`buildFichaTemplateData`):**
- Adicionar `JUST_DESLIG` (alias de `JUST_DESLG`), `VINCULO_RESP1`, `VINCULO_RESP2`, `REMEDIO`, `outras_cond`, `nomegrupo`, `responsavel2`

**Migração SQL:**
- Adicionar colunas na tabela `participantes`: `vinculo_resp1 text`, `vinculo_resp2 text`, `remedio_continuo text`, `outras_condicoes text`

**UI — `ParticipantePerfilPage.tsx` e `ParticipanteNovoPage.tsx`:**
- Adicionar campos no formulário: "Vínculo Resp. 1", "Vínculo Resp. 2", "Remédio Contínuo", "Outras Condições"

**UI — `MatriculaPublicaPage.tsx`:**
- Adicionar campo "Vínculo" junto ao responsável

---

### Parte 2 — Módulo de Orçamentos e Mapa Comparativo (dentro do Financeiro)

#### Arquitetura de dados

**Tabela `orcamentos`:**
```sql
CREATE TABLE orcamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  objeto text,
  mes_referencia text NOT NULL,
  status text NOT NULL DEFAULT 'rascunho', -- rascunho, cotacao, aprovado, cancelado
  fornecedor_vencedor text,
  cnpj_vencedor text,
  data_aprovacao date,
  categoria_id uuid,
  observacoes text,
  created_at timestamptz DEFAULT now()
);
```

**Tabela `orcamento_itens`:**
```sql
CREATE TABLE orcamento_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  orcamento_id uuid NOT NULL REFERENCES orcamentos(id) ON DELETE CASCADE,
  item_num integer NOT NULL,
  descricao text NOT NULL,
  unidade_medida text DEFAULT 'UNID',
  quantidade numeric NOT NULL DEFAULT 1,
  created_at timestamptz DEFAULT now()
);
```

**Tabela `orcamento_cotacoes`** (3 fornecedores por orçamento):
```sql
CREATE TABLE orcamento_cotacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  orcamento_id uuid NOT NULL REFERENCES orcamentos(id) ON DELETE CASCADE,
  fornecedor_nome text NOT NULL,
  cnpj text,
  data_emissao date,
  data_validade date,
  created_at timestamptz DEFAULT now()
);
```

**Tabela `orcamento_precos`** (preço de cada item por cotação):
```sql
CREATE TABLE orcamento_precos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cotacao_id uuid NOT NULL REFERENCES orcamento_cotacoes(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES orcamento_itens(id) ON DELETE CASCADE,
  preco_unitario numeric NOT NULL DEFAULT 0,
  observacao text,
  created_at timestamptz DEFAULT now()
);
```

RLS: SELECT para authenticated, INSERT/UPDATE/DELETE para coordenacao + tecnico.

#### Fluxo na UI (nova aba "Orçamentos" no FinanceiroPage)

1. **Lista de orçamentos** com status (badge colorido), filtro por mês
2. **Criar orçamento**: título, objeto, categoria financeira, mês de referência
3. **Adicionar itens**: nº, descrição detalhada, unidade, quantidade
4. **Adicionar 3 cotações** (fornecedores): razão social, CNPJ, datas
5. **Preencher preços** por item para cada fornecedor
6. **Mapa Comparativo automático**: tabela que calcula menor preço por item e indica fornecedor vencedor
7. **Botão "Aprovar Orçamento"**: 
   - Marca status = `aprovado`
   - Lança automaticamente uma despesa na tabela `despesas` com os dados do fornecedor vencedor (valor total, fornecedor, CNPJ, categoria, mês)
   - Vincula via `lote_id` ou campo `orcamento_id` (adicionar coluna `orcamento_id uuid` na tabela `despesas`)
8. **Exportar**: 
   - "Exportar Orçamento (XLSX)" — formato do modelo `modelo_orcamento_padrao_3.xlsx` (cabeçalho institucional, 1 fornecedor por folha)
   - "Exportar Mapa Comparativo (XLSX)" — formato do modelo `Mapa_Comparativo_de_Preços_1.xlsx` (3 fornecedores lado a lado, cálculo de menor preço)
   - Ambos disponíveis em PDF também

#### Exportação XLSX (usando xlsx-js-style)

- Reproduzir layout institucional: cabeçalho com dados da entidade, tabela com bordas, totais, assinaturas
- Orçamento: 1 aba por fornecedor cotado (preenchido com dados)
- Mapa Comparativo: tabela comparativa com colunas lado a lado, fórmulas de menor preço, fornecedor ganhador

---

### Parte 3 — Upload automático dos novos templates

**Ação:** Copiar os 3 DOCX enviados para o bucket `templates` do Storage via código, substituindo os modelos antigos:
- `SysELO_v1.0_Modelo_Relatorio_de_Atividades_Padrao_1.docx` → `relatorio.docx`
- `SysELO_v1.0_Ficha_de_Inscricao_e_Cadastro_1.docx` → `ficha_inscricao.docx`
- `SysELO_v1.0_Modelo_de_Planejamento_Padrao_1.docx` → `planejamento.docx`

Após upload, invalidar cache de mapeamentos para forçar releitura das tags.

---

### Resumo de arquivos e mudanças

| Arquivo | Mudança |
|---|---|
| Migração SQL | ADD colunas `vinculo_resp1`, `vinculo_resp2`, `remedio_continuo`, `outras_condicoes` em participantes. CREATE tabelas `orcamentos`, `orcamento_itens`, `orcamento_cotacoes`, `orcamento_precos` com RLS. ADD `orcamento_id` em `despesas`. |
| `src/components/TemplateTagMapper.tsx` | Novas entradas em SYSTEM_FIELDS e AUTO_MATCH (vinculo, remedio, outras_cond, nomegrupo, JUST_DESLIG) |
| `src/hooks/useDocumentExport.ts` | Novos campos em `buildFichaTemplateData` |
| `src/pages/participantes/ParticipantePerfilPage.tsx` | Campos: Vínculo Resp 1/2, Remédio, Outras Condições |
| `src/pages/participantes/ParticipanteNovoPage.tsx` | Mesmos campos novos |
| `src/pages/matricula/MatriculaPublicaPage.tsx` | Campo vínculo do responsável |
| `supabase/functions/public-matricula/index.ts` | Aceitar campo vínculo |
| `src/pages/financeiro/FinanceiroPage.tsx` | Nova aba "Orçamentos" com CRUD completo, mapa comparativo, aprovação, exportação XLSX/PDF |
| `src/hooks/useDataExport.ts` | Funções de exportação XLSX institucional para orçamento e mapa comparativo |

