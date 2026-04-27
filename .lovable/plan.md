
## Diagnóstico — lógica atual

### 1. Checklist de presença no Relatório de Atividade (`/relatorios/novo`)
**Arquivo:** `src/pages/relatorios/RelatorioNovoPage.tsx`

- Linha 188: o filtro já permite `["ativo", "busca_ativa"]` — ou seja, quem está em busca ativa **JÁ aparece** no checklist para lançamento de presença. ✅
- Linha 358-365: já existe auto-reversão (presença marcada → status volta para `ativo` + registro em `busca_ativa_registros` + atendimento).
- **Problema:** na renderização (linha 910), só mostra `{p.nome}` sem nenhum indicador visual de que o participante está em busca ativa. O educador não percebe a situação na hora de marcar.

### 2. Lista preenchida exportada do relatório (PDF/DOCX da atividade)
**Arquivo:** `src/hooks/useDocumentExport.ts` (linha 658)

- A tabela "Lista de Presença" do PDF do relatório usa apenas `nome_completo`, `presente`, `justificativa`. **Não traz o status** do participante.
- O dado vem da tabela `relatorio_presenca` joineado com `participantes(nome_completo)` — não puxa `status`.

### 3. Matriz mensal de frequência (preenchida) — `/presenca/exportar`
**Arquivo:** `src/pages/presenca/PresencaExportarPage.tsx` (linhas 82–123)

- O `select` traz `status` e já adiciona sufixo " (Desligado em DD/MM)" no nome.
- **Problema:** ignora completamente `busca_ativa`. Só trata `desligado`.

### 4. Lista em branco para impressão — `handleExportLista` na mesma página + `exportListaPresencaPdf`
- Linha 153: o `select` **nem traz `status`** (`select("participante_id, participantes(nome_completo, created_at)")`). Só trata desligamento manualmente, mas pelo `status === "desligado"` que aqui sequer existe.
- Resultado: participantes em busca ativa aparecem como qualquer outro, sem indicação.

### 5. Lista em branco XLSX por turma — `exportSingleListaPresenca` / `exportAllListasPresenca`
**Arquivos:** `src/lib/exportListaPresenca.ts` + `src/pages/turmas/TurmaDetalhePage.tsx` (linha 257) + `src/pages/turmas/TurmasPage.tsx` (linha 182)

- A interface `MemberInfo` só tem `desligado` e `transferido`. **Não tem campo para busca ativa.**
- `TurmaDetalhePage` já busca `status` mas só usa para determinar `desligado`/`transferido`, descartando `busca_ativa`.
- `TurmasPage` (exportação em massa) só pula `desligado` e nem inclui o status dos demais.

---

## Plano de implementação

**Símbolo escolhido:** `🔍` (lupa) sufixado ao nome — `Maria Silva 🔍` — visível em DOCX/PDF/XLSX e nos checklists. (Alternativa ASCII puro `[BA]` se preferir manter grayscale estrito; pergunto na execução se quiser trocar.)

### Mudança 1 — Checklist do Relatório de Atividade
`src/pages/relatorios/RelatorioNovoPage.tsx` (linha ~910)
- Ao lado do nome, exibir badge discreto "Busca Ativa" (já temos `p.status` em memória) quando `p.status === "busca_ativa"`.
- Tooltip: "Marcar presença reverte automaticamente para Ativo".

### Mudança 2 — Lista preenchida (PDF do relatório)
`src/hooks/useDocumentExport.ts` (linha ~658) e onde os dados de `presenca` são buscados
- Estender o select para incluir `participantes(nome_completo, status)`.
- Ao montar a linha, sufixar `🔍` no nome quando `status === "busca_ativa"` na data do relatório.
- Adicionar legenda no rodapé da tabela: "🔍 = participante em busca ativa no momento do registro".

### Mudança 3 — Matriz mensal `/presenca/exportar` (preenchida)
`src/pages/presenca/PresencaExportarPage.tsx` `handleExport` (linha ~82)
- Já traz `status`. Adicionar sufixo `🔍` quando `status === "busca_ativa"` (sem sobrescrever sufixo de desligamento).

### Mudança 4 — Lista em branco `/presenca/exportar` (impressão)
`handleExportLista` (linha ~150)
- Estender select para incluir `status, data_desligamento`.
- Sufixar `🔍` para `busca_ativa` e manter " (Desligado…)" para desligados.

### Mudança 5 — Lista em branco XLSX por turma (`exportListaPresenca.ts`)
- Adicionar campo opcional `busca_ativa?: boolean` em `MemberInfo`.
- Renderizar `Nome 🔍` quando `busca_ativa = true` (sem strikethrough — eles ainda participam).
- Atualizar callers:
  - `src/pages/turmas/TurmaDetalhePage.tsx` (linha 257): adicionar `busca_ativa: m.status === "busca_ativa"`.
  - `src/pages/turmas/TurmasPage.tsx` (linha 182): repassar status (`busca_ativa: tp.participantes?.status === "busca_ativa"`).
- Adicionar uma linha de legenda no rodapé da planilha: "🔍 = Em busca ativa".

### Mudança 6 — Garantir nas demais exportações relacionadas
- Conferir `exportMatrizFrequenciaDocx` / `exportListaPresencaPdf` (provavelmente em `useDocumentExport.ts` ou similar) para aplicar o mesmo sufixo `🔍`.

---

## Resumo do comportamento após as mudanças

| Local | Antes | Depois |
|---|---|---|
| Checklist relatório | nome cru | nome + badge "Busca Ativa" |
| PDF relatório (preenchido) | nome | nome + 🔍 + legenda |
| Matriz mensal preenchida | só desligados marcados | desligados + 🔍 para busca ativa |
| Lista em branco impressa (PDF) | sem status | 🔍 para busca ativa |
| Lista em branco XLSX (turma única e em massa) | só desligados/transferidos | + 🔍 para busca ativa, com legenda |

Nenhuma migração de banco necessária — todos os dados já existem em `participantes.status`.
