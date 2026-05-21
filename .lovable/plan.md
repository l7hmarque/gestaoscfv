## Limpeza de turmas antigas

Após criar as 38 turmas novas no padrão `OFICINA — FAIXA — BAIRRO`, restaram 13 turmas antigas que ficaram redundantes. Plano para removê-las com segurança.

### Turmas a apagar (13)

**KARATÊ antigas (12):** todas no formato `KARATE - {faixa} - {periodo} - {bairro}` (com hífen simples e `JD. IRENE`). 11 estão sem vínculos; 1 (`KARATE - 6-8 - TARDE - ALVORADA`) tem 1 participante.

**DANÇA antiga (1):** `DANÇA E POESIA - JARDIM IRENE - 6-8 - MANHA` — 14 participantes vinculados.

### Estratégia

1. **Soft delete** (`ativa = false`) em vez de DELETE físico — preserva histórico de relatórios, presenças e listas de chamada já emitidas que referenciam essas turmas.
2. **Antes do soft delete**, rodar `recalcular_vinculos_turmas()` novamente para garantir que os 15 participantes ainda vinculados sejam realocados às turmas novas equivalentes (bate por bairro + faixa + período).
3. Registrar no `audit_log` a desativação com justificativa "Substituída por turma no novo padrão de nomenclatura — 21/05/2026".

### Por que soft delete e não DELETE

Relatórios de atividades, listas de chamada de maio, frequência e planejamentos antigos têm FK para `turma_id`. Apagar fisicamente quebraria a rastreabilidade do mês de abril/maio. A turma some da UI ativa mas o histórico permanece consultável.

### Observação sobre os 252 removidos

Não é necessária ação. Foi limpeza correta de vínculos inconsistentes (participantes desligados, com bairro/idade incompatíveis, ou em turmas erradas). Essa é exatamente a higienização que destrava o problema que você reportou nas listas de chamada com nomes "fantasma".

### Pós-execução

Reportar:
- Quantos participantes foram realocados das 13 antigas para as novas
- Confirmação de que as 13 ficaram `ativa = false`
- Se sobrou algum participante "órfão" (sem turma compatível)
