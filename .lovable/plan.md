A solicitação tem **duas frentes**: (1) gerar um relatório de análise comparando a lista física de Abril/2026 da educadora Larissa com o que está no sistema; (2) aplicar as correções pedidas nos comentários da planilha exportada (Relatório Mensal). Trato as duas em paralelo.

---

## Frente A — Relatório de análise (PDF × Sistema)

### Escopo do PDF físico

3 páginas / 3 turmas (Educadora Larissa, Abril/2026):

- **Pág 1** — PARQUE INDEPENDENCIA · 6-8 · Manhã (11 participantes)
- **Pág 2** — PARQUE INDEPENDENCIA · 9-11 · Manhã (9 participantes)
- **Pág 3** — PARQUE INDEPENDENCIA · 6-8 · Tarde (6 participantes)

Datas usadas no PDF: 02, 07, 09, 14, 16, 21 (riscada — feriado/sem aula), 23, 28, 30 de abril.

### Divergências já identificadas (preview)

**1. Cobertura de chamada (sistema subnotifica)**

- PI 6-8 Manhã: PDF tem 11 nomes; sistema só tem 4 com lançamento de presença em abril (Gabrielli, Larissa, Maria Pietra, Nicolly).
- PI 9-11 Manhã: PDF tem 9 nomes; sistema tem 2 (Thabata, Antonio Marcos — esse último nem está no PDF).
- PI 6-8 Tarde: PDF tem 6 nomes; sistema tem 5 lançados.

**2. Datas registradas no sistema não batem com as do PDF**

- Sistema tem `01/04` (não consta no PDF) e `27/04` (não consta no PDF).
- PDF tem `02, 07, 09, 21, 28, 30` que não aparecem no sistema para várias turmas.
- Sugere que a chamada física não foi digitada ou foi digitada em datas erradas.

**3. Participantes do PDF sem cadastro/vínculo no sistema**

- PI 6-8 Manhã: Ana Heloisa Pistilhi, Anthony Abraao, Lara Gabriely, Maria Fernanda Pistilhi, Nayeli Silguero, Paloma Amaro, "Jece Pandese" (manual), "Maria B. Cardozo" (manual, anotação "para inserção, já levou ficha p/ casa").
- PI 9-11 Manhã: Ana Julia Mackievicz, Daniel Amaro, Davi Fernandes, Kauan Yuri, Laura Beatriz, Sofia Fonseca, Ygor Miguel.
- PI 6-8 Tarde: Adriani Isabelly, "Vitória" (sem sobrenome — provavelmente Vitoria Mendez Gecse já cadastrada).

**4. Anotações manuais a tratar**

- "Yasmin Vitoria Taborda Flores" marcada como **ADOLESCENTE** na pág 2 → precisa migrar para turma 12-17.
- Gabrielli (PI 6-8 Manhã): "está de atestado" + FJ a partir de 16/04 → não está marcada como falta justificada no sistema.
- Ygor Miguel (PI 9-11 Manhã): só comparece 02, 07, 09 → candidato a busca ativa.
- "Convivam com equipe técnica busca ativa desta turma" → ação para a equipe técnica.

### Entregável

Arquivo único em `/mnt/documents/Relatorio_Divergencias_Lista_Abril_Larissa.pdf` (e `.md` espelho) contendo:

- Resumo executivo (n.º de divergências por turma, taxa de subnotificação).
- 1 seção por turma: tabela "Participante × Data" com 3 colunas por dia (PDF, Sistema, Status) destacando inconsistências.
- Lista de participantes do PDF não vinculados → ação: cadastrar/matricular.
- Lista de presenças do sistema sem confirmação física → ação: revisar.
- Datas divergentes (sistema × PDF).
- Anotações manuais e ações recomendadas (busca ativa, atestado, transferência de turma).
- APLICAR CORRECOES NO SISTEMA.

---

## Frente B — Correções no exportador de Relatório Mensal

Os comentários da planilha apontam ajustes em **abas de Resumo/Atividades/Metas/Monitor** e nas **abas de Lista de Frequência**. Conforme instrução, comentários nas linhas 1–5 da aba "PARQUE INDEPENDENCIA — 6-8 - Tarde" valem para **todas as abas de frequência**.

### B.1 — Cabeçalho institucional (todas as abas)

- Linha do título: trocar "RELATÓRIO MENSAL — SysCFV SCFV" por **"RELATÓRIO MENSAL CONSOLIDADO | Sociedade Civil Nossa Senhora Aparecida"**, fonte Arial 12, **fundo preto** com **texto branco em negrito**.
- Linha 2: inserir **"Centro de Atenção Integral ao Adolescente | Serviço de Convivência e Fortalecimento de Vínculos"**.
- Linha "Mês: Abril / 2026" → **"MÊS: ABRIL / 2026"** em **negrito**, MAIÚSCULO (vale para Resumo, Ativ, Metas, Monitor, Atend e abas de frequência).

### B.2 — Abas de Lista de Frequência (regra geral)

- Linha 3 ("Turma: ... | Bairro: ... | Faixa: ... | Período: ..."):
  - **"Turma:"**, **"Bairro:"**, **"Faixa Etária:"**, **"Período:"** em negrito.
  - Renomear `Faixa` → `Faixa Etária`.
  - Valor do período: `tarde`/`manha` → **TARDE / MANHA** (MAIÚSCULO).
- Faixa cinza (fora do vínculo) precisa pintar de fato as células das datas anteriores ao ingresso/posteriores à saída (ex.: Angela Noemi C9:J9 deveria estar cinza no PDF; participante "não estava inserida no mês de abril" deveria sair da lista ou ficar 100 % cinza).
- Datas tipo `2026-04-30` → formatar como **DD/MM/AA**.
- Bordas pretas 0,5 pt em todas as células com informação.

### B.3 — Aba "Resumo"

- Títulos de seção em **negrito**: ATENDIDOS NO MÊS, POR BAIRRO, POR FAIXA ETÁRIA, POR PERÍODO, NOVAS INSERÇÕES NO MÊS, TOTAL GERAL.
- Nomes de bairro em negrito: ALVORADA, PARQUE INDEPENDENCIA, JARDIM IRENE.
- Coluna `Quant.` → atualizar para puxar números corretos.
- Valores `tarde`/`manha` → `Tarde` / `Manha`.

### B.4 — Aba "Ativ" (Atividades Propostas × Desenvolvidas)

- Título "ATIVIDADES PROPOSTAS x DESENVOLVIDAS" em **negrito**.
- Coluna **"Resultados Alcançados"**: corrigir alinhamento e bordas.
- "Mês: Abril / 2026" → MAIÚSCULO.

### B.5 — Aba "Metas"

- Título "METAS PROPOSTAS — ACOMPANHAMENTO MENSAL" em **negrito**.
- "Mês: Abril / 2026" → MAIÚSCULO.
- Coluna "Resultados Alcançados": ajuste de dados e bordas.
- Inserir bordas 0,5 pt pretas em todas as linhas com informação.

### Onde aplicar (técnico)

- Edge function `supabase/functions/generate-relatorio-mensal/index.ts` (geradora da planilha). Toda a estilização (fontes, fills, bordas, formato de data, MAIÚSCULAS, negritos) é montada lá com `xlsx-js-style`.
- Para a faixa cinza "fora do vínculo": revisar a montagem da matriz nas abas por turma (mesma função) — usar `data_entrada`/`data_saida` de `turma_participantes` para pintar o range corretamente, e excluir participantes sem vínculo no mês.

---

## Sequência sugerida

1. **Frente A primeiro** (apenas leitura + geração de PDF em `/mnt/documents/`) — entrega imediata, não toca em código.
2. **Frente B depois** — alterações na edge function + redeploy + nova exportação de teste para validar o layout.

Posso iniciar pela Frente A (relatório) e na sequência aplicar a Frente B (correções do exportador), ou inverter a ordem se preferir.