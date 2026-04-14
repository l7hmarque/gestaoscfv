

## Plano: Página Preview do Novo Design Global

### O que vou criar

Uma página estática `/preview-design` que mostra side-by-side (ou seção por seção) como cada componente visual ficará com o novo design. Tudo com dados mockados, zero lógica funcional.

### Seções da preview

A página simulará os seguintes contextos visuais do sistema:

1. **Header mockado** — barra superior com gradiente sutil, logo "SysELO" integrado, ícones de ação refinados
2. **Sidebar mockada** — item ativo com borda-esquerda 3px + fundo sutil, labels de grupo uppercase/tracking-wide, separadores mais definidos
3. **KPI Cards** — borda-esquerda colorida por contexto (azul=dados, verde=positivo, vermelho=primário), número em `text-2xl font-semibold`, label em `text-xs uppercase tracking-wider`, sem círculo de fundo no ícone
4. **Tabela mockada** — zebra striping (`even:bg-muted/30`), header uppercase com `tracking-wider font-semibold bg-muted/50`, hover na linha
5. **Cards de atalho** — hover com `shadow-md`, ícone sem fundo circular, borda sutil
6. **Badges de status** — `uppercase text-[11px] tracking-wide font-medium`
7. **Gráfico mockado** — card com estilo refinado (mesmo recharts)

### Paleta proposta (visualizada na preview)

| Token | Atual | Novo |
|-------|-------|------|
| Background | `40 20% 97%` (bege) | `220 14% 96%` (cinza frio) |
| Primary | `0 65% 67%` (rosa) | `0 58% 56%` (vermelho mais profundo) |
| Muted | `210 15% 93%` | `215 20% 93%` (mais azulado) |
| Sidebar bg | `0 0% 100%` | `220 15% 98%` (off-white frio) |
| Sidebar active | fundo inteiro | borda-esquerda 3px |

### Arquivos

| Arquivo | Ação |
|---------|------|
| `src/pages/preview/DesignPreviewPage.tsx` | Novo — página estática com todas as seções mockadas |
| `src/App.tsx` | Adicionar rota `/preview-design` (protegida) |

### O que NÃO muda
- Nenhum arquivo existente de estilo ou componente é alterado
- Nenhuma lógica, query ou funcionalidade é tocada
- A rota é temporária — será removida após aprovação do visual

