

## Plano: Corrigir Datas, Cores e Filtro de Participantes nas Listas de Presença

### 4 problemas identificados

**1. Datas em formato MM-DD em vez de DD/MM**
Em 4 arquivos, as datas das colunas da matriz de frequência usam `d.slice(5)` sobre strings ISO (`"2025-03-05"` → `"03-05"`). Precisa converter para `"05/03"` (DD/MM).

**Arquivos afetados:**
- `src/pages/dashboard/DashboardRelatorioMensalTab.tsx` (linha 402/478)
- `src/pages/relatorios/ExportarRelatoriosPage.tsx` (linha 402)
- `supabase/functions/generate-relatorio-mensal/index.ts` (linha 340)
- `supabase/functions/generate-reo/index.ts` (linha 731)

**Correção:** trocar `d.slice(5)` por um helper que inverte: `d.slice(8,10) + "/" + d.slice(5,7)` → `"05/03"`

**2. Cores da planilha — preto, branco e cinza**
O `exportListaPresenca.ts` já usa paleta grayscale, mas o título usa `fill: "333333"` com texto branco, e o header usa `fill: "444444"`. Ajustar para manter consistência total em preto/branco/cinza conforme padrão institucional (sem cores). Verificar também os exports PDF/DOCX da matriz de frequência.

**3. Bordas faltando**
No `exportListaPresenca.ts`, linhas separadoras (row 3, 7) e a linha de assinatura usam `bordersLight` ou `noBorder`, criando gaps visuais. Aplicar bordas em todas as células da área de dados e cabeçalho.

**4. Participantes de abril aparecendo em março**
Nas queries de `PresencaExportarPage.tsx` (linhas 82-85 e 149-152) e nos geradores de relatório mensal, a consulta `turma_participantes` não filtra por data de criação. Participantes cadastrados em abril não devem aparecer na lista de março.

**Correção:** adicionar `created_at` na query de `participantes` e filtrar: se `participantes.created_at > último dia do mês selecionado`, excluir da lista. Mesma lógica nos geradores de relatório mensal (local e edge functions).

---

### Arquivos editados

| Arquivo | Mudança |
|---|---|
| `src/pages/dashboard/DashboardRelatorioMensalTab.tsx` | `d.slice(5)` → DD/MM; filtrar participantes por created_at |
| `src/pages/relatorios/ExportarRelatoriosPage.tsx` | `d.slice(5)` → DD/MM; filtrar participantes por created_at |
| `src/pages/presenca/PresencaExportarPage.tsx` | Filtrar participantes por created_at do mês |
| `src/lib/exportListaPresenca.ts` | Receber e usar created_at; bordas completas |
| `supabase/functions/generate-relatorio-mensal/index.ts` | `d.slice(5)` → DD/MM; filtrar por created_at |
| `supabase/functions/generate-reo/index.ts` | `d.slice(5)` → DD/MM; filtrar por created_at |

