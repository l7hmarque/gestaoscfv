## O que a auditoria mostrou

A marcação de ausência pelo educador não é o que mantém o nome na lista. O problema é anterior: a geração da planilha escolhe quem entra na lista usando uma regra permissiva demais.

Para Maio/2026, a regra atual monta a lista assim:

- Usa o 1º dia do mês como referência.
- Inclui participantes em `busca_ativa` sem corte real para a lista oficial.
- Ainda permite desligados/transferidos em alguns casos do mês.
- Depois disso, as ausências/presenças apenas preenchem as células de quem já entrou.

Números da varredura de Maio/2026:

- Lista atual: 704 linhas de participantes/vínculos.
- Lista limpa recomendada: 601 linhas.
- Remoção estimada: 103 linhas.
- Dessas remoções, 94 são vínculos de participantes em `busca_ativa`.
- Esses nomes de busca ativa tinham 235 marcações em maio: 230 ausências e 5 presenças. Isso confirma que as faltas apareceram porque o nome já estava listado; a ausência não deveria decidir a permanência na lista oficial.
- Também há inconsistência de dados: existem participantes `ativos` com `busca_ativa_desde` preenchido. Isso precisa aparecer em auditoria, mas não deve bagunçar a lista oficial.

## Decisão técnica recomendada

Abandonar a regra de “busca ativa até 30 dias” para a Lista de Frequência preenchida oficial.

A lista oficial deve ser limpa e objetiva:

- Entra somente quem estava vinculado à turma no último dia do mês.
- Entra somente status `ativo` ou `cadastro_incompleto`.
- Sai quem está `busca_ativa`, `desligado`, transferido ou sem vínculo no último dia do mês.
- As presenças já lançadas desses removidos não serão apagadas; irão para aba de auditoria/inconsistências.

Isso resolve o problema de nomes “fantasma” sem destruir histórico.

## Plano seguro antes de aplicar em produção

### 1. Gerar uma planilha-preview, sem mexer na geração atual

Criar uma geração temporária/preview para Maio/2026 com o mesmo formato visual do Google Sheets atual, mas usando a regra limpa.

A planilha-preview terá:

- Uma aba por turma, já no formato final limpo.
- Aba `RESUMO`, comparando atual x limpo por turma.
- Aba `REMOVIDOS`, com nome, turma e motivo da remoção.
- Aba `INCONSISTÊNCIAS`, mostrando casos como:
  - busca ativa com presença marcada;
  - ativo com `busca_ativa_desde` preenchido;
  - desligado/transferido com presença no mês.

Essa etapa não altera o botão atual de `/documentos`.

### 2. Validar que a planilha-preview não quebrou nada

Antes de te mandar o link, validar:

- A função gerou sem erro.
- O Google Sheets abriu com as abas corretas.
- As turmas continuam com datas e cabeçalhos corretos.
- Nenhuma aba oficial contém `busca_ativa`, `desligado` ou vínculo encerrado.
- As presenças removidas ficaram preservadas na aba de auditoria, não perdidas.

### 3. Você avalia a planilha

Eu te envio o link da planilha-preview.

Você decide se:

- aplica exatamente assim;
- ajusta algum critério;
- ou descarta.

### 4. Só depois da sua confirmação, aplicar na geração real de `/documentos`

Se você aprovar, aí sim aplicar a correção oficial:

- Atualizar a função de banco `get_participantes_turma` com um modo novo e seguro, por exemplo `frequencia_oficial`.
- Alterar `generate-listas-frequencia-mes-gsheet` para usar a data do último dia do mês e esse modo limpo.
- Remover da lista oficial os marcadores `(BA)`, `(Desligado)`, `(Transferido)` e os traços `—` para pessoas que nem deveriam aparecer.
- Manter abas `Auditoria`/`Inconsistências` para rastreabilidade.
- Não mexer na Lista de Chamada em branco.
- Não apagar nenhum registro histórico de presença.

## Resultado esperado

A Lista de Frequência preenchida fica clean: só participantes realmente vinculados e ativos no fechamento do mês aparecem no corpo das turmas; casos problemáticos saem da lista oficial e ficam separados para conferência.