

## Plano: Lógica Automática e Contínua de Busca Ativa

### Diagnóstico

Os 107 originais foram todos marcados em lote no dia 14/04 sem critério dinâmico. Minha reclassificação corrigiu o estoque podre, mas **não criou a regra contínua**. Por isso "zerou" e vai continuar zerado até alguém faltar muito — mas hoje **nada detecta isso automaticamente**.

### Regra a implementar

Um participante `ativo` vira `busca_ativa` quando atender QUALQUER um dos critérios:

1. **3 faltas consecutivas** nas últimas atividades da(s) turma(s) dele (já existe a query, é a usada no alerta do dashboard)
2. **14 dias corridos sem nenhuma presença** registrada, tendo histórico anterior

E volta para `ativo` automaticamente quando for marcado presente em qualquer atividade (isso já implementamos no `RelatorioNovoPage` e `PresencaPage`).

### Implementação técnica

**1. Função SQL `recalcular_busca_ativa()` (RPC)**
- Roda sobre todos os participantes `ativo` + `busca_ativa`
- Para cada um, checa as duas condições acima
- Atualiza `participantes.status` conforme o resultado
- Insere registro em `busca_ativa_registros` (motivo: "Detecção automática — N faltas consecutivas" ou "14 dias sem presença")
- Registra em `audit_log`

**2. Trigger de invocação**
- Edge function `recalcular-busca-ativa` que chama a RPC
- Botão manual em `EquipeTecnicaPage` aba Busca Ativa: "Recalcular agora"
- Chamada automática ao final de `handleSave` em `RelatorioNovoPage` (após cada relatório novo, recalcula só os participantes da turma daquele relatório — versão leve)

**3. Aplicação imediata após criar a função**
- Rodar `recalcular_busca_ativa()` uma vez agora
- Mostrar relatório XLSX: quantos voltaram para BA, com nome, turma, motivo (3 faltas / 14 dias), data da última presença

### Detalhes técnicos

- Migration: criar função `recalcular_busca_ativa()` como `SECURITY DEFINER`
- Edge function nova: `recalcular-busca-ativa` (chamável via botão)
- Hook leve no `handleSave` do relatório: roda só para os IDs daquela turma
- Sem mudança de schema — só função + edge function + 1 botão na UI

### Ordem de execução

1. Criar a função SQL
2. Criar edge function que invoca a RPC
3. Adicionar botão "Recalcular Busca Ativa" na aba Busca Ativa da Equipe Técnica
4. Integrar chamada leve no `handleSave` de `RelatorioNovoPage`
5. Rodar uma vez e gerar XLSX com a nova lista de busca ativa

