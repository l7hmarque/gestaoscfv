## Objetivo

Padronizar toda a geração de documentos do SysCFV usando os modelos oficiais em Google Docs/Sheets do Drive, salvando os arquivos finais na mesma pasta mensal já criada por `sync-drive-modelos`. As exportações locais (DOCX/PDF/XLSX) deixam de aparecer na UI e ficam apenas como fallback oculto se a chamada ao Google falhar.

Escopo coberto agora (com modelo no txt):

1. **Relatório Mensal Consolidado** — Google Sheets (modelo `1YgUTOzN7criGJPfO06rYp7OsM7wW9lX-HTKHktFvoyg`)
2. **Listas de Frequência** (preenchidas) — Google Sheets (modelo `12taeg34khJAwY8e6zL2ZiNIMMuJdCIIJacC6e245iBU`)
3. **Relatório de Atividade** (1 por atividade) — Google Docs (modelo `1BSf2GzuXu0QYGsVg-d-plbjrqEemRXxEFX3ut86UJUg`)
4. **Lista de Chamada em branco** — Google Sheets (modelo `18bJs2NjbuxjQ3y3rJlCmXjCgX-PkJOArwNpNNRCULq4`)

Fora do escopo (mantém como está): REO, Prestação de Contas, Relatório da Coordenação, Financeiro, Cronograma, Ficha de Inscrição, Planejamento, RCA — aguardando modelos.

## Padrão institucional aplicado a todos os modelos

- Cabeçalho institucional (Calibri 12, mesclado até a última coluna com dados, centralizado):
  - Linha 1 (fundo preto / texto branco / negrito): "SOCIEDADE CIVIL NOSSA SENHORA APARECIDA"
  - Linha 2 (fundo branco / preto / negrito): "Centro de Atenção Integral ao Adolescente | Serviço de Convivência e Fortalecimento de Vínculos"
  - Linha 3 (fundo branco / preto / negrito itálico): "Termo de Colaboração 001/2022"
- Títulos de coluna: fundo preto, texto branco negrito, Calibri 11
- Demais conteúdos: Calibri 11; legendas Calibri 9
- Bordas pretas 0.5px em todas as células com dados; alinhamento vertical ao meio; "ajustar texto"; colunas/linhas auto-fit
- Nome das abas referenciando a informação contida
- Nome do arquivo continua `SysCFV_{Categoria}_{YYYY-MM-DD}_{HHmmss}` (sem extensão local; o Drive guarda como Google Docs/Sheets)

## Mudanças por categoria

### 1. Relatório Mensal Consolidado (Sheets)

- Nova edge function `generate-relatorio-mensal-gsheet` que:
  - Copia o template Sheets para a pasta `SysCFV/{AAAA-MM}/Relatorios_Mensais/` no Drive (mesma raiz usada por `sync-drive-modelos`)
  - Preenche as abas conforme o txt:
    - Resumo Sintético (atendidos no mês, por bairro, faixa etária, período — únicos com ≥1 presença)
    - Atividades (planejadas vs realizadas + Resultados Alcançados IA ≤300 chars)
    - Metas (por território + Resultados Alcançados IA ≤400 chars)
    - Monitoramento (4 indicadores: Momentos Educando, Oficinas, Educacional 100%, Socioassistencial 100%)
    - Atendimentos Técnicos
    - Listas de Frequência (uma aba por turma, usando o mesmo padrão da categoria 2)
- Aposenta `generate-relatorio-mensal` (XLSX local) — fica só como fallback chamado se a função Google falhar
- UI (`DashboardRelatorioMensalTab.tsx`): troca o botão "Exportar XLSX" por "Gerar no Drive" + link "Abrir no Drive" após sucesso

### 2. Listas de Frequência preenchidas (Sheets)

- Nova edge function `generate-lista-frequencia-gsheet` (uma aba por turma/intervalo) usando o template informado
- Datas como colunas (DD/MM), presença marcada com "P'" negrito faltas com "A", justificativa com "J" na celula correspondente a data e descricao da justificativa em comentario.
- Substitui `exportListaPresenca.ts` na UI; lib local fica só como fallback

### 3. Relatório de Atividade (Docs)

- `generate-relatorio-gdoc` já existe e copia template Docs — **trocar TEMPLATE_ID padrão** para `1BSf2GzuXu0QYGsVg-d-plbjrqEemRXxEFX3ut86UJUg` e revisar o `batchUpdate` para casar exatamente com a estrutura do novo modelo (ler o doc primeiro, mapear seções)
- UI (`RelatorioDetalhePage.tsx`, `useDocumentExport.ts`): remover botões DOCX/PDF locais; deixar só "Abrir no Drive (Docs)". Fallback DOCX local fica oculto, só dispara se a edge function retornar erro

### 4. Lista de Chamada em branco (Sheets)

- `generate-lista-chamada-gsheet` já existe — **atualizar TEMPLATE_ID** para `18bJs2NjbuxjQ3y3rJlCmXjCgX-PkJOArwNpNNRCULq4` e revisar mapeamento de células conforme o novo modelo (idêntico à Lista de Frequência mas com células de presença vazias)
- UI: substitui o botão "Imprimir Chamada" pelo "Gerar Chamada (Drive)"

## Localização dos arquivos no Drive

Reaproveitar a estrutura criada por `sync-drive-modelos`:

```
SysCFV/
  └── 2026-04/
       ├── Relatorios_Mensais/
       ├── Listas_Frequencia/
       ├── Relatorios_Atividade/
       └── Chamadas_Branco/
```

Cada edge function:

1. Garante a pasta-mês via helper `ensureMonthFolder(yyyyMm, subcat)` (extrair de `sync-drive-modelos` para `_shared`)
2. Copia o template, renomeia com `sysCfvFileName`, preenche
3. Compartilha como "qualquer pessoa com link → leitor"
4. Persiste `gdoc_url`/`gsheet_url` no registro origem (relatório, mês consolidado, etc.) para idempotência

## UI/UX

- Hub `useDocumentExport` ganha um modo `preferGoogle = true` (padrão) que tenta a edge function Google primeiro; em caso de erro mostra toast com botão "tentar formato local" (fallback oculto)
- Toast de sucesso: "Documento gerado no Drive" + link direto
- Tela `Exportar Relatórios` (`/relatorios/exportar`): botões redirecionados para as funções Google
- Tela `Dashboard → Relatório Mensal`: idem

## Detalhes técnicos

- Connectors: `google_drive` + `google_docs` + `google_sheets` já estão conectados (já usados em `generate-relatorio-gdoc` e `generate-lista-chamada-gsheet`); confirmar `GOOGLE_SHEETS_API_KEY` antes do deploy
- Compartilhamento: `POST /files/{id}/permissions` com `{ role: "reader", type: "anyone" }`
- IA (Resultados Alcançados): reutilizar `generate-resultados-alcancados` com novos limites de caracteres (300 para atividades, 400 para metas)
- Sem novas tabelas; reutilizar colunas `gdoc_id/gdoc_url` em `relatorios_atividade` e adicionar `gsheet_id/gsheet_url` em `relatorios_mensais` via migration
- Memória: atualizar `mem://constraints/nomenclatura-arquivos` e adicionar `mem://funcionalidades/exportacao-google-drive-unificada` documentando o novo padrão e os IDs dos templates

## Validação

1. `curl_edge_functions` em cada nova função para Abril/2026 e conferir o arquivo gerado no Drive
2. Visualmente abrir cada documento e validar cabeçalho institucional, fontes, bordas e dados
3. Confirmar que os botões antigos sumiram da UI das telas listadas
4. Conferir que `sync-drive-modelos` continua organizando as pastas (sem regressão)