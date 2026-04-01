

## Plano: Tabelas "Metas Propostas" e "Monitoramento e Avaliação" no Relatório Mensal XLSX

### Resumo

Adicionar duas novas sheets ao relatório mensal XLSX, formatadas com bordas e cabeçalhos em negrito para fácil cópia pro Word.

---

### Sheet "Metas Propostas" (baseada na imagem 1)

**Estrutura fixa de 4 colunas**: Metas Propostas | Quant. | Resultados Alcançados | Justificativa

**Dados por bairro (valores fixos da primeira coluna)**:

- **Jardim Irene**: meta 200 crianças (manhã e tarde), 30 idosos
- **Parque Independência**: meta 60 crianças manhã, 60 crianças tarde, 30 idosos
- **Parque Alvorada**: meta 60 crianças manhã, 60 crianças tarde (sem idosos)
- **TOTAL GERAL**: soma

**Coluna "Quant."** — calculada automaticamente a partir dos dados do mês:
- Nº de crianças atendidas no bairro, período manhã (participantes com presença no mês em turmas daquele bairro com período "manha", idade < 60)
- Nº de crianças atendidas no bairro, período tarde
- % da soma em relação à meta (ex: "85% de atendidos em relação à meta")
- Nº de idosos atendidos (idade ≥ 60) — exceto Alvorada

**Coluna "Resultados Alcançados"** — para cada bairro, concatenar/resumir os `analise_ia` dos relatórios de atividades cujas turmas pertencem àquele bairro no mês.

**Coluna "Justificativa"** — vazia por enquanto.

**Lógica de cruzamento**:
1. Filtrar turmas ativas por `bairro_id` → mapear para nome do bairro SCFV
2. Para cada turma do bairro, buscar participantes com presença `presente=true` no mês
3. Classificar por idade (criança vs idoso) e período da turma (manhã/tarde)
4. Contar participantes únicos por combinação bairro+período+tipo
5. Para resultados alcançados: filtrar `relatorios_atividade` via `relatorio_turmas` → turmas do bairro → concatenar `analise_ia`

---

### Sheet "Monitoramento" (baseada na imagem 2)

**Estrutura de 4 colunas**: Objetivo | Indicador | Meta Prevista | Meta Atingida

**Linhas fixas baseadas nos objetivos do SCFV**:

1. **Assegurar espaços de referência para convívio grupal...** | Participação nas atividades sócio educacionais | 100% | calculado: % de presença geral no mês
2. **Possibilitar o desenvolvimento de potencialidades...** | Participação nas atividades culturais, esportivas e sócio educacionais | 100% | calculado: baseado na diversidade de tipos de atividade
3. **Contribuir para inserção/permanência no sistema sócio educacional** | Matrícula, rendimento e frequência | 100% | calculado: % de participantes ativos com frequência ≥ 75%
4. **Promover o acesso aos benefícios e serviços socioassistenciais** | Quantidade de beneficiários encaminhados para proteção social | 100% | 100% (fixo)

---

### Detalhes técnicos

- Ambas as sheets usam bordas em todas as células e cabeçalhos em negrito com fundo cinza
- Larguras de coluna otimizadas para cópia pro Word
- Os dados já são carregados na `generate()` (presencas, turmas, bairros, relatorios, turmaParticipantes)
- Precisa buscar `relatorio_turmas` para vincular relatórios a turmas/bairros

---

### Arquivo modificado

| Arquivo | Mudança |
|---|---|
| `src/pages/dashboard/DashboardRelatorioMensalTab.tsx` | Adicionar sheets "Metas" e "Monitoramento" com dados calculados e formatação para Word |

