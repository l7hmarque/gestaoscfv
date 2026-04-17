

## Diagnóstico

Os educadores relatam dois problemas na lista de presença:
1. **Nomes de desligados aparecendo** — vínculos órfãos em `turma_participantes` (sem `data_saida`) mesmo com `participantes.status='desligado'`
2. **Nomes de ativos faltando** — provavelmente foram removidos das turmas pela auto-transferência de período (relatórios marcam `data_saida` na turma origem e tentam vincular em outra turma do período correto, mas se não existir turma compatível, o aluno fica sem vínculo)

A causa raiz é a funcionalidade **auto-transferência de período via relatório** (mem://funcionalidades/auto-transferencia-periodo-relatorio) que altera vínculos `turma_participantes` automaticamente sempre que um educador marca presença em período diferente do cadastrado no participante.

## Recomendação

Concordo: **remover a auto-transferência de período** e voltar ao comportamento confiável anterior — relatórios de atividade NÃO mexem em vínculos de turma nem em período do participante. Mudanças de período devem ser explícitas (via perfil do participante, com aprovação da coordenação como já existe em `participante_transferencias`).

Em vez de reverter o projeto inteiro (perderia features boas adicionadas depois), faço um **rollback cirúrgico** dessa funcionalidade + limpeza dos dados afetados.

## Plano

### 1. Remover lógica de auto-transferência
- **`RelatorioNovoPage.tsx`** (`handleSave`): remover o bloco que detecta divergência de período e atualiza `participantes.periodo` + `turma_participantes`. Manter apenas: salvar relatório, presenças, fotos, relatos, busca ativa. **Sem mexer em vínculos de turma.**
- Manter `periodo_atividade` no relatório (campo informativo apenas, não dispara ações).

### 2. Limpar vínculos órfãos de desligados
Migration única:
```sql
UPDATE turma_participantes tp
SET data_saida = COALESCE(p.data_desligamento, current_date),
    motivo_saida = 'Desligamento (limpeza retroativa)'
FROM participantes p
WHERE tp.participante_id = p.id
  AND p.status = 'desligado'
  AND tp.data_saida IS NULL;
```

### 3. Restaurar ativos sem turma
Detectar participantes ativos (`status IN ('ativo','busca_ativa')`) que ficaram **sem nenhum vínculo ativo** após auto-transferências indevidas, e re-vincular à turma compatível (mesmo bairro + faixa etária + período). Migration:
```sql
-- Para cada participante ativo sem vínculo ativo, achar turma compatível e inserir vínculo
INSERT INTO turma_participantes (participante_id, turma_id, data_entrada)
SELECT p.id, t.id, current_date
FROM participantes p
JOIN turmas t ON t.ativa = true
  AND t.bairro_id = p.bairro_id
  AND t.periodo::text = p.periodo::text
  -- match faixa etária via array de turma OR coluna única
WHERE p.status IN ('ativo','busca_ativa')
  AND NOT EXISTS (
    SELECT 1 FROM turma_participantes tp
    WHERE tp.participante_id = p.id AND tp.data_saida IS NULL
  );
```
Antes de rodar, vou listar os afetados para o usuário aprovar (pode ter casos onde não há turma compatível e precisa criar manualmente).

### 4. Atualizar memória
Substituir `mem://funcionalidades/auto-transferencia-periodo-relatorio` por nota dizendo que a funcionalidade foi removida em 17/04/2026 por causar dessincronização de vínculos.

### Ordem de execução
1. Remover código de auto-transferência em `RelatorioNovoPage.tsx`
2. Diagnóstico SQL: listar quantos órfãos de desligados + quantos ativos sem turma + quantos sem turma compatível
3. Migration de limpeza (vínculos órfãos)
4. Migration de restauração (ativos sem turma → turma compatível)
5. Reportar ao usuário a lista de ativos sem turma compatível (para resolução manual)
6. Atualizar memória

### Não-objetivos
- **Não vou reverter por checkpoint do histórico** — perderia features importantes (Encaminhamentos, recados↔atendimentos, etc.). Se preferir reverter por histórico mesmo, me avise e eu te mostro o painel.

