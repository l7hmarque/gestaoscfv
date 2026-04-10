

## Relatório Institucional Unificado — Proposta de Formato

Com base na análise completa do sistema, proponho a criação de um **"Relatório de Gestão e Prestação de Contas do SCFV"** em PDF profissional, que atenda simultaneamente Secretaria de Assistência Social, Controladoria, CRAS, gestão interna e editais de captação.

### Dados disponíveis no sistema hoje

| Dimensão | Dados concretos |
|---|---|
| **Público atendido** | 189 ativos, 96M/93F, distribuídos em 3 bairros (Jd. Irene 89, Alvorada 51, Pq. Independência 49) |
| **Faixa etária** | 6-8 (43), 9-11 (81), 12-14 (56), 15-17 (5), 60+ (1) |
| **Cor/raça** | Parda 117, Branca 55, Preta 8 |
| **Moradia** | Própria 27, Alugada 26, Cedida 6 |
| **Saúde/laudos** | TDAH (4+), asma, epilepsia, BPC — dados de medicação contínua |
| **Turmas** | 21 ativas, 3 núcleos territoriais, manhã (118) e tarde (71) |
| **Equipe** | 12 profissionais: 2 educadores, 2 oficineiros, 1 A.S., 1 psicóloga, 1 motorista, coordenação |
| **Pedagógico** | 22 planejamentos, 2 relatórios com Score ELO e competências (5 dimensões) |
| **Frequência** | 63 registros de presença vinculados a relatórios |
| **Atendimentos técnicos** | 1 (busca ativa) — estrutura para individual, grupal, familiar, encaminhamentos |
| **Financeiro** | 10 rubricas orçamentárias (3.1.90.xx a 4.4.90.52), 2 orçamentos, sem despesas lançadas ainda |

---

### Estrutura proposta do relatório (PDF + XLSX)

#### CAPA
- Logo institucional + brasão do município
- Título: "Relatório de Gestão — SCFV/SCNSA"
- Período de referência (mês ou trimestre)
- Nº do Termo de Colaboração / Plano de Trabalho

#### 1. IDENTIFICAÇÃO INSTITUCIONAL
- Dados da OSC (CNPJ, endereço, presidente)
- Dados do Termo de Colaboração (nº, vigência, objeto)
- Equipe técnica com cargo e carga horária

#### 2. PÚBLICO ATENDIDO (dados já disponíveis)
- Total de atendidos por período (manhã/tarde)
- Distribuição por faixa etária (tabela + gráfico)
- Distribuição por gênero
- Distribuição por cor/raça autodeclarada
- Distribuição territorial (por bairro/núcleo)
- Situação de moradia
- Perfil de saúde/neurodiversidade (quantitativo, sem nomes)
- Movimentação: ingressos, desligamentos, transferências no período
- Comparativo de metas x atendidos (por bairro, conforme tabela `bairros.meta_*`)

#### 3. ATIVIDADES PEDAGÓGICAS
- Total de atividades realizadas no período
- Tipos de atividade (Momento Educando, Oficinas, Eventos, etc.)
- Planejamentos elaborados x executados
- Score ELO médio e evolução mensal
- Radar de competências (Iniciativa, Autonomia, Colaboração, Comunicação, Respeito Mútuo)
- Taxa de adesão média
- Objetivo alcançado (distribuição: sim/parcial/não)
- Ranking de educadores por volume de atividades

#### 4. FREQUÊNCIA E BUSCA ATIVA
- Taxa de frequência geral
- Frequência por turma (matriz resumida)
- Participantes em alerta (3+ faltas consecutivas)
- Ações de Busca Ativa realizadas (tipo de contato, resultado)
- Taxa de retorno pós-busca ativa

#### 5. ATENDIMENTOS TÉCNICOS (Serviço Social + Psicologia)
- Quantitativo por tipo (individual, grupal, familiar, visita domiciliar, busca ativa)
- Encaminhamentos realizados (CRAS, CREAS, saúde, educação)
- Atendimentos sigilosos (apenas quantitativo)

#### 6. EXECUÇÃO FINANCEIRA
- Resumo de receitas (parcelas recebidas)
- Despesas por rubrica (código x descrição x previsto x executado x saldo)
- Percentual de execução por categoria
- Estornos/devoluções
- Saldo geral
- Achados da auditoria automatizada (erros/alertas)

#### 7. TRANSPORTE
- Pontos de embarque ativos
- Participantes por ponto
- Rotas e horários

#### 8. INDICADORES DE RESULTADO (para captação de recursos)
- Custo por atendido/mês
- Taxa de permanência (1 - taxa de evasão)
- Evolução do Score ELO (impacto pedagógico mensurável)
- Cobertura territorial (% da meta atingida por bairro)
- Razão técnico/atendidos

#### 9. REGISTROS FOTOGRÁFICOS
- Fotos das atividades (do `relatorio_fotos`) com legendas

#### 10. ANEXOS
- Lista nominal de atendidos (para Secretaria/CRAS)
- Matrizes de frequência por turma
- Cópia dos relatórios de atividade

---

### Implementação técnica

| Item | Detalhe |
|---|---|
| **Arquivo** | Novo `src/hooks/useRelatorioGestao.ts` + seção na página de exportação |
| **Formatos** | PDF (jsPDF + autoTable) + XLSX (xlsx-js-style) |
| **Entrada** | Seletor de período (mês ou intervalo de meses) |
| **Dados** | Todas as queries acima consolidadas em um único fetch |
| **Gráficos no PDF** | Tabelas estilizadas (barras ASCII ou cells coloridas) — compatível com impressão P&B |
| **Acesso** | Roles `coordenacao` e `tecnico` |
| **Localização** | Nova aba "Relatório de Gestão" no Dashboard ou na página Exportar Relatórios |

### Alterações necessárias
1. Criar hook `useRelatorioGestao.ts` com toda a lógica de coleta e cálculo
2. Criar função geradora de PDF institucional com as 10 seções
3. Criar função geradora de XLSX com abas por seção
4. Adicionar aba/botão na página de exportação de relatórios
5. Nenhuma alteração de banco de dados necessária — todos os dados já existem

