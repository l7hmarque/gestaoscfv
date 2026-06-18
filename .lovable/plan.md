## Causa raiz

As turmas de **Karate**, **Dança e Poesia** e **Atividades Culturais e Artísticas** estão sendo silenciosamente puladas na geração da planilha porque o campo `turmas.dias_semana` delas usa nomes **completos** (`segunda`, `terca`, `quarta`, `quinta`), mas o mapa de dias da semana na edge function só reconhece a forma **abreviada** (`seg`, `ter`, `qua`, `qui`, `sex`, `sab`, `dom`).

Trecho atual em `supabase/functions/generate-listas-frequencia-mes-gsheet/index.ts`:

```ts
const DIA_SEMANA_MAP: Record<string, number> = {
  dom: 0, seg: 1, ter: 2, qua: 3, qui: 4, sex: 5, sab: 6
};
```

Quando `diasDoMesPorSemana` recebe `["segunda","quarta"]`, todos os tokens caem no `filter(n => n !== undefined)` e o array de datas fica vazio → `buildTurmaSheet` retorna `null` → a aba é descartada (apenas incrementa `skipped` em "Auditoria").

Conferência no banco — convivem hoje os dois formatos no mesmo sistema:

```
[segunda terca]   ← KARATE Jardim Irene
[quarta]          ← KARATE Alvorada
[quinta]          ← KARATE / DANCA Parque Independência
[segunda quarta]  ← ATIVIDADES CULTURAIS E ARTISTICAS, DANCA E POESIA TODOS OS BAIRROS
[terca]           ← DANCA E POESIA Jardim Irene
[seg qua]         ← (outras turmas, funcionam)
[ter qui]         ← (outras turmas, funcionam)
[sex] / [qui]     ← (outras turmas, funcionam)
```

## Correção

Estender `DIA_SEMANA_MAP` para aceitar ambos os formatos, com normalização de acentos/caixa, mantendo retro-compatibilidade total:

```ts
const DIA_SEMANA_MAP: Record<string, number> = {
  dom: 0, domingo: 0,
  seg: 1, segunda: 1, "segunda-feira": 1,
  ter: 2, terca: 2, "terca-feira": 2,
  qua: 3, quarta: 3, "quarta-feira": 3,
  qui: 4, quinta: 4, "quinta-feira": 4,
  sex: 5, sexta: 5, "sexta-feira": 5,
  sab: 6, sabado: 6,
};
```

Ajustar `diasDoMesPorSemana` para normalizar antes do lookup:

```ts
const norm = (d: string) => String(d).toLowerCase()
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "")  // remove acentos
  .trim();
const targets = new Set((diasSemana || []).map(d => DIA_SEMANA_MAP[norm(d)]).filter(n => n !== undefined));
```

Deploy da function `generate-listas-frequencia-mes-gsheet` e regerar Maio/2026 para confirmar que Karate, Dança e Poesia e Atividades Culturais e Artísticas passam a aparecer.

## Escopo

- Apenas `supabase/functions/generate-listas-frequencia-mes-gsheet/index.ts`.
- Nenhuma mudança de schema, RLS, RPC ou frontend.
- Nenhuma migração de dados (não vou re-normalizar `turmas.dias_semana` para não criar efeito colateral em outras funções; a edge function passa a tolerar os dois formatos).
