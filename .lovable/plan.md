

# Plano Atualizado — Fase 1 SysELO (com Backup, Exportacao em Massa e Dashboard)

## Resumo das Adicoes

Incluir no plano: (1) pagina de Banco de Dados interativo com backup/exportacao completa zipada, (2) exportacao em massa por intervalo de data com arquivos nomeados por padrao rastreavel, (3) dashboard de gestao com indicadores quantitativos.

---

## Novas Rotas

```text
/banco-de-dados          — Interacao com dados brutos + exportacao em massa
/dashboard               — Painel de indicadores de gestao
```

## Sidebar atualizada

Adicionar dois itens: "Banco de Dados" (icone Database) e "Dashboard" (icone LayoutDashboard), totalizando 8 itens no menu.

---

## 11. Banco de Dados + Backup + Exportacao em Massa

### Pagina `/banco-de-dados`

**Interface com abas**: Participantes | Turmas | Presenca | Relatorios | Planejamentos | Profissionais

Cada aba:
- Tabela interativa com todas as colunas, busca, filtros contextuais, ordenacao, paginacao (50/pagina)
- Contagem total de registros

**Exportacao individual por aba**: botao com dropdown PDF / XLSX / DOCX (dados filtrados)

**Padrao de nomenclatura dos arquivos**:
```text
SysELO_{categoria}_{YYYY-MM-DD}_{HHmmss}.{ext}
Exemplos:
  SysELO_Participantes_2026-03-27_143022.xlsx
  SysELO_Relatorio_Atividade_2026-03-15_091500.docx
  SysELO_Presenca_Mar2026_2026-03-27_143022.pdf
```

**Exportacao em massa por intervalo de data**:
- Seletor de data inicio/fim
- Checkboxes para selecionar categorias a incluir (Participantes, Turmas, Presenca, Relatorios, Planejamentos)
- Gera arquivo ZIP com estrutura de pastas:

```text
SysELO_Backup_{YYYY-MM-DD}_{HHmmss}.zip
├── Participantes/
│   └── SysELO_Participantes_2026-03-27.xlsx
├── Turmas/
│   └── SysELO_Turmas_2026-03-27.xlsx
├── Presenca/
│   └── SysELO_Presenca_2026-03-27.xlsx
├── Relatorios/
│   ├── SysELO_Relatorios_Dados_2026-03-27.xlsx
│   └── modelos/
│       ├── SysELO_Relatorio_Atividade_2026-03-15.docx
│       └── SysELO_Relatorio_Atividade_2026-03-20.docx
├── Planejamentos/
│   ├── SysELO_Planejamentos_Dados_2026-03-27.xlsx
│   └── modelos/
│       ├── SysELO_Planejamento_TituloAtividade_2026-03-10.docx
│       └── ...
└── Profissionais/
    └── SysELO_Profissionais_2026-03-27.xlsx
```

- Dados brutos em XLSX + documentos individuais em DOCX dentro dos modelos institucionais
- Usa `JSZip` no frontend para montar o arquivo ZIP

### Implementacao tecnica

| Arquivo | Acao |
|---------|------|
| `src/pages/banco-dados/BancoDadosPage.tsx` | Criar — pagina com Tabs, tabelas, filtros, exportacao |
| `src/components/DataTable.tsx` | Criar — componente tabela reutilizavel com busca/filtro/paginacao/sort |
| `src/hooks/useDataExport.ts` | Criar — logica de exportacao PDF/XLSX/DOCX + ZIP em massa |
| `src/hooks/useBackupExport.ts` | Criar — orquestra fetch de todas as categorias + monta ZIP |

Bibliotecas: `SheetJS (xlsx)`, `jsPDF + jspdf-autotable`, `docx`, `JSZip`, `file-saver`

---

## 12. Dashboard de Gestao

### Pagina `/dashboard`

Painel com cards e graficos calculados a partir dos dados existentes nas tabelas.

**Indicadores principais (cards)**:
- Total de participantes ativos
- Total de turmas ativas
- Total de relatorios no periodo
- Media geral do Score ELO
- % media de adesao (presenca)
- Total de planejamentos no periodo

**Graficos e analises**:
- Distribuicao de participantes por faixa etaria (bar chart)
- Distribuicao por genero (pie chart)
- Distribuicao por bairro (bar chart)
- Evolucao do Score ELO ao longo do tempo (line chart, por mes)
- % de adesao mensal (line chart)
- Competencias ELO comparadas (radar chart — Iniciativa, Autonomia, Colaboracao, Comunicacao, Respeito Mutuo)
- Objetivo alcancado vs parcial vs nao alcancado (stacked bar)
- Ranking de turmas por frequencia media

**Filtros do dashboard**:
- Periodo (mes/ano ou intervalo de datas)
- Turma especifica ou todas
- Educador especifico ou todos

**Fonte de dados**: queries ao Supabase agregando `relatorios_atividade`, `presenca`, `participantes`, `turmas`

### Implementacao tecnica

| Arquivo | Acao |
|---------|------|
| `src/pages/dashboard/DashboardPage.tsx` | Criar — layout com cards + graficos |
| `src/hooks/useDashboardData.ts` | Criar — queries agregadas ao Supabase |
| `src/components/AppSidebar.tsx` | Editar — adicionar Dashboard e Banco de Dados |
| `src/App.tsx` | Editar — adicionar rotas /dashboard e /banco-de-dados |

Graficos: usa `recharts` (ja disponivel via shadcn/ui chart components)

---

## Plano completo revisado — ordem de etapas

1. Design system + Layout (feito)
2. Autenticacao (feito)
3. Banco de dados — migrations (feito)
4. Cadastro de participantes (feito)
5. Importacao em lote
6. Gestao de turmas (feito)
7. Presenca digital + exportacao
8. Planejamento de atividades (feito)
9. Relatorio de atividades (feito)
10. Integracao presenca - relatorio
11. **Banco de Dados + Backup + Exportacao em Massa** (novo)
12. **Dashboard de Gestao** (novo)

