
## Objetivo

Implementar a nova **paleta cromática institucional por formato** em todos os documentos exportados, eliminar a aba REO da página `Exportar Relatórios`, adicionar seletor de formatos e corrigir o bug que impede o download em "Relatórios de Atividades + Listas de Presença".

---

## Nova paleta por formato (regra global)

| Formato | Paleta | Aplicação |
|---|---|---|
| **DOCX** | Branco + Vermelho SCNSA + Azul SCNSA | Títulos coloridos, cabeçalhos de tabela em vermelho/azul, badges e destaques em azul |
| **PDF**  | Apenas preto e branco (sem cinza) | Cabeçalhos de tabela 100% preto com texto branco, sem zebra/alternateRow, sem `setTextColor(150)` |
| **XLSX** | Apenas preto e branco (sem cinza) | Cabeçalho preto / texto branco, células brancas com bordas pretas, sem fills cinza |

Cores SCNSA já usadas no projeto:
- `SCNSA_RED` → `#9E1B32`
- `SCNSA_BLUE` → `#1F3864` (já presente como `ACCENT_COLOR`)

---

## Mudanças por arquivo

### 1. Arquivos centrais (afetam tudo)

**`src/lib/xlsxInstHeader.ts`**
- Substituir todos os `fgColor: { rgb: "F2F2F2" | "D9D9D9" | "F7F7F7" | "333333" }` por **preto puro `000000`** (cabeçalhos) ou **branco `FFFFFF`** (corpo).
- `applyTableHeaderStyle`: fundo `000000`, texto `FFFFFF`.
- Remover tons cinza dos `instStyles`/`subInfoStyle`/`turmaInfoStyle`.

**`src/hooks/useDocumentExport.ts`** (DOCX colorido SCNSA)
- Manter `ACCENT_COLOR` (azul SCNSA) e `SCNSA_RED`.
- Substituir todas as ocorrências de `LIGHT_BG`/`HEADER_COLOR` cinza por azul SCNSA (cabeçalhos) ou branco (corpo); destaques de status (BA, busca ativa) em vermelho SCNSA.
- Trocar fundos cinza `"555555"`, `"CCCCCC"` em separadores/legendas por azul/vermelho ou preto fino.

### 2. PDFs — remover cinza

**`src/hooks/useRelatorioGestao.ts`** (`exportRelatorioGestaoPDF`)
- `gray50 = [50,50,50]` → `[0,0,0]`.
- `altRow = [245,245,245]` → remover (sem `alternateRowStyles`).
- `setTextColor(150)` no rodapé → `setTextColor(0)`.
- `headStyles.fillColor: [31,56,100]`, `[180,30,30]`, `[50,50,50]` → `[0,0,0]` com `textColor: [255,255,255]`.
- `setTextColor(158,27,50)` / `(90,103,112)` / `(180,30,30)` → `setTextColor(0,0,0)`.
- `fillColor: [245,245,245]` em column styles → remover.

**`src/hooks/useBulkRelatorioExport.ts`** (`generateBulkPdf`)
- `headStyles.fillColor: [31,56,100]` → `[0,0,0]`; remover `alternateRowStyles`; remover `setTextColor(90,103,112)` e `[158,27,50]`.

**`src/pages/relatorios/ExportarRelatoriosPage.tsx`** (PDF de Atendimentos e Prestação de Contas)
- Auditar `headStyles.fillColor` / `alternateRowStyles` / `setTextColor(...)` em todas as funções e zerar para preto/branco.

### 3. XLSX — remover cinza

**`src/hooks/useRelatorioGestao.ts`** (`exportRelatorioGestaoXLSX`)
- `headerStyle.fill.fgColor: "D9D9D9"` → `"000000"` + `font.color: "FFFFFF"`.

**`src/hooks/useBulkRelatorioExport.ts`** (`generateBulkXlsx`)
- Trocar `fgColor: "1A5276"` → `"000000"`.

**`src/pages/relatorios/ExportarRelatoriosPage.tsx`**
- `hdr` do XLSX de atendimentos: `fgColor: "323232"` → `"000000"`.
- Auditar Resumo/Atividades/Metas: nenhum `fgColor` cinza.

**`src/lib/exportListaPresenca.ts`** — auditar e converter qualquer cinza.

### 4. Página `Exportar Relatórios` — ajustes funcionais

**`src/pages/relatorios/ExportarRelatoriosPage.tsx`**
- **Eliminar a aba REO** (TabsTrigger, TabsContent e função `exportarREO`, `loadingReo`, `reoFormats`). Atualizar grid para `grid-cols-6`.
- **Bug "Relatórios de Atividades + Listas" não baixa**: a chamada passa `educadorId: undefined`, mas o hook compara contra `"todos"`. Corrigir para passar `educadorId: ativEducadorId === "__all__" ? "todos" : ativEducadorId` e validar que `formatos` é repassado.
- Adicionar `FormatPicker` (DOCX/PDF/XLSX) ao card "Atividades + Listas" e remover toast de sucesso "cego" — só exibir após a Promise do hook resolver com sucesso real (deixar o hook ser a fonte do toast; remover o `toast.success` redundante de `exportarAtividadesLote`).

---

## Critério de aceite

1. Aba REO removida; página tem 6 abas.
2. "Atividades + Listas" baixa o ZIP/PDF/XLSX corretamente quando "Todos" está selecionado.
3. Nenhum DOCX/PDF/XLSX gerado contém cinza (`setTextColor(150)`, `fillColor:[245,245,245]`, `fgColor:"D9D9D9"` etc.) — buscas `rg` por esses padrões devem retornar vazio nos arquivos de export.
4. DOCX exibe títulos em vermelho/azul SCNSA; PDFs e XLSX em preto puro com texto branco em cabeçalhos.

---

## Memória a atualizar

- `mem://estilo/documentos-institucionais-padrao` — substituir "grayscale" pela nova regra cromática por formato.
