## Reorganização da `/documentos` — fim das duplicações

Objetivo: 1 lugar para cada documento, navegação previsível, sem sub-abas redundantes.

### Nova estrutura de `/documentos` (4 abas, sem sub-abas)

```text
/documentos
├── Presença          → Listas de Frequência e Chamada (Google Drive, mensal)
├── Atividades        → Pedagógico: lote DOCX/PDF/XLSX de relatórios de atividade
├── Gestão (restrita) → Institucional: Relatório Mensal SCFV, Anual, Atendimentos, Gestão 10 seções
└── Oficiais          → 4 documentos para a rede de proteção
```

Removendo as sub-abas internas (Atividades-lote/atalhos e Gestão-mensal/completo/rede), cada aba carrega direto sua tela única — ninguém mais precisa "encontrar" o botão.

### Mudanças concretas

**1. Aba Presença (/documentos)**
- Continua embutindo `PresencaExportarPage` (Lista de Frequência + Lista de Chamada).
- Banner explica que correções diárias seguem em `/presenca`.

**2. Página `/presenca` — remover aba Exportar**
- `PresencaPage` volta a ser página única de lançamento (sem `Tabs`, sem `?tab=exportar`).
- Redirect: `/presenca?tab=exportar` → `/documentos?tab=presenca` (ProtectedRoute redirect simples para não quebrar bookmarks).

**3. Aba Atividades (/documentos) — só pedagógico**
- Render direto do bloco **"Relatórios de Atividade em Lote"** extraído de `ExportarRelatoriosPage` (filtros: período + educador, formatos DOCX/PDF/XLSX). Hoje esse bloco está embutido no meio do `ExportarRelatoriosPage`; vou isolá-lo em um sub-componente exportado e reusar.
- Remover sub-aba "Atalhos" (Catálogo de Relatórios + Planejamentos já estão na sidebar).

**4. Aba Gestão (/documentos) — só institucional**
- Render direto de uma versão "podada" do `ExportarRelatoriosPage` contendo apenas: Relatório Mensal SCFV, Relatório Anual, Atendimentos Técnicos, Relatório de Gestão 10 seções.
- Remover sub-aba "Mensal Consolidado" (`DashboardRelatorioMensalTab` — mesmo dado do Mensal SCFV).
- Remover sub-aba "Integridade & Banco" (Integridade, Banco de Dados e Equipe Técnica continuam na sidebar).

**5. Aba Oficiais (/documentos) — 4 diálogos**
- Mantém: Ficha de Referenciamento, Faltas Consecutivas com Alerta, Cobertura de Público Prioritário, Relatório de Evasão.
- Remove cards e imports: `BoletimArticulacaoDialog`, `BoletimPedagogicoDialog`, `EncaminhamentosDialog`.
- Arquivos dos 3 diálogos removidos para não deixar código morto: `src/pages/relatorios/oficiais/BoletimArticulacaoDialog.tsx`, `BoletimPedagogicoDialog.tsx`, `EncaminhamentosDialog.tsx`.

**6. Remover `HubExportacoesPage` (catálogo paralelo)**
- Deletar `src/pages/relatorios/HubExportacoesPage.tsx`.
- Remover rota correspondente em `src/App.tsx` (e item de menu na `AppSidebar` se houver).
- Qualquer link para `/relatorios/hub` passa a apontar para `/documentos`.

### Detalhes técnicos

- **Refator de `ExportarRelatoriosPage`**: hoje é um único componente monolítico (~1144 linhas) que mistura pedagógico e institucional. Vou extrair dois sub-componentes exportados no mesmo arquivo (sem duplicar lógica): `AtividadesLoteSection` e `RelatoriosInstitucionaisSection`. A página `/relatorios/exportar` continua existindo (compõe os dois para quem prefere ver tudo junto, mas pode ser removida depois — não removo agora para não quebrar bookmarks).
- **i18n**: atualizar chaves `documents.*` nos 4 locales (pt-BR, en-US, es-AR, it-IT) — remover sub-abas, ajustar subtítulos.
- **Memória**: atualizar `mem://funcionalidades/hub-documentos-relatorios` refletindo as 4 abas sem sub-abas e a remoção do HubExportacoesPage.

### Arquivos afetados

- Editar: `src/pages/documentos/DocumentosPage.tsx`, `src/pages/presenca/PresencaPage.tsx`, `src/pages/relatorios/ExportarRelatoriosPage.tsx`, `src/App.tsx`, `src/components/AppSidebar.tsx` (se referenciar Hub), `src/i18n/locales/{pt-BR,en-US,es-AR,it-IT}.json`.
- Deletar: `src/pages/relatorios/HubExportacoesPage.tsx`, `src/pages/relatorios/oficiais/BoletimArticulacaoDialog.tsx`, `src/pages/relatorios/oficiais/BoletimPedagogicoDialog.tsx`, `src/pages/relatorios/oficiais/EncaminhamentosDialog.tsx`.
- Memória: `mem://funcionalidades/hub-documentos-relatorios`, `mem://index.md`.

### Resultado para o usuário

- 1 lugar único para cada documento — fim de "qual aba mesmo?".
- 7 sub-abas eliminadas (2 em Atividades, 3 em Gestão, 2 em /presenca).
- 1 página fantasma removida (HubExportacoesPage).
- 3 diálogos oficiais não usados removidos do código.
