## Diagnóstico

Hoje há **69 turmas** com 2 modelos misturados:
- **18 genéricas** (`ALVORADA — 6-8 — Manhã`) — sobra do modelo antigo, sem oficina
- **51 por oficina** (KARATE, DANÇA E POESIA, ESPORTE E RECREAÇÃO, ATIVIDADES CULTURAIS E ARTÍSTICAS)
- **13 inativas** já marcadas como `ativa=false`
- Várias turmas de oficina com **mesmo nome** entre Manhã e Tarde (o período não aparece no nome)

Como a chamada é por oficina, as genéricas viraram só "ruído". Vou consolidar tudo no modelo por oficina.

## O que vou fazer

### 1. Desativar as 18 turmas genéricas (sem oficina)
- Marcar `ativa = false` em todas as turmas onde `oficina IS NULL` ou `oficina = ''`.
- **Não excluir** — elas têm presenças/relatórios históricos vinculados que precisam ser preservados.
- Resultado: somem dos seletores de chamada, presença, relatórios novos.

### 2. Renomear turmas de oficina incluindo o período
Padrão novo: `OFICINA — FAIXA — BAIRRO — PERÍODO`

Exemplos:
- `KARATE — 6-8 — ALVORADA` (manhã) → `KARATE — 6-8 — ALVORADA — Manhã`
- `KARATE — 6-8 — ALVORADA` (tarde) → `KARATE — 6-8 — ALVORADA — Tarde`
- Acaba a colisão de nomes idênticos entre turnos.

### 3. Excluir definitivamente turmas inativas SEM histórico
Para cada uma das 13 inativas, checar se há vínculos em:
- `presenca`, `relatorio_turmas`, `turma_participantes`, `planejamento_turmas`, `cronograma_slots`, `chamadas_assinadas`

Se **zero vínculos em todas** → `DELETE`. Se tiver qualquer histórico → **mantém inativa** (já estava assim).
Registrar a exclusão em `audit_log`.

### 4. Organizar a UI de seleção de turmas
Hoje o `<Select>` de turmas mostra lista plana (já com grupo Manhã/Tarde em /presenca). Vou padronizar em todos os pontos para usar **3 níveis hierárquicos**:

```text
BAIRRO  (JARDIM IRENE / ALVORADA / PARQUE INDEPENDÊNCIA)
 └── PERÍODO  (Manhã / Tarde / Idosos)
      └── OFICINA — FAIXA  (KARATE 6-8, DANÇA 9-11, …)
```

Pontos afetados:
- `src/pages/presenca/PresencaPage.tsx`
- `src/pages/relatorios/RelatorioNovoPage.tsx`
- `src/pages/turmas/TurmasPage.tsx` (lista geral)
- qualquer outro `<Select>` de turma que use a mesma lista

Idosos ganham seu próprio grupo (ficam visualmente separados das crianças).

### 5. Atualizar a constraint de nomenclatura
Atualizar a memória `mem://constraints/nomenclatura-turmas` para o novo padrão `OFICINA — FAIXA — BAIRRO — PERÍODO`, e o validador em `TurmaNovaPage` (se existir checagem) para o novo formato.

## O que **NÃO** vou fazer agora (conforme você pediu)
- **Não mexer em turmas com 0 ou 1 participante** — ficam ativas, você revisa depois caso a caso.
- **Não alterar vínculos `turma_participantes`** — eles já foram reorganizados na rodada anterior (1 turma por oficina).
- **Não tocar em presenças, relatórios ou planejamentos passados.**

## Detalhes técnicos

- 3 migrations leves (ou 1 migration + 1 chamada de dados):
  1. `UPDATE turmas SET ativa = false WHERE oficina IS NULL OR oficina = ''`
  2. `UPDATE turmas SET nome = oficina || ' — ' || faixa_etaria || ' — ' || <bairro> || ' — ' || CASE periodo WHEN 'manha' THEN 'Manhã' WHEN 'tarde' THEN 'Tarde' ELSE 'Integral' END WHERE oficina IS NOT NULL AND oficina <> ''`
  3. `DELETE FROM turmas WHERE ativa = false AND id NOT IN (SELECT turma_id FROM presenca UNION SELECT turma_id FROM relatorio_turmas UNION SELECT turma_id FROM turma_participantes UNION …)` — com `audit_log` antes.
- UI: extrair `<TurmaSelect bairros={…} turmas={…}/>` em `src/components/TurmaSelect.tsx` para reuso e usar `SelectGroup` aninhado por bairro/período.
- Sem mudanças em RLS, edge functions, ou schema.

## Resultado esperado
- De 69 → ~38 turmas ativas (só por oficina), todas com nome único.
- Seleção em 3 cliques lógicos (bairro → período → oficina/faixa).
- Histórico 100% preservado.
