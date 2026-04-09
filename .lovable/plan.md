

## Plano: 4 melhorias — REO unificado, cabeçalho institucional XLSX, exclusão de atendimentos, página de configurações

### 1. REO unificado entre Financeiro e Exportar Relatórios

**Problema**: O REO gerado no Financeiro e na página de Exportar Relatórios podem divergir.

**Solução**: Ambos já chamam a mesma edge function `generate-reo`. Garantir que o `FinanceiroPage` use exatamente a mesma chamada (`supabase.functions.invoke("generate-reo")`) e remover qualquer lógica local duplicada de geração de REO no financeiro. Ambas as páginas passarão os mesmos parâmetros para a edge function, garantindo dados idênticos e atualizados.

### 2. Cabeçalho institucional em todos os XLSX

**Problema**: Os relatórios XLSX não possuem cabeçalho institucional padronizado.

**Solução**: Em todos os locais que geram XLSX (ExportarRelatoriosPage, FinanceiroPage, EquipeTecnicaPage, e a edge function generate-reo), adicionar nas 3 primeiras linhas de cada aba:

```
Linha 1: "Sociedade Civil Nossa Senhora Aparecida"
Linha 2: "Centro de Atenção Integral ao Adolescente - Medianeira"  
Linha 3: [Título da aba/seção]
```

Com estilização: negrito, fonte maior, merge de colunas, e separação visual antes dos dados.

**Arquivos afetados**:
- `src/pages/relatorios/ExportarRelatoriosPage.tsx` — todas as abas do relatório mensal e prestação de contas
- `src/pages/financeiro/FinanceiroPage.tsx` — prestação de contas XLSX
- `src/pages/equipe-tecnica/EquipeTecnicaPage.tsx` — relatório da equipe técnica XLSX
- `supabase/functions/generate-reo/index.ts` — abas do REO XLSX

Criar uma função helper `addInstitutionalHeader(ws, title, colCount)` reutilizável.

### 3. Exclusão de atendimentos na Equipe Técnica

**Problema**: Não existe opção de deletar atendimentos. Super admin (coordenação) deve poder deletar sem justificativa; equipe técnica com justificativa.

**Solução** em `EquipeTecnicaPage.tsx`:
- Adicionar coluna "Ações" na tabela de atendimentos com botão de exclusão
- Verificar role do usuário (`coordenacao` ou `tecnico`) via `user_roles`
- Se `coordenacao`: deletar direto, sem justificativa obrigatória
- Se `tecnico`: abrir dialog com campo de justificativa obrigatório
- Registrar no `audit_log` com ação `exclusao_atendimento`
- RLS já permite delete para `tecnico` e `coordenacao`

### 4. Página de Configurações Gerais (Super Admin)

**Problema**: Não existe uma página centralizada de configurações do sistema.

**Solução**: Criar `/configuracoes` com acesso restrito a `coordenacao`, contendo:

| Seção | Funcionalidade |
|---|---|
| **Instituição** | Nome da entidade, endereço, CNPJ, logo (upload), dados do convênio |
| **Bairros e Metas** | CRUD de bairros SCFV e metas por bairro (crianças manhã/tarde, idosos) — atualmente hardcoded |
| **Pontos de Transporte** | Gerenciar pontos e horários (já existe parcialmente) |
| **Tipos de Atividade** | Gerenciar lista de tipos de atendimento e atividades |
| **Perfis e Cargos** | Visualizar profissionais ativos, alterar cargos |
| **Templates DOCX** | Migrar a funcionalidade de upload de templates que está na aba Admin do Dashboard |
| **Segurança** | Timeout de sessão, configurações de auditoria |
| **Backup/Exportação** | Exportação completa do banco de dados |

**Nota**: Nesta primeira versão, implementar as seções **Instituição** (com tabela `configuracoes_gerais` no banco) e **Bairros e Metas** (migrar de constantes hardcoded para tabela). As demais seções serão planejadas para iterações futuras, mantendo os placeholders visíveis.

**Novos recursos de banco**:
- Tabela `configuracoes_gerais` (chave-valor) para dados institucionais
- Migrar `METAS_BAIRRO` e `BAIRROS_SCFV` de constantes hardcoded para a tabela `bairros` (adicionar colunas `meta_criancas_manha`, `meta_criancas_tarde`, `meta_idosos`)

**Arquivos afetados**:
- `src/pages/configuracoes/ConfiguracoesPage.tsx` — **novo**
- `src/App.tsx` — nova rota `/configuracoes`
- `src/components/AppSidebar.tsx` — novo link "Configurações" na seção Gestão
- Migration SQL para `configuracoes_gerais` e colunas de metas em `bairros`

### Resumo de arquivos

| Arquivo | Ação |
|---|---|
| `supabase/functions/generate-reo/index.ts` | Cabeçalho institucional nas abas XLSX |
| `src/pages/relatorios/ExportarRelatoriosPage.tsx` | Cabeçalho institucional + garantir REO via edge function |
| `src/pages/financeiro/FinanceiroPage.tsx` | Cabeçalho institucional XLSX + unificar REO |
| `src/pages/equipe-tecnica/EquipeTecnicaPage.tsx` | Cabeçalho institucional + exclusão de atendimentos com role check |
| `src/pages/configuracoes/ConfiguracoesPage.tsx` | **Novo** — página de configurações |
| `src/App.tsx` | Rota `/configuracoes` |
| `src/components/AppSidebar.tsx` | Link configurações |
| Migration SQL | Tabela `configuracoes_gerais` + colunas de metas em `bairros` |

