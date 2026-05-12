Plano para resolver o “processou, mas Despesas continua zerada”:

1. Corrigir a Caixa de Entrada
- Quando a IA terminar de extrair despesas dos PDFs, gravar imediatamente essas despesas na tabela `despesas`, sem depender de o usuário achar outro botão.
- Manter validação e normalização SIT já existentes: valor, data, favorecido, tipo de documento, pagamento, rubrica/categoria e anexos.
- Após salvar, remover da Caixa de Entrada apenas os arquivos realmente lançados e recarregar a aba Despesas.
- Se algum documento extrair 0 despesas, mostrar isso claramente e manter o arquivo na Caixa para diagnóstico.

2. Remover a contradição de interface
- Ajustar o texto que hoje diz “abra a aba Despesas para revisar e confirmar”, porque a aba Despesas não tem uma fila de revisão; ela só mostra registros já lançados.
- Trocar para um fluxo direto: “processou → lançou em despesas → pronto para exportar/regularizar”.

3. Sincronizar a exportação com a competência selecionada
- A tela financeira usa `mesRef`, mas o card de Exportação SIT tem um mês interno próprio; isso pode fazer a exportação dizer “sem dados” mesmo quando a tela está em outro mês.
- Passar o mês selecionado da página financeira para o card de exportação, ou unificar o estado de competência, para a lista, os totais e a exportação usarem o mesmo mês.

4. Manter a revisão detalhada como alternativa, não como caminho principal
- Deixar a aba “Revisão Detalhada” existindo para conferência manual quando necessário.
- A Caixa de Entrada, porém, fará o trabalho que você pediu: ler os PDFs e separar/lançar as despesas com os dados extraídos.

5. Validação final
- Conferir no banco se despesas foram criadas para o mês selecionado.
- Conferir que a aba Despesas carrega esses registros.
- Conferir que a exportação SIT passa a ver os mesmos dados do mês selecionado.