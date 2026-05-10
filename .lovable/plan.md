## Objetivo

Trocar o fluxo "Exportar DOCX" do relatório de atividade por "Abrir no Google Docs":
1. Cada relatório vira uma cópia do template institucional `1in9wpXN6kScnZ048pnxvboaWiqKEWzxaB_m8hr-eG2I` (que já contém cabeçalho/rodapé timbrado).
2. O conteúdo do relatório é inserido no corpo via batchUpdate, **sem tocar em header/footer** (preservando a folha timbrada).
3. O doc é compartilhado como "qualquer pessoa com o link pode visualizar".
4. O link `webViewLink` abre em nova aba.

---

## Arquitetura

**Conector**: Google Docs + Google Drive (mesma conta institucional, via gateway Lovable). Os 2 já compartilham OAuth — uma única ligação atende.

**Edge Function nova**: `supabase/functions/generate-relatorio-gdoc/index.ts`
- Input: `{ relatorioId: string }`
- Fluxo:
  1. Valida JWT do usuário.
  2. Carrega relatório + turmas + presença + fotos do Supabase (mesma query de `bibliotecaDocx.ts`).
  3. **Copia o template** via Drive API: `POST /drive/v3/files/{TEMPLATE_ID}/copy` com `{ name: "SysCFV_Relatorio_<data>_<titulo>.gdoc" }` em pasta institucional (configurável por secret `GDOCS_RELATORIOS_FOLDER_ID`, opcional).
  4. **Limpa o body** do doc copiado (deleteContentRange 1..endIndex-1) — header/footer permanecem intactos pois vivem em `documentStyle.defaultHeaderId/FooterId`.
  5. **Insere conteúdo** via `documents:batchUpdate` na ordem do modelo já alinhado em `useDocumentExport.ts`:
     - Faixa "RELATÓRIO DE ATIVIDADE" (parágrafo com fundo vermelho via `updateParagraphStyle.shading`)
     - Tabela "Dados da Atividade" (6 linhas)
     - Engajamento (4 opções com ■/☐)
     - Tabela Competências (5x3) + linha "Score ELO: X.XX"
     - Tabela Resumo (1x3 Presentes/Ausentes/% Adesão)
     - Objetivo, Atividades Realizadas, Observações
     - Faixa cinza "ANEXO I — LISTA DE FREQUÊNCIA" + tabela Nº/Nome/Presença
     - Faixa cinza "ANEXO II — REGISTROS FOTOGRÁFICOS" + imagens (insertInlineImage com URLs públicas do Storage)
  6. **Compartilha**: `POST /drive/v3/files/{newId}/permissions` com `{ role: "reader", type: "anyone" }`.
  7. **Persiste** o `gdoc_id` e `gdoc_url` (webViewLink) numa nova coluna em `relatorios_atividade` para evitar regerar — se já existe, retorna o link existente.
  8. Retorna `{ url, fileId }`.

**Migration**: adicionar colunas `gdoc_id text` e `gdoc_url text` em `relatorios_atividade`.

---

## Frontend

**Arquivos a editar**:
- `src/hooks/useDocumentExport.ts`: adicionar `abrirRelatorioNoGoogleDocs(relatorioId)` que chama a edge function e faz `window.open(url, "_blank")`. Manter `buildRelatorioDocxBlob` como **fallback interno** apenas para a Biblioteca de Documentos (que precisa de Blob para upload em Storage), mas remover dos botões de UI.
- `src/pages/relatorios/RelatorioDetalhePage.tsx`: trocar botão "Exportar DOCX" por "Abrir no Google Docs" (ícone `FileText` + `ExternalLink`).
- `src/pages/relatorios/RelatoriosPage.tsx` (lista): no menu de ações, mesmo swap.
- `src/hooks/useBulkRelatorioExport.ts`: para exportação em lote, gerar N Google Docs em paralelo (Promise.allSettled, 3 simultâneos) e abrir uma página intermediária (ou toast com lista de links) — **sem auto-abrir N abas** que o navegador bloqueia.
- `src/pages/biblioteca/BibliotecaPage.tsx`: substituir download DOCX por link Google Docs (usa `gdoc_url` se presente, senão dispara geração).

**Sem alteração**:
- PDF (`exportRelatorioPdf`) permanece.
- XLSX, REO, Relatório Mensal (não são relatórios de atividade individuais).
- Planejamentos (continuam DOCX por enquanto, só relatórios mudam).

---

## Conector

Disparar `standard_connectors--connect` para `google_docs` e `google_drive` (mesma conta). Validar via `verify_credentials`. Secrets esperados: `GOOGLE_DOCS_API_KEY`, `GOOGLE_DRIVE_API_KEY`, `LOVABLE_API_KEY`.

Secret extra opcional (via `add_secret`): `GDOCS_RELATORIOS_TEMPLATE_ID` (default `1in9wpXN6kScnZ048pnxvboaWiqKEWzxaB_m8hr-eG2I`) e `GDOCS_RELATORIOS_FOLDER_ID` (opcional, para organizar por mês).

---

## Cuidados com a folha timbrada

- **Nunca** editar `headers`/`footers` do doc copiado — o template já os possui e a cópia preserva.
- Definir margens via `documents:batchUpdate updateDocumentStyle` somente se necessário (top/bottom maiores para não invadir timbre — ler do template original primeiro e replicar).
- Inserir tudo entre `body.content[0].endIndex` e final, garantindo que o conteúdo fique no corpo, não no header.
- Imagens do Anexo II: URL pública do Supabase Storage (já temos), inseridas via `insertInlineImage` com `objectSize` capada em ~450pt para não estourar margens.

---

## Validação

1. Gerar Google Doc do relatório atual (`/relatorios/5b477c4d-...`) e abrir no Drive: confirmar timbre presente em todas as páginas, nenhum texto sobreposto.
2. Confirmar permissão "anyone with link can view" (testar em janela anônima).
3. Testar lote (3+ relatórios) — toast com lista de links.
4. Confirmar que segunda chamada do mesmo relatório retorna o mesmo `gdoc_url` (idempotência).

---

## Fora de escopo

- Sincronizar edições feitas no Google Docs de volta para o Supabase.
- Aplicar mesmo fluxo a Planejamentos e REO (pode virar próxima iteração).
- Per-user OAuth (todos os docs ficam na conta institucional).
