## Sobre a sanitização (resposta direta)

Sim. As listas de chamada e frequência leem nomes direto da tabela `participantes` — as mesmas 14 linhas que foram corrigidas no saneamento. Toda nova geração (Drive/Sheets ou download local) já sai com os nomes corretos. Arquivos antigos no Drive precisam ser regerados para refletir a correção.

---

## Relatório de Evolução SAS — Março a Maio/2026

### Observação importante sobre o período
A regra "Marco Operacional" do sistema (`mem://constraints/data-inicio-operacional`) define que KPIs oficiais contam **a partir de 01/04/2026**. Para o relatório SAS:
- **Março** entra como "linha de base / pré-operação" (rotulada como tal nos gráficos), com os dados disponíveis no banco.
- **Abril e Maio** entram como meses operacionais cheios.
- O texto introdutório explica essa distinção para evitar leitura equivocada pela SAS.

Se você preferir omitir março, basta avisar no momento da implementação.

### Onde fica
- Nova entrada no hub `/documentos` → aba **Gestão** (restrita a Coordenação/Super Admin), card **"Relatório de Evolução SAS"**.
- Também acessível em `/relatorios/exportar` (modo institucional).
- Diálogo para escolher período (default: 03/2026–05/2026) e disparar geração no servidor.

### Estrutura do PDF (institucional, A4, grayscale + acento vermelho SysCFV)

1. **Capa** — título, período, território, logo, data de emissão, responsável (coordenação logada).
2. **Sumário executivo** (1 página) — quadro com os 4 indicadores-chave do trimestre e variação % mar→mai.
3. **Evolução dos KPIs Essenciais** — uma seção por KPI, cada uma com gráfico + tabela mensal + parágrafo-modelo com placeholders preenchidos:
   - Participantes ativos no mês (linha)
   - Novos ingressos (barras)
   - Frequência média % (linha)
   - Atendimentos técnicos (barras)
   - Atividades realizadas (barras)
   - *(desligamentos: omitidos conforme solicitado)*
4. **Vínculo e Adesão** — seção interpretativa:
   - Tempo médio de vínculo dos ativos (em dias/meses) — barra horizontal por mês
   - Taxa de adesão (presentes ÷ convocados) — linha mensal
   - Retenção mensal (ativos no mês N que seguem ativos no mês N+1) — barras
   - Volume de busca ativa realizada — barras
5. **Atividades em Destaque** — para cada mês (Mar/Abr/Mai), as **Top 3 atividades por número de presentes**:
   - Card com: título, data, eixo, turma, nº de presentes, resumo (do campo `resultados_alcancados` quando existir)
   - Até 2 fotos do `registros_fotograficos` ou `relatorio_fotos` vinculadas àquela atividade/data/turma
6. **Galeria fotográfica do trimestre** — 6 a 9 fotos representativas adicionais (uma por mês mínimo).
7. **Texto-modelo interpretativo (placeholders preenchidos)** — frases automáticas distribuídas nas seções, ex.:
   - "A frequência média subiu de **{X}%** em março para **{Y}%** em maio, variação de **{Δ} p.p.**"
   - "O tempo médio de vínculo dos participantes ativos passou de **{X} dias** para **{Y} dias**, indicando {↑/↓} na permanência."
   - "A taxa de adesão atingiu **{Z}%** em maio, **{acima/abaixo}** da média trimestral de **{M}%**."
   - Espaço marcado como *"Análise da Coordenação:"* (linhas em branco) para a coordenação escrever à mão / preencher após impressão.
8. **Rodapé institucional** padrão SysCFV (SCNSA, território, data, paginação).

### Fontes de dados (por seção)
- KPIs essenciais e vínculo/adesão: `participantes`, `turma_participantes`, `presenca`, `atendimentos`, `relatorios_atividade`, `busca_ativa_registros`.
- Top 3 atividades/mês: `relatorios_atividade` ordenado por `count(presenca.presente=true)` daquela sessão.
- Fotos: `registros_fotograficos` + `relatorio_fotos` (URL pública ou download via storage).

### Detalhes técnicos (para revisão técnica)

**Nova edge function**: `supabase/functions/generate-relatorio-evolucao-sas/index.ts`
- Recebe `{ mes_inicio, mes_fim }`, default `2026-03` → `2026-05`.
- Roda queries agregadas mês a mês (usa `fetchAllRows` quando necessário).
- Renderiza PDF com **jsPDF + jspdf-autotable** (já em uso no projeto) e gráficos via **canvas server-side**: usa `chart.js` + `chartjs-node-canvas` (já presente em outras funções de geração; se ausente, importar por `npm:` como nas outras edge functions Deno) e embute como PNG no PDF.
- Fotos: baixa via `fetch` da URL pública (signed se preciso), redimensiona com `image-script` (npm) para no máx 800px do lado maior antes de embutir.
- Upload do PDF resultante para o Drive em `SYSCFV/RelatoriosOficiais/EvolucaoSAS/` quando o Drive estiver conectado; sempre retorna URL assinada para download local.
- Nome do arquivo: `SysCFV_EvolucaoSAS_2026-03-a-2026-05_{YYYY-MM-DD}_{HHmmss}.pdf` (padrão `sysCfvFileName`).

**Frontend**:
- Novo card em `src/pages/documentos/DocumentosPage.tsx` (seção Gestão).
- Novo diálogo `src/pages/relatorios/oficiais/EvolucaoSASDialog.tsx` com seletor de mês inicial/final, preview dos KPIs trimestrais, e botão "Gerar PDF" → `supabase.functions.invoke("generate-relatorio-evolucao-sas")`.
- Loading com `Loader2`, download via `file-saver`, fallback `window.open` (padrão do projeto).

**Auditoria**: cada geração registra `audit_log` (`acao='gerou_relatorio_evolucao_sas'`) com período e usuário.

### Fora de escopo (confirmar se quer incluir depois)
- Vulnerabilidade/território (PBF, BPC, CT, ECA, metas territoriais por bairro).
- Comparativo com anos anteriores.
- Texto interpretativo gerado por IA (você optou por placeholders).
- Versão DOCX/XLSX paralela.

Posso seguir para implementação?
