## Causa raiz

A função `public.recalcular_vinculos_turmas()` faz `SELECT ... LIMIT 1` por participante e depois `DELETE` de todos os outros vínculos. Resultado: cada participante fica em apenas UMA turma — a primeira que casa por bairro+faixa+período, em ordem alfabética de nome. Como as turmas legacy "ALVORADA — …" e "DANCA E POESIA — …" vencem o sort, as turmas de **KARATE**, **ESPORTE E RECREACAO** e **ATIVIDADES CULTURAIS E ARTISTICAS** nunca recebem ninguém.

## Mudança

Reescrever a função para iterar por **oficina** e garantir 1 turma por oficina por participante. Cada participante elegível (ativo/busca_ativa, não-teste, com bairro, período e faixa válidos) passa a aparecer em todas as oficinas compatíveis.

### Nova lógica (resumo)

```text
para cada participante elegível:
  calcula faixa (6-8 | 9-11 | 12-17 | idosos)
  para cada oficina distinta em turmas.ativa:
    escolhe 1 turma onde:
      oficina = oficina_iter
      ativa = true
      (bairro_id = part.bairro_id OR part.bairro_id ∈ bairro_ids)
      (faixa_etaria = faixa OR faixa ∈ faixas_etarias)
      (periodo = part.periodo OR periodo = 'integral')
    se já existe vínculo nessa oficina (em qualquer turma daquela oficina),
      mantém esse — não troca arbitrariamente
    senão insere o vínculo
  remove vínculos do participante em turmas cuja oficina não é mais compatível
  ou cuja turma específica não é mais a escolhida E não tem histórico (data_entrada hoje)
```

Detalhes importantes:

- **Não apaga vínculos com `data_entrada` antiga** — preserva histórico mensal usado por `get_participantes_turma` (que filtra por mês).
- Turmas **legacy sem oficina** (ex.: "ALVORADA — 9-11 — Manhã") são tratadas como uma "oficina" própria (valor de `oficina` é NULL) — vamos **ignorá-las no agrupamento por oficina** para não competir com as oficinas reais. Ficam visíveis mas vazias até a coordenação decidir arquivá-las.
- Participantes sem turma compatível continuam reportados em `sem_turma_lista`.

### Passos

1. **Migration** — substituir `recalcular_vinculos_turmas()` por nova versão iterando por `oficina IS NOT NULL` e fazendo upsert/limpeza seletiva.
2. **Insert** — executar `SELECT public.recalcular_vinculos_turmas();` uma vez para popular vínculos.
3. **Memória** — atualizar `mem://funcionalidades/turma-auto-vinculacao-logica` para refletir "1 turma por oficina, não 1 turma absoluta".

## Riscos

- Se um participante já tinha presença registrada em turma legacy "ALVORADA — 9-11 — Manhã", o vínculo continua existindo (não removemos vínculos com histórico). A nova lógica só adiciona vínculos nas oficinas reais.
- Volume: hoje há ~150 participantes ativos × ~4 oficinas = ~600 vínculos. Sem problema.
- Relatórios/Presença já filtram por turma específica — não há efeito colateral em totais (cada presença é por turma+data).

## Arquivos

- `supabase/migrations/<timestamp>_recalcular_vinculos_por_oficina.sql` (nova migration)
- `.lovable/memory/funcionalidades/turma-auto-vinculacao-logica.md` (atualizar)

Sem mudanças de UI nesta etapa.
