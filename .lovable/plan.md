## Objetivo

Na página da turma, renomear "Lista de Presença" para "Lista de Chamada" e adicionar a opção **"Abrir no Google Sheets"**, gerando o documento conforme o modelo institucional (com correções extraídas dos comentários do sheet de referência).

## Correções de conteúdo/estilo (modelo Google Sheets — válidas para todas as listas)

Aplicadas tanto na geração XLSX local quanto na geração via Google Sheets:

1. **Título**: `LISTA DE CHAMADA — {MÊS} / {ANO}` (substitui "LISTA DE FREQUÊNCIA").
2. **Cabeçalho institucional**: `SOCIEDADE CIVIL NOSSA SENHORA APARECIDA` em MAIÚSCULO.
3. **Linha de info**: rótulos em **negrito** — `Período:`, `Faixa Etária:` (renomear de "Faixa"), `Educador(a):`, `Bairro:`.
4. **Marcadores em negrito**: `(BA)`, `(D)`, `(T)` ao lado dos nomes e na legenda.
5. **Assinatura**: linha "Assinatura do(a) Educador(a):" alinhada à esquerda e em **negrito**.
6. **Largura das colunas**: B até a última ajustadas ao conteúdo (auto-fit).
7. **Nome do arquivo**: `SysCFV_ListaChamada_{Turma}_{YYYY-MM}_{timestamp}` (segue padrão institucional, atualiza categoria de "ListaPresenca" → "ListaChamada").

## Mudanças na UI (`src/pages/turmas/TurmaDetalhePage.tsx`)

- Botão "Lista Presença" → **"Lista de Chamada"**.
- Título do diálogo "Gerar Lista de Presença" → **"Gerar Lista de Chamada"**.
- Dentro do diálogo, ao lado de "Gerar XLSX", adicionar botão **"Abrir no Google Sheets"** (ícone `FileSpreadsheet`/`ExternalLink`), que invoca a edge function e abre a URL retornada em nova aba.
- Toast de sucesso atualizado.

## Edge Function nova: `generate-lista-chamada-gsheet`

Segue o mesmo padrão de `generate-relatorio-gdoc` (conta institucional única via conector Google Sheets + Google Drive).

Fluxo:
1. Recebe `{ turma_id, mes, ano }`. Valida sessão.
2. Carrega turma (nome, período, faixa_etaria, dias_semana, bairro, educador) e membros (com flags `desligado`, `transferido`, `busca_ativa`, datas).
3. Calcula as datas de atendimento do mês a partir de `dias_semana`.
4. Cria uma nova planilha via `POST /v4/spreadsheets` com título `SysCFV_ListaChamada_{Turma}_{YYYY-MM}`.
5. Envia `spreadsheets:batchUpdate` com:
   - `updateCells` para cabeçalho (3 linhas institucionais em maiúsculo + título + nome da turma + linha de info com rich-text bold nos rótulos).
   - Cabeçalho da tabela (`Nº`, `Nome do Participante`, datas `dd/MM`).
   - Linhas dos participantes (ativos primeiro; transferidos e desligados ao final com strikethrough; `(BA)`/`(D)`/`(T)` em **bold runs**).
   - Linha de assinatura (alinhada à esquerda, bold).
   - Linha de legenda (com `(BA)`, `(D)`, `(T)` em bold).
   - `mergeCells` nas linhas de cabeçalho institucional.
   - `updateDimensionProperties` com `autoResizeDimensions` para colunas B+.
   - Bordas e tamanhos consistentes com o template do sheet de referência.
6. Via Google Drive API, define permissão pública (`anyone` / `reader`) e retorna `webViewLink`.
7. Retorna `{ url }` para o frontend.

Sem persistência por enquanto: cada clique gera nova planilha (consistente com a natureza de "lista de chamada em branco para impressão"). Caso a Coordenação valide, posso adicionar reuso por `(turma_id, mes, ano)` em iteração futura.

## Mudanças no exporter XLSX local (`src/lib/exportListaPresenca.ts`)

Aplicar as mesmas 6 correções de estilo acima para manter paridade visual entre o XLSX baixado e o Google Sheets gerado. Renomear constantes/labels internos de "Frequência" para "Chamada" onde apropriado, mantendo o helper de naming.

## Fora do escopo

- Não altero a página `/presenca/exportar` (Lista de Frequência preenchida × Lista de Chamada em branco já estão separadas lá).
- Não altero o exporter de Lista de Frequência preenchida (modelo diferente, mantém marcadores `■`).
- Não persisto `gsheet_id` na turma; pode ser adicionado depois se a Coordenação solicitar reuso.
