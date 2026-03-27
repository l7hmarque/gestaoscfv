

# Plano Consolidado — Funcionalidades Pendentes SysELO

## 1. Exportacao Institucional DOCX + PDF

Criar hook `src/hooks/useDocumentExport.ts` que gera documentos seguindo os modelos enviados.

**Modelos:**
- **Relatorio de Atividade**: cabecalho SCFV/CAIA, dados, checkboxes pintadas (☐/☑), competencias com cores de fundo (1=vermelho a 5=verde), fotos dinamicas (remove tabelas nao usadas), quebras de pagina
- **Planejamento**: cabecalho institucional, tags mapeadas aos campos do banco
- **Ficha de Inscricao**: dados completos do participante no formato institucional
- **Matriz de Frequencia**: A4 paisagem, cabecalho institucional, nomes x datas, checkmarks para presentes, versao em branco e preenchida

Formatos: DOCX (via `docx-js`) + PDF (via `jsPDF`). Botoes de export nas paginas de detalhe e no Banco de Dados. Backup ZIP inclui versoes DOCX+PDF.

## 2. Pagina Individual do Profissional

Nova rota `/profissional/:id` com layout tipo perfil:
- Header: foto, nome, cargo, status
- Cronograma semanal: grade visual seg-sex gerada das turmas do profissional
- Tabs: Turmas, Planejamentos, Relatorios, Presencas — todos filtrados pelo `educador_id`
- Cards de profissionais no Dashboard viram links clicaveis para o perfil

## 3. Integracao de Documentos nas Paginas

- **Participante perfil**: botao "Ficha de Inscricao" gera DOCX/PDF institucional
- **Profissional perfil**: acesso direto aos planejamentos e relatorios do educador
- **Relatorio detalhe**: botoes "Exportar DOCX" e "Exportar PDF"
- **Planejamento detalhe**: botoes "Exportar DOCX" e "Exportar PDF"

## 4. Impressao Direta do Navegador

- Botao "Imprimir" em: Relatorio, Planejamento, Participante, Profissional
- CSS `@media print` global em `index.css`: esconde sidebar/header/botoes, ajusta margens A4

## 5. Seguranca e Protecao de Dados

### RLS por cargo
- Adicionar role `educador` ao enum `app_role`
- UPDATE em planejamentos/relatorios: somente autor OU coordenacao
- DELETE em todas as tabelas criticas: somente coordenacao
- INSERT em turmas/pontos_transporte/bairros: somente coordenacao

### Storage
- Tornar buckets `fotos-participantes` e `fotos-relatorios` privados
- Policies: SELECT/INSERT para authenticated, DELETE para coordenacao

### Profiles update
- Permitir coordenacao atualizar perfis de outros (policy UPDATE)

### Sessao
- Hook `useSessionTimeout.ts`: auto-logout apos 30min de inatividade
- Integrar no `AppLayout.tsx`

---

## Arquivos

| Arquivo | Acao |
|---|---|
| `src/hooks/useDocumentExport.ts` | Criar |
| `src/pages/profissional/ProfissionalPerfilPage.tsx` | Criar |
| `src/hooks/useSessionTimeout.ts` | Criar |
| `src/App.tsx` | Editar — rota `/profissional/:id` |
| `src/index.css` | Editar — `@media print` |
| `src/pages/relatorios/RelatorioDetalhePage.tsx` | Editar — botoes export + imprimir |
| `src/pages/planejamentos/PlanejamentoDetalhePage.tsx` | Editar — botoes export + imprimir |
| `src/pages/participantes/ParticipantePerfilPage.tsx` | Editar — ficha inscricao + imprimir |
| `src/pages/presenca/PresencaExportarPage.tsx` | Reescrever — matriz frequencia DOCX+PDF |
| `src/pages/dashboard/DashboardProfissionaisTab.tsx` | Editar — cards clicaveis |
| `src/hooks/useBackupExport.ts` | Editar — incluir DOCX/PDF no ZIP |
| `src/pages/banco-dados/BancoDadosPage.tsx` | Editar — opcao DOCX no dropdown |
| `src/components/AppLayout.tsx` | Editar — integrar timeout |
| Migration SQL | RLS refinado, role educador, storage policies |

