

## Plano de Reclassificação dos 107 Participantes em Busca Ativa

### Diagnóstico real (dados consolidados de `presenca` + `relatorio_presenca`)

| Categoria | Quantidade | Ação |
|---|---|---|
| Tem presença em **Abril/2026** | **30** | → `ativo` |
| Última presença há < 30 dias (sem ser abril) | 0 | → manter `busca_ativa` |
| Última presença entre 30–90 dias | 0 | → manter `busca_ativa` |
| Última presença > 90 dias | 0 | → manter `busca_ativa` |
| Nunca teve presença + cadastro > 6 meses | **48** | → `desligado` (motivo: "Reclassificação automática — sem presença histórica") |
| Nunca teve presença + cadastro recente (< 6 meses ou sem `iniciou_em`) | **29** | → `ativo` |
| **TOTAL** | **107** | |

Observação: nenhum dos 107 cai nas faixas 30–90d ou >90d. A regra "presença > 90 dias mantém BA" fica registrada mas hoje não atinge ninguém.

### Análise de períodos (Mar+Abr/2026, base universal — 59 participantes ativos com presença)

| Período cadastrado | Vão só manhã | Vão só tarde | Vão ambos | Divergência |
|---|---|---|---|---|
| Manhã (44) | 5 | 0 | 39 | 0 |
| Tarde (15) | 0 | 1 | 14 | 0 |

**Nenhum participante tem cadastro divergente do período em que efetivamente comparece.** Os 53 que aparecem em manhã+tarde refletem turmas cruzadas (Karatê, oficinas) — comportamento esperado, sem ação.

### Operações a executar

1. **UPDATE 30 participantes**: `status='busca_ativa' → 'ativo'` (presença em abril/2026). Inserir `busca_ativa_registros` com `resultado='ja_retornou'` e `audit_log` "Reclassificação automática — presença confirmada em Abril/2026".
2. **UPDATE 29 participantes**: `status='busca_ativa' → 'ativo'` (cadastro recente, ainda não compareceram). `audit_log` "Reclassificação — cadastro recente sem presença, mantido como ativo aguardando início".
3. **UPDATE 48 participantes**: `status='busca_ativa' → 'desligado'`, `data_desligamento=CURRENT_DATE`, `motivo_desligamento='Sem frequência histórica'`, `justificativa_desligamento='Reclassificação automática 2026-04-16 — cadastro > 6 meses sem qualquer presença registrada'`. `audit_log` correspondente.
4. **Relatório XLSX em `/mnt/documents/`** com 3 abas: "Ativados por Presença Abril" (30), "Ativados Cadastro Recente" (29), "Desligados Sem Histórico" (48), com colunas: nome, bairro, período, iniciou_em, última presença.
5. **Relatório XLSX adicional**: "Análise de Períodos Mar+Abr/2026" — lista nominal dos 59 com colunas (nome, período cadastro, total presenças manhã, total presenças tarde, recomendação).

### Detalhes técnicos

- Todas as operações são `UPDATE`/`INSERT` em dados (não migration) → tool `supabase--read_query` com INSERT permitido via Lovable Cloud.
- Preserva histórico: `data_desligamento` e `motivo_desligamento` populados conforme padrão `mem://funcionalidades/desligamento-participantes`.
- Nenhuma alteração em `turma_participantes` — vínculos atuais permanecem (importante para os 30 que estão ativos efetivamente).
- Nenhuma alteração de schema/RLS/edge function.

### Ordem de execução

1. Gerar XLSX de pré-visualização (ler dados, sem escrever no banco).
2. Executar UPDATE dos 30 (abril) + audit_log + busca_ativa_registros.
3. Executar UPDATE dos 29 (cadastro recente) + audit_log.
4. Executar UPDATE dos 48 (desligados) + audit_log.
5. Confirmar contagem final: 0 em busca_ativa, +59 ativos, +48 desligados.

