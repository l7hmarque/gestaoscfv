Plano de correção:

1. Corrigir os indicadores do dashboard
- Atualizar a função `get_dashboard_stats` para parar de converter `NULL` em `N/I` dentro do enum `periodo_enum`, que é a causa direta do erro `invalid input value for enum periodo_enum: "N/I"`.
- Manter a regra já solicitada: Participantes Ativos e delta calculados somente por participantes distintos com ao menos 1 presença no período.
- Ajustar o frontend para exibir erro real quando a RPC falhar, em vez de ficar eternamente em “Carregando indicadores...”.
- Corrigir o texto do tooltip que ainda diz “Sem filtro: cadastros com status ativo”, pois isso contradiz a regra atual.

2. Corrigir a sincronização mensal com o Drive
- Refatorar `sync-drive-modelos` para não depender de `EdgeRuntime.waitUntil` para preencher todos os arquivos; os logs indicam que o runtime encerra logo após a resposta, então o trabalho em background não está concluindo.
- Trocar para um modelo confiável por lotes: a chamada cria/usa a pasta do mês e processa uma quantidade pequena por execução, retornando progresso e `hasMore` para o cliente continuar chamando até terminar.
- Corrigir Listas de Presença: hoje a busca tenta `planejamentos(turma_id)`, mas `planejamentos` não tem `turma_id`; deve buscar turmas via `relatorio_turmas` e/ou `planejamento_turmas`.
- Corrigir REO: a chamada envia `format`, mas `generate-reo` espera `formato`; por isso não gera os anexos corretamente.
- Garantir que Planejamentos e Relatórios de Atividade sejam processados com progresso por lote para evitar timeout e arquivos incompletos.

3. Melhorar retorno visual da sincronização
- Atualizar o botão do Drive para mostrar progresso por categoria durante a execução.
- Exibir avisos/erros retornados no resultado final, incluindo quantos documentos foram gerados por Listas, Planejamentos, Relatórios e REO.
- Manter o atalho para abrir a pasta no Drive.

Validação após implementar:
- Testar a RPC `get_dashboard_stats` e confirmar que retorna JSON sem erro.
- Testar a função `sync-drive-modelos` para Abril/2026 e confirmar que ela retorna progresso em vez de timeout.
- Verificar no banco que há dados para Abril/2026: 37 relatórios, 13 planejamentos e 838 presenças, então a sincronização deve gerar conteúdo nessas categorias.