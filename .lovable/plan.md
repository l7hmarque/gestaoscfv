## Plano: Renomear para SysCFV + Melhorias Globais de UI + Funcionalidades

### 1. Renomear SysELO → SysCFV (todas as referências)

**Arquivos afetados:**

- `src/lib/fileNaming.ts` — renomear função e prefixo de `SysELO_` para `SysCFV_`
- `src/components/AppSidebar.tsx` — texto do brand na sidebar
- `src/pages/preview/DesignPreviewPage.tsx` — brand no preview
- `index.html` — `<title>` e meta tags
- `src/pages/matricula/MatriculaPublicaPage.tsx` — rodapé
- `src/pages/turmas/TurmaDetalhePage.tsx` — textos em PDFs exportados
- `src/pages/dashboard/DashboardRelatorioMensalTab.tsx` — rodapés de PDF
- `src/hooks/useBackupExport.ts` — nomes de arquivos no ZIP
- `src/hooks/useRelatorioGestao.ts` — nomes de arquivos
- `supabase/functions/generate-rca/index.ts` — filename
- Demais arquivos com "SysELO" (~28 arquivos)

### 2. Logo SysCFV — clean, profissional, revolucionária

Criar um componente SVG inline `src/components/SysCFVLogo.tsx` com design:

- Ícone geométrico angular (hexágono ou seta abstrata) em vermelho institucional
- Tipografia "SysCFV" em font-weight 700, tracking tight
- Versões: completa (sidebar aberta) e ícone só (sidebar colapsada)

### 3. Scrollbars e botões mais quadrados

`**src/index.css**` — adicionar custom scrollbar:

```css
::-webkit-scrollbar { width: 10px; }
::-webkit-scrollbar-thumb { background: hsl(215 14% 70%); border-radius: 2px; }
::-webkit-scrollbar-track { background: transparent; }
```

`**tailwind.config.ts**` — reduzir `--radius` de `0.5rem` para `0.25rem` (afeta todos os botões e cards globalmente)

### 4. Gráficos comparativos e evolução de presença no dashboard real

**Sim, é possível com os dados atuais.** A tabela `relatorio_presenca` já tem dados de presença por mês. 

`**src/hooks/useDashboardData.ts**` — adicionar ao retorno:

- `presencaMensal: { mes: string; presentes: number; matriculados: number }[]` — calculado agrupando `relatorio_presenca` por mês do relatório e contando presentes vs total
- `deltaParticipantes: number` — diferença vs mês anterior (usando contagem de participantes com presença no mês atual vs anterior)

`**src/pages/dashboard/DashboardPage.tsx**` — adicionar:

- KPI cards com delta (`+3 vs mês anterior`) usando os novos campos
- Gráfico de barras "Presentes vs Matriculados" por mês (como no preview)
- Gráfico de linha "Evolução de Presença" (como no preview)

### 5. Botão "Copiar gráfico" na dashboard

Adicionar um botão de cópia em cada card de gráfico que usa `html2canvas` para capturar o elemento DOM do chart e copiá-lo para o clipboard como imagem PNG (pronto para colar no Word).

**Dependência**: instalar `html2canvas`
**Implementação**: wrapper `useRef` em cada chart card + botão com ícone `Copy` que executa:

```ts
const canvas = await html2canvas(chartRef.current);
canvas.toBlob(blob => navigator.clipboard.write([new ClipboardItem({"image/png": blob})]));
```

### 6. Banner de avisos do super admin

**Banco de dados**: criar tabela `avisos_sistema` com campos:

- `id`, `mensagem`, `tipo` (info/warning/urgent), `ativo`, `criado_por`, `created_at`, `expires_at`
- RLS: leitura para `authenticated`, escrita restrita a admins via `has_role`

`**src/components/AppLayout.tsx**`: consultar `avisos_sistema` onde `ativo = true` e `expires_at > now()`, exibir banner no topo (estilo do preview — fundo colorido, texto centralizado, botão de fechar)

**Admin**: adicionar seção na página de Configurações ou DashboardAdminTab para criar/editar/desativar avisos

### Arquivos novos

- `src/components/SysCFVLogo.tsx`
- `src/components/ChartCopyButton.tsx`
- `src/components/SystemBanner.tsx`
- Migration: `avisos_sistema` table

### Arquivos editados

- ~28 arquivos para rename SysELO → SysCFV
- `src/index.css` — scrollbar + radius
- `tailwind.config.ts` — radius token (se necessário, ou só no CSS)
- `src/hooks/useDashboardData.ts` — dados comparativos mensais
- `src/pages/dashboard/DashboardPage.tsx` — gráficos comparativos + botão copiar
- `src/components/AppLayout.tsx` — banner de avisos
- `src/components/AppSidebar.tsx` — nova logo
- `package.json` — adicionar `html2canvas`

Zero alteração em lógica existente de negócio.