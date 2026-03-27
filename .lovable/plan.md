## Plano: Gerar Lista de Presença em PDF (individual ou em lote)

### Ideia central

Nova função na página `PresencaExportarPage` que gera listas de presença em branco (para impressão), com base nos **dias de atendimento** da turma e no **mês selecionado**. O PDF sai em formato A4 paisagem, com cabeçalho institucional, nomes dos participantes, colunas com as datas corretas (ex: todas as terças e quintas de abril) e quadradinhos vazios para marcar de caneta.

### Diferença da funcionalidade atual

A exportação atual ("Matriz de Frequência") usa datas de presenças **já registradas** no sistema. A nova função gera datas **futuras/planejadas** com base nos dias da semana da turma e mês escolhido, sem depender de registros existentes.

### Fluxo

1. Usuário acessa `/presenca/exportar`
2. Seleciona **mês/ano** (novo campo)
3. Aplica filtros de bairro/faixa/período (já existentes)
4. Clica "Gerar Lista de Presença (PDF)"
5. Para cada turma filtrada, o sistema:
  - Lê `turma.dias_semana` (ex: `["terca", "quinta"]`)
  - Calcula todas as datas do mês que caem nesses dias
  - Busca participantes da turma, ordena por nome
  - Gera PDF A4 paisagem com:
    - Cabeçalho: "SOCIEDADE CIVIL NOSSA SENHORA APARECIDA   
    Centro de Atenção Integral ao Adolescente - Medianeira"
    - Título: "Lista de Presença - SCFV"
    - Info: turma, bairro, período, faixa etária, mês/ano
    - Tabela: Nº | Nome | colunas de data (dd/MM) com quadradinhos `☐`
    - Rodapé: linha de assinatura do educador
6. Se em lote, gera um PDF por turma (download sequencial)

### Arquivos


| Arquivo                                       | Ação                                                                   |
| --------------------------------------------- | ---------------------------------------------------------------------- |
| `src/pages/presenca/PresencaExportarPage.tsx` | Adicionar seletor de mês/ano + botão "Gerar Lista de Presença (PDF)"   |
| `src/hooks/useDocumentExport.ts`              | Nova função `exportListaPresencaPdf(turma, participantes, datasDoMes)` |


### Detalhes do PDF

- Formato A4 paisagem
- Cabeçalho institucional (mesmo padrão da Matriz de Frequência)
- Colunas de data calculadas a partir de `dias_semana` da turma + mês selecionado
- Cada célula de presença contém `☐` (quadradinho vazio para marcar de caneta)
- Fontes pequenas (6-7pt) para caber muitas colunas
- Mapeamento de dias: `segunda→1, terca→2, quarta→3, quinta→4, sexta→5, sabado→6`