## Análise: Tags faltantes no DOCX do REO

Analisei o documento completo e mapeei todas as tabelas. Aqui está o status de cada seção:

---

### Tabelas que JÁ TÊM tags no DOCX


| Seção                  | Tags encontradas                                                                                                                                                                                                                                                                                                                                         |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1.1 Atividades**     | `{tabela_atividades_reo}` (apenas referência, a tabela de dados está vazia)                                                                                                                                                                                                                                                                              |
| **1.2 Equipe Técnica** | `{MES_ANO}`, `{COUNT_ATENDIMENTOS_COMUNIDADE}`, `{COUNT_ATENDIMENTOS_FAMILIARES}`, `{COUNT_ATENDIMENTOS_PARTICIPANTES}`, `{COUNT_ATENDIMENTOS_EDUCADORES}`, `{COUNT_ACOES_SOCIAIS}`, `{COUNT_ESTUDO_DE_CASO_REUNIAO REDE}`, `{COUNT_VISITAS_DOMICILIARES}`, `{COUNT_VISITAS_ESCOLARES}`, `{COUNT_APLICACAO_GRUPOS}`, `{COUNT_TOTAL_SERVICOS_EQ_TECNICA}` |


---

### Tabelas que NÃO TÊM tags (precisam ser adicionadas ao DOCX)


| Seção                                | O que falta                                                               | Tags sugeridas                                                                                                                                                                                                                                           |
| ------------------------------------ | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1.1 Atividades** (corpo da tabela) | As linhas de dados estão vazias — sem tags para preencher automaticamente | Precisa de um loop ou tag de tabela dinâmica                                                                                                                                                                                                             |
| **1.3 Comparativo de Metas**         | Colunas "Quant.", "Resultados Alcançados" e "Justificativa" estão vazias  | Tags por bairro: `{QUANT_JI_MANHA}`, `{QUANT_JI_TARDE}`, `{QUANT_JI_IDOSOS}`, `{QUANT_PI_MANHA}`, `{QUANT_PI_TARDE}`, `{QUANT_PI_IDOSOS}`, `{QUANT_ALV_MANHA}`, `{QUANT_ALV_TARDE}`, `{QUANT_TOTAL_GERAL}`, `{RESULT_JI}`, `{RESULT_PI}`, `{RESULT_ALV}` |
| **1.4 Recursos Humanos**             | Nomes estão fixos/hardcoded — sem tags                                    | Tags: `{tabela_recursos_humanos}` ou linhas com `{RH_NOME_1}`, `{RH_FUNCAO_1}`, `{RH_CH_1}` etc.                                                                                                                                                         |
| **1.5 Monitoramento e Avaliação**    | Colunas "Meta atingida" estão vazias ou fixas                             | Tags: `{META_ATINGIDA_1}`, `{META_ATINGIDA_2}`, `{META_ATINGIDA_3}`, `{META_ATINGIDA_4}`                                                                                                                                                                 |
| **2.1 Valores Transferidos**         | Dados fixos, sem tags                                                     | Tags: `{tabela_parcelas}` ou linhas individuais                                                                                                                                                                                                          |
| **2.2 Despesas Efetuadas**           | Dados fixos, sem tags                                                     | Tag: `{tabela_despesas}`                                                                                                                                                                                                                                 |
| **2.3 Resumo Financeiro**            | Valores fixos, sem tags                                                   | Tags: `{SALDO_ANTERIOR}`, `{VALORES_TRANSFERIDOS}`, `{RENDIMENTOS}`, `{VALORES_ESTORNADOS}`, `{VALOR_EXECUTADO}`, `{SALDO_MES_SEGUINTE}`                                                                                                                 |
| **2.4 Saldo por Categoria**          | Valores fixos, sem tags                                                   | Tag: `{tabela_saldo_categorias}`                                                                                                                                                                                                                         |
| **Anexos Fotográficos**              | Fotos fixas, sem tags                                                     | Tag: `{anexos_fotos}`                                                                                                                                                                                                                                    |


---

### Resumo: o que precisa ser feito

O DOCX modelo atual tem tags apenas na seção **1.2 (Equipe Técnica)**. Todas as outras tabelas estão com dados fixos/exemplo e precisam receber tags para automação.

**Há duas abordagens possíveis:**

1. **Você insere as tags manualmente no DOCX** — eu forneço a lista exata de tags para cada célula, você edita o modelo no Word e faz upload na aba Admin. Depois o sistema preenche via `docxtemplater`.
2. **O sistema gera o REO inteiro programaticamente** (sem template DOCX) — usando a biblioteca `docx-js`, o app monta o documento do zero com os dados corretos, replicando o layout do modelo. Não precisa de tags no DOCX.

A **opção 2 é mais confiável** porque:

- Tabelas dinâmicas (1.1 Atividades, 2.2 Despesas, 2.4 Categorias) têm número variável de linhas — `docxtemplater` com loops em tabelas é frágil
- Os anexos fotográficos precisam de inserção de imagens dinâmicas
- O layout é padronizado e raramente muda

### Plano de implementação (opção 2 — geração programática)

1. **Nova edge function `generate-reo**` que:
  - Recebe `{ mes, ano }`
  - Busca todos os dados necessários (planejamentos, relatórios, atendimentos, presença, financeiro, profiles, fotos)
  - Gera o DOCX completo usando `docx-js` (npm:docx) replicando o layout exato do modelo
  - Salva no Storage e retorna URL assinada
2. **Seções geradas automaticamente:**
  - 1.1: Tabela de atividades propostas × desenvolvidas (planejamentos + relatórios)
  - 1.2: Contagens de atendimentos por tipo (tabela `atendimentos`)
  - 1.3: Metas por bairro com quantitativos (presença + participantes)
  - 1.4: Recursos Humanos (tabela `profiles` com cargo e carga horária)
  - 1.5: Monitoramento com metas atingidas (indicadores de presença)
  - 2.1: Parcelas (tabela `parcelas_financeiras`)
  - 2.2: Despesas do mês (tabela `despesas`)
  - 2.3: Resumo financeiro (calculado)
  - 2.4: Saldo por categoria (tabela `categorias_financeiras` + `despesas` + `estornos`)
  - Anexos: Fotos dos relatórios do período
3. **UI no Dashboard** — Botão "Gerar REO (DOCX)" na aba Relatório Mensal
4. **Campo faltante no banco**: `profiles` não tem `carga_horaria` — adicionar via migração

### Arquivos


| Arquivo                                               | Mudança                                              |
| ----------------------------------------------------- | ---------------------------------------------------- |
| Migração SQL                                          | `ALTER TABLE profiles ADD COLUMN carga_horaria text` |
| `supabase/functions/generate-reo/index.ts`            | Nova edge function                                   |
| `src/pages/dashboard/DashboardRelatorioMensalTab.tsx` | Botão "Gerar REO"                                    |
