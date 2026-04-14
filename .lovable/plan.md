

## Plano: Cabeçalho institucional bonito nas matrizes de frequência XLSX

### Problema atual
Os cabeçalhos das matrizes de frequência XLSX são simples texto sem formatação profissional — sem centralização adequada, sem logos, e com informações incompletas (falta "SCFV CAIA - Termo de Colaboração 001/2022").

### O que será feito

Padronizar o cabeçalho em **todos os locais** que geram matrizes de frequência XLSX, com:
- Texto institucional centralizado e estilizado (3 linhas):
  1. **Sociedade Civil Nossa Senhora Aparecida**
  2. **Centro de Atenção Integral ao Adolescente**
  3. **SCFV CAIA - Termo de Colaboração 001/2022**
- Logos translúcidos da SCNSA e do CAIA (PNG) inseridos como imagens no cabeçalho
- Fundo azul claro (#EBF5FB), fontes em azul escuro (#1A5276), bordas, centralização
- Estilo consistente com o que já existe em `exportListaPresenca.ts` (que já tem um cabeçalho bonito)

### Arquivos afetados

1. **`src/pages/relatorios/ExportarRelatoriosPage.tsx`** — Funções `addInstHeader()` e `applyInstStyle()` + cabeçalho das matrizes por turma (linhas 428-434)
2. **`src/pages/dashboard/DashboardRelatorioMensalTab.tsx`** — Cabeçalho das matrizes por turma (linhas 514-528)
3. **`src/lib/exportListaPresenca.ts`** — Já tem cabeçalho bonito, mas atualizar o texto da linha 2 para incluir "SCFV CAIA - Termo de Colaboração 001/2022"

### Abordagem técnica

1. **Criar helper centralizado** em `src/lib/xlsxInstHeader.ts` com:
   - Função `addInstitutionalHeader(ws, totalCols, title, turmaInfo)` que aplica o cabeçalho com merges, estilos, e opcionalmente logos
   - Logos armazenados como imagens no Supabase Storage (bucket `documentos`) ou em `public/`
   - Uso de `xlsx-js-style` para inserir imagens como base64

2. **Substituir** os cabeçalhos simples nos 3 arquivos pelo helper centralizado

3. **Logos**: Aguardar envio dos PNGs pelo usuário, depois incluir como assets em `public/` e referenciá-los no helper

### Aguardando do usuário

Envie os **2 logos em PNG com fundo transparente** (SCNSA e CAIA) para que eu possa incluí-los no cabeçalho. Enquanto isso, posso já implementar a estrutura do cabeçalho com o texto e estilos, e adicionar os logos assim que recebê-los.

