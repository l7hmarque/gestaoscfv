## Geração dos Relatórios REO e RMA — Junho/2026 (01/06 a 25/06)

Entrega: **1 arquivo XLSX** com múltiplas abas + **1 arquivo ZIP** com as fotos do mês, ambos salvos em `/mnt/documents/` para download direto.

### Arquivo 1 — `SysCFV_REO-RMA_Junho2026_{timestamp}.xlsx`

Abas:

1. **Capa** — Cabeçalho institucional, período (01–25/06/2026), metas territoriais, data de emissão.

2. **REO — Atividades** — Tabela comparativa:
   - Atividades **planejadas** em Junho (de `planejamentos` por `data_aplicacao`).
   - Atividades **realizadas** em Junho (de `relatorios_atividade` por `iniciou_em`).
   - Coluna "Resultado Alcançado" por atividade — texto breve técnico ancorado nas diretrizes SCFV (Tipificação Nacional / Resolução CNAS 109/2009 e Caderno de Orientações Técnicas SCFV), gerada a partir do tema/objetivos/tipo de cada atividade.

3. **REO — Resultado Consolidado** — Síntese técnica geral do mês, consolidando os resultados individuais (fortalecimento de vínculos, prevenção de situações de risco, convivência intergeracional, etc., conforme SCFV).

4. **REO — Participantes (Crianças e Adolescentes)** — Apenas participantes ≤17 anos que tiveram **pelo menos 1 presença=true em Junho**, cruzando por:
   - Bairro: Jardim Irene / Parque Independência / Alvorada
   - Faixa etária: **Abaixo da faixa (<6)**, 6–8, 9–11, 12–17
   - Totais por linha/coluna
   - % do total geral em relação à **meta de 440**

5. **RMA** — Total único (desduplicado) de crianças e adolescentes com ≥1 presença no mês, e matriz **Gênero × Faixa Etária**:
   - Feminino: <6, 6–8, 9–11, 12–14, 15–17, Total
   - Masculino: <6, 6–8, 9–11, 12–14, 15–17, Total

6. **Listas de Presença — {Profissional}** (uma aba por `registrado_por`) — Mesmo formato da entrega anterior: participantes nas linhas, datas de Junho nas colunas, presença marcada com `■`, estilo grayscale, nomes em Title Case. Filtra apenas crianças/adolescentes (≤17).

### Arquivo 2 — `SysCFV_Fotos_Junho2026_{timestamp}.zip`

- Fotos com `created_at` em Junho/2026 vindas de `relatorio_fotos` **+** `registros_fotograficos`.
- Baixadas do storage, convertidas para `.jpeg` quando necessário, renomeadas como `{origem}_{data}_{seq}.jpeg`.
- ZIP plano (sem subpastas) para anexar diretamente no processo.

### Regras aplicadas (de acordo com memória do projeto)

- Idade calculada em 30/06/2026; **exclui >17 anos** em todas as contagens do REO e RMA.
- Exclui registros `is_teste=true`.
- Considera o marco operacional ≥ 01/04/2026 (irrelevante aqui pois recorte é Junho).
- Desduplicação por `participante_id` (1 presença basta).
- Estilo de exportação institucional: grayscale, datas `DD/MM`, presença `■`, fonte profissional, nome padronizado `SysCFV_...`.

### Execução

Tudo será gerado por um script Python único (`openpyxl` + `requests` + `zipfile`) rodando no sandbox via `code--exec`, consultando o banco via `psql`/`supabase--read_query` e baixando fotos pelo Storage público. Após gerar, faço QA visual das abas-chave e entrego com tags `<presentation-artifact>` para o XLSX e o ZIP.

### Observação técnica

Como é uma entrega de artefato (não há mudança no app), nenhum arquivo do projeto será alterado e nenhuma migração será criada.